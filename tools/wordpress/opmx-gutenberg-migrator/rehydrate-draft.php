<?php
/**
 * One-shot, draft-only rehydration pass for OPMX legacy snapshots.
 * It intentionally excludes inline-media posts. The original snapshot is immutable.
 */
defined('ABSPATH') || exit;

function opmx_b($name, $attrs, $html) {
    $json = $attrs ? ' ' . wp_json_encode($attrs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '';
    return "<!-- wp:{$name}{$json} -->\n{$html}\n<!-- /wp:{$name} -->\n";
}
function opmx_inner(DOMNode $node) {
    $out = '';
    foreach ($node->childNodes as $child) $out .= $node->ownerDocument->saveHTML($child);
    return trim($out);
}
function opmx_text_block($tag, DOMElement $node, $attrs = []) {
    $inner = opmx_inner($node);
    if ($inner === '') return '';
    if ($tag === 'p') return opmx_b('paragraph', $attrs, '<p>' . $inner . '</p>');
    if (preg_match('/^h([2-6])$/', $tag, $m)) return opmx_b('heading', array_merge(['level'=>(int)$m[1]], $attrs), '<' . $tag . '>' . $inner . '</' . $tag . '>');
    if ($tag === 'ul' || $tag === 'ol') return opmx_b('list', array_merge(['ordered'=>$tag === 'ol'], $attrs), '<' . $tag . '>' . $inner . '</' . $tag . '>');
    if ($tag === 'blockquote') return opmx_b('quote', $attrs, '<blockquote class="wp-block-quote">' . $inner . '</blockquote>');
    return '';
}
function opmx_group($class, $children) {
    $children = array_values(array_filter($children, static fn($v) => $v !== ''));
    if (!$children) return '';
    $attrs = ['className'=>$class, 'layout'=>['type'=>'constrained']];
    return opmx_b('group', $attrs, '<div class="wp-block-group ' . esc_attr($class) . '">\n' . implode('', $children) . '</div>');
}
function opmx_has($class, $needle) { return strpos(' ' . $class . ' ', ' ' . $needle . ' ') !== false; }
function opmx_emit_children(DOMElement $parent, &$seen_lede) {
    $out = [];
    foreach ($parent->childNodes as $node) {
        if (!$node instanceof DOMElement) continue;
        $tag = strtolower($node->tagName);
        $class = (string)$node->getAttribute('class');
        if (opmx_has($class, 'opmx-editorial__masthead') || opmx_has($class, 'opmx-editorial__header') || opmx_has($class, 'opmx-editorial__hero') || opmx_has($class, 'opmx-editorial__footer') || opmx_has($class, 'opmx-editorial__share') || opmx_has($class, 'opmx-editorial__meta')) continue;
        if (opmx_has($class, 'opmx-editorial__inline-media') || $tag === 'img' || $tag === 'figure' || $tag === 'iframe' || $tag === 'script' || $tag === 'style') throw new RuntimeException('unsafe_inline_media');
        if (opmx_has($class, 'opmx-editorial__keypoints')) { $out[] = opmx_group('opmx-module opmx-module--brief', opmx_emit_children($node, $seen_lede)); continue; }
        if (opmx_has($class, 'opmx-editorial__sources')) { $out[] = opmx_group('opmx-module opmx-module--sources', opmx_emit_children($node, $seen_lede)); continue; }
        if (opmx_has($class, 'opmx-editorial__tags')) { $out[] = opmx_group('opmx-module opmx-module--tags', opmx_emit_children($node, $seen_lede)); continue; }
        if (opmx_has($class, 'opmx-editorial__tag')) { $label = trim($node->textContent); if ($label !== '') $out[] = opmx_b('paragraph', ['className'=>'opmx-module__tag'], '<p class="opmx-module__tag">' . esc_html($label) . '</p>'); continue; }
        if (opmx_has($class, 'opmx-editorial__closing')) { $out[] = opmx_group('opmx-module opmx-module--closure', opmx_emit_children($node, $seen_lede)); continue; }
        if (opmx_has($class, 'opmx-editorial__analysis')) { $out[] = opmx_group('opmx-module opmx-module--analysis', opmx_emit_children($node, $seen_lede)); continue; }
        if ($tag === 'p') { $attrs = $seen_lede ? [] : ['className'=>'opmx-editorial__lede']; $seen_lede = true; $out[] = opmx_text_block('p', $node, $attrs); continue; }
        if (preg_match('/^h[2-6]$/', $tag) || $tag === 'ul' || $tag === 'ol' || $tag === 'blockquote') { $out[] = opmx_text_block($tag, $node); continue; }
        if ($tag === 'a' && $node->getAttribute('href') !== '') { $out[] = opmx_b('paragraph', ['className'=>'opmx-module__tag'], '<p class="opmx-module__tag"><a href="' . esc_url($node->getAttribute('href')) . '">' . opmx_inner($node) . '</a></p>'); continue; }
        $out = array_merge($out, opmx_emit_children($node, $seen_lede));
    }
    return array_values(array_filter($out, static fn($v) => $v !== ''));
}

global $wpdb;
// A single, explicitly named target per invocation. Never expands to a broad query.
$target_id = (int) getenv('OPMX_TARGET_ID');
if ($target_id < 1) throw new RuntimeException('A single OPMX_TARGET_ID is required.');
$ids = $wpdb->get_col($wpdb->prepare("SELECT DISTINCT p.ID FROM {$wpdb->posts} p JOIN {$wpdb->postmeta} pm ON pm.post_id=p.ID AND pm.meta_key=%s WHERE p.ID=%d AND p.post_type=%s AND p.post_status=%s", '_opmx_gutenberg_legacy_content', $target_id, 'post', 'draft'));
$result = ['converted'=>[], 'skipped'=>[]];
foreach ($ids as $id) {
    $post = get_post($id);
    $legacy = get_post_meta($id, '_opmx_gutenberg_legacy_content', true);
    if (!$post || !$legacy || !str_contains($legacy, 'opmx-editorial__body')) { $result['skipped'][] = ['id'=>$id,'reason'=>'missing_body']; continue; }
    try {
        $dom = new DOMDocument('1.0', 'UTF-8');
        libxml_use_internal_errors(true);
        $ok = $dom->loadHTML('<?xml encoding="utf-8" ?><div id="opmx-root">' . $legacy . '</div>');
        libxml_clear_errors();
        if (!$ok) throw new RuntimeException('parse_failed');
        $xp = new DOMXPath($dom);
        $body = $xp->query('//*[contains(concat(" ",normalize-space(@class)," ")," opmx-editorial__body ")]')->item(0);
        if (!$body instanceof DOMElement) throw new RuntimeException('missing_body');
        if ($xp->query('.//img|.//figure|.//iframe|.//*[contains(concat(" ",normalize-space(@class)," ")," opmx-editorial__inline-media ")]', $body)->length) throw new RuntimeException('unsafe_inline_media');
        $seen_lede = false;
        // Tags are inside the V5 body and are emitted as their own semantic
        // module rather than being treated as removable page chrome.
        $content = implode('', opmx_emit_children($body, $seen_lede));
        if (substr_count($content, '<!-- wp:') < 3) throw new RuntimeException('too_few_blocks');
        if (strpos($content, 'opmx-editorial__masthead') !== false || strpos($content, 'opmx-editorial__footer') !== false) throw new RuntimeException('chrome_leaked');
        $canonical = serialize_blocks(parse_blocks($content));
        if ($canonical === '' || substr_count($canonical, '<!-- wp:') < 3) throw new RuntimeException('roundtrip_failed');
        $updated = $wpdb->update($wpdb->posts, ['post_content'=>$canonical,'post_modified'=>current_time('mysql'),'post_modified_gmt'=>current_time('mysql', true)], ['ID'=>$id], ['%s','%s','%s'], ['%d']);
        if ($updated === false) throw new RuntimeException('db_update_failed');
        clean_post_cache($id);
        update_post_meta($id, '_opmx_gutenberg_migration', ['version'=>'0.2.0-rehydrate','migrated_at_gmt'=>gmdate('c'),'source'=>'_opmx_gutenberg_legacy_content','native_blocks'=>count(parse_blocks($canonical))]);
        $result['converted'][] = ['id'=>$id,'slug'=>$post->post_name,'blocks'=>count(parse_blocks($canonical)),'modules'=>substr_count($canonical,'opmx-module')];
    } catch (RuntimeException $e) { $result['skipped'][] = ['id'=>$id,'reason'=>$e->getMessage()]; }
}
echo wp_json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
