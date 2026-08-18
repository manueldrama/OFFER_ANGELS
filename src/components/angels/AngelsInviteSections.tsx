// Shared section renderers for the CAFEPASTE Angels invite design.
// Extracted verbatim from pages/angels/AngelsInvite.tsx so the public /angels
// landing can render the exact same sections. The only variability is wired
// through AngelsSectionsContext: CTA handlers, the hero extra line (invite's
// "active until {{date}}") and the confirm card's accept-vs-apply variant.
// Any visual change here shows up on BOTH the invite page and /angels.

import { Fragment } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { FONT_DISPLAY, AngelsWordmark } from './AngelsShell';
import { LanguageSwitcher } from '../offer/LanguageSwitcher';
import LogoMarquee from '../landing/LogoMarquee';
import type { ResolvedAngelsSection } from '../../types/angels';

export const INVITE_A = {
    bgMain: '#050505',
    bgDeep: '#0A0A0C',
    bgCard: 'rgba(255, 255, 255, 0.02)',
    borderSubtle: 'rgba(255, 255, 255, 0.04)',
    borderStrong: 'rgba(255, 255, 255, 0.08)',
    textMuted: 'rgba(255, 255, 255, 0.4)',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    red: '#C41E2A',
    redHover: '#b31b26',
    redText: '#ff4d5a',
};
const A = INVITE_A;

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

export function scrollToAngelsSection(id: string) {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 40, behavior: 'smooth' });
}
const scrollTo = scrollToAngelsSection;

export type AngelsContentT = (text: string | null | undefined, options?: { noTradeMark?: boolean }) => string;

export type AngelsConfirmVariant =
    | { kind: 'accept'; agreed: boolean; onToggleAgreed: () => void; agreeError: string; onAccept: () => void }
    | { kind: 'apply'; onApply: () => void };

export interface AngelsSectionsContext {
    t: AngelsContentT;
    onHeroPrimary: () => void;
    onHeroSecondary?: () => void;
    renderHeroExtra?: (heroCfg: Record<string, any>) => React.ReactNode;
    confirm: AngelsConfirmVariant;
}

