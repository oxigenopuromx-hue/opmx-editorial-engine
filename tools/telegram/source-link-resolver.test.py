import importlib.util
import io
import json
import pathlib
import socket
import subprocess
import sys
import time
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).with_name("source-link-resolver.py")
SPEC = importlib.util.spec_from_file_location("source_link_resolver", PATH)
m = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = m
SPEC.loader.exec_module(m)

SOURCE = "https://share.google/GHhvKh1alwdXhKLb4"
TARGET = "https://www.jdpower.com/business/es/mexico-vehicle-dependability-study-vds/"
ENV = {"HTTPS_PROXY": "http://proxy.example:8080", "NO_PROXY": "localhost,127.0.0.1"}


class Responses:
    def __init__(self, *values):
        self.values = list(values)
        self.calls = []

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        if not self.values:
            raise AssertionError("unexpected request")
        return self.values.pop(0)


class ResolverTests(unittest.TestCase):
    def resolve(self, *responses, url=SOURCE, env=None, **kwargs):
        observer = Responses(*responses)
        result = m.resolve_shared_link(url, environ=ENV if env is None else env, observer=observer, **kwargs)
        return result, observer.calls

    def test_real_incident_shape_resolves_final_504_without_verifying_content(self):
        result, calls = self.resolve(m.HttpObservation(302, TARGET), m.HttpObservation(504, media_type="text/html"))
        self.assertEqual(result["status"], "REDIRECT_RESOLVED")
        self.assertEqual(result["original_url"], SOURCE)
        self.assertEqual(result["final_url"], TARGET)
        self.assertEqual(result["final_http_status"], 504)
        self.assertFalse(result["source_content_verified"])
        self.assertFalse(result["publishing_authorized"])
        self.assertTrue(result["requires_content_review"])
        self.assertFalse(result["final_is_shared_wrapper"])
        self.assertEqual([c["url"] for c in calls], [SOURCE, TARGET])

    def test_final_timeout_keeps_only_address_candidate(self):
        result, calls = self.resolve(m.HttpObservation(302, TARGET), m.HttpObservation(error="REQUEST_TIMEOUT"))
        self.assertEqual(result["status"], "REDIRECT_RESOLVED")
        self.assertEqual(result["reason"], "FINAL_FETCH_UNCONFIRMED")
        self.assertEqual(result["final_url"], TARGET)
        self.assertIsNone(result["final_http_status"])
        self.assertFalse(result["source_content_verified"])

    def test_http_200_never_verifies_article_or_grants_publication(self):
        for statuses in [(302, 200), (307, 404)]:
            with self.subTest(statuses=statuses):
                result, _ = self.resolve(m.HttpObservation(statuses[0], TARGET), m.HttpObservation(statuses[1]))
                self.assertEqual(result["status"], "REDIRECT_RESOLVED")
                self.assertFalse(result["source_content_verified"])
                self.assertFalse(result["publishing_authorized"])

    def test_shortener_landing_page_is_not_canonical_article(self):
        result, calls = self.resolve(m.HttpObservation(200))
        self.assertEqual(result["status"], "NO_REDIRECT")
        self.assertTrue(result["final_is_shared_wrapper"])
        self.assertFalse(result["source_content_verified"])
        self.assertEqual(len(calls), 1)

    def test_generic_article_url_does_not_trigger_fallback_network(self):
        result, calls = self.resolve(url=TARGET)
        self.assertEqual(result["status"], "NOT_SHARED_LINK")
        self.assertEqual(calls, [])

    def test_supported_initial_hosts_are_exact_and_routes_bounded(self):
        for value in ["https://g.co/test", "https://share.google.com/test", "https://www.google.com/url?q=https%3A%2F%2Fwww.jdpower.com%2F", "https://www.google.com/share.google?q=GHhvKh1alwdXhKLb4", "https://news.google.com/articles/test"]:
            with self.subTest(value=value):
                result, calls = self.resolve(m.HttpObservation(302, TARGET), m.HttpObservation(200), url=value)
                self.assertEqual(result["status"], "REDIRECT_RESOLVED")
                self.assertEqual(len(calls), 2)
        for value in ["https://share.google.evil.com/test", "https://evilgoogle.com/url?q=x", "https://www.google.com/search?q=x", "https://share.google/"]:
            with self.subTest(value=value):
                result, calls = self.resolve(url=value)
                self.assertEqual(result["status"], "NOT_SHARED_LINK")
                self.assertFalse(calls)

    def test_only_https_public_hostname_addresses_are_eligible(self):
        bad = [
            "http://share.google/test", "file:///etc/passwd", "https://user@share.google/test",
            "https://user:password@share.google/test", "https://share.google:444/test",
            "https://127.0.0.1/test", "https://127.1/test", "https://2130706433/test",
            "https://0x7f000001/test", "https://0177.0.0.1/test", "https://[::1]/test",
            "https://[::ffff:127.0.0.1]/test", "https://localhost/test", "https://a.internal/test",
            "https://127.0.0.1.nip.io/test", "https://share.google./test", "https://share.google\\@evil.com/test",
            "https://share.google/test\nX:1", "https://%31%32%37.0.0.1/test",
        ]
        for url in bad:
            with self.subTest(url=url):
                result, calls = self.resolve(url=url)
                self.assertEqual(result["status"], "RESOLUTION_BLOCKED")
                self.assertIsNone(result["original_url"])
                self.assertFalse(calls)

    def test_secret_query_is_not_echoed_or_requested(self):
        for key in ["access_token", "APIKEY", "x-amz-signature", "session_id", "client_secret", "utm_token"]:
            with self.subTest(key=key):
                result, calls = self.resolve(url=SOURCE + "?" + key + "=PRIVATE_SENTINEL")
                self.assertEqual(result["reason"], "CREDENTIAL_URL_NOT_ALLOWED")
                self.assertNotIn("PRIVATE_SENTINEL", json.dumps(result))
                self.assertFalse(calls)

    def test_tracking_parameters_are_preserved_and_fragment_not_sent(self):
        url = SOURCE + "?utm_source=telegram#local-fragment"
        result, calls = self.resolve(m.HttpObservation(302, TARGET), m.HttpObservation(200), url=url)
        self.assertEqual(calls[0]["url"], SOURCE + "?utm_source=telegram")
        self.assertNotIn("#", result["original_url"])

    def test_google_encoded_target_cannot_echo_credentials(self):
        value = "https://www.google.com/url?q=https%3A%2F%2Fnews.example.org%2Fx%3Faccess_token%3DPRIVATE_SENTINEL"
        result, calls = self.resolve(url=value)
        self.assertEqual(result["reason"], "CREDENTIAL_URL_NOT_ALLOWED")
        self.assertNotIn("PRIVATE_SENTINEL", json.dumps(result))
        self.assertFalse(calls)

    def test_nested_url_schemes_are_case_insensitive_before_credential_check(self):
        for nested in ["HTTPS%3A%2F%2Fuser%3APRIVATE_SENTINEL%40jdpower.com%2F",
                       "Https%3A%2F%2Fjdpower.com%2F%3Ftoken%3DPRIVATE_SENTINEL"]:
            result, calls = self.resolve(url="https://www.google.com/url?q=" + nested)
            self.assertIn(result["reason"], ("CREDENTIAL_URL_NOT_ALLOWED", "URL_NOT_ALLOWED"))
            self.assertNotIn("PRIVATE_SENTINEL", json.dumps(result))
            self.assertFalse(calls)

    def test_isolated_unicode_surrogate_fails_without_trace_or_echo(self):
        result, calls = self.resolve(url="https://share.google/\ud800")
        self.assertEqual(result["reason"], "URL_NOT_ALLOWED")
        self.assertFalse(calls)
        done = subprocess.run([sys.executable, str(PATH)], input=b'{"url":"https://share.google/\\ud800"}', capture_output=True)
        self.assertEqual(done.returncode, 0)
        self.assertEqual(json.loads(done.stdout)["reason"], "URL_NOT_ALLOWED")
        self.assertEqual(done.stderr, b"")

    def test_cli_rejects_deep_json_without_raw_error(self):
        done = subprocess.run([sys.executable, str(PATH)], input=b"[" * 2000 + b"]" * 2000,
                              capture_output=True)
        self.assertEqual(done.returncode, 2)
        self.assertEqual(json.loads(done.stdout)["reason"], "INVALID_INPUT")
        self.assertEqual(done.stderr, b"")

    def test_google_share_wrapper_is_not_an_article_and_uses_get(self):
        wrapper = "https://www.google.com/share.google?q=GHhvKh1alwdXhKLb4"
        result, calls = self.resolve(m.HttpObservation(302, wrapper), m.HttpObservation(302, TARGET), m.HttpObservation(200))
        self.assertEqual([c["method"] for c in calls], ["HEAD", "GET", "HEAD"])
        self.assertEqual(result["final_url"], TARGET)
        self.assertFalse(result["final_is_shared_wrapper"])
        result, _ = self.resolve(m.HttpObservation(302, wrapper), m.HttpObservation(200))
        self.assertTrue(result["final_is_shared_wrapper"])
        self.assertFalse(result["source_content_verified"])

    def test_redirect_target_rejected_before_any_target_request(self):
        for target in ["//127.0.0.1/x", "http://www.jdpower.com/x", "https://x@www.jdpower.com/x", "https://a.local/x", "https://www.jdpower.com:8443/x", "https://www.jdpower.com/x?auth=PRIVATE_SENTINEL"]:
            with self.subTest(target=target):
                result, calls = self.resolve(m.HttpObservation(302, target))
                self.assertEqual(result["status"], "RESOLUTION_BLOCKED")
                self.assertIsNone(result["final_url"])
                self.assertEqual(len(calls), 1)
                self.assertNotIn("PRIVATE_SENTINEL", json.dumps(result))

    def test_relative_redirect_is_resolved_against_checked_url(self):
        result, calls = self.resolve(m.HttpObservation(302, "/second"), m.HttpObservation(302, TARGET), m.HttpObservation(200))
        self.assertEqual(calls[1]["url"], "https://share.google/second")
        self.assertEqual(result["final_url"], TARGET)

    def test_no_ambient_proxy_fails_before_network(self):
        for env in [{}, {"HTTPS_PROXY": "socks5://proxy.example:1080"}, {"HTTPS_PROXY": "not a proxy"}]:
            with self.subTest(env=env):
                result, calls = self.resolve(env=env)
                self.assertEqual(result["reason"], "PROXY_REQUIRED")
                self.assertFalse(calls)

    def test_inherited_proxy_environment_is_preserved(self):
        env = {**ENV, "https_proxy": "https://user:PRIVATE_SENTINEL@proxy.example", "UNCHANGED": "value"}
        result, calls = self.resolve(m.HttpObservation(200), env=env)
        self.assertIs(calls[0]["environ"], env)
        self.assertEqual(env["UNCHANGED"], "value")
        self.assertNotIn("PRIVATE_SENTINEL", json.dumps(result))

    def test_no_proxy_matching_routes_fail_before_the_target_hop(self):
        for entry in ["*", ".jdpower.com", "jdpower.com:443", "JDPOWER.COM", "*.jdpower.com"]:
            with self.subTest(entry=entry):
                env = {**ENV, "NO_PROXY": entry}
                result, calls = self.resolve(m.HttpObservation(302, TARGET), env=env)
                self.assertEqual(result["reason"], "NO_PROXY_ROUTE")
                self.assertLessEqual(len(calls), 1)
        result, calls = self.resolve(m.HttpObservation(200), env={**ENV, "no_proxy": "share.google"})
        self.assertEqual(result["reason"], "NO_PROXY_ROUTE")
        self.assertFalse(calls)

    def test_similar_no_proxy_domains_and_other_ports_do_not_match(self):
        result, calls = self.resolve(m.HttpObservation(302, TARGET), m.HttpObservation(200), env={**ENV, "NO_PROXY": "notjdpower.com,jdpower.com:444"})
        self.assertEqual(result["status"], "REDIRECT_RESOLVED")
        self.assertEqual(len(calls), 2)

    def test_dns_is_not_queried_locally(self):
        with patch.object(socket, "getaddrinfo", side_effect=AssertionError("local DNS forbidden")):
            result, _ = self.resolve(m.HttpObservation(302, TARGET), m.HttpObservation(200))
        self.assertEqual(result["status"], "REDIRECT_RESOLVED")

    def test_redirect_loop_and_limit_stop_without_repeated_requests(self):
        result, calls = self.resolve(m.HttpObservation(302, "/other"), m.HttpObservation(302, SOURCE))
        self.assertEqual(result["reason"], "REDIRECT_LOOP")
        self.assertEqual(len(calls), 2)
        results = [m.HttpObservation(302, "https://news.example.org/" + str(i)) for i in range(6)]
        result, calls = self.resolve(*results)
        self.assertEqual(result["reason"], "REDIRECT_LIMIT")
        self.assertEqual(len(calls), 6)

    def test_missing_location_is_never_guessed(self):
        result, calls = self.resolve(m.HttpObservation(302))
        self.assertEqual(result["reason"], "REDIRECT_WITHOUT_LOCATION")
        self.assertIsNone(result["final_url"])
        self.assertEqual(len(calls), 1)

    def test_only_shared_wrapper_head_405_501_gets_bounded_get_fallback(self):
        for status in (405, 501):
            with self.subTest(status=status):
                result, calls = self.resolve(m.HttpObservation(status), m.HttpObservation(302, TARGET), m.HttpObservation(200))
                self.assertEqual([c["method"] for c in calls], ["HEAD", "GET", "HEAD"])
                self.assertEqual(result["status"], "REDIRECT_RESOLVED")
        result, calls = self.resolve(m.HttpObservation(302, TARGET), m.HttpObservation(405))
        self.assertEqual(len(calls), 2)
        self.assertEqual(result["final_http_status"], 405)

    def test_transport_failure_has_fixed_code_no_raw_error(self):
        def broken(**kwargs):
            raise RuntimeError("PRIVATE_SENTINEL source contents credentials")
        result = m.resolve_shared_link(SOURCE, environ=ENV, observer=broken)
        self.assertEqual(result["reason"], "TRANSPORT_UNCONFIRMED")
        self.assertNotIn("PRIVATE_SENTINEL", json.dumps(result))

    def test_total_budget_stops_before_an_additional_request(self):
        times = iter([0.0, 0.0, 21.0])
        result, calls = self.resolve(m.HttpObservation(302, TARGET), clock=lambda: next(times))
        self.assertEqual(len(calls), 1)
        self.assertEqual(result["status"], "REDIRECT_RESOLVED")
        self.assertEqual(result["final_url"], TARGET)
        self.assertTrue(all(0 < c["timeout"] <= m.REQUEST_SECONDS for c in calls))

    def test_total_header_budget_is_bounded_across_hops(self):
        result, calls = self.resolve(m.HttpObservation(302, TARGET, header_bytes=40000), m.HttpObservation(200, header_bytes=40000))
        self.assertEqual(result["reason"], "HEADER_LIMIT")
        self.assertEqual(len(calls), 2)

    def test_parser_uses_origin_status_not_proxy_connect(self):
        raw = b"HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 302\r\nlocation: " + TARGET.encode() + b"\r\ncontent-type: text/html; charset=UTF-8\r\n\r\n"
        r = m.parse_curl_headers(raw)
        self.assertEqual(r.status, 302)
        self.assertEqual(r.location, TARGET)
        self.assertEqual(r.media_type, "text/html")
        self.assertEqual(r.header_bytes, len(raw))
        self.assertEqual(m.parse_curl_headers(b"HTTP/1.1 200 Connection established\r\n\r\n").error, "HTTP_RESPONSE_INVALID")
        self.assertEqual(m.parse_curl_headers(b"HTTP/1.1 200 Connection established  \r\n\r\n").error, "HTTP_RESPONSE_INVALID")
        self.assertEqual(m.parse_curl_headers(b"HTTP/2 200\r\nX: truncated").error, "HTTP_RESPONSE_INVALID")

    def test_parser_rejects_duplicate_folded_and_invalid_location(self):
        cases = [
            b"HTTP/2 302\r\nlocation: https://www.jdpower.com/a\r\nlocation: https://evil.example.org/\r\n\r\n",
            b"HTTP/2 302\r\nlocation: https://www.jdpower.com/a\r\n https://evil.example.org/\r\n\r\n",
            b"HTTP/2 302\r\nlocation: https://www.jdpower.com/\x00x\r\n\r\n",
            b"HTTP/2 302\r\nlocation: https://www.jdpower.com/\xff\r\n\r\n",
        ]
        for raw in cases:
            with self.subTest(raw=raw):
                self.assertIsNotNone(m.parse_curl_headers(raw).error)

    def test_parser_honors_header_size_limit(self):
        self.assertEqual(m.parse_curl_headers(b"x" * (m.MAX_HEADER_BYTES + 1)).error, "HEADER_LIMIT")

    def test_curl_is_one_hop_no_shell_glob_auth_or_config(self):
        captured = []
        def absent(args, **kwargs):
            captured.append((args, kwargs))
            raise FileNotFoundError()
        value = SOURCE + "?range=[1-100]&items={a,b}"
        with patch.object(m.subprocess, "Popen", side_effect=absent):
            r = m.curl_observe(url=value, method="HEAD", timeout=2.0, environ=ENV)
        args, kwargs = captured[0]
        self.assertEqual(args[0:2], ["curl", "--disable"])
        self.assertIn("--globoff", args)
        self.assertNotIn("--location", args)
        self.assertNotIn("--insecure", args)
        self.assertNotIn("--cookie", args)
        self.assertNotIn("--user", args)
        self.assertEqual(args[-2:], ["--url", value])
        self.assertFalse(kwargs["shell"])
        self.assertEqual(kwargs["env"], ENV)
        self.assertEqual(r.error, "CLIENT_UNAVAILABLE")

    def test_get_fallback_limits_body_bytes(self):
        captured = []
        def absent(args, **kwargs):
            captured.append(args)
            raise FileNotFoundError()
        with patch.object(m, "_curl_supports_body_limit", return_value=True), patch.object(m.subprocess, "Popen", side_effect=absent):
            m.curl_observe(url=SOURCE, method="GET", timeout=2, environ=ENV)
        self.assertNotIn("--range", captured[0])
        self.assertIn("--max-filesize", captured[0])
        self.assertIn(str(m.MAX_BODY_BYTES), captured[0])

    def test_get_rejects_unsupported_body_limit_client_before_request(self):
        with patch.object(m, "_curl_supports_body_limit", return_value=False), patch.object(m.subprocess, "Popen") as popen:
            r = m.curl_observe(url=SOURCE, method="GET", timeout=2, environ=ENV)
        self.assertEqual(r.error, "CLIENT_VERSION_UNSUPPORTED")
        popen.assert_not_called()

    def test_body_limit_requires_curl_8_4_or_later(self):
        for version, expected in [(b"curl 8.3.0 (linux)", False), (b"curl 8.4.0 (linux)", True), (b"curl 8.14.1 (linux)", True), (b"unexpected PRIVATE_SENTINEL", False)]:
            with self.subTest(version=version):
                result = subprocess.CompletedProcess([], 0, stdout=version)
                with patch.object(m.subprocess, "run", return_value=result):
                    self.assertEqual(m._curl_supports_body_limit(ENV, 1), expected)

    def test_actual_pipe_adapter_kills_oversized_header_process(self):
        real_popen = subprocess.Popen
        children = []
        def local_process(args, **kwargs):
            p = real_popen([sys.executable, "-c", "import sys;sys.stdout.buffer.write(b'HTTP/2 200\\r\\nX: '+b'a'*70000+b'\\r\\n\\r\\n')"], **kwargs)
            children.append(p)
            return p
        with patch.object(m.subprocess, "Popen", side_effect=local_process):
            r = m.curl_observe(url=SOURCE, method="HEAD", timeout=2, environ=ENV)
        self.assertEqual(r.error, "HEADER_LIMIT")
        self.assertIsNotNone(children[0].poll())

    def test_actual_pipe_adapter_bounds_elapsed_time_and_reaps_child(self):
        real_popen = subprocess.Popen
        children = []
        def local_process(args, **kwargs):
            p = real_popen([sys.executable, "-c", "import time;time.sleep(5)"], **kwargs)
            children.append(p)
            return p
        before = time.monotonic()
        with patch.object(m.subprocess, "Popen", side_effect=local_process):
            r = m.curl_observe(url=SOURCE, method="HEAD", timeout=0.05, environ=ENV)
        self.assertEqual(r.error, "REQUEST_TIMEOUT")
        self.assertLess(time.monotonic() - before, 0.6)
        self.assertIsNotNone(children[0].poll())

    def test_cli_invalid_input_is_bounded_and_does_not_echo_it(self):
        for value in [b'{"url":"https://share.google/x","extra":"PRIVATE_SENTINEL"}', b"[]", b"{invalid", b"x" * (m.MAX_INPUT_BYTES + 1)]:
            with self.subTest(value=value[:40]):
                completed = subprocess.run([sys.executable, str(PATH)], input=value, capture_output=True)
                self.assertEqual(completed.returncode, 2)
                r = json.loads(completed.stdout)
                self.assertEqual(r["reason"], "INVALID_INPUT")
                self.assertNotIn(b"PRIVATE_SENTINEL", completed.stdout + completed.stderr)


if __name__ == "__main__":
    unittest.main()
