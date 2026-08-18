import React from 'react';
import { motion } from 'framer-motion';
import { LandingPageSection } from '../../types';
import { P, FadeIn } from './primitives';

interface VisualProofSectionProps {
    section: LandingPageSection;
}

export default function VisualProofSection({ section }: VisualProofSectionProps) {
    const c = section.config;
    const items = section.items ?? [];

    return (
        <section
            id="gorsel-kanit"
            className="border-b"
            style={{
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
                <FadeIn style={{ flexShrink: 0, marginBottom: '2vh', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.4vh', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: P.primary, marginBottom: '0.8vh' }}>
                        {c.eyebrow ?? 'Görsel Kanıt'}
                    </p>
                    <h2 style={{ fontSize: '3vh', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: P.fg, marginBottom: '0.5vh' }}>
                        {c.title ?? 'Her İçeceğe Çalışır'}
                    </h2>
                    {c.subtitle && (
                        <p style={{ fontSize: '1.5vh', lineHeight: 1.5, color: P.muted }}>{c.subtitle}</p>
                    )}
                </FadeIn>

                {/* ── CIRCLE IMAGE GALLERY ── */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="flex items-center justify-center gap-6 lg:gap-10 flex-wrap" style={{ width: '100%' }}>
                        {items.map((item, i) => (
                            <FadeIn key={item.id || i} delay={i * 0.1}>
                                <motion.div
                                    className="relative group"
                                    style={{
                                        width: 'clamp(140px, 18vw, 240px)',
                                        height: 'clamp(140px, 18vw, 240px)',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                                        border: `3px solid ${P.border}`,
                                    }}
                                    whileHover={{ scale: 1.05, boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }}
                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                >
                                    {item.media_url && (
                                        <img
                                            src={item.media_url}
                                            alt={item.title ?? `Art'lı içecek ${i + 1}`}
                                            loading="lazy"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    )}
                                    {item.title && (
                                        <div className="absolute inset-0 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)' }}>
                                            <span className="text-white text-xs font-semibold pb-4 text-center px-2">{item.title}</span>
                                        </div>
                                    )}
                                </motion.div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
