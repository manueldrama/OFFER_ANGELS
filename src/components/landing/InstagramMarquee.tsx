import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { LandingPageSection } from '../../types';
import { P } from './primitives';

interface InstagramItem {
    id: string;
    type: string; // 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
    media_url: string | null;
    thumbnail_url: string | null;
    permalink: string;
    caption?: string;
}

interface FeedResponse {
    status: 'ok' | 'warming' | 'unconfigured';
    /** true → payload 24 saatten eski, imzalı CDN linkleri ölmüş olabilir. */
    stale?: boolean;
    items: InstagramItem[];
    fetched_at: string | null;
}

interface InstagramMarqueeProps {
    section?: LandingPageSection;
    /** When true, render only the scrolling strip (no header). */
    embedded?: boolean;
}

const FALLBACK_ITEMS: InstagramItem[] = [
    { id: 'fb-1', type: 'IMAGE', media_url: 'https://storage.googleapis.com/banani-generated-images/generated-images/ac741058-0775-4d6c-86fb-336937126573.jpg', thumbnail_url: null, permalink: 'https://instagram.com/cafepasteart' },
    { id: 'fb-2', type: 'IMAGE', media_url: 'https://storage.googleapis.com/banani-generated-images/generated-images/8c2ab3bc-86c2-498a-b5de-520c48220bbf.jpg', thumbnail_url: null, permalink: 'https://instagram.com/cafepasteart' },
    { id: 'fb-3', type: 'IMAGE', media_url: 'https://storage.googleapis.com/banani-generated-images/generated-images/97fd5c63-f0f9-4263-8595-2a77e0d332ad.jpg', thumbnail_url: null, permalink: 'https://instagram.com/cafepasteart' },
    { id: 'fb-4', type: 'IMAGE', media_url: 'https://storage.googleapis.com/banani-generated-images/generated-images/ccd4db1a-a074-426f-87da-b8567cafe004.jpg', thumbnail_url: null, permalink: 'https://instagram.com/cafepasteart' },
    { id: 'fb-5', type: 'IMAGE', media_url: 'https://storage.googleapis.com/banani-generated-images/generated-images/924ad68a-4fa0-440e-b189-3a3f48bfd820.jpg', thumbnail_url: null, permalink: 'https://instagram.com/cafepasteart' },
    { id: 'fb-6', type: 'IMAGE', media_url: 'https://storage.googleapis.com/banani-generated-images/generated-images/1f57ee3e-f458-4757-98e4-72af49bbfad3.jpg', thumbnail_url: null, permalink: 'https://instagram.com/cafepasteart' },
];

interface LightboxProps {
    items: InstagramItem[];
    index: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
}

