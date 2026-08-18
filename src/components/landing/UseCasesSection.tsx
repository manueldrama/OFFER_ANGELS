import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Check, ArrowRight, Zap, Coffee, Wine, Cake, UtensilsCrossed, Building2, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { LandingPageSection } from '../../types';
import { P, FadeIn, ease } from './primitives';
import { useTracking } from '../../hooks/useTracking';

const TAB_ICONS: Record<string, React.ElementType> = {
    Coffee, Wine, Cake, UtensilsCrossed, Building2, PartyPopper,
};

interface UseCasesSectionProps {
    section: LandingPageSection;
    go: () => void;
}

export default function UseCasesSection({ section, go }: UseCasesSectionProps) {
    const c = section.config;
    const items = section.items ?? [];
    const [activeTab, setActiveTab] = useState(0);
    const [direction, setDirection] = useState(0);
    const { trackEvent } = useTracking();
    const item = items[activeTab];
    const tabsRef = useRef<HTMLDivElement>(null);

    const goTo = useCallback((i: number) => {
        setDirection(i > activeTab ? 1 : -1);
        setActiveTab(i);
        trackEvent('tab_switched', { tab: items[i]?.title });
    }, [activeTab, items, trackEvent]);

    const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
        const threshold = 50;
        if (info.offset.x < -threshold && activeTab < items.length - 1) {
            goTo(activeTab + 1);
        } else if (info.offset.x > threshold && activeTab > 0) {
            goTo(activeTab - 1);
        }
    }, [activeTab, items.length, goTo]);

    useEffect(() => {
        const container = tabsRef.current;
        if (!container) return;
        const activeBtn = container.children[activeTab] as HTMLElement | undefined;
        if (activeBtn) {
            activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, [activeTab]);

    const IconComponent = item?.icon ? TAB_ICONS[item.icon as string] : null;

    return (
        <section
            className="border-b"
            style={{
                background: P.secondary,
                borderColor: P.border,
                height: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                padding: '7vh 4vw 10vh',
                overflow: 'hidden',
            }}
        >
            <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

                {/* ── HEADER ── */}
                <FadeIn className="text-center" style={{ marginBottom: '1vh', flexShrink: 0 }}>
                    <p style={{ fontSize: '1.2vh', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: P.primary, marginBottom: '0.5vh' }}>
                        {c.eyebrow ?? 'Kategoriyi Tanımlayan Çözüm'}
                    </p>
                    <h2 style={{ fontSize: '2.4vh', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: P.fg }}>
                        {c.title ?? 'Bu Teknolojiyi Kullanmayan Mekanlar Geride Kalıyor'}
                    </h2>
                </FadeIn>

                {/* ── TABS ── */}
                <FadeIn delay={0.08} style={{ marginBottom: '1vh', flexShrink: 0 }}>
                    <div
                        ref={tabsRef}
                        className="no-scrollbar"
                        style={{ display: 'flex', gap: '0.8vw', justifyContent: 'center', overflowX: 'auto', paddingBottom: 2 }}
                    >
                        {items.map((uc, i) => {
                            const TabIcon = uc.icon ? TAB_ICONS[uc.icon as string] : null;
                            const isActive = activeTab === i;
                            return (
                                <button
                                    key={uc.id || i}
                                    onClick={() => goTo(i)}
                                    style={{
                                        flexShrink: 0,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5vw',
                                        padding: '0.6vh 1.5vw',
                                        borderRadius: 10,
                                        fontSize: '1.3vh',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        background: isActive ? P.fg : 'transparent',
                                        color: isActive ? P.bg : P.muted,
                                        border: isActive ? 'none' : `1px solid ${P.border}`,
                                        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    }}
                                >
                                    {TabIcon && <TabIcon style={{ width: '1.8vh', height: '1.8vh' }} />}
                                    {uc.title}
                                </button>
                            );
                        })}
                    </div>
                </FadeIn>

                {/* ── CONTENT ── kalan tüm alanı kaplar */}
                <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                    <AnimatePresence initial={false}>
                        {item && (
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: direction * 40 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: direction * -40, position: 'absolute' as const, inset: 0 }}
                                transition={{ duration: 0.45, ease }}
                                drag="x"
                                dragConstraints={{ left: 0, right: 0 }}
                                dragElastic={0.15}
                                onDragEnd={handleDragEnd}
                                style={{
                                    height: '100%',
                                    display: 'grid',
                                    gridTemplateRows: '1fr 1fr',
                                    gap: '1.2vh',
                                    cursor: 'grab',
                                }}
                                className="active:cursor-grabbing lg:!grid-cols-[1.1fr_0.9fr] lg:!grid-rows-[1fr] lg:!gap-[3vw]"
                            >
                                {/* ── IMAGE ── grid row 1 */}
                                <div
                                    style={{
                                        position: 'relative',
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        minHeight: 0,
                                    }}
                                >
                                    {item.media_url ? (
                                        <img
                                            src={item.media_url}
                                            alt={item.title ?? ''}
                                            loading="lazy"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.card }}>
                                            {IconComponent && <IconComponent size={40} style={{ color: P.muted }} />}
                                        </div>
                                    )}
                                    {/* Stat badge */}
                                    {item.value_text && (
                                        <div style={{
                                            position: 'absolute', bottom: '1vh', left: '1vw',
                                            padding: '0.4vh 1.2vw',
                                            borderRadius: 8, fontSize: '1.3vh', fontWeight: 700,
                                            background: P.card, color: P.primary,
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                        }}>
                                            {item.value_text}
                                        </div>
                                    )}
                                </div>

                                {/* ── TEXT ── grid row 2 */}
                                <div
                                    style={{
                                        minHeight: 0,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        gap: '0.5vh',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* Top: text content */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5vh' }}>
                                        {/* ① Stat */}
                                        {item.value_text && (
                                            <p style={{ fontSize: '2vh', fontWeight: 700, color: P.primary, lineHeight: 1.1 }}>
                                                {item.value_text}
                                            </p>
                                        )}

                                        {/* ② Headline */}
                                        <h3 style={{ fontSize: '1.7vh', fontWeight: 700, lineHeight: 1.2, color: P.fg }}>
                                            {item.description}
                                        </h3>

                                        {/* ③ Description */}
                                        <p style={{ fontSize: '1.2vh', lineHeight: 1.4, color: P.muted }}>
                                            {item.extra?.desc}
                                        </p>

                                        {/* ④ Benefits */}
                                        {item.extra?.benefits && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3vh' }}>
                                                {(item.extra.benefits as Array<{ title: string }>).map((b, bi) => (
                                                    <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
                                                        <div style={{
                                                            width: '1.6vh', height: '1.6vh', borderRadius: '50%',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0, background: P.primaryBg,
                                                        }}>
                                                            <Check style={{ width: '1vh', height: '1vh', color: P.primary }} />
                                                        </div>
                                                        <p style={{ fontSize: '1.15vh', fontWeight: 500, lineHeight: 1.3, color: P.fg }}>{b.title}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* ⑤ First-Mover */}
                                        {item.extra?.firstMover && (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '1vw',
                                                background: P.primaryBg, borderRadius: 6,
                                                padding: '0.4vh 1.2vw',
                                            }}>
                                                <Zap style={{ width: '1.2vh', height: '1.2vh', flexShrink: 0, color: P.primary }} />
                                                <p style={{ fontSize: '1.05vh', fontWeight: 500, lineHeight: 1.3, color: P.primary }}>
                                                    {item.extra.firstMover as string}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* ⑥ CTA — always at bottom */}
                                    <button
                                        onClick={go}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1vw',
                                            width: '100%',
                                            padding: '1vh 3vw',
                                            borderRadius: 10,
                                            fontSize: '1.4vh', fontWeight: 600,
                                            background: P.primary, color: '#FAFAFA',
                                            cursor: 'pointer', border: 'none',
                                            boxShadow: `0 0.6vh 2vh ${P.primary}40`,
                                            transition: 'all 0.2s',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {(item.extra?.ctaLabel as string) ?? 'Teklif al'}
                                        <ArrowRight style={{ width: '1.6vh', height: '1.6vh' }} />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── DOT INDICATORS ── */}
                <div className="lg:hidden" style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: '0.8vh', flexShrink: 0 }}>
                    {items.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            style={{
                                width: 6, height: 6, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                background: activeTab === i ? P.primary : P.border,
                                transform: activeTab === i ? 'scale(1.4)' : 'scale(1)',
                                transition: 'all 0.2s',
                            }}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
