// Cross-language slug groups for the /blog SEO content tree.
//
// WHY THIS FILE EXISTS
// `seo_pages` stores one row per (slug, language, type) and slugs are
// deliberately localized ('kahve-yazicisi' TR / 'kaffee-drucker' DE), but the
// table records NO link between a page and its translations. Without that link
// the language switcher can only swap the /:lang prefix, which lands on a slug
// that doesn't exist in the target language — a 404 on every language switch.
//
// This map is that missing link. It was reconciled against live published rows,
// not hand-written: every group below resolves at least one published page, and
// together they cover 100% of the published non-homepage rows as of 2026-08-15.
// Sources, in order of trust:
//   1. `*_all_langs` / `*_6langs` seed migrations — one file = one concept.
//   2. Multi-concept per-language seed families, aligned positionally.
//   3. Hand-clustered admin/AI-authored content that was never seeded.
//
// KEEP THIS FILE DEPENDENCY-FREE. It is imported by the Cloudflare Worker
// bundle (langSlugRedirect / prerender / sitemap) as well as the browser, so a
// value import of anything Supabase- or `import.meta.env`-shaped would break the
// worker build. Type-only imports are fine — they are erased at compile time.
//
// MAINTENANCE: new content authored in the admin does NOT appear here
// automatically. The SEO Roadmap admin page surfaces a drift banner listing
// published rows that belong to no group; those pages fall back to the section
// index on language switch instead of resolving. Phase 2 (a `group_key` column
// on `seo_pages`, backfilled from these ids) removes the need to hand-edit this
// file — see supabase/migrations/20260816_seo_pages_group_key.sql.

import type { SupportedLang } from './seoConfig';

/** Content types that live under /:lang/blog/. `homepage` is excluded — it has
 *  a single shared slug and never needs cross-language resolution. */
export type SeoGroupType = 'comparison' | 'guide' | 'solution' | 'glossary';

export interface SlugGroup {
    /** Stable id. Doubles as the `group_key` value once Phase 2 is applied. */
    id: string;
    type: SeoGroupType;
    /** Per-language slug. Partial on purpose: several concepts are genuinely
     *  published in only some languages, and claiming otherwise would make the
     *  resolver point at pages that don't exist. */
    slug: Partial<Record<SupportedLang, string>>;
}

/** URL segment each content type lives under: /:lang/blog/{section}/:slug */
export const SECTION_FOR_TYPE: Record<SeoGroupType, string> = {
    comparison: 'compare',
    guide: 'guides',
    solution: 'solutions',
    glossary: 'glossary',
};

const TYPE_FOR_SECTION: Record<string, SeoGroupType> = {
    compare: 'comparison',
    guides: 'guide',
    solutions: 'solution',
    glossary: 'glossary',
};

