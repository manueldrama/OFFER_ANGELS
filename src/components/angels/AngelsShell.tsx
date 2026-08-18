// Shared dark shell + brand system for the public CAFEPASTE® Angels surfaces.
// The look is taken directly from the reference design in
// design-system/angels/CAFEPASTE® Angels Invitation.dc.html — near-black canvas,
// Sora display + Manrope body, red #D11C2A with lighter #ff6b76 accents,
// cinematic/private-club mood — blended into our app (real data + routing).

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ease } from '../landing/primitives';
import { AngelsLogoSvg } from './AngelsLogoSvg';

// ── Angels palette (anchored to the reference .dc.html) ─────────────────────
export const A = {
    // backgrounds
    bg: '#0C0C0C', // Match landing dark
    bgDeep: '#0C0C0C',
    bgDeepest: '#0C0C0C',
    surface: '#171717',
    surfaceElevated: '#262626',
    panel: 'rgba(23,23,23,0.95)',
    panel2: 'rgba(38,38,38,0.95)',
    // borders
    border: '#262626',
    borderStrong: '#404040',
    // red system
    red: '#C41E2A',
    redBright: '#D82B38',
    redDeep: '#A31822',
    redSoft: 'rgba(196,30,42,0.12)',
    redLine: 'rgba(196,30,42,0.4)',
    redText: '#FF5A66',
    redText2: '#ff5a66',
    // text scale
    text: '#FAFAFA',
    textBright: '#FFFFFF',
    textSecondary: '#A3A3A3',
    textMuted: '#737373',
    textGhost: '#525252',
    s1: '#e6e6ea',
    s2: '#c8c8cf',
    s5: '#8d8d95',
    s7: '#5c5c63',
} as const;

// Match the rest of cafepaste.com — Inter (var(--font-sans)) for everything.
// Only the elegant gold "Angels" wordmark uses a script face.
export const FONT_DISPLAY = "var(--font-sans, 'Inter Variable', Inter, system-ui, sans-serif)";
export const FONT_BODY = "var(--font-sans, 'Inter Variable', Inter, system-ui, sans-serif)";
export const FONT_SCRIPT = "'Great Vibes', cursive";

// Metallic gold gradient for the script "Angels" wordmark (clipped to text).
export const goldScript: React.CSSProperties = {
    fontFamily: FONT_SCRIPT,
    backgroundImage:
        'linear-gradient(180deg,#fff4cf 0%,#f3d27e 30%,#e1b256 50%,#c79a3e 64%,#b8860b 78%,#f1cf82 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
    fontWeight: 400,
    lineHeight: 1,
    filter: 'drop-shadow(0 1px 6px rgba(212,170,80,0.35))',
};

// Inter is already loaded app-wide; we only need the "Great Vibes" script for
// the gold Angels wordmark. Loaded once, lazily, scoped to Angels pages.
let fontsRequested = false;
export function useAngelsFonts() {
    useEffect(() => {
        if (fontsRequested || typeof document === 'undefined') return;
        fontsRequested = true;
        const pre = document.createElement('link');
        pre.rel = 'preconnect';
        pre.href = 'https://fonts.gstatic.com';
        pre.crossOrigin = 'anonymous';
        document.head.appendChild(pre);
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap';
        document.head.appendChild(l);
    }, []);
}

/**
 * The CAFEPASTE® / ANGELS lockup. Uses the REAL brand asset (/logo.svg),
 * rendered white on the dark canvas via the same `brightness(0) invert(1)`
 * filter the rest of the site uses on dark surfaces (LogoMarquee, dark landing
 * header, CustomerOffer dark). Red ANGELS badge sits alongside it.
 */
export function AngelsWordmark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
    return (
        <AngelsLogoSvg size={size} className={className} />
    );
}

/** 
 * Coherent premium brand system lockup.
 * Used on all main hero / onboarding pages to enforce consistency.
 */
