// Shared site header used by SEO content pages. Mirrors the landing page's
// inline header (LandingPage.tsx around L1240-L1330) including its
// scroll-aware dark→light glass behavior so SEO pages feel native.
//
// Visual contract (must match the landing header):
//   • Sticky `position: fixed; top: 0`, height 56px mobile / 80px desktop
//   • Glass background — dark variant while at top of a dark hero
//     (darkAtTop), light variant after scrolling past 60px (same threshold
//     as LandingPage's `scrolledEnough`)
//   • max-width 1200px, side padding 24/40px
//   • /logo.svg img (invert filter while on dark, like landing)
//   • Small tagline under logo (uppercase, 0.15em tracking)

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LanguageSwitcher } from '../offer/LanguageSwitcher';
import { P } from '../landing/primitives';
import { SUPPORTED_LANGS } from '../../lib/seoConfig';

interface SiteHeaderProps {
    /** Right-hand link target — typically the homepage in the active language.
     *  Optional only when `showHomeLink` is false. */
    homeHref?: string;
    /** Label for the right-hand link — comes from SEO_UI_STRINGS so it's
     *  translated per locale. Optional only when `showHomeLink` is false. */
    homeLabel?: string;
    /** Set false on captive flows (the /interview/:token candidate portal)
     *  where any navigation away mid-session loses the recording. It drops the
     *  right-hand back link AND makes the logo non-clickable — a linked logo is
     *  the same escape hatch by another name. */
    showHomeLink?: boolean;
    /** Whether to show the LanguageSwitcher. Keep it on for content pages
     *  so visitors can switch languages without going back to the landing. */
    showLanguageSwitcher?: boolean;
    /** Optional tagline shown under the logo. Defaults to the standard
     *  CAFEPASTE tagline; pass empty string to hide. */
    tagline?: string;
    /** Pages whose top band is dark (the /blog editorial skin, About) pass
     *  true: the header starts as the landing's dark glass overlaying the
     *  hero, then flips to the light glass after 60px of scroll — exactly
     *  like the homepage. Default false keeps the always-light behavior
     *  (influencer / contact pages with light tops). */
    darkAtTop?: boolean;
}

export function SiteHeader({
    homeHref,
    homeLabel,
    showHomeLink = true,
    showLanguageSwitcher = true,
    tagline = 'BEVERAGE ART CREATOR',
    darkAtTop = false,
}: SiteHeaderProps) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        if (!darkAtTop) return;
        const onScroll = () => setScrolled(window.scrollY > 60);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [darkAtTop]);

    const light = !darkAtTop || scrolled;

    return (
        <>
            {/* Spacer so the fixed header doesn't overlap the content below it.
                The landing hero is full-viewport so it can slide under the
                glass, but the blog/about dark bands have shallower top
                padding — without the spacer their breadcrumbs get clipped
                under the fixed header. Dark-at-top pages get a dark spacer
                so it blends into the hero band seamlessly. */}
            <div
                className="h-14 md:h-20"
                style={darkAtTop ? { background: '#0C0C0C' } : undefined}
                aria-hidden="true"
            />
            <header
                className="fixed inset-x-0 top-0 z-50 h-14 md:h-20 px-6 lg:px-10 transition-all duration-500"
                style={{
                    background: light ? 'rgba(250,250,250,0.95)' : 'rgba(0,0,0,0.45)',
                    backdropFilter: light ? 'blur(20px)' : 'blur(12px)',
                    WebkitBackdropFilter: light ? 'blur(20px)' : 'blur(12px)',
                    borderBottom: light ? `1px solid ${P.border}` : '1px solid transparent',
                    boxShadow: light ? '0 1px 3px rgba(0,0,0,0.06)' : '0 4px 16px rgba(0,0,0,0.08)',
                    color: P.fg,
                }}
            >
                <div className="relative h-full flex items-center justify-between max-w-[1200px] mx-auto">
                    {/* Left/center: logo + tagline. Centered on mobile (absolute),
                        left-aligned on desktop (static). Mirrors landing exactly. */}
                    <div className="md:hidden w-8" aria-hidden="true" />
                    {(() => {
                        const logoCls =
                            'inline-flex flex-col absolute left-1/2 -translate-x-1/2 md:static md:left-auto md:translate-x-0 items-stretch w-max';
                        const logoInner = (
                            <>
                                <img
                                    src="/logo.svg"
                                    alt="CAFEPASTE"
                                    className={`h-5 md:h-6 lg:h-8 w-auto block object-contain object-left transition-all duration-500 ${light ? 'invert-0' : 'invert'}`}
                                />
                                {tagline && (
                                    <span
                                        className="hidden md:block uppercase mt-0.5 text-center"
                                        style={{
                                            fontSize: 'clamp(7px, 1.8vw, 9px)',
                                            letterSpacing: '0.15em',
                                            color: light ? P.muted : 'rgba(255,255,255,0.5)',
                                        }}
                                    >
                                        {tagline}
                                    </span>
                                )}
                            </>
                        );
                        return showHomeLink ? (
                            <a href={homeHref} className={logoCls} aria-label="CAFEPASTE">{logoInner}</a>
                        ) : (
                            <div className={logoCls}>{logoInner}</div>
                        );
                    })()}

                    {/* Right: language switcher + back link */}
                    <div className="flex items-center gap-3 ml-auto">
                        {showLanguageSwitcher && (
                            <LanguageSwitcher dark={!light} allowedLangs={SUPPORTED_LANGS} />
                        )}
                        {showHomeLink && (
                            <a
                                href={homeHref}
                                className="inline-flex items-center gap-1.5 text-[13px] md:text-sm font-semibold transition-colors duration-150"
                                style={{ color: light ? P.muted : 'rgba(255,255,255,0.9)' }}
                                onMouseEnter={e => { e.currentTarget.style.color = light ? P.primary : '#ffffff'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = light ? P.muted : 'rgba(255,255,255,0.9)'; }}
                            >
                                <ArrowLeft size={15} />
                                {homeLabel}
                            </a>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
}