export const SEO_SLUG_GROUPS: SlugGroup[] = [
    // ---- glossary ----
    { id: 'glossary-beverage-art-creator', type: 'glossary', slug: { tr: 'icecek-sanat-makinesi', en: 'beverage-art-creator', de: 'beverage-art-creator', fr: 'beverage-art-creator', es: 'beverage-art-creator', it: 'beverage-art-creator', pl: 'beverage-art-creator' } },
    { id: 'glossary-beverage-art-creator-legacy', type: 'glossary', slug: { tr: 'icecek-art-makinesi', de: 'getraenke-art-creator', fr: 'createur-art-boisson', es: 'creador-arte-bebida', it: 'creatore-arte-bevande', pl: 'kreator-art-napojow' } }, // no en variant
    { id: 'glossary-beverage-art-machine', type: 'glossary', slug: { en: 'beverage-art-machine', de: 'getraenkekunst-maschine' } }, // no tr/fr/es/it/pl variant
    { id: 'glossary-beverage-printing', type: 'glossary', slug: { tr: 'icecek-baskisi', en: 'beverage-printing', de: 'getraenkedruck', fr: 'impression-boisson', es: 'impresion-bebidas', it: 'stampa-bevande', pl: 'druk-na-napojach' } },
    { id: 'glossary-cafepaste-origin', type: 'glossary', slug: { tr: 'cafepaste-nerenin-markasi', en: 'where-is-cafepaste-from', de: 'woher-kommt-cafepaste', fr: 'd-ou-vient-cafepaste', es: 'de-donde-es-cafepaste', it: 'da-dove-viene-cafepaste', pl: 'skad-pochodzi-cafepaste' } },
    { id: 'glossary-cocktail-printer', type: 'glossary', slug: { tr: 'kokteyl-yazicisi', en: 'cocktail-printer', de: 'cocktail-drucker', fr: 'imprimante-cocktail', es: 'impresora-de-cocteles', it: 'stampante-cocktail', pl: 'drukarka-do-koktajli' } },
    { id: 'glossary-coffee-logo-printing', type: 'glossary', slug: { tr: 'kahveye-logo-baskisi', en: 'coffee-logo-printing', de: 'logo-druck-auf-kaffee', fr: 'impression-logo-cafe', es: 'impresion-logo-cafe', it: 'stampa-logo-caffe', pl: 'druk-logo-na-kawie' } },
    { id: 'glossary-coffee-printer', type: 'glossary', slug: { tr: 'kahve-yazicisi', en: 'coffee-printer', de: 'kaffee-drucker', fr: 'imprimante-cafe', es: 'impresora-de-cafe', it: 'stampante-caffe', pl: 'drukarka-do-kawy' } },
    { id: 'glossary-coffee-printing', type: 'glossary', slug: { tr: 'kahve-baskisi', en: 'coffee-printing', de: 'kaffeedruck', fr: 'impression-cafe', es: 'impresion-cafe', it: 'stampa-caffe', pl: 'druk-kawowy' } },
    { id: 'glossary-coffee-printing-machine', type: 'glossary', slug: { tr: 'kahve-baski-makinesi', en: 'coffee-printing-machine', de: 'kaffee-druck-maschine', fr: 'machine-impression-cafe', es: 'maquina-impresion-cafe', it: 'macchina-stampa-caffe', pl: 'maszyna-do-druku-na-kawie' } },
    { id: 'glossary-cup-branding', type: 'glossary', slug: { tr: 'bardak-markalama', en: 'cup-branding', de: 'becher-branding', fr: 'branding-sur-verre', es: 'branding-en-vaso', it: 'branding-su-bicchiere', pl: 'branding-na-kubku' } },
    { id: 'glossary-drink-personalization', type: 'glossary', slug: { tr: 'icecek-kisisellestirme', en: 'drink-personalization', de: 'getraenke-personalisierung', fr: 'personnalisation-boisson', es: 'personalizacion-bebida', it: 'personalizzazione-bevanda', pl: 'personalizacja-napoju' } },
    { id: 'glossary-edible-ink', type: 'glossary', slug: { tr: 'yenilebilir-murekkep', en: 'edible-ink', de: 'essbare-tinte', fr: 'encre-comestible', es: 'tinta-comestible', it: 'inchiostro-commestibile', pl: 'jadalny-atrament' } },
    { id: 'glossary-foam-printer', type: 'glossary', slug: { tr: 'kopuk-yazicisi', en: 'foam-printer', de: 'schaum-drucker', fr: 'imprimante-mousse', es: 'impresora-de-espuma', it: 'stampante-schiuma', pl: 'drukarka-do-pianki' } },
    { id: 'glossary-foam-printing', type: 'glossary', slug: { tr: 'kopuk-baskisi', en: 'foam-printing', de: 'schaumdruck', fr: 'impression-sur-mousse', es: 'impresion-sobre-espuma', it: 'stampa-sulla-schiuma', pl: 'druk-na-piance' } },
    { id: 'glossary-latte-art', type: 'glossary', slug: { tr: 'latte-art', en: 'latte-art', de: 'latte-art', fr: 'latte-art', es: 'latte-art', it: 'latte-art', pl: 'latte-art' } },
    { id: 'glossary-latte-art-printer', type: 'glossary', slug: { tr: 'latte-art-yazicisi', en: 'latte-art-printer', de: 'latte-art-drucker', fr: 'imprimante-latte-art', es: 'impresora-latte-art', it: 'stampante-latte-art', pl: 'drukarka-latte-art' } },
    { id: 'glossary-latte-art-printing', type: 'glossary', slug: { tr: 'latte-art-baskisi', en: 'latte-art-printing', de: 'latte-art-druck', fr: 'impression-latte-art', es: 'impresion-latte-art', it: 'stampa-latte-art', pl: 'druk-latte-art' } },
    { id: 'glossary-photo-printing-on-coffee', type: 'glossary', slug: { tr: 'kahve-uzerine-fotograf-baskisi', en: 'photo-printing-on-coffee', de: 'fotodruck-auf-kaffee', fr: 'impression-photo-sur-cafe', es: 'impresion-foto-en-cafe', it: 'stampa-foto-sul-caffe', pl: 'druk-zdjec-na-kawie' } },
    { id: 'glossary-qr-cup-system', type: 'glossary', slug: { tr: 'qr-bardak-sistemi', en: 'qr-cup-system', de: 'qr-becher-system', fr: 'systeme-verre-qr', es: 'sistema-vaso-qr', it: 'sistema-bicchiere-qr', pl: 'system-kubka-qr' } },
    { id: 'glossary-selfie-coffee', type: 'glossary', slug: { tr: 'selfie-kahve', en: 'selfie-coffee', de: 'selfie-kaffee', fr: 'selfie-cafe', es: 'selfie-cafe', it: 'selfie-caffe', pl: 'selfie-kawa' } },
    { id: 'glossary-selfie-coffee-printer', type: 'glossary', slug: { tr: 'selfie-kahve-yazicisi', en: 'selfie-coffee-printer', de: 'selfie-kaffee-drucker', fr: 'imprimante-cafe-selfie', es: 'impresora-de-cafe-selfie', it: 'stampante-caffe-selfie', pl: 'drukarka-selfie-kawy' } },
    { id: 'glossary-what-is-beverage-art-printer', type: 'glossary', slug: { tr: 'kahve-baski-makinesi-nedir', en: 'what-is-beverage-art-printer', de: 'was-ist-getraenkedrucker', fr: 'quest-ce-imprimante-boisson', es: 'que-es-impresora-bebidas', it: 'cose-stampante-bevande', pl: 'co-to-drukarka-do-napojow' } },

    // ---- guide ----
    { id: 'guide-beverage-art-printing', type: 'guide', slug: { tr: 'icecek-sanat-baskisi-rehber', en: 'beverage-art-printing-guide', de: 'getraenkekunst-druck-leitfaden', fr: 'guide-impression-art-boisson', es: 'guia-impresion-arte-bebida', it: 'guida-stampa-beverage-art', pl: 'przewodnik-druku-beverage-art' } },
    { id: 'guide-cafe-latte-art-cost', type: 'guide', slug: { tr: 'kafe-latte-art-makinesi-maliyeti', en: 'cafe-latte-art-machine-cost', de: 'cafe-latte-art-maschine-kosten', fr: 'cout-machine-latte-art-cafe', es: 'costo-maquina-latte-art-cafeteria', it: 'costo-macchina-latte-art-caffetteria', pl: 'koszt-maszyny-latte-art-kawiarnia' } },
    { id: 'guide-hotel-breakfast-experience', type: 'guide', slug: { tr: 'otel-kahvalti-kisisellestirilmis-kahve', en: 'hotel-breakfast-personalized-coffee', de: 'hotel-fruehstueck-personalisierter-kaffee', fr: 'petit-dejeuner-hotel-cafe-personnalise', es: 'desayuno-hotel-cafe-personalizado', it: 'colazione-hotel-caffe-personalizzato', pl: 'sniadanie-hotel-kawa-personalizowana' } },
    { id: 'guide-how-it-works', type: 'guide', slug: { tr: 'latte-art-baski-nasil-calisir', en: 'how-latte-art-printing-works', de: 'wie-latte-art-druck-funktioniert', fr: 'comment-fonctionne-impression-latte-art', es: 'como-funciona-la-impresion-de-latte-art', it: 'come-funziona-stampa-latte-art', pl: 'jak-dziala-druk-latte-art' } },
    { id: 'guide-how-to-choose-machine', type: 'guide', slug: { tr: 'icecek-sanat-makinesi-nasil-secilir', en: 'how-to-choose-beverage-art-machine', de: 'getraenkekunst-maschine-auswaehlen', fr: 'choisir-machine-art-boisson', es: 'elegir-maquina-arte-bebida', it: 'come-scegliere-macchina-beverage-art', pl: 'jak-wybrac-maszyne-beverage-art' } },
    { id: 'guide-price-cost-range', type: 'guide', slug: { tr: 'kahve-yazicisi-fiyati', en: 'coffee-printer-price-cost-guide', de: 'kaffeedrucker-preis-kosten', fr: 'imprimante-cafe-prix-cout', es: 'impresora-de-cafe-precio-coste', it: 'stampante-caffe-prezzo-costi', pl: 'drukarka-do-kawy-cena-koszty' } },
    { id: 'guide-printing-technology', type: 'guide', slug: { tr: 'kahve-uzerine-baski-teknolojisi', en: 'coffee-printing-technology', de: 'kaffee-druck-technologie', fr: 'technologie-impression-cafe', es: 'tecnologia-impresion-cafe', it: 'tecnologia-stampa-caffe', pl: 'technologia-druku-kawa' } },
    { id: 'guide-pro-vs-lite-model-picker', type: 'guide', slug: { tr: 'hangi-model-pro-vs-lite', en: 'cafepaste-pro-vs-lite-which-model', de: 'pro-vs-lite-welches-modell', fr: 'pro-vs-lite-quel-modele', es: 'pro-vs-lite-que-modelo', it: 'pro-vs-lite-quale-modello', pl: 'pro-vs-lite-ktory-model' } },
    { id: 'guide-roi-cafe', type: 'guide', slug: { tr: 'kafe-latte-art-makinesi-roi', en: 'cafe-latte-art-machine-roi', de: 'cafe-latte-art-maschine-roi', fr: 'roi-machine-latte-art-cafe', es: 'roi-maquina-latte-art-cafeteria', it: 'roi-macchina-latte-art-caffetteria', pl: 'roi-maszyna-latte-art-kawiarnia' } },
    { id: 'guide-wedding-coffee-bar', type: 'guide', slug: { tr: 'dugun-kahve-bar-rehberi', en: 'wedding-coffee-bar-guide', de: 'hochzeit-kaffee-bar-leitfaden', fr: 'guide-bar-cafe-mariage', es: 'guia-bar-cafe-boda', it: 'guida-bar-caffe-matrimonio', pl: 'przewodnik-bar-kawowy-wesele' } },
    { id: 'guide-what-is-beverage-art', type: 'guide', slug: { tr: 'icecek-art-makinesi-nedir', en: 'what-is-a-beverage-art-creator', de: 'was-ist-eine-getraenke-druck-maschine', fr: 'quest-ce-quune-machine-art-boisson', es: 'que-es-una-maquina-de-arte-para-bebidas', it: 'cose-una-macchina-per-beverage-art', pl: 'co-to-jest-maszyna-do-beverage-art' } },

    // ---- solution ----
    { id: 'solution-bakery', type: 'solution', slug: { tr: 'pastane-cozumu', en: 'bakery-solution', de: 'baeckerei-loesung', fr: 'solution-patisserie', es: 'solucion-pasteleria', it: 'soluzione-pasticceria', pl: 'rozwiazanie-cukierni' } },
    { id: 'solution-cafe', type: 'solution', slug: { tr: 'cafe-cozumu', en: 'cafe-solution', de: 'cafe-loesung', fr: 'solution-cafe', es: 'solucion-cafeteria', it: 'soluzione-caffetteria', pl: 'rozwiazanie-kawiarni' } },
    { id: 'solution-cafe-legacy', type: 'solution', slug: { tr: 'kafe', en: 'cafe', de: 'cafe', fr: 'cafe', es: 'cafeteria', it: 'caffetteria', pl: 'kawiarnia' } },
    { id: 'solution-corporate-logo-printing', type: 'solution', slug: { tr: 'içeceklere-kurumsal-logo-baskisi', en: 'corporate-logo-printing-on-beverages', es: 'impresion-de-logotipo-corporativo-en-bebidas', pl: 'korporacyjny-druk-logo-na-napojach' } }, // no de/fr/it variant
    { id: 'solution-hotel', type: 'solution', slug: { tr: 'otel-cozumu', en: 'hotel-solution', de: 'hotel-loesung', fr: 'solution-hotel', es: 'solucion-hotel', it: 'soluzione-hotel', pl: 'rozwiazanie-hotelowe' } },
    { id: 'solution-hotel-legacy', type: 'solution', slug: { tr: 'otel', en: 'hotel', de: 'getraenkekunst-druck-fuer-hotels', fr: 'hotel', es: 'hotel', it: 'hotel', pl: 'hotel' } },
    { id: 'solution-marketing-agency', type: 'solution', slug: { tr: 'pazarlama-ajansi', en: 'marketing-agency', de: 'marketing-agentur', fr: 'agence-marketing', es: 'agencia-marketing', it: 'agenzia-marketing', pl: 'agencja-marketingowa' } },
    { id: 'solution-wedding-event', type: 'solution', slug: { tr: 'etkinlik-dugun-cozumu', en: 'wedding-event-solution', de: 'hochzeit-event-loesung', fr: 'solution-mariage-evenement', es: 'solucion-boda-evento', it: 'soluzione-matrimonio-evento', pl: 'rozwiazanie-wesele-event' } },
    { id: 'solution-wedding-event-legacy', type: 'solution', slug: { tr: 'etkinlik-dugun', en: 'wedding-event', de: 'hochzeit-event', fr: 'mariage-evenement', es: 'boda-evento', it: 'matrimonio-evento', pl: 'wesele-event' } },
    { id: 'use-case-birthday', type: 'solution', slug: { tr: 'dogum-gunu-organizasyonu', en: 'birthday-events', de: 'geburtstag-events', fr: 'anniversaire-evenement', es: 'cumpleanos-eventos', it: 'compleanno-eventi', pl: 'urodziny-event' } },
    { id: 'use-case-cafe-instagram', type: 'solution', slug: { tr: 'kafe-instagram-viral-icerik', en: 'cafe-instagram-viral-content', de: 'cafe-instagram-viraler-content', fr: 'cafe-instagram-contenu-viral', es: 'cafeteria-instagram-contenido-viral', it: 'caffetteria-instagram-contenuto-virale', pl: 'kawiarnia-instagram-viralna-tresc' } },
    { id: 'use-case-logo-printing', type: 'solution', slug: { tr: 'logo-baski', en: 'logo-printing', de: 'logo-druck', fr: 'impression-logo', es: 'impresion-logo', it: 'stampa-logo', pl: 'druk-logo' } },
    { id: 'use-case-photo-printing', type: 'solution', slug: { tr: 'foto-baski', en: 'photo-printing', de: 'foto-druck', fr: 'impression-photo', es: 'impresion-foto', it: 'stampa-foto', pl: 'druk-zdjec' } },
    { id: 'use-case-restaurant', type: 'solution', slug: { tr: 'restoran-kahve-baski', en: 'restaurant-coffee-printing', de: 'restaurant-kaffeedruck', fr: 'restaurant-impression-cafe', es: 'restaurante-impresion-cafe', it: 'ristorante-stampa-caffe', pl: 'restauracja-druk-kawy' } },

    // ---- comparison ----
    { id: 'compare-best-coffee-printer', type: 'comparison', slug: { tr: 'en-iyi-kahve-yazicisi', en: 'best-coffee-printer', de: 'bester-kaffeedrucker', fr: 'meilleure-imprimante-cafe', es: 'mejor-impresora-de-cafe', it: 'migliore-stampante-caffe', pl: 'najlepsza-drukarka-do-kawy' } },
    { id: 'compare-best-commercial-coffee-printer', type: 'comparison', slug: { tr: 'en-iyi-ticari-kahve-yazicisi', en: 'best-commercial-coffee-printer', de: 'bester-kommerzieller-kaffeedrucker', fr: 'meilleure-imprimante-cafe-professionnelle', es: 'mejor-impresora-de-cafe-comercial', it: 'migliore-stampante-caffe-professionale', pl: 'najlepsza-komercyjna-drukarka-do-kawy' } },
    { id: 'compare-beverage-art-vs-coffee-printer', type: 'comparison', slug: { tr: 'icecek-art-makinesi-vs-kahve-yazicisi', en: 'beverage-art-creator-vs-coffee-printer', de: 'beverage-art-creator-vs-kaffeedrucker', fr: 'beverage-art-creator-vs-imprimante-a-cafe', es: 'beverage-art-creator-vs-impresora-de-cafe', it: 'beverage-art-creator-vs-stampante-per-caffe', pl: 'beverage-art-creator-vs-drukarka-do-kawy' } },
    { id: 'compare-cino-printer-alternative', type: 'comparison', slug: { tr: 'cino-printer-alternatifi', en: 'cino-printer-alternative', de: 'cino-printer-alternative', fr: 'cino-printer-alternative', es: 'cino-printer-alternativa', it: 'cino-printer-alternativa', pl: 'cino-printer-alternatywa' } },
    { id: 'compare-coffee-colorato-alternative', type: 'comparison', slug: { tr: 'coffee-colorato-alternatifi', en: 'coffee-colorato-alternative', de: 'coffee-colorato-alternative', fr: 'coffee-colorato-alternative', es: 'coffee-colorato-alternativa', it: 'coffee-colorato-alternativa', pl: 'coffee-colorato-alternatywa' } },
    { id: 'compare-coffee-crafter-alternative', type: 'comparison', slug: { tr: 'coffee-crafter-alternatifi', en: 'coffee-crafter-alternative', de: 'coffee-crafter-alternative', fr: 'alternative-coffee-crafter', es: 'alternativa-coffee-crafter', it: 'alternativa-coffee-crafter', pl: 'alternatywa-coffee-crafter' } },
    { id: 'compare-evebot-alternative', type: 'comparison', slug: { tr: 'evebot-alternatifi', en: 'evebot-alternative', de: 'evebot-alternative', fr: 'evebot-alternative', es: 'evebot-alternativa', it: 'evebot-alternativa', pl: 'evebot-alternatywa' } },
    { id: 'compare-ripple-maker-alternative', type: 'comparison', slug: { tr: 'ripple-maker-alternatifi', en: 'ripple-maker-alternative', de: 'ripple-maker-alternative', fr: 'ripple-maker-alternative', es: 'ripple-maker-alternativa', it: 'ripple-maker-alternativa', pl: 'ripple-maker-alternatywa' } },
];

