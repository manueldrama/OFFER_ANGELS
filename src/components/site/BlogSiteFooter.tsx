// Editorial blog footer for the SEO content section. Mirrors the
// design-reference footer (dark ink band, brand + tagline + simple
// secondary nav + copyright). Used by SeoContentPage,
// SeoIndexPage, SeoResourcesHub. Landing / admin / product pages
// keep using src/components/site/SiteFooter.tsx.
//
// Why not extend SiteFooter: the editorial footer needs DM Serif
// for the brand mark + a dark band that wraps the full viewport
// width (not just a content card). Extending SiteFooter with a
// "variant" prop would have leaked design-reference tokens into
// the main site. A separate component is cleaner and stays scoped
// to `.cp-blog-skin` consumers.

import { Link, useParams } from 'react-router-dom';
import {
    getUiStrings,
    isSupportedLang,
    type SupportedLang,
} from '../../lib/seoConfig';
import { useLegalFooterLinks } from '../../hooks/useLegalFooterLinks';

// Secondary nav — minimal. Each entry maps to a top-level SEO
// route; the labels reuse i18n keys from seoConfig.ts so adding
// new languages later doesn't require touching this file. The
// `null` href means "render a static brand label, not a link".
const FOOTER_LINKS: Array<{
    href: string;
    labelKey: keyof ReturnType<typeof getUiStrings>;
}> = [
    { href: '/blog', labelKey: 'breadcrumbResources' },
    { href: '/blog/glossary', labelKey: 'breadcrumbGlossary' },
    { href: '/blog/guides', labelKey: 'breadcrumbGuide' },
    { href: '/blog/solutions', labelKey: 'breadcrumbSolution' },
];

// Copyright line rotates the year automatically — no annual edit
// required. The brand label still routes through getUiStrings so
// future locales can localize "CAFEPASTE" (e.g. add a tagline).
function buildCopyright(lang: SupportedLang, brand: string): string {
    return `© ${new Date().getFullYear()} ${brand}`;
}

interface BlogSiteFooterProps {
    lang?: SupportedLang;
}

export function BlogSiteFooter({ lang: langProp }: BlogSiteFooterProps) {
    const params = useParams<{ lang?: string }>();
    const lang: SupportedLang =
        langProp ?? (isSupportedLang(params.lang) ? (params.lang as SupportedLang) : 'tr');
    const ui = getUiStrings(lang);
    const legalLinks = useLegalFooterLinks(lang);

    return (
        <footer
            style={{
                background: 'var(--ink)',
                color: 'var(--text-on-ink-2)',
                marginTop: 'var(--s12)',
                padding: 'var(--s11) 0 var(--s7)',
                borderTop: '1px solid var(--ink-line)',
            }}
        >
            <div className="container-wide">
                {/* Top grid — brand block + 1 link column. Kept lean
                    on purpose so the editorial pages have a calmer
                    footer than the full marketing landing page. */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1.6fr 1fr',
                        gap: 'var(--s9)',
                        paddingBottom: 'var(--s10)',
                        borderBottom: '1px solid var(--ink-line)',
                    }}
                    className="cp-footer-grid"
                >
                    {/* Brand block */}
                    <div>
                        <Link
                            to={`/${lang}`}
                            aria-label="CAFEPASTE"
                            style={{
                                display: 'inline-flex',
                                flexDirection: 'column',
                                gap: 1,
                                lineHeight: 1,
                                textDecoration: 'none',
                            }}
                        >
                            <span
                                style={{
                                    fontFamily: 'var(--font-sans)',
                                    fontWeight: 700,
                                    fontSize: 'var(--fs-18)',
                                    letterSpacing: '0.04em',
                                    color: 'var(--text-on-ink-1)',
                                }}
                            >
                                CAFEPASTE
                                <span aria-hidden="true" style={{ color: 'var(--red)' }}>.</span>
                            </span>
                            <span
                                style={{
                                    fontFamily: 'var(--font-sans)',
                                    fontWeight: 500,
                                    fontSize: 9,
                                    letterSpacing: '0.22em',
                                    color: 'var(--text-on-ink-3)',
                                    textTransform: 'uppercase',
                                    marginTop: 2,
                                }}
                            >
                                Beverage Art Creator
                            </span>
                        </Link>
                        <p
                            style={{
                                margin: 'var(--s5) 0 var(--s6)',
                                fontSize: 'var(--fs-14)',
                                lineHeight: 1.55,
                                maxWidth: '38ch',
                                color: 'var(--text-on-ink-2)',
                            }}
                        >
                            {ui.hubSubtitle}
                        </p>
                    </div>

                    {/* Editorial nav column */}
                    <div>
                        <h5
                            style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--fs-11)',
                                fontWeight: 600,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: 'var(--text-on-ink-1)',
                                margin: '0 0 var(--s5)',
                            }}
                        >
                            {ui.breadcrumbResources}
                        </h5>
                        <ul
                            style={{
                                listStyle: 'none',
                                padding: 0,
                                margin: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                            }}
                        >
                            {FOOTER_LINKS.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        to={`/${lang}${link.href}`}
                                        style={{
                                            color: 'var(--text-on-ink-2)',
                                            fontSize: 'var(--fs-14)',
                                            textDecoration: 'none',
                                            transition: 'color var(--d1)',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.color = 'var(--paper)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.color = 'var(--text-on-ink-2)';
                                        }}
                                    >
                                        {ui[link.labelKey] as string}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Yasal linkler — sadece Türkçe. Sayfaların içeriği Türkçe ve
                    Türk tüketici mevzuatına özgü olduğu için legalFooterLinks
                    diğer dillerde boş dizi döner ve satır hiç render edilmez.
                    Ödeme kuruluşu denetimlerinde bu linklerin her sayfadan
                    erişilebilir olması aranıyor — blog sayfaları dahil. */}
                {legalLinks.length > 0 && (
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '10px 24px',
                            paddingTop: 'var(--s6)',
                            fontSize: 'var(--fs-12)',
                        }}
                    >
                        {legalLinks.map((l) => (
                            <Link
                                key={l.href}
                                to={l.href}
                                style={{
                                    color: 'var(--text-on-ink-3)',
                                    textDecoration: 'none',
                                    transition: 'color var(--d1)',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--paper)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-on-ink-3)'; }}
                            >
                                {l.label}
                            </Link>
                        ))}
                    </div>
                )}

                {/* Bottom strip — copyright + ürün siteye dön */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: 'var(--s6)',
                        fontSize: 'var(--fs-12)',
                        color: 'var(--text-on-ink-3)',
                    }}
                    className="cp-footer-bottom"
                >
                    <span>{buildCopyright(lang, ui.footerCopy)}</span>
                    <Link
                        to={`/${lang}`}
                        style={{
                            color: 'var(--text-on-ink-2)',
                            textDecoration: 'none',
                            transition: 'color var(--d1)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--paper)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-on-ink-2)';
                        }}
                    >
                        {ui.backToHome}
                    </Link>
                </div>
            </div>

            <style>{`
                @media (max-width: 760px) {
                    .cp-footer-grid {
                        grid-template-columns: 1fr !important;
                        gap: var(--s7) !important;
                    }
                    .cp-footer-bottom {
                        flex-direction: column !important;
                        gap: var(--s3) !important;
                    }
                }
            `}</style>
        </footer>
    );
}

export default BlogSiteFooter;
