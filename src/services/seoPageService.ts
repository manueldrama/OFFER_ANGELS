// Data access for the `seo_pages` Supabase table. The table is created by
// the SEO migration (see supabase/migrations/<date>_seo_pages.sql once added);
// queries here tolerate the "table not yet created" case by returning null,
// so the new public routes are safe to deploy ahead of the migration.

import { supabase } from '../lib/supabase/client';
import type { SupportedLang } from '../lib/seoConfig';

export type SeoPageType = 'homepage' | 'comparison' | 'guide' | 'solution' | 'glossary';

// Canonical slug for the landing page row. There's exactly one row per language
// for type='homepage', identified by slug='home'.
export const HOMEPAGE_SLUG = 'home';

// JSON shape stored in `content_json`. Kept flexible on purpose — the admin
// editor authors structured blocks (intro, table, FAQ, etc.), and rendering
// components pick the fields they understand. Unknown blocks are ignored.
export interface SeoContentBlock {
    type: string;
    [key: string]: unknown;
}

export interface SeoAuthor {
    id: string;
    name: string;
    job_title?: string;
    bio?: string;
    photo_url?: string;
    profile_url?: string;
}

export interface SeoPage {
    id: string;
    slug: string;
    type: SeoPageType;
    language: SupportedLang;
    title: string;
    meta_description: string;
    h1?: string;
    intro?: string; // 40-60 word direct answer block, rendered above the fold
    content_json: SeoContentBlock[];
    schema_json?: unknown; // pre-built JSON-LD override; otherwise schemas.ts is used
    hero_image?: string;
    author?: SeoAuthor | null;
    published_at?: string;
    updated_at: string;
    status: 'draft' | 'published';
    // For comparison pages: the list of competitors covered, in display order.
    competitors?: Array<{
        name: string;
        brand?: string;
        url?: string;
        image?: string;
        description?: string;
    }>;
    // FAQ items extracted for FAQPage schema + on-page rendering.
    faq?: Array<{ question: string; answer: string }>;
    // Per-page visual enrichment flags. Defaults align with the migration
    // (visual strip on, Instagram off) so unmigrated rows behave sensibly.
    show_visual_strip?: boolean;
    show_instagram?: boolean;
    // Editorial taxonomy added by 20260620 migration. tags renders as
    // .chip row in article footer + post-card meta; is_featured drives
    // the /resources featured slot + .hub-card eyebrow; media_color is
    // the fallback .ph variant when hero_image is null.
    tags?: string[];
    is_featured?: boolean;
    media_color?: 'default' | 'cream' | 'red';
}

export async function getSeoPage(
    type: SeoPageType,
    slug: string,
    language: SupportedLang,
): Promise<SeoPage | null> {
    try {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('*, author:seo_authors(*)')
            .eq('type', type)
            .eq('slug', slug)
            .eq('language', language)
            .eq('status', 'published')
            .maybeSingle();
        if (error) {
            // 42P01 = undefined_table; happens before migration runs.
            if ((error as { code?: string }).code === '42P01') return null;
            return null;
        }
        return (data as SeoPage) ?? null;
    } catch {
        return null;
    }
}

/** Fetch the published homepage SEO row for a given language. Returns null if
 *  none is published yet — callers should fall back to bundled i18n strings. */
export async function getHomepageSeo(language: SupportedLang): Promise<SeoPage | null> {
    return getSeoPage('homepage', HOMEPAGE_SLUG, language);
}

/** Fetches the image URLs from the landing CMS's visual_proof section so SEO
 *  content pages can re-use the brand's existing customer photos. Returns an
 *  empty array if no section is published — the caller (SiteVisualStrip) then
 *  falls back to its bundled defaults. */
