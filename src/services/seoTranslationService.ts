// Resolves which languages a /blog content page is published in, and under
// which slug in each.
//
// `seo_pages` has no translation-group column (see src/lib/seoSlugGroups.ts for
// the full story), so the static slug-group map does the linking and the DB only
// confirms what is actually published. Kept out of seoPageService.ts on purpose:
// that module is imported by LandingPage via getHomepageSeo, and the slug-group
// map has no business on the landing chunk.

import { supabase } from '../lib/supabase/client';
import type { SupportedLang } from '../lib/seoConfig';
import {
    findGroupBySlug,
    candidateSlugs,
    type SeoGroupType,
} from '../lib/seoSlugGroups';

/** language → the slug that language's published page uses. */
export type TranslationMap = Partial<Record<SupportedLang, string>>;

interface SlugLangRow {
    language: SupportedLang;
    slug: string;
}

// `group_key` (20260816 migration) may not exist yet — the operator applies
// migrations by hand. PostgREST returns 400 for an unknown column, so the first
// failure flips this off for the rest of the session instead of retrying on
// every page view. null = not tried yet.
let groupKeySupported: boolean | null = null;

/**
 * Fallback for content the static map doesn't know: ask the DB whether this row
 * belongs to a translation group, and if so fetch its siblings. Costs two extra
 * queries, but only on pages outside the map — and nothing at all once
 * `group_key` is known to be absent.
 */
async function translationsViaGroupKey(
    type: SeoGroupType,
    slug: string,
): Promise<TranslationMap | null> {
    if (groupKeySupported === false) return null;
    try {
        const { data: self, error: selfError } = await supabase
            .from('seo_pages')
            .select('group_key')
            .eq('type', type)
            .eq('slug', slug)
            .eq('status', 'published')
            .limit(1)
            .maybeSingle();
        if (selfError) {
            // Unknown column → migration not applied. Stop asking.
            if (/group_key/i.test(selfError.message ?? '')) groupKeySupported = false;
            return null;
        }
        groupKeySupported = true;
        const groupKey = (self as { group_key?: string | null } | null)?.group_key;
        if (!groupKey) return null;

        const { data, error } = await supabase
            .from('seo_pages')
            .select('language, slug')
            .eq('type', type)
            .eq('group_key', groupKey)
            .eq('status', 'published');
        if (error || !data) return null;
        const out: TranslationMap = {};
        for (const row of data as SlugLangRow[]) out[row.language] = row.slug;
        return out;
    } catch {
        return null;
    }
}

/**
 * Published translations of a page, keyed by language.
 *
 * Resolution ladder — one query either way:
 *  1. Known slug group → look up all its candidate slugs at once, then keep only
 *     the rows whose (language, slug) pair matches what the group claims. That
 *     guard matters because different groups can share a slug string across
 *     languages (e.g. 'latte-art', 'ripple-maker-alternative').
 *  2. Unknown slug → `group_key` lookup (Phase 2; no-ops until that migration
 *     is applied), so content authored after this file was written resolves
 *     without a code change.
 *  3. Still nothing → identical-slug lookup. The old behaviour, still correct
 *     for concepts whose slug never got localized.
 *
 * Returns {} on any error (including "table doesn't exist yet"), matching
 * getSeoPage's tolerance — callers degrade to a single-language page.
 */
export async function getTranslations(
    type: SeoGroupType,
    slug: string,
): Promise<TranslationMap> {
    const group = findGroupBySlug(type, slug);
    if (!group) {
        const viaGroupKey = await translationsViaGroupKey(type, slug);
        if (viaGroupKey && Object.keys(viaGroupKey).length > 0) return viaGroupKey;
    }
    try {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('language, slug')
            .eq('type', type)
            .eq('status', 'published')
            .in('slug', group ? candidateSlugs(group) : [slug]);
        if (error || !data) return {};

        const out: TranslationMap = {};
        for (const row of data as SlugLangRow[]) {
            if (group && group.slug[row.language] !== row.slug) continue;
            out[row.language] = row.slug;
        }
        return out;
    } catch {
        return {};
    }
}

/**
 * Slug this concept is published under in `targetLang`, or null when there is
 * no published equivalent. Used to repair a stale cross-language URL client
 * side (the worker does the same check before issuing its 301).
 */
export async function resolveEquivalent(
    type: SeoGroupType,
    slug: string,
    targetLang: SupportedLang,
): Promise<string | null> {
    const target = findGroupBySlug(type, slug)?.slug[targetLang];
    if (!target || target === slug) return null;
    try {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('slug')
            .eq('type', type)
            .eq('slug', target)
            .eq('language', targetLang)
            .eq('status', 'published')
            .maybeSingle();
        if (error || !data) return null;
        return target;
    } catch {
        return null;
    }
}