export function buildAngelsSectionRenderers(
    ctx: AngelsSectionsContext,
): Record<string, (s: ResolvedAngelsSection) => React.ReactElement> {
    const { t, confirm } = ctx;

    // ── Section renderers (JSX preserved 1:1 from the original page; only the
    // literals now come from section config/items) ──────────────────────────
    const renderHero = (s: ResolvedAngelsSection) => {
        const cfg = s.config;
        const tags = s.items;
        return (
            <section
                key="hero"
                className="relative w-full flex flex-col justify-between overflow-hidden"
                style={{
                    minHeight: '100svh', // Matches true mobile screen height
                    background: '#0C0C0C', // Match main homepage dark
                    paddingTop: '64px', // Header offset (slightly less on mobile)
                }}
            >
                {/* Background Image & Overlay */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={cfg.bg_image_url || '/hero-desktop.webp'}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ objectPosition: 'center 40%' }}
                    />
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: NOISE, mixBlendMode: 'overlay' }} />
                    {/* Less muddy overlay, keep product subtly visible */}
                    <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(12,12,12,0) 0%, rgba(12,12,12,1) 100%)' }} />
                </div>

                {/* Soft red CAFEPASTE glow for atmosphere */}
                <div style={{
                    position: 'absolute',
                    top: '-10%',
                    right: '-10%',
                    width: '70%',
                    height: '100%',
                    background: 'radial-gradient(ellipse at center, rgba(196,30,42,0.15) 0%, transparent 60%)',
                    pointerEvents: 'none',
                    filter: 'blur(50px)',
                    zIndex: 1,
                }} />

                {/* Middle Zone: Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center text-center px-5 md:px-6 w-full" style={{ position: 'relative', zIndex: 10, paddingBottom: '24px', paddingTop: '24px' }}>
                    <div className="flex flex-col items-center text-center" style={{ maxWidth: 760, width: '100%', margin: '0 auto' }}>
                        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] md:text-[11px] font-semibold tracking-[0.12em] uppercase mb-5" style={{ background: 'transparent', color: 'rgba(255,255,255,0.85)', border: '0.5px solid rgba(255,255,255,0.15)' }}>
                            <div className="w-1 h-1 rounded-full shrink-0 animate-pulse" style={{ background: A.red }} />
                            {t(cfg.badge_text)}
                        </span>
                        <h1
                            style={{
                                fontFamily: FONT_DISPLAY,
                                fontWeight: 'bold',
                                fontSize: 'clamp(28px, 4vw, 40px)',
                                lineHeight: 1.05,
                                letterSpacing: '-0.02em',
                                margin: '0 auto 12px',
                                color: '#fff',
                                maxWidth: 760,
                                width: '100%',
                            }}
                        >
                            {(() => {
                                const raw = t(cfg.headline, { noTradeMark: true }) || '';
                                const parts = raw.split(/(CAFEPASTE Angels\.?)/i);
                                return parts.map((part, i) => (
                                    part.match(/CAFEPASTE Angels/i)
                                        ? <span key={i} className="whitespace-nowrap inline-block">{part}</span>
                                        : <Fragment key={i}>{part}</Fragment>
                                ));
                            })()}
                        </h1>
                        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 'clamp(15px, 1.8vw, 18px)', color: '#fff', margin: '0 auto 16px', maxWidth: 760, width: '100%' }}>
                            {t(cfg.subheadline, { noTradeMark: true })}
                        </p>
                        <p style={{ fontSize: 'clamp(14px, 1.5vw, 16px)', lineHeight: 1.45, color: A.textSecondary, margin: '0 auto 32px', maxWidth: 680, width: '100%', textWrap: 'balance' }}>
                            {t(cfg.description, { noTradeMark: true })}
                        </p>
                        <div className="flex flex-col md:flex-row justify-center items-center w-full md:w-auto" style={{ gap: '16px 24px' }}>
                            <button
                                onClick={ctx.onHeroPrimary}
                                className="inline-flex items-center justify-center gap-3 font-semibold px-8 md:px-10 min-h-[52px] md:min-h-[56px] transition-all duration-500 active:scale-[0.98] cursor-pointer whitespace-nowrap overflow-hidden group hover:-translate-y-1 w-full md:w-auto"
                                style={{
                                    background: `linear-gradient(180deg, ${A.red} 0%, #99141f 100%)`,
                                    color: '#FFF',
                                    boxShadow: '0 8px 24px -6px rgba(196,30,42,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                                    fontSize: 15,
                                    border: '1px solid rgba(196,30,42,0.4)',
                                    borderRadius: 10,
                                    letterSpacing: '0.05em',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(196,30,42,0.6), inset 0 1px 0 rgba(255,255,255,0.2)')}
                                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 8px 24px -6px rgba(196,30,42,0.4), inset 0 1px 0 rgba(255,255,255,0.1)')}
                            >
                                {t(cfg.cta_primary_label)}
                                <ArrowRight size={16} className="shrink-0 opacity-80 transition-transform duration-500 group-hover:translate-x-2" strokeWidth={2} />
                            </button>

                            {/* Subtle Secondary Link */}
                            <button
                                onClick={ctx.onHeroSecondary ?? (() => scrollTo('how'))}
                                className="group flex items-center gap-2 text-[13px] md:text-[14px] transition-all duration-300 mt-2 md:mt-0"
                                style={{
                                    color: 'rgba(255,255,255,0.6)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                <span className="relative pb-1 group-hover:text-white transition-colors duration-300 font-medium">
                                    {t(cfg.cta_secondary_label) === 'See Details' ? 'See How It Works' : t(cfg.cta_secondary_label)}
                                    <span className="absolute left-0 bottom-0 w-full h-[1px] bg-white/40 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 ease-out" />
                                </span>
                            </button>
                        </div>
                        <div className="flex justify-center items-center" style={{ gap: 8, marginTop: 24, color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500 }}>
                            <span>{t(cfg.trust_left)}</span>
                            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
                            <span>{t(cfg.trust_right)}</span>
                        </div>
                        {ctx.renderHeroExtra?.(cfg)}
                    </div>
                </div>

                {/* Bottom Zone: Venues Strip directly inside hero area */}
                {(cfg.show_marquee !== false || cfg.show_venue_tags !== false) && (
                    <div className="w-full flex flex-col items-center pb-6 md:pb-10 px-4 md:px-6" style={{ position: 'relative', zIndex: 10 }}>
                        <div className="w-full max-w-[800px] pt-6 md:pt-8 flex flex-col items-center" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <p className="text-[11px] md:text-[12px] font-semibold tracking-wider uppercase mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                {t(cfg.venues_label)}
                            </p>
                            {cfg.show_venue_tags !== false && tags && tags.length > 0 && (
                                <div className="flex flex-wrap justify-center items-center gap-3 md:gap-5 mb-4 w-full">
                                    {tags.map((tag, i) => (
                                        <span key={tag.id ?? i} className="flex items-center">
                                            {i > 0 && <span className="mr-3 md:mr-5" style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>}
                                            <span className="text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.15em] whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                                {tag.title}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            )}
                            {cfg.show_marquee !== false && (
                                <LogoMarquee className="w-full max-w-[540px] mx-auto mt-2" heightClass="h-8 md:h-10" gapClass="gap-8 md:gap-10" durationSec={15} opacityClass="opacity-95 hover:opacity-100 transition-opacity" maskWidthClass="w-10 md:w-16" />
                            )}
                        </div>
                    </div>
                )}
            </section>
        );
    };



    const renderMoments = (s: ResolvedAngelsSection) => {
        const cfg = s.config;
        return (
            <section key="moments" style={{ padding: 'clamp(64px, 10vw, 96px) 24px', background: A.bgDeep }}>
                <div className="mx-auto" style={{ maxWidth: 1240 }}>
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-12" style={{ gap: 24 }}>
                        <div>
                            <div style={{ ...eyebrow, color: A.red, marginBottom: 12 }}>{t(cfg.eyebrow)}</div>
                            <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(32px,4vw,48px)', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 16px', color: '#fff' }}>
                                {t(cfg.title)}
                            </h2>
                            <p style={{ fontSize: 'clamp(15px,1.5vw,18px)', lineHeight: 1.6, color: A.textSecondary, maxWidth: 600, margin: 0 }}>
                                {t(cfg.subtitle)}
                            </p>
                        </div>
                    </div>

                    {/* Horizontal scroll container */}
                    <div
                        className="flex overflow-x-auto pb-8 snap-x snap-mandatory"
                        style={{ gap: 16, margin: '0 -24px', padding: '0 24px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {s.items.map((m, idx) => (
                            <div key={m.id ?? idx} className="group snap-start shrink-0" style={{
                                width: 'min(85vw, 320px)',
                                background: '#111',
                                border: `1px solid rgba(209,28,42,0.1)`,
                                borderRadius: 16,
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                aspectRatio: '4/5',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
                                boxShadow: '0 12px 30px -10px rgba(0,0,0,0.5)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'rgba(209,28,42,0.4)';
                                e.currentTarget.style.boxShadow = '0 16px 40px -10px rgba(209,28,42,0.2)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'rgba(209,28,42,0.1)';
                                e.currentTarget.style.boxShadow = '0 12px 30px -10px rgba(0,0,0,0.5)';
                            }}
                            >
                                {/* Background Image */}
                                <div className="absolute inset-0">
                                    <img
                                        src={m.media_url ?? ''}
                                        alt={m.title ?? ''}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        className="transition-transform duration-700 group-hover:scale-105"
                                    />
                                </div>

                                {/* Dark overlay for text readability at bottom */}
                                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.9) 100%)' }} />

                                {/* Badge */}
                                <div style={{ position: 'absolute', top: 16, left: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(209,28,42,0.15)', padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(209,28,42,0.3)', backdropFilter: 'blur(4px)', zIndex: 10 }}>
                                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: A.red }} />
                                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#fff', textTransform: 'uppercase' }}>
                                        {m.value_text}
                                    </span>
                                </div>

                                {/* Title Area */}
                                <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 10 }}>
                                    <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 'clamp(18px, 1.5vw, 22px)', color: '#fff', lineHeight: 1.3, margin: 0, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                                        {m.title}
                                    </h3>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Visual drag indicator for desktop (subtle) */}
                    {cfg.drag_hint && (
                        <div className="hidden md:flex justify-center mt-2 opacity-40">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/70">
                                <ArrowRight size={12} className="rotate-180" />
                                {t(cfg.drag_hint)}
                                <ArrowRight size={12} />
                            </div>
                        </div>
                    )}
                </div>
            </section>
        );
    };

    const renderWhyInvited = (s: ResolvedAngelsSection) => {
        const cfg = s.config;
        return (
            <section key="why_invited" id="why" style={{ padding: 'clamp(64px, 10vw, 80px) 24px', background: 'linear-gradient(180deg, #0a0a0c, #111114)' }}>
                <div className="mx-auto" style={{ maxWidth: 1080 }}>
                    <div className="text-center" style={{ marginBottom: 48 }}>
                        <div style={{ ...eyebrow, color: A.red, marginBottom: 12 }}>{t(cfg.eyebrow, { noTradeMark: true })}</div>
                        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(28px,3.6vw,42px)', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 16px', color: '#fff' }}>
                            {t(cfg.title, { noTradeMark: true })}
                        </h2>
                        <p style={{ fontSize: 'clamp(15px,1.6vw,17px)', lineHeight: 1.5, color: A.textSecondary, maxWidth: 680, margin: '0 auto' }}>
                            {t(cfg.subtitle, { noTradeMark: true })}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {s.items.map((card, idx) => (
                            <div key={card.id ?? idx} className="relative overflow-hidden group" style={{ background: 'linear-gradient(160deg,rgba(20,20,24,0.4),rgba(12,12,15,0.8))', border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 12, padding: '28px 24px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', transition: 'transform 0.3s' }}>
                                {/* Soft red glow inside card */}
                                <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none opacity-20 transition-opacity duration-500 group-hover:opacity-40" style={{ background: `radial-gradient(circle, ${A.red} 0%, transparent 70%)`, transform: 'translate(30%, -30%)' }} />
                                {/* Thin red accent line top */}
                                <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: `linear-gradient(90deg, ${A.red}, transparent)` }} />

                                <div className="flex items-end gap-2 mb-6">
                                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 28, lineHeight: 0.8, color: 'rgba(255,255,255,0.8)', letterSpacing: '-0.02em' }}>{card.value_text}</span>
                                </div>
                                <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: '#fff', margin: '0 0 10px' }}>
                                    {t(card.title, { noTradeMark: true })}
                               </h3>
                                <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
                                    {t(card.description, { noTradeMark: true })}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    };

    const renderWhatIs = (s: ResolvedAngelsSection) => {
        const cfg = s.config;
        return (
            <section key="what_is" id="about" style={{ padding: 'clamp(80px, 12vw, 140px) 24px', background: '#0a0a0c', position: 'relative' }}>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: NOISE }} />
                <div className="relative z-10 mx-auto" style={{ maxWidth: 1080 }}>
                    <div className="text-center flex flex-col items-center" style={{ marginBottom: 'clamp(48px, 8vw, 80px)' }}>
                        <div style={{ ...eyebrow, textAlign: 'center', color: A.red, marginBottom: 16 }}>{t(cfg.eyebrow, { noTradeMark: true })}</div>
                        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(32px,4.5vw,48px)', letterSpacing: '-0.02em', margin: '0 0 24px', color: '#fff' }}>
                            {t(cfg.title, { noTradeMark: true })}
                        </h2>
                        {/* Intro text updated to use p1 with newlines if present, else subtitle */}
                        {(cfg.p1 || cfg.subtitle) && (
                            <p style={{ fontSize: 'clamp(16px,1.8vw,20px)', lineHeight: 1.6, color: A.textSecondary, maxWidth: 840, margin: '0 auto', whiteSpace: 'pre-line' }}>
                                {t((cfg.p1 || cfg.subtitle) ?? '', { noTradeMark: true })}
                            </p>
                        )}
                    </div>

                    <div className="relative flex flex-col md:flex-row gap-8 lg:gap-12 justify-center items-center md:items-start">
                        {s.items.map((card, idx) => (
                            <div key={card.id ?? idx} className="contents">
                                <div className={`relative z-10 flex flex-col flex-1 w-full max-w-[340px] md:max-w-none group ${idx % 2 === 1 ? 'md:mt-10' : ''}`}>
                                    {/* Visual Card Box */}
                                    <div className="w-full aspect-[4/5] rounded-xl relative overflow-hidden flex flex-col transition-transform duration-700 group-hover:-translate-y-2" style={{
                                        background: 'linear-gradient(160deg, rgba(20,20,24,0.6), rgba(10,10,12,0.9))',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                                        backdropFilter: 'blur(12px)'
                                    }}>
                                        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: NOISE, mixBlendMode: 'overlay' }} />
                                        {/* Image Section */}
                                        <div className="relative h-[65%] w-full overflow-hidden">
                                            {card.media_url ? (
                                                <img src={card.media_url} alt="" className="w-full h-full object-cover opacity-80 transition-transform duration-1000 group-hover:scale-105" />
                                            ) : (
                                                <div className="w-full h-full bg-[#111114]" />
                                            )}
                                            {/* Gradient fade to blend image with text area */}
                                            <div className="absolute inset-x-0 bottom-0 h-24" style={{ background: 'linear-gradient(to bottom, transparent, rgba(10,10,12,0.9))' }} />
                                        </div>

                                        {/* Text Section */}
                                        <div className="relative flex-1 flex flex-col px-6 pb-8 pt-2">
                                            <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 'clamp(18px, 1.6vw, 22px)', color: '#fff', margin: '0 0 12px', lineHeight: 1.3 }}>
                                                {t(card.title, { noTradeMark: true })}
                                            </h3>
                                            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                                                {t(card.description, { noTradeMark: true })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    };

    const renderWhatIsCafepaste = (s: ResolvedAngelsSection) => {
        const cfg = s.config;
        return (
            <section key="what_is_cafepaste" style={{ padding: 'clamp(64px, 10vw, 96px) 24px', background: '#080809', position: 'relative' }}>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: NOISE }} />
                <div className="flex flex-col md:flex-row min-h-[60vh] mx-auto items-stretch overflow-hidden" style={{ maxWidth: 1180, background: '#0a0a0c', border: `1px solid ${A.borderStrong}`, borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}>
                    {/* Left/Top: Image */}
                    <div className="w-full md:w-1/2 relative min-h-[360px] md:min-h-[540px] overflow-hidden">
                        {cfg.bg_image_url && (
                            cfg.bg_image_url.match(/\.(mp4|webm|mov)(\?.*)?$/i) ? (
                                <video
                                    src={cfg.bg_image_url}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    className="absolute inset-0 w-full h-full object-cover"
                                    style={{ filter: 'brightness(0.85) contrast(1.15)' }}
                                />
                            ) : (
                                <img src={cfg.bg_image_url} alt="CAFEPASTE Experience" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'brightness(0.85) contrast(1.15)' }} />
                            )
                        )}
                        <div className="absolute inset-0 md:hidden" style={{ background: 'linear-gradient(to top, #0a0a0c 0%, transparent 50%)' }} />
                        <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(to right, transparent 40%, #0a0a0c 100%)' }} />
                        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 30%, rgba(10,10,12,0.7) 100%)' }} />
                    </div>

                    {/* Right/Bottom: Content */}
                    <div className="w-full md:w-1/2 flex items-center p-8 pb-12 md:p-12 lg:p-16 relative z-10" style={{ background: '#0a0a0c' }}>
                        <div style={{ maxWidth: 480 }}>
                            <div style={{ ...eyebrow, color: A.red, marginBottom: 16 }}>{t(cfg.eyebrow, { noTradeMark: true })}</div>
                            <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(28px,3.5vw,42px)', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 20px', color: '#fff', whiteSpace: 'pre-line' }}>
                                {t(cfg.title, { noTradeMark: true })}
                            </h2>
                            {cfg.subtitle && (
                                <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 'clamp(16px,1.8vw,20px)', lineHeight: 1.4, color: '#fff', margin: '0 0 20px' }}>
                                    {t(cfg.subtitle, { noTradeMark: true })}
                                </p>
                            )}
                            {cfg.p1 && (
                                <p style={{ fontSize: 'clamp(14px,1.4vw,16px)', lineHeight: 1.65, color: A.textSecondary, margin: '0 0 16px' }}>
                                    {t(cfg.p1, { noTradeMark: true })}
                                </p>
                            )}
                            {cfg.p2 && (
                                <p style={{ fontSize: 'clamp(14px,1.4vw,16px)', lineHeight: 1.65, color: A.textSecondary, margin: '0 0 16px' }}>
                                    {t(cfg.p2, { noTradeMark: true })}
                                </p>
                            )}
                            {cfg.closing_line && (
                                <p style={{ fontSize: 'clamp(14px,1.4vw,16px)', lineHeight: 1.65, color: A.textMuted, margin: '0 0 32px' }}>
                                    {t(cfg.closing_line, { noTradeMark: true })}
                                </p>
                            )}

                            <a
                                href="https://cafepaste.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-3 transition-all duration-300"
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: 6,
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    background: 'transparent',
                                    color: 'rgba(255,255,255,0.9)',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    textDecoration: 'none',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'rgba(209,28,42,0.4)';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.background = 'rgba(209,28,42,0.05)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                                    e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                {t(cfg.cta_label, { noTradeMark: true }) || 'Discover CAFEPASTE'}
                                <ArrowRight size={14} className="opacity-60 transition-transform duration-300 group-hover:translate-x-1" color={A.red} />
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        );
    };


    const renderJoiningNetwork = (s: ResolvedAngelsSection) => {
        const cfg = s.config;
        return (
            <section key="joining_network" style={{ padding: 'clamp(64px, 10vw, 80px) 24px', background: A.bgDeep }}>
                <div
                    className="mx-auto flex flex-col md:flex-row items-center justify-between group"
                    style={{
                        maxWidth: 1080,
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 16,
                        background: 'linear-gradient(160deg, #0a0a0c, #111114)',
                        padding: 'clamp(40px, 6vw, 64px) clamp(24px, 5vw, 64px)',
                        gap: 'clamp(32px, 6vw, 64px)',
                        boxShadow: '0 24px 64px -12px rgba(0,0,0,0.6)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: NOISE }} />
                    {/* Subtle red glow top right */}
                    <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none opacity-20 transition-opacity duration-700 group-hover:opacity-40" style={{ background: `radial-gradient(circle, ${A.red} 0%, transparent 70%)`, transform: 'translate(30%, -30%)' }} />

                    {/* Thin red accent line top */}
                    <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: `linear-gradient(90deg, ${A.red}, transparent)` }} />

                    <div style={{ flex: '1 1 360px', minWidth: 280, position: 'relative', zIndex: 1 }}>
                        <div style={{ ...eyebrow, color: A.red, marginBottom: 12 }}>{t(cfg.eyebrow, { noTradeMark: true })}</div>
                        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(32px,4vw,44px)', lineHeight: 1.1, letterSpacing: '-0.02em', color: '#fff', marginBottom: 24 }}>
                            {t(cfg.title, { noTradeMark: true })}
                        </div>
                        {cfg.lead && (
                            <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 'clamp(16px, 1.8vw, 18px)', lineHeight: 1.5, color: 'rgba(255,255,255,0.95)', margin: '0 0 16px' }}>
                                {t(cfg.lead, { noTradeMark: true })}
                            </p>
                        )}
                        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)', margin: '0 0 24px', maxWidth: 480 }}>
                            {t(cfg.body, { noTradeMark: true })}
                        </p>
                        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.45)', margin: 0, maxWidth: 480 }}>
                            {t(cfg.footnote, { noTradeMark: true })}
                        </p>
                    </div>

                    <div style={{ flex: '1 1 320px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px 32px' }}>
                        {s.items.map((p, idx) => (
                            <div key={p.id ?? idx} className="flex items-center group/item" style={{ padding: '20px 0', borderBottom: idx !== s.items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.04em', marginRight: 24, flexShrink: 0, transition: 'color 0.3s' }} className="group-hover/item:text-red-500">
                                    0{idx + 1}
                                </span>
                                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: 400, letterSpacing: '0.01em', transition: 'color 0.3s' }} className="group-hover/item:text-white">
                                    {t(p.title, { noTradeMark: true })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    };

    const renderConfirm = (s: ResolvedAngelsSection) => {
        const cfg = s.config;
        return (
            <section
                key="confirm"
                id="confirm"
                style={{
                    padding: 'clamp(80px, 12vw, 120px) 24px',
                    background: A.bgDeep,
                }}
            >
                <div className="mx-auto" style={{ maxWidth: 660 }}>
                    <div className="text-center" style={{ marginBottom: 24 }}>
                        <div style={{ ...eyebrow, textAlign: 'center', color: A.red, marginBottom: 16 }}>
                            {t(cfg.eyebrow, { noTradeMark: true })}
                        </div>
                        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(28px,3.6vw,44px)', lineHeight: 1.12, letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 16px', color: '#fff' }}>
                            {t(cfg.title, { noTradeMark: true })}
                        </h2>
                        <p style={{ textAlign: 'center', fontSize: 'clamp(15px,1.6vw,18px)', lineHeight: 1.6, color: A.textSecondary, maxWidth: 540, margin: '0 auto 48px' }}>
                            {t(cfg.subtitle, { noTradeMark: true })}
                        </p>
                    </div>

                    <div style={{
                        background: 'linear-gradient(160deg, rgba(20,20,24,0.6), rgba(10,10,12,0.9))',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 16,
                        padding: 'clamp(40px, 6vw, 56px) clamp(24px, 5vw, 40px)',
                        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(12px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.9)', margin: '0 0 40px', textAlign: 'center', maxWidth: 480 }}>
                            {t(cfg.statement, { noTradeMark: true })}
                        </p>

                        {confirm.kind === 'accept' && (
                            <button
                                type="button"
                                onClick={confirm.onToggleAgreed}
                                className="group"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 16,
                                    background: confirm.agreed ? 'rgba(209,28,42,0.05)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${confirm.agreed ? 'rgba(209,28,42,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                    padding: '20px 24px',
                                    borderRadius: 10,
                                    width: '100%',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    marginBottom: 24
                                }}
                            >
                                <span
                                    style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: 8,
                                        background: confirm.agreed ? A.red : 'transparent',
                                        border: `1px solid ${confirm.agreed ? A.red : 'rgba(255,255,255,0.15)'}`,
                                        flex: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        boxShadow: confirm.agreed ? '0 0 12px rgba(209,28,42,0.4)' : 'none'
                                    }}
                                    className="group-hover:border-[rgba(255,255,255,0.3)]"
                                >
                                    {confirm.agreed && <Check size={16} color="#fff" strokeWidth={3} />}
                                </span>
                                <span style={{ fontSize: 15, color: confirm.agreed ? '#fff' : 'rgba(255,255,255,0.7)', textAlign: 'left', transition: 'color 0.2s' }} className="group-hover:text-white">
                                    {t(cfg.checkbox_label, { noTradeMark: true })}
                                </span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={confirm.kind === 'accept' ? confirm.onAccept : confirm.onApply}
                            className="inline-flex items-center justify-center gap-3 font-semibold px-8 min-h-[56px] transition-all duration-500 active:scale-[0.98] cursor-pointer whitespace-nowrap overflow-hidden group hover:-translate-y-1 w-full"
                            style={{
                                background: `linear-gradient(180deg, ${A.red} 0%, #99141f 100%)`,
                                color: '#FFF',
                                boxShadow: '0 8px 24px -6px rgba(196,30,42,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                                fontSize: 16,
                                border: '1px solid rgba(196,30,42,0.4)',
                                borderRadius: 10,
                                letterSpacing: '0.02em',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(196,30,42,0.6), inset 0 1px 0 rgba(255,255,255,0.2)')}
                            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 8px 24px -6px rgba(196,30,42,0.4), inset 0 1px 0 rgba(255,255,255,0.1)')}
                        >
                            {t(cfg.cta_label, { noTradeMark: true })}
                            <ArrowRight size={16} className="shrink-0 opacity-80 transition-transform duration-500 group-hover:translate-x-2" strokeWidth={2} />
                        </button>

                        {confirm.kind === 'accept' && confirm.agreeError && (
                            <div style={{ color: A.redText, fontSize: 14, textAlign: 'center', marginTop: 16 }}>{confirm.agreeError}</div>
                        )}

                        <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '24px 0 0', maxWidth: 420 }}>
                            {t(cfg.footnote, { noTradeMark: true })}
                        </p>
                    </div>
                </div>
            </section>
        );
    };

    // 'header' and 'status_copy' are chrome/state copy — read directly, never
    // rendered through the ordered map.
    return {
        hero: renderHero,
        moments: renderMoments,
        why_invited: renderWhyInvited,
        what_is: renderWhatIs,
        what_is_cafepaste: renderWhatIsCafepaste,
        joining_network: renderJoiningNetwork,
        confirm: renderConfirm,
    };
}

// ── HEADER (fixed chrome; the pill hides with the 'header' section) ──
export function AngelsFixedHeader({ pillText, t }: { pillText?: string | null; t: AngelsContentT }) {
    return (
        <header
            className="fixed inset-x-0 top-0 z-50 h-14 md:h-20 px-6 lg:px-10 transition-all duration-500"
            style={{
                background: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid transparent',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
        >
            <div className="relative h-full flex items-center justify-between max-w-[1200px] mx-auto">
                <div className="md:hidden w-8" aria-hidden="true" />
                <div className="inline-flex flex-col absolute left-1/2 -translate-x-1/2 md:static md:left-auto md:translate-x-0 pointer-events-none md:pointer-events-auto items-stretch w-max">
                    <AngelsWordmark size="sm" />
                </div>

                <div className="flex items-center gap-3">
                    {pillText && (
                        <span className="hidden md:inline-flex items-center mr-2" style={pill}>
                            {t(pillText)}
                        </span>
                    )}
                    <LanguageSwitcher dark={true} />
                </div>
            </div>
        </header>
    );
}

// ── inline style atoms (kept here to mirror the reference 1:1) ──────────────
const pill: React.CSSProperties = {
    gap: 7,
    padding: '7px 13px',
    border: `1px solid ${A.borderStrong}`,
    borderRadius: 999,
    fontSize: 11,
    letterSpacing: '0.12em',
    color: '#fff',
    fontWeight: 600,
    textTransform: 'uppercase',
};

const eyebrow: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.22em',
    color: A.red,
    textTransform: 'uppercase',
    marginBottom: 18,
};
