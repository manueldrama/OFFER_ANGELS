// useAngelsContent(pageKey) — resolved, render-ready content for a public
// Angels page. DB rows (angels_page_sections) win; the code defaults in
// angelsDefaultContent.ts are the fallback, so pages render instantly and an
// empty DB produces the exact pre-CMS visuals.
//
// Show/hide semantics:
//   - DB row exists with is_active=false → getSection() returns null → JSX skips it.
//   - DB row missing entirely (e.g. seeded before a new section_type was added)
//     → the code default for that type is merged back in (self-healing).
//
// No persistent cache (low traffic; one small query). A module-level memo keeps
// SPA route hops within a session from refetching.

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AngelsPageContentService,
    localizeAngelsSection,
} from '../services/angels/angelsPageContentService';
import type { AngelsPageKey, ResolvedAngelsSection } from '../types/angels';

const memo = new Map<AngelsPageKey, ResolvedAngelsSection[]>();

export interface AngelsContent {
    /** null = section hidden (is_active=false) or unknown type. */
    getSection: (type: string) => ResolvedAngelsSection | null;
    /** Active sections in sort_order — drives section-order rendering on the invite page. */
    orderedSections: ResolvedAngelsSection[];
    /** false only during the very first fetch (defaults are already rendered meanwhile). */
    ready: boolean;
}

export function useAngelsContent(pageKey: AngelsPageKey): AngelsContent {
    // Base content is EN; config_i18n/item_i18n carry the translations.
    // useTranslation re-renders on languageChanged, so the browser-detected
    // language (and the header LanguageSwitcher) drive localization live.
    const { i18n } = useTranslation();
    const lang = (i18n.language || 'en').split('-')[0];
    const [sections, setSections] = useState<ResolvedAngelsSection[]>(
        () => memo.get(pageKey) ?? AngelsPageContentService.resolveDefaultSections(pageKey),
    );
    const [ready, setReady] = useState(() => memo.has(pageKey));

    useEffect(() => {
        if (memo.has(pageKey)) {
            setSections(memo.get(pageKey)!);
            setReady(true);
            return;
        }
        let active = true;
        (async () => {
            const rows = await AngelsPageContentService.getPageSections(pageKey);
            if (!active) return;
            let resolved: ResolvedAngelsSection[];
            if (rows === null) {
                resolved = AngelsPageContentService.resolveDefaultSections(pageKey);
            } else {
                resolved = AngelsPageContentService.resolvePublicSections(rows);
                // Self-heal: merge defaults whose section_type has no DB row at all
                // (a row that exists but is inactive stays hidden — that's show/hide).
                const dbTypes = new Set(rows.map(r => r.section_type));
                const missing = AngelsPageContentService.resolveDefaultSections(pageKey).filter(
                    d => !dbTypes.has(d.section_type),
                );
                if (missing.length > 0) {
                    resolved = [...resolved, ...missing].sort((a, b) => a.sort_order - b.sort_order);
                }
            }
            memo.set(pageKey, resolved);
            setSections(resolved);
            setReady(true);
        })();
        return () => {
            active = false;
        };
    }, [pageKey]);

    return useMemo(() => {
        // Localize at render time — the memo cache above stays language-agnostic.
        const localized = sections.map(s => localizeAngelsSection(s, lang));
        return {
            getSection: (type: string) => localized.find(s => s.section_type === type) ?? null,
            orderedSections: localized,
            ready,
        };
    }, [sections, ready, lang]);
}

/** Admin editor calls this after a save so public pages refetch fresh content. */
export function invalidateAngelsContent(pageKey?: AngelsPageKey) {
    if (pageKey) memo.delete(pageKey);
    else memo.clear();
}