export async function fetchVisualProofImages(): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from('landing_page_sections')
            .select('items:landing_page_items(image_url, image, media_url, src, sort_order)')
            .eq('section_type', 'visual_proof')
            .eq('is_active', true)
            .maybeSingle();
        if (error || !data) return [];
        const items = ((data as { items?: unknown }).items ?? []) as Array<Record<string, unknown>>;
        // The landing schema uses multiple historical column names for the image
        // URL; pick the first one that has a value so this keeps working as
        // the schema drifts.
        const urls = items
            .map((it) =>
                typeof it.image_url === 'string' ? it.image_url :
                typeof it.image === 'string' ? it.image :
                typeof it.media_url === 'string' ? it.media_url :
                typeof it.src === 'string' ? it.src :
                null,
            )
            .filter((u): u is string => !!u && u.startsWith('http'));
        return urls;
    } catch {
        return [];
    }
}

/** Light row shape used by the "Related pages" component — only the fields
 *  needed to render a card. Avoids pulling full content_json across the wire.
 *  Tags / featured / media_color added by 20260620 — surfaced on cards so
 *  the .post-card__cat chip and .ph fallback can reflect the admin choices. */
export interface RelatedPageCard {
    slug: string;
    type: SeoPageType;
    language: SupportedLang;
    title: string;
    intro: string | null;
    meta_description: string;
    hero_image: string | null;
    tags?: string[];
    is_featured?: boolean;
    media_color?: 'default' | 'cream' | 'red';
}

/** Fetch up to N other published pages in the same language, preferring the
 *  same type (solution → solutions, guide → guides) and excluding the current
 *  slug. The intent is to give readers cross-links inside the same content
 *  cluster, which boosts dwell time and crawl depth. */
export async function fetchRelatedPages(
    currentSlug: string,
    currentType: SeoPageType,
    language: SupportedLang,
    limit = 4,
): Promise<RelatedPageCard[]> {
    try {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('slug, type, language, title, intro, meta_description, hero_image, tags, is_featured, media_color')
            .eq('language', language)
            .eq('status', 'published')
            .eq('type', currentType)
            .neq('slug', currentSlug)
            .order('updated_at', { ascending: false })
            .limit(limit);
        if (error || !data) return [];
        return data as RelatedPageCard[];
    } catch {
        return [];
    }
}

/** List every published page of a given type in a language. Used by the
 *  category index pages (/[lang]/glossary, /[lang]/guides, /[lang]/solutions,
 *  /[lang]/compare) — the same RelatedPageCard shape is reused so cards render
 *  consistently. Ordered by most recently updated. */
export async function listPublishedPagesByType(
    type: SeoPageType,
    language: SupportedLang,
): Promise<RelatedPageCard[]> {
    try {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('slug, type, language, title, intro, meta_description, hero_image, tags, is_featured, media_color')
            .eq('language', language)
            .eq('status', 'published')
            .eq('type', type)
            .order('updated_at', { ascending: false });
        if (error || !data) return [];
        return data as RelatedPageCard[];
    } catch {
        return [];
    }
}

/** List ALL published content pages (glossary + guide + solution + comparison)
 *  in a single query. Used by the cross-type resources hub
 *  (/[lang]/resources) so a reader sees the full content set with type +
 *  topic chip filters in one view. Excludes type='homepage'. Ordered by
 *  published_at DESC so the featured slot at the top of the hub gets the
 *  newest content automatically. */
export async function listAllPublishedPages(
    language: SupportedLang,
): Promise<RelatedPageCard[]> {
    try {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('slug, type, language, title, intro, meta_description, hero_image, tags, is_featured, media_color')
            .eq('language', language)
            .eq('status', 'published')
            .in('type', ['glossary', 'guide', 'solution', 'comparison'])
            .order('published_at', { ascending: false, nullsFirst: false });
        if (error || !data) return [];
        return data as RelatedPageCard[];
    } catch {
        return [];
    }
}

/** List published languages for a given (type, slug). Used to populate the
 *  hreflang alternates on each page. */
export async function getAvailableLanguages(
    type: SeoPageType,
    slug: string,
): Promise<SupportedLang[]> {
    try {
        const { data, error } = await supabase
            .from('seo_pages')
            .select('language')
            .eq('type', type)
            .eq('slug', slug)
            .eq('status', 'published');
        if (error || !data) return [];
        return data.map((r) => r.language as SupportedLang);
    } catch {
        return [];
    }
}
