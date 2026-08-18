import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useInView } from 'framer-motion';

export const ease = [0.22, 1, 0.36, 1] as const;

/**
 * The site palette now lives in `src/design/tokens.ts` alongside the neutral
 * ramp and the `alpha()` helper. Every value is unchanged — this re-export
 * keeps the ~20 existing `import { P } from '.../primitives'` call sites
 * working while giving the colours a single home.
 *
 * New code should import from `@/design/tokens` directly, or better, use the
 * Tailwind utility classes (`text-neutral-500`, `border-neutral-200`) — the
 * greys here are byte-identical to Tailwind's default `neutral` scale.
 */
export { P, alpha, neutral, ink, brand, surface, status } from '../../design/tokens';
import { P } from '../../design/tokens';

export function Counter({ end, suffix = '', prefix = '', decimals = 0 }: {
    end: number; suffix?: string; prefix?: string; decimals?: number;
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true });
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!inView) return;
        let current = 0;
        const duration = 1400;
        const step = 16;
        const increment = end / (duration / step);
        const timer = setInterval(() => {
            current += increment;
            if (current >= end) { setCount(end); clearInterval(timer); }
            else setCount(current);
        }, step);
        return () => clearInterval(timer);
    }, [inView, end]);

    const display = decimals > 0
        ? count.toFixed(decimals)
        : Math.round(count).toLocaleString('tr-TR');

    return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

export function FadeIn({ children, delay = 0, className = '' }: {
    children: React.ReactNode; delay?: number; className?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, delay, ease }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <p className="font-semibold tracking-[0.2em] uppercase"
            style={{ fontSize: 'clamp(0.6rem, 1.2vw, 0.75rem)', color: P.primary, marginBottom: 'clamp(0.5rem, 1.2vh, 1rem)', ...style }}>
            {children}
        </p>
    );
}

export function SectionTitle({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
    return (
        <h2
            className={`font-bold leading-[1.2] tracking-[-0.02em] ${className}`}
            style={{ fontSize: 'clamp(1.25rem, 4vw, 2.5rem)', color: P.fg, ...style }}
        >
            {children}
        </h2>
    );
}

export function PrimaryBtn({ onClick, label = 'Modelleri İncele', block = false, size = 'lg', className: extraCls = '', showArrow = false }: {
    onClick: () => void; label?: React.ReactNode; block?: boolean; size?: 'sm' | 'md' | 'lg'; className?: string; showArrow?: boolean;
}) {
    const pad = size === 'sm'
        ? 'py-3 px-6 text-[15px] min-h-[44px]'
        : size === 'md'
            ? 'py-3.5 px-7 text-[15px] min-h-[46px]'
            : 'py-3.5 px-8 text-[15px] min-h-[48px]';

    const baseStyle: React.CSSProperties = {
        background: 'linear-gradient(135deg, #DC2626, #991B1B)',
        color: '#FAFAFA',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 4px 12px rgba(196,30,42,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.1)',
        textShadow: '0 1px 1px rgba(0,0,0,0.15)',
        letterSpacing: '0.02em',
    };

    const hoverStyle: React.CSSProperties = {
        background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.12), 0 8px 24px rgba(196,30,42,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
        transform: 'translateY(-1px)',
    };

    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] transition-all duration-200 active:scale-[0.98] active:translate-y-0 cursor-pointer whitespace-nowrap ${pad} ${block ? 'w-full' : ''} ${extraCls}`}
            style={baseStyle}
            onMouseEnter={e => {
                Object.assign(e.currentTarget.style, hoverStyle);
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = baseStyle.background as string;
                e.currentTarget.style.boxShadow = baseStyle.boxShadow as string;
                e.currentTarget.style.transform = '';
            }}
        >
            {label}
            {showArrow && <ArrowRight size={15} className="shrink-0" />}
        </button>
    );
}

/** Anchor variant of PrimaryBtn — same exact look (gradient red, glow shadow,
 *  rounded-[10px], 48px min-height) but renders as an <a> for navigation
 *  between pages instead of triggering a JS handler. Used by SEO content
 *  pages where the CTA is a real link to /[lang], not a scroll action.
 *
 *  Style block is copy-locked with PrimaryBtn — when you change one, change
 *  both. Kept as a separate function (rather than as={'a'} polymorphism) so
 *  TypeScript prop types stay simple. */
export function PrimaryBtnLink({ href, label = 'Modelleri İncele', block = false, size = 'lg', className: extraCls = '', showArrow = false, target, rel }: {
    href: string;
    label?: React.ReactNode;
    block?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    showArrow?: boolean;
    target?: string;
    rel?: string;
}) {
    const pad = size === 'sm'
        ? 'py-3 px-6 text-[15px] min-h-[44px]'
        : size === 'md'
            ? 'py-3.5 px-7 text-[15px] min-h-[46px]'
            : 'py-3.5 px-8 text-[15px] min-h-[48px]';

    const baseStyle: React.CSSProperties = {
        background: 'linear-gradient(135deg, #DC2626, #991B1B)',
        color: '#FAFAFA',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 4px 12px rgba(196,30,42,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.1)',
        textShadow: '0 1px 1px rgba(0,0,0,0.15)',
        letterSpacing: '0.02em',
        textDecoration: 'none',
    };
    const hoverStyle: React.CSSProperties = {
        background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.12), 0 8px 24px rgba(196,30,42,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
        transform: 'translateY(-1px)',
    };

    return (
        <a
            href={href}
            target={target}
            rel={rel}
            className={`inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] transition-all duration-200 active:scale-[0.98] active:translate-y-0 cursor-pointer whitespace-nowrap ${pad} ${block ? 'w-full' : ''} ${extraCls}`}
            style={baseStyle}
            onMouseEnter={e => { Object.assign(e.currentTarget.style, hoverStyle); }}
            onMouseLeave={e => {
                e.currentTarget.style.background = baseStyle.background as string;
                e.currentTarget.style.boxShadow = baseStyle.boxShadow as string;
                e.currentTarget.style.transform = '';
            }}
        >
            {label}
            {showArrow && <ArrowRight size={15} className="shrink-0" />}
        </a>
    );
}

export function OutlineBtn({ onClick, label, icon }: {
    onClick: () => void; label: string; icon?: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center justify-center gap-2 font-semibold rounded py-3.5 px-7 text-[15px] min-h-[48px] transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{ background: 'transparent', border: `1px solid ${P.border}`, color: P.fg }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = P.fg; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = P.border; }}
        >
            {icon}
            {label}
        </button>
    );
}