// Reverse index, built once at module load. A slug can legitimately repeat
// across languages inside one group (e.g. 'latte-art' in all 7, or
// 'ripple-maker-alternative' in en/de/fr) — that collapses to a single entry
// pointing at the same group, which is exactly what we want. Slugs are never
// shared BETWEEN groups of the same type; the admin drift audit enforces that.
const BY_TYPE_SLUG = new Map<string, SlugGroup>();
for (const group of SEO_SLUG_GROUPS) {
    for (const slug of Object.values(group.slug)) {
        BY_TYPE_SLUG.set(`${group.type}:${slug}`, group);
    }
}

const BY_ID = new Map(SEO_SLUG_GROUPS.map((g) => [g.id, g]));

/** The translation group a (type, slug) belongs to, or null if unknown. */
export function findGroupBySlug(type: SeoGroupType, slug: string): SlugGroup | null {
    return BY_TYPE_SLUG.get(`${type}:${slug}`) ?? null;
}

export function findGroupById(id: string): SlugGroup | null {
    return BY_ID.get(id) ?? null;
}

/** Slug the same concept uses in `targetLang`, or null when this concept has no
 *  variant in that language (or the slug belongs to no known group).
 *  NOTE: this says nothing about whether the target page is *published* —
 *  callers that redirect must verify against the DB first. */
