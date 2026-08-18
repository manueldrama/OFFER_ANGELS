// Lets the mounted page tell LocaleRouter where a language switch should land,
// without LocaleRouter having to know anything about the page's data.
//
// WHY THE INDIRECTION: LocaleRouter is the element for `/:lang`, so it is on the
// landing page's critical path (src/App.tsx). Importing the slug-group map (or
// anything that pulls Supabase) into it would ship that weight to every visitor
// who lands on /tr. This module is deliberately tiny and data-free; the blog
// page registers a closure over data it has already fetched, so resolving a
// language switch costs no bundle weight and no extra network round trip.
//
// Only one resolver is active at a time — the currently mounted content page.
// Pages MUST clear it on unmount, otherwise a stale closure would redirect
// language switches on unrelated pages.

import type { SupportedLang } from './seoConfig';

/** Returns the path to navigate to for `targetLang`, or null to let
 *  LocaleRouter fall back to its generic "swap the :lang segment" behaviour. */
export type LangSwitchResolver = (targetLang: SupportedLang) => string | null;

let current: LangSwitchResolver | null = null;

export function setLangSwitchResolver(resolver: LangSwitchResolver | null): void {
    current = resolver;
}

/** Path the active page wants for `targetLang`, or null when no page has
 *  registered one (or the resolver threw — never let a switcher break on it). */
export function resolveLangSwitchPath(targetLang: SupportedLang): string | null {
    if (!current) return null;
    try {
        return current(targetLang);
    } catch {
        return null;
    }
}
