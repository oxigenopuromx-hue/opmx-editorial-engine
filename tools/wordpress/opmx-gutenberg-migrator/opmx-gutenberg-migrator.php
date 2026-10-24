<?php
/**
 * Plugin Name: OPMX Gutenberg Migrator
 * Description: Converts the legacy OPMX editorial V5 HTML wrapper into editable core Gutenberg blocks without changing the post title, slug, status, taxonomy, or SEO metadata.
 * Version: 0.1.1
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * License: GPL-2.0-or-later
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class OPMX_Gutenberg_Migrator {
    private const META_KEY = '_opmx_gutenberg_migration';
    private const ORIGINAL_CONTENT_META_KEY = '_opmx_gutenberg_legacy_content';
    private const LEGACY_MARKER = 'opmx-editorial__masthead';
    private const LEGACY_BLOCK_MARKER = 'wp:html';

    public static function boot(): void {
        add_action('wp_enqueue_scripts', [self::class, 'enqueue_style']);
        add_filter('body_class', [self::class, 'body_class']);

        if (defined('WP_CLI') && WP_CLI) {
            WP_CLI::add_command('opmx migrate-v5', [self::class, 'cli_migrate']);
            WP_CLI::add_command('opmx migrate-v4', [self::class, 'cli_migrate_v4']);
        }
    }

    public static function enqueue_style(): void {
        if (!is_singular('post')) {
            return;
        }

        global $post;
        if (!$post instanceof WP_Post || !get_post_meta($post->ID, self::META_KEY, true)) {
            return;
        }

        wp_enqueue_style(
            'opmx-gutenberg-migrator',
            plugins_url('assets/opmx-editorial-blocks.css', __FILE__),
            [],
            '0.1.1'
        );
    }

    public static function body_class(array $classes): array {
        if (is_singular('post')) {
            $post_id = get_queried_object_id();
            if ($post_id && get_post_meta($post_id, self::META_KEY, true)) {
                $classes[] = 'opmx-editorial-layout';
            }
        }
        return $classes;
    }

    /**
     * Convert exactly one V5 post, or a bounded group with --all.
     *
     * ## OPTIONS
     *
     * [--post=<id>]
     * : A single post ID.
     *
     * [--all]
     * : Select only legacy V5 posts that have not already been migrated.
     *
     * [--limit=<n>]
     * : Maximum selected posts (default 1 for --all).
     *
     * [--apply]
     * : Persist the converted content. Omit for a dry run.
     *
     * [--force]
     * : Reprocess a post previously marked as migrated.
     */
    public static function cli_migrate(array $args, array $assoc_args): void {
        $apply = isset($assoc_args['apply']);
        $force = isset($assoc_args['force']);
        $ids = self::select_ids($assoc_args);

        if (!$ids) {
            WP_CLI::warning('No V5 posts matched the selection.');
            return;
        }

        foreach ($ids as $id) {
            $post = get_post($id);
            if (!$post instanceof WP_Post) {
                WP_CLI::warning("Post {$id} no longer exists.");
                continue;
            }
            if (!$force && get_post_meta($id, self::META_KEY, true)) {
                WP_CLI::log("{$id}: already marked as migrated; skipped.");
                continue;
            }

            try {
                $result = self::convert_post($post);
            } catch (RuntimeException $e) {
                WP_CLI::warning("{$id}: {$e->getMessage()}");
                continue;
            }

            $summary = sprintf(
                '%d: %d legacy modules → %d native blocks%s',
                $id,
                $result['legacy_modules'],
                $result['block_count'],
                $apply ? '' : ' (dry run)'
            );

            if (!$apply) {
                WP_CLI::log($summary);
                continue;
            }

            // A conversion is reversible even if an operator later decides a visual module
            // needs a different native-block mapping. Never overwrite this first snapshot.
            if (!metadata_exists('post', $id, self::ORIGINAL_CONTENT_META_KEY)) {
                $saved = add_post_meta($id, self::ORIGINAL_CONTENT_META_KEY, $post->post_content, true);
                if (!$saved) {
                    WP_CLI::warning("{$id}: original-content snapshot could not be saved; skipped.");
                    continue;
                }
            }

            wp_update_post([
                'ID'           => $id,
                'post_content' => $result['content'],
            ]);
            update_post_meta($id, self::META_KEY, [
                'version' => '0.1.0',
                'source_sha256' => hash('sha256', $post->post_content),
                'migrated_at_gmt' => gmdate('c'),
                'legacy_modules' => $result['legacy_modules'],
                'native_blocks' => $result['block_count'],
            ]);
            WP_CLI::success($summary);
        }
    }

    private static function select_ids(array $args): array {
        if (isset($args['post'])) {
            return [(int) $args['post']];
        }
        if (!isset($args['all'])) {
            throw new RuntimeException('Pass --post=<id> or --all.');
        }

        global $wpdb;
        $limit = max(1, min(100, (int) ($args['limit'] ?? 1)));
        $sql = $wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts}
             WHERE post_type = 'post'
               AND post_status IN ('draft', 'publish')
               AND post_content LIKE %s
               AND post_content LIKE %s
             ORDER BY ID ASC
             LIMIT %d",
            '%' . self::LEGACY_MARKER . '%',
            '%' . self::LEGACY_BLOCK_MARKER . '%',
            $limit
        );
        return array_map('intval', $wpdb->get_col($sql));
    }

    /**
     * Convert the older OPMX Story markup.  Unlike V5 this template has no
     * stable module wrapper, so it is deliberately single-post only.
     *
     * ## OPTIONS
     *
     * --post=<id>
     * : The legacy-story post ID.
     *
     * [--apply]
     * : Persist the conversion after the parser round-trip validation.
     */
    public static function cli_migrate_v4(array $args, array $assoc_args): void {
        $id = (int) ($assoc_args['post'] ?? 0);
        if (!$id || !($post = get_post($id)) instanceof WP_Post) {
            throw new RuntimeException('Pass an existing --post=<id>.');
        }
        if (get_post_meta($id, self::META_KEY, true)) {
            WP_CLI::warning("{$id}: already marked as migrated; skipped.");
            return;
        }
        try {
            $result = self::convert_v4_post($post);
        } catch (RuntimeException $e) {
            WP_CLI::warning("{$id}: {$e->getMessage()}");
            return;
        }
        $summary = sprintf('%d: legacy story → %d native blocks%s', $id, $result['block_count'], isset($assoc_args['apply']) ? '' : ' (dry run)');
        if (!isset($assoc_args['apply'])) {
            WP_CLI::log($summary);
            return;
        }
        if (!metadata_exists('post', $id, self::ORIGINAL_CONTENT_META_KEY)
            && !add_post_meta($id, self::ORIGINAL_CONTENT_META_KEY, $post->post_content, true)) {
            WP_CLI::warning("{$id}: original-content snapshot could not be saved; skipped.");
            return;
        }
        wp_update_post(['ID' => $id, 'post_content' => $result['content']]);
        update_post_meta($id, self::META_KEY, [
            'version' => '0.1.2',
            'source_sha256' => hash('sha256', $post->post_content),
            'migrated_at_gmt' => gmdate('c'),
            'legacy_modules' => $result['modules'],
            'native_blocks' => $result['block_count'],
        ]);
        WP_CLI::success($summary);
    }

    /** @return array{content:string,modules:int,block_count:int} */
    private static function convert_v4_post(WP_Post $post): array {
        if (!str_contains($post->post_content, 'opmx-story') || !class_exists('DOMDocument')) {
            throw new RuntimeException('Not a supported OPMX Story legacy article.');
        }
        $dom = new DOMDocument('1.0', 'UTF-8');
        libxml_use_internal_errors(true);
        $loaded = $dom->loadHTML('<?xml encoding="utf-8" ?><div id="opmx-root">' . self::strip_legacy_wrapper($post->post_content) . '</div>');
        libxml_clear_errors();
        if (!$loaded) {
            throw new RuntimeException('Legacy HTML could not be parsed.');
        }
        $xpath = new DOMXPath($dom);
        $story = self::first_class($xpath, 'opmx-story');
        if (!$story) {
            throw new RuntimeException('The OPMX Story wrapper is missing.');
        }
        // Some V4 exports prepend an UAG feature image outside the story
        // article. Convert the complete legacy wrapper, not only <article>,
        // so that editorial media is never silently dropped.
        $container = $dom->getElementById('opmx-root');
        if (!$container instanceof DOMElement) {
            throw new RuntimeException('The V4 document wrapper is missing.');
        }
        $children = [];
        foreach (self::element_children($container) as $child) {
            $block = self::block_from_v4_element($child, $post);
            if ($block !== null) {
                $children[] = $block;
            }
        }
        if (!$children) {
            throw new RuntimeException('No editable V4 modules were recovered.');
        }
        $root = self::group_block('div', 'opmx-story-container', $children);
        $content = serialize_blocks([$root]);
        if (self::contains_block([$root], 'core/html') || str_contains($content, '<style') || str_contains($content, '<script')) {
            throw new RuntimeException('Unsafe legacy markup remained after conversion.');
        }
        if (serialize_blocks(parse_blocks($content)) !== $content) {
            throw new RuntimeException('The generated blocks failed the WordPress parser round-trip check.');
        }
        return ['content' => $content, 'modules' => count(self::element_children($container)), 'block_count' => self::count_blocks([$root])];
    }

    /** @return array<string,mixed>|null */
    private static function block_from_v4_element(DOMElement $node, WP_Post $post): ?array {
        $tag = strtolower($node->tagName);
        if (in_array($tag, ['style', 'script', 'svg', 'path', 'button'], true) || $tag === 'h1') {
            return null;
        }
        if ($tag === 'figure') {
            $image = $node->getElementsByTagName('img')->item(0);
            if (!$image instanceof DOMElement || str_contains($image->getAttribute('src'), 'URL_DE_LA_IMAGEN')) {
                // This is a template token, not a recoverable media asset.  A real
                // UAG feature image preceding the V4 story is retained separately.
                return null;
            }
            return self::convert_figure($node, trim($node->getAttribute('class')), $post);
        }
        if (in_array($tag, ['div', 'section', 'aside', 'nav', 'header', 'footer', 'article'], true)) {
            $children = [];
            foreach (self::element_children($node) as $child) {
                $block = self::block_from_v4_element($child, $post);
                if ($block !== null) {
                    $children[] = $block;
                }
            }
            return $children ? self::group_block($tag, trim($node->getAttribute('class')), $children) : null;
        }
        return self::block_from_element($node);
    }

    /** @return array{content:string,legacy_modules:int,block_count:int} */
    public static function convert_post(WP_Post $post): array {
        if (!str_contains($post->post_content, self::LEGACY_MARKER) || !str_contains($post->post_content, self::LEGACY_BLOCK_MARKER)) {
            throw new RuntimeException('Not an OPMX V5 HTML monolith.');
        }
        if (!class_exists('DOMDocument')) {
            throw new RuntimeException('PHP DOM extension is required.');
        }

        $dom = new DOMDocument('1.0', 'UTF-8');
        libxml_use_internal_errors(true);
        $loaded = $dom->loadHTML('<?xml encoding="utf-8" ?><div id="opmx-root">' . self::strip_legacy_wrapper($post->post_content) . '</div>');
        libxml_clear_errors();
        if (!$loaded) {
            throw new RuntimeException('Legacy HTML could not be parsed.');
        }

        $xpath = new DOMXPath($dom);
        $article = self::first_class($xpath, 'opmx-editorial');
        if (!$article) {
            throw new RuntimeException('The OPMX V5 article wrapper is missing.');
        }

        $article_children = self::element_children($article);
        $has_explicit_body = false;
        foreach ($article_children as $child) {
            if (str_contains(' ' . $child->getAttribute('class') . ' ', ' opmx-editorial__body ')) {
                $has_explicit_body = true;
                break;
            }
        }

        $blocks = [];
        if ($has_explicit_body) {
            foreach ($article_children as $child) {
                $blocks = array_merge($blocks, self::convert_top_level_node($child, $post));
            }
        } else {
            // Early V5 exports flattened body modules directly under <article>.
            // Recreate the canonical editable body group instead of falling back to core/html.
            $flat_body = [];
            foreach ($article_children as $child) {
                $class = ' ' . $child->getAttribute('class') . ' ';
                $is_chrome = str_contains($class, ' opmx-editorial__masthead ')
                    || str_contains($class, ' opmx-editorial__header ')
                    || str_contains($class, ' opmx-editorial__hero ')
                    || str_contains($class, ' opmx-editorial__footer ');
                if ($is_chrome) {
                    if ($flat_body) {
                        $blocks[] = self::group_block('div', 'opmx-editorial__body', $flat_body);
                        $flat_body = [];
                    }
                    $blocks = array_merge($blocks, self::convert_top_level_node($child, $post));
                    continue;
                }
                $flat_body[] = strtolower($child->tagName) === 'figure'
                    ? self::convert_figure($child, trim($child->getAttribute('class')), $post)
                    : self::block_from_element($child);
            }
            if ($flat_body) {
                $blocks[] = self::group_block('div', 'opmx-editorial__body', $flat_body);
            }
        }
        if (!$blocks) {
            throw new RuntimeException('No editable modules were recovered.');
        }

        $root = self::group_block('div', 'opmx-editorial', $blocks);
        if (self::contains_block([$root], 'core/html')) {
            throw new RuntimeException('A legacy module could not be expressed as a native block; post left unchanged for manual review.');
        }
        $content = serialize_blocks([$root]);
        $round_trip = serialize_blocks(parse_blocks($content));
        if ($round_trip !== $content) {
            throw new RuntimeException('The generated blocks failed the WordPress parser round-trip check.');
        }

        return [
            'content' => $content,
            'legacy_modules' => count(self::element_children($article)),
            'block_count' => self::count_blocks([$root]),
        ];
    }

    private static function strip_legacy_wrapper(string $content): string {
        $content = preg_replace('/<!--\s*wp:html\s*-->\s*/i', '', $content) ?? $content;
        return preg_replace('/\s*<!--\s*\/wp:html\s*-->\s*/i', '', $content) ?? $content;
    }

    /** @return array<int,array<string,mixed>> */
    private static function convert_top_level_node(DOMElement $node, WP_Post $post): array {
        $class = ' ' . $node->getAttribute('class') . ' ';
        if (str_contains($class, ' opmx-editorial__masthead ')) {
            return [self::group_from_element($node, 'opmx-editorial__masthead')];
        }
        if (str_contains($class, ' opmx-editorial__header ')) {
            return [self::convert_header($node)];
        }
        if (str_contains($class, ' opmx-editorial__hero ')) {
            return [self::convert_figure($node, 'opmx-editorial__hero', $post)];
        }
        if (str_contains($class, ' opmx-editorial__body ')) {
            return [self::convert_body($node, $post)];
        }
        if (str_contains($class, ' opmx-editorial__footer ')) {
            return [self::group_from_element($node, 'opmx-editorial__footer')];
        }
        return [self::block_from_element($node)];
    }

    private static function convert_header(DOMElement $node): array {
        $children = [];
        foreach (self::element_children($node) as $child) {
            // WordPress renders post_title as the single H1. Preserve its neighboring modules only.
            if (strtolower($child->tagName) === 'h1') {
                continue;
            }
            $children[] = self::block_from_element($child);
        }
        return self::group_block('header', 'opmx-editorial__header', $children);
    }

    private static function convert_body(DOMElement $node, WP_Post $post): array {
        $children = [];
        foreach (self::element_children($node) as $child) {
            $class = ' ' . $child->getAttribute('class') . ' ';
            if (str_contains($class, ' opmx-editorial__keypoints ')) {
                $children[] = self::group_from_element($child, 'opmx-editorial__keypoints');
            } elseif (str_contains($class, ' opmx-editorial__inline-media ')) {
                $children[] = self::convert_figure($child, 'opmx-editorial__inline-media', $post);
            } elseif (str_contains($class, ' opmx-editorial__analysis ') || str_contains($class, ' opmx-editorial__sources ') || str_contains($class, ' opmx-editorial__tags ') || str_contains($class, ' opmx-editorial__share ')) {
                $children[] = self::group_from_element($child, trim($child->getAttribute('class')));
            } else {
                $children[] = self::block_from_element($child);
            }
        }
        return self::group_block('div', 'opmx-editorial__body', $children);
    }

    private static function convert_figure(DOMElement $figure, string $class_name, WP_Post $post): array {
        $img = $figure->getElementsByTagName('img')->item(0);
        if (!$img instanceof DOMElement) {
            return self::html_block(self::outer_html($figure));
        }
        $url = $img->getAttribute('src');
        $id = $url ? attachment_url_to_postid($url) : 0;
        $alt = $img->getAttribute('alt');
        $caption_node = $figure->getElementsByTagName('figcaption')->item(0);
        $caption = $caption_node instanceof DOMElement ? trim($caption_node->textContent) : '';
        $attrs = ['sizeSlug' => 'full', 'linkDestination' => 'none', 'className' => $class_name];
        if ($id) {
            $attrs['id'] = $id;
        }
        if ($url) {
            $attrs['url'] = $url;
        }
        if ($alt !== '') {
            $attrs['alt'] = $alt;
        }
        if ($caption !== '') {
            $attrs['caption'] = $caption;
        }
        $figure_class = trim('wp-block-image size-full ' . $class_name);
        $image_class = $id ? ' class="wp-image-' . (int) $id . '"' : '';
        $image_html = sprintf('<figure class="%s"><img src="%s" alt="%s"%s/>%s</figure>', esc_attr($figure_class), esc_url($url), esc_attr($alt), $image_class, $caption !== '' ? '<figcaption class="wp-element-caption">' . esc_html($caption) . '</figcaption>' : '');
        return self::block('core/image', $attrs, [], $image_html);
    }

    private static function group_from_element(DOMElement $node, string $class_name): array {
        $children = [];
        foreach (self::element_children($node) as $child) {
            $children[] = self::block_from_element($child);
        }
        return self::group_block($node->tagName, $class_name, $children);
    }

    private static function block_from_element(DOMElement $node): array {
        $tag = strtolower($node->tagName);
        $class_name = trim($node->getAttribute('class'));
        if (preg_match('/^h([2-6])$/', $tag, $m)) {
            return self::block('core/heading', ['level' => (int) $m[1], 'className' => $class_name ?: null], [], self::outer_html($node));
        }
        if ($tag === 'p') {
            return self::block('core/paragraph', $class_name ? ['className' => $class_name] : [], [], self::outer_html($node));
        }
        if ($tag === 'blockquote') {
            return self::block('core/quote', $class_name ? ['className' => $class_name] : [], [], self::outer_html($node));
        }
        if ($tag === 'ul' || $tag === 'ol') {
            return self::block('core/list', ['ordered' => $tag === 'ol', 'className' => $class_name ?: null], [], self::outer_html($node));
        }
        if ($tag === 'figure') {
            $image = $node->getElementsByTagName('img')->item(0);
            if ($image instanceof DOMElement) {
                $url = $image->getAttribute('src');
                $alt = $image->getAttribute('alt');
                $id = $url ? attachment_url_to_postid($url) : 0;
                $attrs = ['sizeSlug' => 'full', 'linkDestination' => 'none'];
                if ($url) $attrs['url'] = $url;
                if ($alt !== '') $attrs['alt'] = $alt;
                if ($id) $attrs['id'] = $id;
                return self::block('core/image', $attrs, [], sprintf('<figure class="wp-block-image size-full"><img src="%s" alt="%s"%s/></figure>', esc_url($url), esc_attr($alt), $id ? ' class="wp-image-' . (int) $id . '"' : ''));
            }
            return self::block('core/paragraph', [], [], '<p>' . esc_html(trim($node->textContent)) . '</p>');
        }
        if (in_array($tag, ['div', 'section', 'aside', 'nav', 'header', 'footer'], true)) {
            return self::group_from_element($node, $class_name);
        }
        if ($tag === 'img') {
            $url = $node->getAttribute('src');
            $alt = $node->getAttribute('alt');
            return self::block('core/image', ['url' => $url, 'alt' => $alt, 'sizeSlug' => 'full', 'linkDestination' => 'none'], [], sprintf('<figure class="wp-block-image size-full"><img src="%s" alt="%s"/></figure>', esc_url($url), esc_attr($alt)));
        }
        // Inline legacy decoration remains editable rich text, never a new HTML monolith.
        return self::block('core/paragraph', $class_name ? ['className' => $class_name] : [], [], '<p>' . self::outer_html($node) . '</p>');
    }

    private static function group_block(string $tag, string $class_name, array $children): array {
        $attrs = ['tagName' => $tag, 'className' => $class_name, 'layout' => ['type' => 'constrained']];
        $classes = trim('wp-block-group ' . $class_name);
        $open = sprintf('<%1$s class="%2$s">', esc_attr($tag), esc_attr($classes));
        $close = sprintf('</%s>', esc_attr($tag));
        $inner_content = [$open];
        foreach ($children as $_child) {
            $inner_content[] = null;
        }
        $inner_content[] = $close;
        return [
            'blockName' => 'core/group',
            'attrs' => $attrs,
            'innerBlocks' => $children,
            'innerHTML' => $open . $close,
            'innerContent' => $inner_content,
        ];
    }

    private static function html_block(string $html): array {
        return self::block('core/html', [], [], $html);
    }

    private static function block(string $name, array $attrs, array $inner_blocks, string $inner_html): array {
        return ['blockName' => $name, 'attrs' => array_filter($attrs, static fn($v) => $v !== null && $v !== ''), 'innerBlocks' => $inner_blocks, 'innerHTML' => $inner_html, 'innerContent' => $inner_blocks ? array_fill(0, count($inner_blocks) + 1, null) : [$inner_html]];
    }

    private static function first_class(DOMXPath $xpath, string $class): ?DOMElement {
        $nodes = $xpath->query("//*[contains(concat(' ', normalize-space(@class), ' '), ' {$class} ')]");
        return $nodes && $nodes->length && $nodes->item(0) instanceof DOMElement ? $nodes->item(0) : null;
    }

    /** @return DOMElement[] */
    private static function element_children(DOMElement $node): array {
        $children = [];
        foreach ($node->childNodes as $child) {
            if ($child instanceof DOMElement) {
                $children[] = $child;
            }
        }
        return $children;
    }

    private static function outer_html(DOMNode $node): string {
        return $node->ownerDocument ? trim($node->ownerDocument->saveHTML($node)) : '';
    }

    private static function count_blocks(array $blocks): int {
        $count = 0;
        foreach ($blocks as $block) {
            $count++;
            $count += self::count_blocks($block['innerBlocks'] ?? []);
        }
        return $count;
    }

    private static function contains_block(array $blocks, string $wanted): bool {
        foreach ($blocks as $block) {
            if (($block['blockName'] ?? null) === $wanted || self::contains_block($block['innerBlocks'] ?? [], $wanted)) {
                return true;
            }
        }
        return false;
    }
}

OPMX_Gutenberg_Migrator::boot();
