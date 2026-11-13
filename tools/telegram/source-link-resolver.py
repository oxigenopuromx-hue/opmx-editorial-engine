#!/usr/bin/env python3
"""Resolve public shared-source addresses, never verify their editorial content.

Run in the Motor's existing execution environment, using its inherited proxy.
CLI input is a JSON object {"url": "https://share.google/..."} on stdin.  Output
contains only bounded address/status metadata; no response bodies or raw errors.
No package, Telegram, CMS, browser, subscription or credential is changed.
"""

from __future__ import annotations

import fnmatch
import ipaddress
import json
import os
import re
import selectors
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Callable, Mapping
from urllib.parse import parse_qsl, quote, urljoin, urlsplit, urlunsplit

SCHEMA = "opmx.source-link-resolution.v1"
MAX_URL_BYTES = 4096
MAX_HEADER_BYTES = 65536
MAX_BODY_BYTES = 32768
MAX_INPUT_BYTES = 8192
MAX_REDIRECTS = 5
MAX_REQUESTS = 7
TOTAL_SECONDS = 20.0
REQUEST_SECONDS = 12.0
REDIRECT_STATUSES = frozenset((301, 302, 303, 307, 308))
PRIVATE_SUFFIXES = (
    "localhost", "local", "localdomain", "internal", "intranet", "lan",
    "home", "test", "invalid", "example", "onion", "arpa", "nip.io",
    "sslip.io", "lvh.me", "localtest.me", "traefik.me",
)
SECRET_QUERY_KEYS = frozenset((
    "access_token", "auth", "authorization", "api_key", "apikey", "key",
    "token", "signature", "sig", "password", "passwd", "secret",
    "credential", "credentials", "session", "sessionid", "sid", "jwt",
    "code", "client_secret",
))


class ResolutionBlocked(Exception):
    """A fixed diagnostic code; never place a URL or raw error in this class."""


@dataclass(frozen=True)
class HttpObservation:
    status: int | None = None
    location: str | None = None
    media_type: str | None = None
    error: str | None = None
    header_bytes: int = 0


def normalize_public_url(value: str, *, _depth: int = 0) -> str:
    """Syntactic public-address gate; the platform proxy enforces DNS policy."""
    if not isinstance(value, str) or not value:
        raise ResolutionBlocked("URL_NOT_ALLOWED")
    try:
        if len(value.encode("utf-8")) > MAX_URL_BYTES:
            raise ResolutionBlocked("URL_NOT_ALLOWED")
    except UnicodeError:
        raise ResolutionBlocked("URL_NOT_ALLOWED") from None
    if any(ord(c) <= 32 or ord(c) == 127 for c in value) or "\\" in value:
        raise ResolutionBlocked("URL_NOT_ALLOWED")
    try:
        parts = urlsplit(value)
        if parts.scheme.lower() != "https" or parts.username is not None or parts.password is not None:
            raise ValueError()
        host = parts.hostname
        port = parts.port
        if not host or host.endswith(".") or port not in (None, 443):
            raise ValueError()
        host = host.encode("idna").decode("ascii").lower()
        try:
            ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            raise ValueError()
        labels = host.split(".")
        if len(labels) < 2 or len(host) > 253 or not re.fullmatch(r"[a-z]{2,63}", labels[-1]):
            raise ValueError()
        if any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in labels):
            raise ValueError()
        if any(host == suffix or host.endswith("." + suffix) for suffix in PRIVATE_SUFFIXES):
            raise ValueError()
        for key, nested in parse_qsl(parts.query, keep_blank_values=True, max_num_fields=100):
            k = key.lower().replace("-", "_")
            if (k in SECRET_QUERY_KEYS or k.startswith(("x_amz_", "x_goog_", "auth_", "session_", "credential_"))
                    or k.endswith(("_token", "_secret", "_password", "_key", "_signature"))):
                raise ResolutionBlocked("CREDENTIAL_URL_NOT_ALLOWED")
            # Google /url commonly puts a complete URL in q/url. Do not echo
            # or transmit an encoded credential address inside that wrapper.
            if nested.lower().startswith(("https://", "http://")):
                if _depth >= 3:
                    raise ResolutionBlocked("URL_NESTING_LIMIT")
                normalize_public_url(nested, _depth=_depth + 1)
        # URL fragments are client-side data, never sent to a source server.
        path = quote(parts.path or "/", safe="/:@!$&'()*+,;=-._~%")
        query = quote(parts.query, safe="=&?/:@!$'()*+,;~-._%")
        return urlunsplit(("https", host, path, query, ""))
    except ResolutionBlocked:
        raise
    except (ValueError, UnicodeError):
        raise ResolutionBlocked("URL_NOT_ALLOWED") from None