export function AngelsBrandLockup({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
    const isLg = size === 'lg';
    const isSm = size === 'sm';
    
    // Exact sizing to make sure it looks substantial and premium
    const widthClass = isLg ? 'w-[280px] sm:w-[400px]' : isSm ? 'w-[160px] sm:w-[200px]' : 'w-[220px] sm:w-[280px]';
    
    // Because the SVG has significant internal bottom padding, we use negative margins to pull the slogan up
    const mtClass = isLg ? '-mt-7' : isSm ? '-mt-3' : '-mt-5';
    
    // Ensure the text width never exceeds the logo width on mobile
    const textClass = isLg ? 'text-[8.5px] sm:text-[11px]' : isSm ? 'text-[6px] sm:text-[7.5px]' : 'text-[7.5px] sm:text-[9.5px]';

    return (
        <div className={`flex flex-col items-center justify-center w-full ${className || ''}`}>
            <a href="/" className={`block ${widthClass}`}>
                <AngelsWordmark size={size} className="w-full h-auto" />
            </a>
            <p 
                className={`${mtClass} text-center ${textClass} tracking-[0.14em] font-semibold`} 
                style={{ 
                    color: A.textMuted, 
                    textTransform: 'uppercase', 
                    opacity: 0.8
                }}
            >
                A Private Creator Network By CAFEPASTE
            </p>
        </div>
    );
}

/** Sticky blurred header used across the public creator pages. */
export function AngelsHeader({
    rightLabel = 'Private Invitation',
}: {
    rightLabel?: string;
}) {
    return (
        <header
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 50,
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                background: 'rgba(10,10,12,0.72)',
                borderBottom: `1px solid rgba(255,255,255,0.06)`,
            }}
        >
            <div
                className="mx-auto flex items-center justify-between gap-6"
                style={{ maxWidth: 1240, padding: '16px 24px' }}
            >
                <a href="/" aria-label="CAFEPASTE® Angels">
                    <AngelsWordmark />
                </a>
                <span
                    className="inline-flex items-center"
                    style={{
                        gap: 7,
                        padding: '7px 13px',
                        border: `1px solid ${A.borderStrong}`,
                        borderRadius: 999,
                        fontSize: 11,
                        letterSpacing: '0.12em',
                        color: A.text,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                    }}
                >
                    <span
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: A.red,
                            animation: 'cpPulse 2s infinite',
                        }}
                    />
                    {rightLabel}
                </span>
            </div>
        </header>
    );
}

export function AngelsFooter() {
    return (
        <footer
            style={{
                background: A.bgDeepest,
                borderTop: '1px solid rgba(255,255,255,0.06)',
                padding: '48px 24px',
            }}
        >
            <div
                className="mx-auto flex flex-col md:flex-row items-center justify-between gap-6"
                style={{ maxWidth: 1180 }}
            >
                <a href="/" aria-label="CAFEPASTE Angels" className="max-w-[240px] md:max-w-none block">
                    <AngelsLogoSvg size="md" className="w-full h-auto" />
                </a>
                <a
                    href="mailto:angels@cafepaste.com"
                    style={{ fontSize: 13, color: A.redText, fontWeight: 600 }}
                >
                    angels@cafepaste.com
                </a>
            </div>
            <div
                className="mx-auto text-center md:text-left"
                style={{ maxWidth: 1180, marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: A.s7 }}
            >
                © {new Date().getFullYear()} CAFEPASTE · The Premium Creator Network · Private network — by invitation only.
            </div>
        </footer>
    );
}

/** Keyframes used by the Angels pages (pulse / float / fade). Mounted once. */
export function AngelsKeyframes() {
    return (
        <style>{`
            @keyframes cpPulse{0%,100%{opacity:.5}50%{opacity:1}}
            @keyframes cpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
            .angels-shell h1,.angels-shell h2,.angels-shell h3{font-family:${FONT_DISPLAY};}
            .angels-shell ::selection{background:#D11C2A;color:#fff;}
            .angels-shell input:focus,.angels-shell textarea:focus,.angels-shell select:focus{outline:none;border-color:#D11C2A;}
        `}</style>
    );
}

/**
 * Centered single-column dark wrapper — used by the simpler Angels surfaces
 * (acceptance form, thank-you, venue pages). The full multi-section invite page
 * builds its own layout but shares the same palette/fonts.
 */
