// Renders <head> metadata for a page: title, meta description, canonical,
// Open Graph, Twitter Card, and hreflang alternates for every supported
// language. Relies on React 19's native document metadata support — any
// <title>/<meta>/<link> rendered here is hoisted to <head>.
//
// Use at the top of every public page component:
//   <SEOHead path="/compare/cafepaste-vs-ripple-maker" title="..." description="..." />

import { useEffect } from 'react';
import {
    SITE_URL,
    SUPPORTED_LANGS,
    HREFLANG_VARIANTS,
    X_DEFAULT_LANG,
    type SupportedLang,
} from '../lib/seoConfig';

interface SEOHeadProps {
    // Path *without* the language prefix, with leading slash. e.g. "/" or "/compare/foo".
    path: string;
    // Current page language — determines canonical URL.
    lang: SupportedLang;
    title: string;
    description: string;
    // Optional absolute or root-relative image URL for OG/Twitter cards.
    image?: string;
    // "article" for guides/blog; "product" for product pages; default "website".
    ogType?: 'website' | 'article' | 'product';
    // Mark this page as no-index (drafts, private previews).
    noindex?: boolean;
    // Optional pre-built JSON-LD object (or array). Stringified into a
    // <script type="application/ld+json"> tag.
    jsonLd?: object | object[];
    // Override the set of languages the page exists in. Defaults to all
    // supported — useful for pages only translated partially.
    availableLangs?: SupportedLang[];
    // Per-language unprefixed path, for content whose slug differs by language
    // (the whole /blog tree: 'kahve-yazicisi' TR vs 'kaffee-drucker' DE).
    // When given it drives hreflang entirely — both which languages are listed
    // and the URL each one points at. Without it every alternate reuses `path`,
    // which is only correct for language-independent routes.
    altPaths?: Partial<Record<SupportedLang, string>>;
}

function buildLocaleUrl(lang: SupportedLang, path: string): string {
    const trimmed = path === '/' ? '' : path;
    return `${SITE_URL}/${lang}${trimmed}`;
}

export function SEOHead({
    path,
    lang,
    title,
    description,
    image,
    ogType = 'website',
    noindex = false,
    jsonLd,
    availableLangs,
    altPaths,
}: SEOHeadProps) {
    const canonical = buildLocaleUrl(lang, path);
    const langs = altPaths
        ? (Object.keys(altPaths) as SupportedLang[])
        : availableLangs ?? [...SUPPORTED_LANGS];
    // Every alternate's path: the language's own slug when known, else `path`.
    const pathFor = (altLang: SupportedLang) => altPaths?.[altLang] ?? path;

    // Keep <html lang> in sync with the active page language. The static
    // index.html ships lang="en" (global default); without this, Google's
    // rendered DOM for /tr, /de, … would still report English (or whatever the
    // shell shipped), sending a mixed/incorrect language signal that collapses
    // every locale into one in the index. React 19 hoists <title>/<meta> but
    // NOT the documentElement lang attribute, so we set it imperatively.
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = lang;
        }
    }, [lang]);
    // Image priority:
    //   1. Explicit `image` prop (admin-set hero image)
    //   2. Static og-default.jpg (1200×630 raster). NOT the old /api/og SVG —
    //      FB/WhatsApp/LinkedIn/Twitter don't render SVG og:image, so the
    //      dynamic SVG produced blank social previews.
    const absoluteImage = image
        ? image.startsWith('http')
            ? image
            : `${SITE_URL}${image.startsWith('/') ? '' : '/'}${image}`
        : `${SITE_URL}/og-default.jpg`;

    const jsonLdString = jsonLd ? JSON.stringify(jsonLd) : null;

    return (
        <>
            <title>{title}</title>
            <meta name="description" content={description} />
            {noindex ? (
                <meta name="robots" content="noindex, nofollow" />
            ) : (
                <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
            )}
            <link rel="canonical" href={canonical} />

            {/* hreflang — every language this page exists in + regional variants */}
            {langs.flatMap((altLang) =>
                HREFLANG_VARIANTS[altLang].map((hreflang) => (
                    <link
                        key={`${altLang}-${hreflang}`}
                        rel="alternate"
                        hrefLang={hreflang}
                        href={buildLocaleUrl(altLang, pathFor(altLang))}
                    />
                )),
            )}
            {/* x-default — the fallback AI engines / search engines pick when
                the user's locale doesn't match any published language. English
                gives the broadest global reach. If EN isn't published for this
                page, fall back to the first available language. */}
            <link
                rel="alternate"
                hrefLang="x-default"
                href={(() => {
                    const xLang = langs.includes(X_DEFAULT_LANG)
                        ? X_DEFAULT_LANG
                        : (langs[0] ?? X_DEFAULT_LANG);
                    return buildLocaleUrl(xLang, pathFor(xLang));
                })()}
            />

            {/* Open Graph */}
            <meta property="og:type" content={ogType} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={canonical} />
            <meta property="og:image" content={absoluteImage} />
            <meta property="og:site_name" content="CAFEPASTE" />
            <meta property="og:locale" content={lang === 'tr' ? 'tr_TR' : lang === 'en' ? 'en_US' : `${lang}_${lang.toUpperCase()}`} />
            {langs
                .filter((l) => l !== lang)
                .map((l) => (
                    <meta key={l} property="og:locale:alternate" content={l === 'tr' ? 'tr_TR' : l === 'en' ? 'en_US' : `${l}_${l.toUpperCase()}`} />
                ))}

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={absoluteImage} />

            {/* JSON-LD structured data */}
            {jsonLdString && (
                <script
                    type="application/ld+json"
                    // React 19 sanitizes dangerouslySetInnerHTML for script tags; this is
                    // the canonical way to ship JSON-LD without escaping issues.
                    dangerouslySetInnerHTML={{ __html: jsonLdString }}
                />
            )}
        </>
    );
}