def is_shared_source_url(url: str) -> bool:
    p = urlsplit(url)
    if p.hostname in ("share.google", "share.google.com", "g.co"):
        return p.path not in ("", "/")
    if p.hostname in ("google.com", "www.google.com", "google.com.mx", "www.google.com.mx"):
        return p.path in ("/url", "/share.google") and any(k in ("url", "q") and v for k, v in parse_qsl(p.query))
    if p.hostname == "news.google.com":
        return p.path.startswith(("/articles/", "/read/"))
    return False


def _proxy_available(environ: Mapping[str, str]) -> bool:
    # Match curl's variable precedence.  Never print or modify proxy values.
    value = next((environ.get(k) for k in ("https_proxy", "HTTPS_PROXY", "all_proxy", "ALL_PROXY") if environ.get(k)), None)
    if not value:
        return False
    try:
        p = urlsplit(value)
        port = p.port
        return p.scheme in ("http", "https") and bool(p.hostname) and (port is None or 1 <= port <= 65535)
    except ValueError:
        return False


def _bypasses_proxy(url: str, environ: Mapping[str, str]) -> bool:
    host = urlsplit(url).hostname or ""
    # Reject a match in either variable, conservatively, without overriding
    # NO_PROXY. IP/CIDR entries cannot match our non-IP request host.
    for setting in (environ.get("no_proxy", ""), environ.get("NO_PROXY", "")):
        for raw in setting.split(","):
            token = raw.strip().lower()
            if not token:
                continue
            if token == "*":
                return True
            if ":" in token and token.count(":") == 1:
                token, port = token.rsplit(":", 1)
                if port != "443":
                    continue
            token = token.lstrip(".").rstrip(".")
            if not token or "/" in token or ":" in token:
                continue
            if host == token or host.endswith("." + token) or fnmatch.fnmatchcase(host, token):
                return True
    return False


def parse_curl_headers(raw: bytes) -> HttpObservation:
    if not isinstance(raw, bytes) or len(raw) > MAX_HEADER_BYTES:
        return HttpObservation(error="HEADER_LIMIT")
    if not raw.endswith((b"\r\n\r\n", b"\n\n")):
        return HttpObservation(error="HTTP_RESPONSE_INVALID")
    blocks = re.split(rb"\r?\n\r?\n", raw)
    selected = None
    for block in blocks:
        lines = block.splitlines()
        if not lines:
            continue
        m = re.fullmatch(rb"HTTP/(?:1\.[01]|2|3) ([1-5][0-9]{2})(?: ([^\x00-\x1f\x7f]*))?", lines[0])
        if not m:
            return HttpObservation(error="HTTP_RESPONSE_INVALID")
        status = int(m.group(1))
        reason = (m.group(2) or b"").strip().lower()
        if status < 200 or status == 200 and reason == b"connection established":
            continue
        values: dict[bytes, list[bytes]] = {}
        for line in lines[1:]:
            if not line or line[:1] in (b" ", b"\t") or b":" not in line:
                return HttpObservation(error="HTTP_RESPONSE_INVALID")
            name, value = line.split(b":", 1)
            if not re.fullmatch(rb"[!#$%&'*+.^_`|~0-9A-Za-z-]+", name):
                return HttpObservation(error="HTTP_RESPONSE_INVALID")
            value = value.strip(b" \t")
            if any(c < 32 and c != 9 or c == 127 for c in value):
                return HttpObservation(error="HTTP_RESPONSE_INVALID")
            values.setdefault(name.lower(), []).append(value)
        if len(values.get(b"location", [])) > 1:
            return HttpObservation(error="AMBIGUOUS_LOCATION")
        location = values.get(b"location", [None])[0]
        if location is not None:
            try:
                location = location.decode("ascii")
            except UnicodeDecodeError:
                return HttpObservation(error="INVALID_LOCATION")
        media = values.get(b"content-type", [b""])[0].split(b";", 1)[0].strip().lower()
        media_type = media.decode("ascii") if re.fullmatch(rb"[a-z0-9.+-]+/[a-z0-9.+-]+", media) else None
        selected = HttpObservation(status=status, location=location, media_type=media_type, header_bytes=len(raw))
    return selected or HttpObservation(error="HTTP_RESPONSE_INVALID")