function Lightbox({ items, index, onClose, onPrev, onNext }: LightboxProps) {
    const item = items[index];
    const hasMultiple = items.length > 1;

    // Close on ESC, navigate with arrow keys
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft' && hasMultiple) onPrev();
            else if (e.key === 'ArrowRight' && hasMultiple) onNext();
        };
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose, onPrev, onNext, hasMultiple]);

    if (!item) return null;

    const navBtnStyle: React.CSSProperties = {
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        width: 52, height: 52, borderRadius: 999,
        background: 'rgba(255,255,255,0.12)',
        color: '#fff', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s, transform 0.15s',
        zIndex: 2,
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 'clamp(16px, 4vw, 48px)',
                backdropFilter: 'blur(6px)',
                animation: 'ig-fade-in 0.2s ease-out',
            }}
        >
            {/* Close button */}
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="Kapat"
                style={{
                    position: 'absolute', top: 20, right: 20,
                    width: 44, height: 44, borderRadius: 999,
                    background: 'rgba(255,255,255,0.12)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                    zIndex: 2,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            >
                <X size={22} />
            </button>

            {/* Prev button */}
            {hasMultiple && (
                <button
                    onClick={(e) => { e.stopPropagation(); onPrev(); }}
                    aria-label="Önceki"
                    style={{ ...navBtnStyle, left: 'clamp(8px, 2vw, 28px)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
                >
                    <ChevronLeft size={26} />
                </button>
            )}

            {/* Next button */}
            {hasMultiple && (
                <button
                    onClick={(e) => { e.stopPropagation(); onNext(); }}
                    aria-label="Sonraki"
                    style={{ ...navBtnStyle, right: 'clamp(8px, 2vw, 28px)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
                >
                    <ChevronRight size={26} />
                </button>
            )}

            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'relative',
                    maxWidth: 'min(560px, 100%)',
                    maxHeight: '90vh',
                    width: '100%',
                    background: '#000',
                    borderRadius: 16,
                    overflow: 'hidden',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                    display: 'flex', flexDirection: 'column',
                }}
            >
                <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                    {item.type === 'VIDEO' && item.media_url ? (
                        <video
                            key={item.id}
                            src={item.media_url}
                            poster={item.thumbnail_url ?? undefined}
                            controls
                            autoPlay
                            playsInline
                            style={{ width: '100%', height: 'auto', maxHeight: '80vh', display: 'block' }}
                        />
                    ) : (
                        <img
                            key={item.id}
                            src={item.media_url || item.thumbnail_url || ''}
                            alt=""
                            style={{ width: '100%', height: 'auto', maxHeight: '80vh', objectFit: 'contain', display: 'block' }}
                        />
                    )}
                </div>

                {(item.caption || item.permalink) && (
                    <div style={{ padding: '14px 18px', background: '#0c0c0c', color: '#fff' }}>
                        {item.caption && (
                            <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, marginBottom: 10, opacity: 0.92, maxHeight: 90, overflow: 'auto' }}>
                                {item.caption}
                            </p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <a
                                href={item.permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    fontSize: 12, fontWeight: 600,
                                    color: '#fff', textDecoration: 'none',
                                    opacity: 0.85,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0.85'; }}
                            >
                                Instagram'da Aç <ExternalLink size={12} />
                            </a>
                            {hasMultiple && (
                                <span style={{ fontSize: 11, opacity: 0.55, fontVariantNumeric: 'tabular-nums' }}>
                                    {index + 1} / {items.length}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes ig-fade-in {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
            `}</style>
        </div>
    );
}

export default function InstagramMarquee({ section, embedded = false }: InstagramMarqueeProps) {
    const config = section?.config ?? {};
    const itemLimit = Math.max(6, Math.min(12, Number(config.item_limit) || 10));

    const [items, setItems] = useState<InstagramItem[] | null>(null);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [paused, setPaused] = useState(false);

    const cancelledRef = useRef(false);
    const healAttemptedRef = useRef(false);
    const usingFallbackRef = useRef(false);

    const applyFallback = useCallback(() => {
        if (usingFallbackRef.current) return;
        usingFallbackRef.current = true;
        setItems(FALLBACK_ITEMS.slice(0, itemLimit));
    }, [itemLimit]);

    const fetchFeed = useCallback(async (): Promise<FeedResponse | null> => {
        try {
            const res = await fetch(`/api/social/instagram-feed?limit=${itemLimit}`);
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    }, [itemLimit]);

    // Meta CDN linkleri süreli (imzalı oe parametresi). Payload bayatsa veya
    // medya 403 verirse cache'i tazeletip feed'i bir kez daha çeker; hâlâ
    // sağlıklı değilse fallback görsellere düşer. Refresh endpoint'i KV lock
    // ile 1 çağrı/60sn'e sınırlı, o yüzden burada agresif davranmak güvenli.
    const healFeed = useCallback(async () => {
        if (healAttemptedRef.current) return;
        healAttemptedRef.current = true;
        try {
            await fetch('/api/internal/instagram/refresh', { method: 'POST' });
        } catch { /* noop — refetch yine de denenir */ }
        const data = await fetchFeed();
        if (cancelledRef.current) return;
        if (data && data.status === 'ok' && !data.stale && Array.isArray(data.items) && data.items.length > 0) {
            setItems(data.items);
        } else {
            applyFallback();
        }
    }, [fetchFeed, applyFallback]);

    useEffect(() => {
        cancelledRef.current = false;
        (async () => {
            const data = await fetchFeed();
            if (cancelledRef.current) return;
            if (data && data.status === 'ok' && Array.isArray(data.items) && data.items.length > 0) {
                setItems(data.items);
                if (data.stale) void healFeed();
            } else {
                applyFallback();
            }
        })();
        return () => { cancelledRef.current = true; };
    }, [fetchFeed, healFeed, applyFallback]);

    // Kart medyası yüklenemedi (tipik neden: süresi dolmuş CDN imzası → 403).
    const handleMediaError = useCallback(() => {
        if (!healAttemptedRef.current) {
            void healFeed();
        } else {
            applyFallback();
        }
    }, [healFeed, applyFallback]);

    const base = useMemo(() => items ?? FALLBACK_ITEMS.slice(0, itemLimit), [items, itemLimit]);
    const looped = useMemo(() => [...base, ...base], [base]);

    const openLightbox = useCallback((realIndex: number, e: React.MouseEvent) => {
        e.preventDefault();
        setActiveIndex(realIndex);
    }, []);

    const goPrev = useCallback(() => {
        setActiveIndex(i => (i === null ? null : (i - 1 + base.length) % base.length));
    }, [base.length]);
    const goNext = useCallback(() => {
        setActiveIndex(i => (i === null ? null : (i + 1) % base.length));
    }, [base.length]);

    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<{ active: boolean; startX: number; startScroll: number; moved: boolean; pointerId: number | null }>({
        active: false, startX: 0, startScroll: 0, moved: false, pointerId: null,
    });

    // Auto-scroll loop: advances scrollLeft each frame, wraps at half-width (looped = base × 2)
    useEffect(() => {
        const el = scrollerRef.current;
        const track = trackRef.current;
        if (!el || !track) return;
        const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return;

        let raf = 0;
        let last = performance.now();
        const SPEED = 30; // px per second

        const tick = (now: number) => {
            const dt = (now - last) / 1000;
            last = now;
            if (!paused && !dragStateRef.current.active && el.scrollWidth > el.clientWidth) {
                const half = track.scrollWidth / 2;
                let next = el.scrollLeft + SPEED * dt;
                if (next >= half) next -= half;
                el.scrollLeft = next;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [paused, base.length]);

    // Keep scrollLeft inside the first copy when user scrolls past the seam
    const handleScroll = useCallback(() => {
        const el = scrollerRef.current;
        const track = trackRef.current;
        if (!el || !track) return;
        const half = track.scrollWidth / 2;
        if (half <= 0) return;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
        else if (el.scrollLeft < 0) el.scrollLeft += half;
    }, []);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const el = scrollerRef.current;
        if (!el) return;
        // Only initiate drag for mouse/touch/pen primary button
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragStateRef.current = {
            active: true,
            startX: e.clientX,
            startScroll: el.scrollLeft,
            moved: false,
            pointerId: e.pointerId,
        };
        try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const state = dragStateRef.current;
        const el = scrollerRef.current;
        if (!state.active || !el) return;
        const dx = e.clientX - state.startX;
        if (!state.moved && Math.abs(dx) > 5) state.moved = true;
        if (state.moved) {
            e.preventDefault();
            el.scrollLeft = state.startScroll - dx;
        }
    }, []);

    const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const el = scrollerRef.current;
        const state = dragStateRef.current;
        if (state.pointerId !== null && el) {
            try { el.releasePointerCapture(state.pointerId); } catch { /* noop */ }
        }
        // Defer clearing 'active' so the click handler can read 'moved'
        const wasMoved = state.moved;
        setTimeout(() => {
            dragStateRef.current = { active: false, startX: 0, startScroll: 0, moved: false, pointerId: null };
        }, 0);
        if (wasMoved) {
            // Suppress the synthetic click after a drag
            e.preventDefault();
        }
    }, []);

    const handleCardClick = useCallback((realIndex: number, e: React.MouseEvent) => {
        if (dragStateRef.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        openLightbox(realIndex, e);
    }, [openLightbox]);

    const strip = (
        <div
            ref={scrollerRef}
            className="ig-scroller"
            onScroll={handleScroll}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            style={{
                width: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                cursor: 'grab',
                touchAction: 'pan-x',
                WebkitOverflowScrolling: 'touch',
                maskImage: 'linear-gradient(to right, transparent 0, #000 5%, #000 95%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0, #000 5%, #000 95%, transparent 100%)',
            }}
        >
            <div
                ref={trackRef}
                style={{
                    display: 'flex',
                    gap: 12,
                    width: 'max-content',
                }}
            >
                {looped.map((item, idx) => (
                    <a
                        key={`${item.id}-${idx}`}
                        href={item.permalink}
                        onClick={(e) => handleCardClick(idx % base.length, e)}
                        draggable={false}
                        className="ig-card"
                        style={{
                            position: 'relative',
                            flex: '0 0 auto',
                            aspectRatio: '1 / 1',
                            borderRadius: 14,
                            overflow: 'hidden',
                            background: P.secondary,
                            border: `1px solid ${P.border}`,
                            textDecoration: 'none',
                            display: 'block',
                            cursor: 'zoom-in',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.04)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        {item.type === 'VIDEO' && item.media_url ? (
                            <video
                                src={item.media_url}
                                poster={item.thumbnail_url ?? undefined}
                                autoPlay
                                muted
                                loop
                                playsInline
                                onError={handleMediaError}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                            />
                        ) : (
                            <img
                                src={item.thumbnail_url || item.media_url || ''}
                                alt=""
                                loading={idx < 4 ? 'eager' : 'lazy'}
                                onError={handleMediaError}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                            />
                        )}
                        {item.type === 'VIDEO' && (
                            <span style={{
                                position: 'absolute', top: 6, right: 6,
                                background: 'rgba(0,0,0,0.55)', color: '#fff',
                                fontSize: 9, fontWeight: 600,
                                padding: '2px 6px', borderRadius: 999,
                                backdropFilter: 'blur(4px)',
                                pointerEvents: 'none',
                            }}>VIDEO</span>
                        )}
                    </a>
                ))}
            </div>

            <style>{`
                /* Card width: viewport-responsive on mobile so two full cards fit
                   with no overflow, fixed compact size on desktop. */
                .ig-card { width: 42vw; }
                @media (min-width: 640px) { .ig-card { width: 200px; } }
                @media (min-width: 1024px) { .ig-card { width: 180px; } }
                .ig-card img, .ig-card video { user-select: none; -webkit-user-drag: none; }
                /* Hide scrollbar across browsers while keeping native scroll */
                .ig-scroller::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );

    const content = (
        <>
            {strip}
            {activeIndex !== null && (
                <Lightbox
                    items={base}
                    index={activeIndex}
                    onClose={() => setActiveIndex(null)}
                    onPrev={goPrev}
                    onNext={goNext}
                />
            )}
        </>
    );

    if (embedded) return content;

    return (
        <section style={{ background: P.card, padding: '32px 0', overflow: 'hidden' }}>
            {content}
        </section>
    );
}
