// Inline rich-text sanitizer for SEO content fields (Faz 2).
//
// WHY a string→string sanitizer (not a React parse+map):
// CAFEPASTE renders SEO pages through TWO independent paths —
//   1. the SPA React renderer (src/components/seo/SeoBlockRenderer.tsx), and
//   2. the bot prerender layer (functions/seo/prerender.ts) which emits raw
//      HTML strings for crawlers (Googlebot, GPTBot, PerplexityBot, ClaudeBot).
// To guarantee users and crawlers see IDENTICAL inline marks, both paths call
// this one allowlist sanitizer. The SPA feeds the result to a guarded
// dangerouslySetInnerHTML; the prerender concatenates it into its HTML string.
//
// SECURITY: strict allowlist. Only <strong>/<b>, <em>/<i>, <code>, <br>, and
// <a href> survive — every other tag is escaped to literal text, all other
// attributes are dropped, and href is validated (no javascript:/data: URLs).
// Content is admin-authored, but we still treat it as untrusted.

const ALLOWED = new Set(['strong', 'b', 'em', 'i', 'code', 'br', 'a']);

function escapeText(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Allow only safe URL shapes: absolute http(s), mailto, tel, root-relative,
// and in-page anchors. Everything else (javascript:, data:, vbscript:, …) is
// rejected so the anchor is dropped (its inner text is preserved).
function safeHref(raw: string): string | null {
    const h = raw.trim();
    if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(h)) {
        return h
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    return null;
}

/**
 * Sanitize a single inline-text field to a safe HTML string.
 * Returns plain escaped text when the input has no (allowed) markup, so legacy
 * plain-text blocks pass through visually unchanged.
 */
export function sanitizeInline(input: string | null | undefined): string {
    if (!input) return '';
    let out = '';
    let last = 0;
    const openStack: string[] = [];
    const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g;
    let m: RegExpExecArray | null;

    while ((m = tagRe.exec(input)) !== null) {
        out += escapeText(input.slice(last, m.index));
        last = m.index + m[0].length;

        const closing = m[1] === '/';
        const name = m[2].toLowerCase();
        const attrs = m[3] || '';

        if (!ALLOWED.has(name)) {
            // Not in the allowlist → render the literal tag as escaped text.
            out += escapeText(m[0]);
            continue;
        }

        if (name === 'br') {
            out += '<br>';
            continue;
        }

        if (name === 'a') {
            if (closing) {
                if (openStack[openStack.length - 1] === 'a') {
                    openStack.pop();
                    out += '</a>';
                }
                continue; // drop stray closer
            }
            const hrefM = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
            const href = hrefM ? safeHref(hrefM[2] ?? hrefM[3] ?? '') : null;
            if (!href) continue; // unsafe/missing href → drop opener, keep text
            const external = /^https?:\/\//i.test(href);
            // External links open in a new tab with noopener. No nofollow — we
            // WANT authoritative outbound links to count for E-E-A-T / GEO.
            out += `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}>`;
            openStack.push('a');
            continue;
        }

        // strong / b / em / i / code — normalize b→strong, i→em.
        const canonical = name === 'b' ? 'strong' : name === 'i' ? 'em' : name;
        if (closing) {
            if (openStack[openStack.length - 1] === canonical) {
                openStack.pop();
                out += `</${canonical}>`;
            }
            continue; // drop stray/mismatched closer
        }
        out += `<${canonical}>`;
        openStack.push(canonical);
    }

    out += escapeText(input.slice(last));
    while (openStack.length) out += `</${openStack.pop()}>`;
    return out;
}

/**
 * Normalize a YouTube/Vimeo watch URL to its privacy-friendly embed URL.
 * Returns null when the URL isn't a recognized provider (caller falls back to a
 * <video> tag for direct .mp4 links). Pure + React-free so BOTH the SPA
 * renderer and the worker prerender import the same logic.
 */
export function toEmbedUrl(url: string): string | null {
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
    if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return null;
}

/**
 * Detect whether a field actually contains allowed inline markup. Used by the
 * E-E-A-T scorer to count outbound links, and to decide when a plain render is
 * enough. Markdown-style [text](url) links also count (legacy authoring).
 */
export function hasInlineLink(input: string | null | undefined): boolean {
    if (!input) return false;
    return /<a\s+[^>]*href=/i.test(input) || /\[[^\]]+\]\((https?:\/\/[^)]+)\)/i.test(input);
}
