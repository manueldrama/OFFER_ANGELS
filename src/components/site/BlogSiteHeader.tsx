// Editorial blog header for the SEO content section. Renders on
// SeoContentPage / SeoIndexPage / SeoResourcesHub, NOT on the
// landing / admin / product pages — those keep using the
// existing SiteHeader (src/components/site/SiteHeader.tsx).
//
// Design reference: design-reference/CAFEPASTE Blog.html — two-row
// sticky header (utility band + main header). The main site's
// language switcher and logo lockup are preserved here so that
// a reader who lands on /tr/glossary/... still sees a CAFEPASTE
// brand handshake and can switch languages.
//
// Rendering rules:
//   - Outer element relies on a `.cp-blog-skin` ancestor (set by
//     the SEO page wrappers). All visual styles cascade through
//     seo-tokens.css + seo-base.css + seo-components.css.
//   - Sticky positioning, no glass blur — design-ref uses flat
//     paper / ink backgrounds.
//   - No "Demo" CTA anywhere. Primary right-side action is the
//     existing language switch + a link back to the main product
//     site (`/[lang]`).

import { Link, useLocation, useParams } from 'react-router-dom';
import { resolveLangSwitchPath } from '../../lib/langSwitchTarget';
import {
    SUPPORTED_LANGS,
    getUiStrings,
    isSupportedLang,
    type SupportedLang,
} from '../../lib/seoConfig';

// Single source of truth for the editorial top-nav. Keeping it as
// data (not JSX) so we can later move it into seoConfig.ts when the
// rest of the labels need to be translated for new locales.
const NAV_ITEMS: Array<{
    /** Pathname suffix appended after `/${lang}` */
    href: string;
    /** Localized labels (mirrors SeoUiStrings.breadcrumb*). */
    labels: Record<SupportedLang, string>;
}> = [
    {
        href: '/blog',
        labels: {
            tr: 'Tümü', en: 'All', de: 'Alle', fr: 'Tous',
            es: 'Todos', it: 'Tutti', pl: 'Wszystkie',
        },
    },
    {
        href: '/blog/glossary',
        labels: {
            tr: 'Sözlük', en: 'Glossary', de: 'Glossar', fr: 'Glossaire',
            es: 'Glosario', it: 'Glossario', pl: 'Słownik',
        },
    },
    {
        href: '/blog/guides',
        labels: {
            tr: 'Rehber', en: 'Guides', de: 'Leitfäden', fr: 'Guides',
            es: 'Guías', it: 'Guide', pl: 'Przewodniki',
        },
    },
    {
        href: '/blog/solutions',
        labels: {
            tr: 'Çözümler', en: 'Solutions', de: 'Lösungen', fr: 'Solutions',
            es: 'Soluciones', it: 'Soluzioni', pl: 'Rozwiązania',
        },
    },
];

// "Editorial Sürüm" / "Editorial Edition" — the utility band's
// brand stamp. Hardcoded here (TR/EN only) because it never changes
// per page and isn't a translatable copy users will see in deep
// nav. The brand label always reads as the CAFEPASTE editorial.
const UTILITY_BAND_LABEL: Record<SupportedLang, { mark: string; tag: string }> = {
    tr: { mark: 'CAFEPASTE BLOG', tag: 'EDİTORYAL' },
    en: { mark: 'CAFEPASTE BLOG', tag: 'EDITORIAL' },
    de: { mark: 'CAFEPASTE BLOG', tag: 'EDITORIAL' },
    fr: { mark: 'CAFEPASTE BLOG', tag: 'ÉDITORIAL' },
    es: { mark: 'CAFEPASTE BLOG', tag: 'EDITORIAL' },
    it: { mark: 'CAFEPASTE BLOG', tag: 'EDITORIALE' },
    pl: { mark: 'CAFEPASTE BLOG', tag: 'REDAKCJA' },
};

interface BlogSiteHeaderProps {
    /** Active language (already validated). Falls back to the URL
     *  `:lang` param if not provided — useful when rendered from
     *  page components that haven't extracted the lang yet. */
    lang?: SupportedLang;
}

