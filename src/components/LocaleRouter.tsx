// Wrapper used as the parent route for `/:lang/*`. Validates the language
// segment, syncs i18next, and renders <Outlet/> so child public routes
// (localized landing, comparisons, guides, solutions) inherit the active
// language without re-implementing the check.
//
// Existing routes outside `/:lang/...` (admin, offer/:token, portal/:slug,
// payment, login) are left untouched — they're not SEO surface, and language
// is still controlled by their own legacy mechanisms.

import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isSupportedLang, DEFAULT_LANG } from '../lib/seoConfig';
import { detectBrowserLanguage } from '../i18n';
import { resolveLangSwitchPath } from '../lib/langSwitchTarget';

// Top-level public sections that live under /:lang. When someone types a
// bare URL like cafepaste.com/blog (no language prefix), the first segment
// lands in :lang — instead of bouncing them to the homepage, prefix the
// browser's language (fallback DEFAULT_LANG) and keep the full path.
// The worker mirrors this with a 301 for direct hits; this covers pure
// client-side navigations. (influencer + contact already have explicit
// bare routes in App.tsx.)
const KNOWN_SECTIONS = new Set([
    'blog',
    'about',
    'glossary',
    'guides',
    'solutions',
    'compare',
    'resources',
]);

export default function LocaleRouter() {
    const { lang } = useParams<{ lang: string }>();
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    // Sync i18next on every render where lang changes. Cheap; i18next no-ops
    // when the language is already active.
    useEffect(() => {
        if (!lang || !isSupportedLang(lang)) return;
        if (i18n.language !== lang) {
            void i18n.changeLanguage(lang);
        }
    }, [lang, i18n]);

    // Reverse sync: when the language changes via a switcher (i18n-only),
    // rewrite the URL so pages that read `useParams().lang` (the whole /blog
    // SEO tree) actually refetch in the new language.
    //
    // Two strategies, in order:
    //  1. If the mounted page registered a resolver (see lib/langSwitchTarget),
    //     use the path it asks for. Blog content pages do this because their
    //     slugs are localized per language — 'kahve-yazicisi' in TR is
    //     'kaffee-drucker' in DE, so swapping only the :lang segment 404s.
    //  2. Otherwise swap the :lang segment, which is right for every page whose
    //     path is language-independent (/about, /tr → /de, …).
    //
    // Reads window.location at event time on purpose: pages with their own
    // languageChanged listeners (contact/influencer navigate to localized
    // slugs) may fire before or after us, and checking the live pathname
    // makes both orderings converge instead of racing.
    useEffect(() => {
        const onLanguageChanged = (next: string) => {
            const code = next?.split('-')[0];
            if (!code || !isSupportedLang(code)) return;
            const { pathname, search, hash } = window.location;
            const segments = pathname.split('/').filter(Boolean);
            if (segments.length === 0 || segments[0] === code) return;
            if (!isSupportedLang(segments[0])) return;
            const resolved = resolveLangSwitchPath(code);
            if (resolved) {
                navigate(`${resolved}${search}${hash}`, { replace: true });
                return;
            }
            segments[0] = code;
            navigate(`/${segments.join('/')}${search}${hash}`, { replace: true });
        };
        i18n.on('languageChanged', onLanguageChanged);
        return () => {
            i18n.off('languageChanged', onLanguageChanged);
        };
    }, [i18n, navigate]);

    // Unknown language:
    //  • /blog, /about, /glossary/... (bare known section) → prefix the
    //    visitor's language and KEEP the path: /blog → /de/blog.
    //  • anything else (/xx/foo junk) → bounce to the default homepage so
    //    Google/AI bots don't index junk URLs.
    if (!lang || !isSupportedLang(lang)) {
        if (lang && KNOWN_SECTIONS.has(lang)) {
            const detected = detectBrowserLanguage()?.split('-')[0];
            const target = detected && isSupportedLang(detected) ? detected : DEFAULT_LANG;
            return (
                <Navigate
                    to={`/${target}${location.pathname}${location.search}${location.hash}`}
                    replace
                />
            );
        }
        return <Navigate to={`/${DEFAULT_LANG}`} replace />;
    }

    return <Outlet />;
}
