// Image carousel used on SEO content pages — extracted from LandingPage.tsx's
// VisualProofCarousel (line 194). Same auto-rotating ring of round image
// tiles, but as a standalone reusable component that takes images as a prop.
//
// SEO pages embed this between the article content and the FAQ. The bot
// prerender renders a static <img> grid instead (no JS animation needed for
// crawlers).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { P } from '../landing/primitives';

const FALLBACK_IMAGES = [
    'https://storage.googleapis.com/banani-generated-images/generated-images/ac741058-0775-4d6c-86fb-336937126573.jpg',
    'https://storage.googleapis.com/banani-generated-images/generated-images/8c2ab3bc-86c2-498a-b5de-520c48220bbf.jpg',
    'https://storage.googleapis.com/banani-generated-images/generated-images/97fd5c63-f0f9-4263-8595-2a77e0d332ad.jpg',
    'https://storage.googleapis.com/banani-generated-images/generated-images/ccd4db1a-a074-426f-87da-b8567cafe004.jpg',
    'https://storage.googleapis.com/banani-generated-images/generated-images/924ad68a-4fa0-440e-b189-3a3f48bfd820.jpg',
    'https://storage.googleapis.com/banani-generated-images/generated-images/1f57ee3e-f458-4757-98e4-72af49bbfad3.jpg',
];

interface SiteVisualStripProps {
    images?: string[];
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    /** Alt-text fallback prefix for accessibility / SEO when alt text is not
     *  provided per image. Defaults to a generic CAFEPASTE label. */
    altPrefix?: string;
}

export function SiteVisualStrip({
    images,
    eyebrow,
    title,
    subtitle,
    altPrefix = 'CAFEPASTE Beverage Art',
}: SiteVisualStripProps) {
    const imgs = images && images.length > 0 ? images : FALLBACK_IMAGES;
    const [visible, setVisible] = useState(4);
    const GAP = visible <= 3 ? 16 : 24;
    const [offset, setOffset] = useState(0);
    const [paused, setPaused] = useState(false);
    const [instant, setInstant] = useState(false);
    const total = imgs.length;
    const canSlide = total > visible;
    const containerRef = useRef<HTMLDivElement>(null);
    const [itemSize, setItemSize] = useState(220);

    useEffect(() => {
        const measure = () => {
            if (!containerRef.current) return;
            const w = containerRef.current.offsetWidth;
            const v = w < 480 ? 1 : w < 640 ? 3 : 4;
            setVisible(v);
            const gap = v <= 3 ? 16 : 24;
            const size = Math.floor((w - gap * (v - 1)) / v);
            setItemSize(Math.min(size, v === 1 ? 340 : 280));
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    useEffect(() => {
        if (!canSlide || paused) return;
        const t = setInterval(() => setOffset((p) => p + 1), 2000);
        return () => clearInterval(t);
    }, [canSlide, paused]);

    const handleAnimComplete = useCallback(() => {
        if (offset >= total) {
            setInstant(true);
            setOffset(offset % total);
            requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
        } else if (offset < 0) {
            setInstant(true);
            setOffset(((offset % total) + total) % total);
            requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
        }
    }, [offset, total]);

    const stripImages = useMemo(() => {
        if (total === 0) return [];
        const result: { src: string; idx: number }[] = [];
        for (let i = total - visible; i < total; i++)
            result.push({ src: imgs[((i % total) + total) % total], idx: i - total });
        for (let i = 0; i < total; i++) result.push({ src: imgs[i], idx: i });
        for (let i = 0; i < visible; i++) result.push({ src: imgs[i % total], idx: total + i });
        return result;
    }, [imgs, total, visible]);

    const step = itemSize + GAP;
    const translateX = -(offset + visible) * step;
    const stripWidth = total > 0 ? step * stripImages.length : 0;
    const displayOffset = ((offset % total) + total) % total;

    return (
        <section className="my-16 not-prose">
            {(eyebrow || title || subtitle) && (
                <div className="text-center mb-8">
                    {eyebrow && (
                        <span
                            className="inline-block uppercase tracking-[0.15em] text-xs font-semibold mb-3"
                            style={{ color: P.primary }}
                        >
                            {eyebrow}
                        </span>
                    )}
                    {title && (
                        <h2
                            className="font-bold mb-3"
                            style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', color: P.fg, letterSpacing: '-0.02em' }}
                        >
                            {title}
                        </h2>
                    )}
                    {subtitle && (
                        <p className="max-w-xl mx-auto" style={{ color: P.muted }}>
                            {subtitle}
                        </p>
                    )}
                </div>
            )}
            <div ref={containerRef} className="relative max-w-[1200px] mx-auto w-full">
                <div className="overflow-hidden select-none py-4 -my-4 touch-pan-y">
                    <motion.div
                        className="flex"
                        style={{ gap: GAP, width: stripWidth }}
                        animate={{ x: translateX }}
                        transition={instant ? { duration: 0 } : { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                        onAnimationComplete={handleAnimComplete}
                    >
                        {stripImages.map(({ src, idx }) => (
                            <div key={idx} className="shrink-0" style={{ width: itemSize, height: itemSize }}>
                                <div
                                    className="rounded-full overflow-hidden w-full h-full transition-shadow duration-500 ease-out hover:shadow-xl"
                                    style={{
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                                        border: '3px solid rgba(0,0,0,0.04)',
                                    }}
                                >
                                    <img
                                        src={src}
                                        alt={`${altPrefix} ${((idx % total) + total) % total + 1}`}
                                        loading="lazy"
                                        draggable={false}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        ))}
                    </motion.div>
                </div>
                {canSlide && (
                    <div className="flex items-center justify-center mt-6">
                        <div className="flex gap-2">
                            {imgs.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => { setOffset(i); setPaused(true); setTimeout(() => setPaused(false), 4000); }}
                                    className="rounded-full transition-all duration-500 ease-out"
                                    style={{
                                        width: i === displayOffset ? 24 : 8,
                                        height: 8,
                                        background: i === displayOffset ? P.primary : P.border,
                                        opacity: i === displayOffset ? 1 : 0.5,
                                    }}
                                    aria-label={`Görsel ${i + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