export function BlogSiteHeader({ lang: langProp }: BlogSiteHeaderProps) {
    const params = useParams<{ lang?: string }>();
    const lang: SupportedLang =
        langProp ?? (isSupportedLang(params.lang) ? (params.lang as SupportedLang) : 'tr');
    const location = useLocation();
    const ui = getUiStrings(lang);
    const utility = UTILITY_BAND_LABEL[lang];

    // Active link detection: a nav entry is active if the current
    // pathname starts with `/${lang}${href}`. This treats list /
    // detail pages alike (e.g. /tr/guides AND /tr/guides/foo light
    // up the Rehber link).
    function isActive(href: string): boolean {
        const target = `/${lang}${href}`;
        if (location.pathname === target) return true;
        return location.pathname.startsWith(`${target}/`);
    }

    return (
        <header
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 60,
                background: 'var(--paper)',
                borderBottom: '1px solid var(--line)',
            }}
        >
            {/* ── Utility band — dark ink bg, mono brand stamp,
                  language switcher + link back to product site ── */}
            <div
                style={{
                    background: 'var(--ink)',
                    color: 'var(--text-on-ink-2)',
                    height: 32,
                }}
            >
                <div
                    className="container-wide"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: '100%',
                        gap: 'var(--s5)',
                        fontSize: 'var(--fs-11)',
                        letterSpacing: '0.06em',
                    }}
                >
                    <div
                        style={{
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: 'var(--text-on-ink-3)',
                        }}
                    >
                        <b style={{ color: 'var(--text-on-ink-1)', fontWeight: 600 }}>
                            {utility.mark}
                        </b>{' '}
                        · {utility.tag}
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--s5)',
                        }}
                    >
                        {/* Language switcher — minimal anchor list. Same
                            URL path, swap the lang segment. */}
                        <LanguageSwitcher lang={lang} pathname={location.pathname} />
                        <Link
                            to={`/${lang}`}
                            style={{
                                color: 'var(--text-on-ink-2)',
                                transition: 'color var(--d1)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--paper)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-on-ink-2)';
                            }}
                        >
                            ← {ui.backToHome}
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── Main header — logo + primary nav ── */}
            <div
                className="container-wide"
                style={{
                    height: 'var(--header-h)',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    alignItems: 'center',
                    gap: 'var(--s8)',
                }}
            >
                <Link
                    to={`/${lang}`}
                    aria-label="CAFEPASTE"
                    style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 1,
                        lineHeight: 1,
                        flexShrink: 0,
                        textDecoration: 'none',
                    }}
                >
                    <span
                        style={{
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 700,
                            fontSize: 'var(--fs-18)',
                            letterSpacing: '0.04em',
                            color: 'var(--ink)',
                        }}
                    >
                        CAFEPASTE
                        <span aria-hidden="true" style={{ color: 'var(--red)' }}>
                            .
                        </span>
                    </span>
                    <span
                        style={{
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 500,
                            fontSize: 9,
                            letterSpacing: '0.22em',
                            color: 'var(--text-3)',
                            textTransform: 'uppercase',
                            marginTop: 2,
                        }}
                    >
                        Beverage Art Creator
                    </span>
                </Link>

                <nav
                    aria-label="Editorial sections"
                    style={{
                        display: 'flex',
                        gap: 'var(--s2)',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                    }}
                    className="cp-blog-nav"
                >
                    {NAV_ITEMS.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                to={`/${lang}${item.href}`}
                                style={{
                                    fontSize: 'var(--fs-14)',
                                    fontWeight: 500,
                                    color: active ? 'var(--ink)' : 'var(--text-2)',
                                    background: active ? 'var(--cream-deep)' : 'transparent',
                                    padding: '8px 14px',
                                    borderRadius: 'var(--r-sm)',
                                    transition: 'all var(--d1)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    textDecoration: 'none',
                                }}
                                onMouseEnter={(e) => {
                                    if (!active) {
                                        e.currentTarget.style.background = 'var(--cream)';
                                        e.currentTarget.style.color = 'var(--ink)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!active) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-2)';
                                    }
                                }}
                            >
                                {item.labels[lang]}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Mobile responsive — hide secondary nav under 760px; the
                utility band's lang switcher stays available so reader
                can still pick a different locale. */}
            <style>{`
                @media (max-width: 760px) {
                    .cp-blog-nav { display: none !important; }
                }
            `}</style>
        </header>
    );
}

// Tiny inline language switcher — renders the 7 supported lang
// abbreviations and links to the same page in the target language.
// Stops there: no nav recompute, no flag image, no dropdown.
// Active locale highlighted in `--paper`.
function LanguageSwitcher({
    lang,
    pathname,
}: {
    lang: SupportedLang;
    pathname: string;
}) {
    function urlForLang(target: SupportedLang): string {
        // Blog content slugs are localized per language, so swapping only the
        // :lang segment 404s ('kahve-yazicisi' has no DE row). Ask the mounted
        // page where it wants to go first; the segment swap is the fallback for
        // pages whose path is language-independent.
        const resolved = resolveLangSwitchPath(target);
        if (resolved) return resolved;
        const segments = pathname.split('/').filter(Boolean);
        if (segments.length === 0) return `/${target}`;
        segments[0] = target;
        return `/${segments.join('/')}`;
    }

    return (
        <div
            role="group"
            aria-label="Language"
            style={{
                display: 'inline-flex',
                gap: 8,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
            }}
        >
            {SUPPORTED_LANGS.map((code) => {
                const active = code === lang;
                return (
                    <Link
                        key={code}
                        to={urlForLang(code)}
                        aria-current={active ? 'true' : undefined}
                        style={{
                            color: active ? 'var(--paper)' : 'var(--text-on-ink-3)',
                            fontWeight: active ? 600 : 500,
                            transition: 'color var(--d1)',
                            textDecoration: 'none',
                        }}
                        onMouseEnter={(e) => {
                            if (!active) e.currentTarget.style.color = 'var(--paper)';
                        }}
                        onMouseLeave={(e) => {
                            if (!active) e.currentTarget.style.color = 'var(--text-on-ink-3)';
                        }}
                    >
                        {code}
                    </Link>
                );
            })}
        </div>
    );
}

export default BlogSiteHeader;