export function AngelsShell({
    children,
    maxWidth = 560,
    showWordmark = true,
    wordmarkSize = 'md',
    wordmarkGap = 'mb-9 sm:mb-12',
    className = 'px-5 py-10 sm:py-14',
}: {
    children: React.ReactNode;
    maxWidth?: number;
    showWordmark?: boolean;
    wordmarkSize?: 'sm' | 'md' | 'lg';
    wordmarkGap?: string;
    className?: string;
}) {
    useAngelsFonts();
    return (
        <div
            className={`angels-shell min-h-[100dvh] w-full flex flex-col items-center ${className}`}
            style={{ background: A.bg, color: A.textBright, fontFamily: FONT_BODY, position: 'relative', overflow: 'hidden' }}
        >
            <AngelsKeyframes />
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    top: '-20%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '120vw',
                    height: '60vh',
                    background:
                        'radial-gradient(ellipse at center, rgba(209,28,42,0.16) 0%, rgba(209,28,42,0.04) 35%, transparent 70%)',
                    pointerEvents: 'none',
                    filter: 'blur(20px)',
                }}
            />
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease }}
                className="relative w-full flex flex-col items-center"
                style={{ maxWidth, zIndex: 1 }}
            >
                {showWordmark && (
                    <div className={`${wordmarkGap} w-full`}>
                        <AngelsBrandLockup size={wordmarkSize} />
                    </div>
                )}
                {children}
            </motion.div>

            <div
                className="relative mt-auto pt-12 text-center"
                style={{ zIndex: 1, color: A.s7, fontSize: 11, letterSpacing: '0.12em' }}
            >
                © {new Date().getFullYear()} CAFEPASTE® · A CURATED CREATOR NETWORK
            </div>
        </div>
    );
}

/** Primary red CTA (reference button — solid red, red glow). */
export function AngelsButton({
    onClick,
    children,
    type = 'button',
    block = false,
    disabled = false,
    loading = false,
}: {
    onClick?: () => void;
    children: React.ReactNode;
    type?: 'button' | 'submit';
    block?: boolean;
    disabled?: boolean;
    loading?: boolean;
}) {
    const off = disabled || loading;
    // Matches the landing PrimaryBtn (src/components/landing/primitives.tsx):
    // red gradient + layered glow, rounded-[10px], white text.
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={off}
            className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[0.98] whitespace-nowrap py-3.5 px-8 text-[15px] min-h-[48px] rounded ${
                block ? 'w-full' : ''
            } ${off ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            style={{
                background: A.red,
                color: '#FAFAFA',
                boxShadow: '0 8px 32px rgba(196,30,42,0.4)',
                fontFamily: FONT_BODY,
            }}
            onMouseEnter={e => {
                if (off) return;
                e.currentTarget.style.background = A.redDeep;
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = A.red;
            }}
        >
            {loading ? 'Please wait…' : children}
        </button>
    );
}

export function AngelsGhostButton({
    onClick,
    children,
    block = false,
}: {
    onClick?: () => void;
    children: React.ReactNode;
    block?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer py-3.5 px-7 text-[15px] min-h-[48px] rounded ${
                block ? 'w-full' : ''
            }`}
            style={{
                background: 'transparent',
                border: `1px solid ${A.border}`,
                color: A.text,
                fontFamily: FONT_BODY,
            }}
            onMouseEnter={e => {
                e.currentTarget.style.borderColor = A.text;
            }}
            onMouseLeave={e => {
                e.currentTarget.style.borderColor = A.border;
            }}
        >
            {children}
        </button>
    );
}

/** Uppercase red eyebrow used across Angels sections. */
export function AngelsEyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
    return (
        <p
            style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.22em',
                color: A.red,
                textTransform: 'uppercase',
                marginBottom: 16,
                textAlign: center ? 'center' : 'left',
            }}
        >
            {children}
        </p>
    );
}

/** Sora heading helper. */
export function AngelsHeading({
    children,
    style,
    as = 'h2',
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    as?: 'h1' | 'h2' | 'h3';
}) {
    const Tag = as as any;
    return (
        <Tag style={{ fontFamily: FONT_DISPLAY, fontWeight: 'bold', letterSpacing: '-0.025em', color: A.text, margin: 0, ...style }}>
            {children}
        </Tag>
    );
}