def _curl_supports_body_limit(environ: Mapping[str, str], timeout: float) -> bool:
    # Before curl8.4, --max-filesize did not bound unknown-length downloads.
    # No GET fallback is allowed with that older client. Version output is
    # local software metadata and is never included in resolution diagnostics.
    try:
        p = subprocess.run(["curl", "--disable", "--version"], stdin=subprocess.DEVNULL,
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                           env=dict(environ), shell=False, timeout=min(1.0, timeout),
                           check=False)
        match = re.match(rb"curl ([0-9]+)\.([0-9]+)\.([0-9]+)(?: |\r?\n)", p.stdout[:128])
        return p.returncode == 0 and bool(match) and tuple(int(v) for v in match.groups()) >= (8, 4, 0)
    except (OSError, subprocess.TimeoutExpired):
        return False


def curl_observe(*, url: str, method: str, timeout: float, environ: Mapping[str, str]) -> HttpObservation:
    """One hop, no automatic redirects, no body retained, no user credentials."""
    if method not in ("HEAD", "GET") or timeout <= 0:
        return HttpObservation(error="REQUEST_TIMEOUT")
    if method == "GET":
        before = time.monotonic()
        if not _curl_supports_body_limit(environ, timeout):
            return HttpObservation(error="CLIENT_VERSION_UNSUPPORTED")
        timeout -= time.monotonic() - before
        if timeout <= 0:
            return HttpObservation(error="REQUEST_TIMEOUT")
    args = [
        "curl", "--disable", "--globoff", "--silent", "--show-error", "--proto", "=https",
        "--max-redirs", "0", "--dump-header", "-", "--output", os.devnull,
        "--connect-timeout", str(min(10.0, timeout)), "--max-time", str(timeout),
    ]
    if method == "HEAD":
        args += ["--head"]
    else:
        args += ["--request", "GET", "--max-filesize", str(MAX_BODY_BYTES)]
    args += ["--url", url]
    try:
        process = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                   stderr=subprocess.DEVNULL, env=dict(environ),
                                   shell=False, close_fds=True)
    except FileNotFoundError:
        return HttpObservation(error="CLIENT_UNAVAILABLE")
    except OSError:
        return HttpObservation(error="TRANSPORT_UNCONFIRMED")
    deadline = time.monotonic() + timeout
    raw = bytearray()
    selector = selectors.DefaultSelector()
    try:
        assert process.stdout is not None
        os.set_blocking(process.stdout.fileno(), False)
        selector.register(process.stdout, selectors.EVENT_READ)
        ended = False
        while not ended:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return HttpObservation(error="REQUEST_TIMEOUT")
            for key, _ in selector.select(remaining):
                piece = os.read(key.fileobj.fileno(), min(4096, MAX_HEADER_BYTES + 1 - len(raw)))
                if not piece:
                    ended = True
                    break
                raw.extend(piece)
                if len(raw) > MAX_HEADER_BYTES:
                    return HttpObservation(error="HEADER_LIMIT")
        try:
            code = process.wait(timeout=max(0.001, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            return HttpObservation(error="REQUEST_TIMEOUT")
        observation = parse_curl_headers(bytes(raw))
        if code == 0 or code == 63 and method == "GET" and observation.status:
            return observation
        if observation.status in REDIRECT_STATUSES and observation.location and code == 63:
            return observation
        return HttpObservation(error={28: "REQUEST_TIMEOUT", 60: "TLS_UNCONFIRMED"}.get(code, "TRANSPORT_UNCONFIRMED"))
    finally:
        selector.close()
        if process.poll() is None:
            process.kill()
        try:
            process.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass
        if process.stdout is not None:
            process.stdout.close()


def resolve_shared_link(url: str, *, environ: Mapping[str, str] | None = None,
                        observer: Callable[..., HttpObservation] = curl_observe,
                        clock: Callable[[], float] = time.monotonic) -> dict:
    """Return address evidence only; the Motor must independently read/review it."""
    env = os.environ if environ is None else environ
    original = None
    chain: list[dict] = []

    def result(status: str, reason: str, final: str | None = None,
               observation: HttpObservation | None = None) -> dict:
        return {
            "schema": SCHEMA, "status": status, "reason": reason,
            "original_url": original, "final_url": final,
            "final_http_status": observation.status if observation else None,
            "final_media_type": observation.media_type if observation else None,
            "final_is_shared_wrapper": is_shared_source_url(final) if final else None,
            "chain": chain, "source_content_verified": False,
            "requires_content_review": True, "publishing_authorized": False,
        }

    try:
        original = normalize_public_url(url)
    except ResolutionBlocked as exc:
        return result("RESOLUTION_BLOCKED", str(exc))
    if not is_shared_source_url(original):
        return result("NOT_SHARED_LINK", "UNSUPPORTED_INITIAL_URL")
    if not _proxy_available(env):
        return result("RESOLUTION_BLOCKED", "PROXY_REQUIRED")
    current, method = original, "HEAD"
    visited = {current}
    redirects = 0
    header_bytes = 0
    deadline = clock() + TOTAL_SECONDS
    for _ in range(MAX_REQUESTS):
        if _bypasses_proxy(current, env):
            return result("RESOLUTION_BLOCKED", "NO_PROXY_ROUTE")
        remaining = deadline - clock()
        if remaining <= 0:
            return result("REDIRECT_RESOLVED" if redirects else "RESOLUTION_UNCONFIRMED",
                          "FINAL_FETCH_UNCONFIRMED" if redirects else "REQUEST_TIMEOUT",
                          current if redirects else None)
        try:
            observation = observer(url=current, method=method,
                                   timeout=min(REQUEST_SECONDS, remaining), environ=env)
        except Exception:
            observation = HttpObservation(error="TRANSPORT_UNCONFIRMED")
        if not isinstance(observation, HttpObservation):
            observation = HttpObservation(error="HTTP_RESPONSE_INVALID")
        if type(observation.header_bytes) is not int or observation.header_bytes < 0:
            return result("RESOLUTION_UNCONFIRMED", "HTTP_RESPONSE_INVALID")
        header_bytes += observation.header_bytes
        if header_bytes > MAX_HEADER_BYTES:
            return result("RESOLUTION_UNCONFIRMED", "HEADER_LIMIT")
        if observation.error:
            if observation.error in ("HEADER_LIMIT", "HTTP_RESPONSE_INVALID", "AMBIGUOUS_LOCATION", "INVALID_LOCATION"):
                return result("RESOLUTION_UNCONFIRMED", observation.error)
            safe_error = observation.error if observation.error in (
                "REQUEST_TIMEOUT", "TLS_UNCONFIRMED", "CLIENT_UNAVAILABLE", "CLIENT_VERSION_UNSUPPORTED", "TRANSPORT_UNCONFIRMED"
            ) else "TRANSPORT_UNCONFIRMED"
            return result("REDIRECT_RESOLVED" if redirects else "RESOLUTION_UNCONFIRMED",
                          "FINAL_FETCH_UNCONFIRMED" if redirects else safe_error,
                          current if redirects else None)
        if type(observation.status) is not int or not 100 <= observation.status <= 599:
            return result("RESOLUTION_UNCONFIRMED", "HTTP_RESPONSE_INVALID")
        chain.append({"url": current, "method": method, "http_status": observation.status})
        if observation.status in REDIRECT_STATUSES:
            if not observation.location:
                return result("RESOLUTION_UNCONFIRMED", "REDIRECT_WITHOUT_LOCATION")
            if redirects >= MAX_REDIRECTS:
                return result("RESOLUTION_UNCONFIRMED", "REDIRECT_LIMIT")
            try:
                following = normalize_public_url(urljoin(current, observation.location))
            except ResolutionBlocked as exc:
                return result("RESOLUTION_BLOCKED", str(exc))
            if following in visited:
                return result("RESOLUTION_UNCONFIRMED", "REDIRECT_LOOP")
            # Crucially, the next Location is gated before any second request.
            if _bypasses_proxy(following, env):
                return result("RESOLUTION_BLOCKED", "NO_PROXY_ROUTE")
            # Google responds differently to HEAD at /share.google. A known
            # wrapper uses bounded GET; the editorial target still uses HEAD.
            current, method = following, "GET" if is_shared_source_url(following) else "HEAD"
            visited.add(current)
            redirects += 1
            continue
        if observation.status in (405, 501) and method == "HEAD" and is_shared_source_url(current):
            method = "GET"
            continue
        return result("REDIRECT_RESOLVED" if redirects else "NO_REDIRECT",
                      "FINAL_HTTP_RESPONSE" if observation.status < 400 else "FINAL_HTTP_ERROR",
                      current, observation)
    return result("RESOLUTION_UNCONFIRMED", "REQUEST_LIMIT")


def main() -> int:
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            raise ValueError()
        data = json.loads(raw)
        if not isinstance(data, dict) or set(data) != {"url"} or not isinstance(data["url"], str):
            raise ValueError()
    except (ValueError, UnicodeError, RecursionError):
        print(json.dumps({"schema": SCHEMA, "status": "RESOLUTION_BLOCKED", "reason": "INVALID_INPUT",
                          "source_content_verified": False, "requires_content_review": True,
                          "publishing_authorized": False}))
        return 2
    print(json.dumps(resolve_shared_link(data["url"]), ensure_ascii=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
