// RichText — renders an inline-formatted SEO content field in the SPA.
//
// Pairs with src/lib/seoInlineHtml.ts (the shared allowlist sanitizer) and the
// bot prerender layer, so inline marks (bold/italic/link/code) look identical
// for users and crawlers. The dangerouslySetInnerHTML here is safe ONLY because
// the HTML has already passed sanitizeInline()'s strict allowlist.

import type { ElementType } from 'react';
import { sanitizeInline } from '../../lib/seoInlineHtml';

/**
 * Spread helper: apply sanitized inline HTML as the children of any element.
 * Usage: `<p {...richInner(block.text)} />` — keeps the semantic tag clean
 * (no wrapper span) while supporting inline <strong>/<em>/<a>/<code>.
 */
export function richInner(text: string | null | undefined) {
    return { dangerouslySetInnerHTML: { __html: sanitizeInline(text) } };
}

interface RichTextProps {
    text: string | null | undefined;
    as?: ElementType;
    className?: string;
}

/** Wrapper-element variant when a spread isn't convenient. Defaults to <span>. */
export function RichText({ text, as, className }: RichTextProps) {
    const Tag = as ?? 'span';
    return <Tag className={className} {...richInner(text)} />;
}