export function resolveSlug(
    type: SeoGroupType,
    slug: string,
    targetLang: SupportedLang,
): string | null {
    return findGroupBySlug(type, slug)?.slug[targetLang] ?? null;
}

/** Every candidate slug for a group, for a single `slug=in.(…)` DB lookup. */
export function candidateSlugs(group: SlugGroup): string[] {
    return [...new Set(Object.values(group.slug))];
}

export interface BlogDetailPath {
    lang: string;
    section: string;
    type: SeoGroupType;
    slug: string;
}

/** Parse `/:lang/blog/:section/:slug` — the only shape that can carry a
 *  cross-language slug mismatch. Returns null for every other path, which is
 *  what keeps the worker hot path free. Language is NOT validated here; the
 *  caller does that with `isSupportedLang` to avoid importing runtime values. */
export function parseBlogDetailPath(pathname: string): BlogDetailPath | null {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length !== 4 || segments[1] !== 'blog') return null;
    const [lang, , section, rawSlug] = segments;
    const type = TYPE_FOR_SECTION[section];
    if (!type) return null;
    let slug: string;
    try {
        slug = decodeURIComponent(rawSlug);
    } catch {
        return null; // malformed percent-encoding — let the normal 404 path handle it
    }
    if (!slug) return null;
    return { lang, section, type, slug };
}

/** Canonical public path for a page. Slug is percent-encoded because a handful
 *  of TR slugs carry non-ASCII characters (e.g. 'içeceklere-kurumsal-logo-baskisi'). */
export function blogDetailPath(lang: string, type: SeoGroupType, slug: string): string {
    return `/${lang}/blog/${SECTION_FOR_TYPE[type]}/${encodeURIComponent(slug)}`;
}

/** Section index path, used as the graceful fallback when a concept has no
 *  variant in the target language. */
export function blogSectionPath(lang: string, type: SeoGroupType): string {
    return `/${lang}/blog/${SECTION_FOR_TYPE[type]}`;
}
