import React from 'react';
import { LandingPageSection } from '../../types';
import { P, FadeIn } from './primitives';
import { resolveIcon } from './iconMap';

interface HowItWorksSectionProps {
    section: LandingPageSection;
}

export default function HowItWorksSection({ section }: HowItWorksSectionProps) {
    const c = section.config;
    const items = section.items ?? [];

    return (
        <section
            id="nasil-calisir"
            className="border-b"
            style={{
                background: P.card,
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
                <FadeIn style={{ flexShrink: 0, marginBottom: '2vh' }}>
                    <p style={{ fontSize: '1.4vh', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: P.primary, marginBottom: '0.8vh' }}>
                        {c.eyebrow ?? 'Nasıl Çalışır?'}
                    </p>
                    <h2 style={{ fontSize: '3vh', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: P.fg, marginBottom: '0.5vh' }}>
                        {c.title ?? "3 Adımda Art'lı İçecek"}
                    </h2>
                    {c.subtitle && (
                        <p style={{ fontSize: '1.5vh', lineHeight: 1.5, color: P.muted }}>{c.subtitle}</p>
                    )}
                </FadeIn>

                {/* ── STEPS ── */}
                <div
                    className="lg:flex-row lg:justify-center lg:items-center"
                    style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2.5vh', position: 'relative' }}
                >
                    {/* Timeline line */}
                    <div className="lg:hidden" style={{ position: 'absolute', left: '2.5vh', top: '3vh', bottom: '3vh', width: 2, background: P.border }} />
                    <div className="hidden lg:block" style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: 2, background: P.border }} />

                    {items.map((step, i) => {
                        const IconComponent = resolveIcon(step.icon);
                        return (
                            <FadeIn key={step.id || i} delay={i * 0.1}>
                                <div
                                    className="lg:flex-col lg:items-center lg:text-center"
                                    style={{ display: 'flex', gap: '2vw', position: 'relative', zIndex: 10 }}
                                >
                                    <div style={{
                                        width: '5vh', height: '5vh', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, background: P.primary,
                                        boxShadow: `0 0 0 1.2vh ${P.card}`,
                                    }}>
                                        {IconComponent ? <IconComponent style={{ width: '2.2vh', height: '2.2vh', color: '#fff' }} /> : null}
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '1.7vh', fontWeight: 700, marginBottom: '0.5vh', color: P.fg }}>{step.title}</h4>
                                        <p className="lg:max-w-[280px]" style={{ fontSize: '1.4vh', lineHeight: 1.5, color: P.muted }}>{step.description}</p>
                                    </div>
                                </div>
                            </FadeIn>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
