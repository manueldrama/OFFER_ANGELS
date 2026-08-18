import React from 'react';
import { LandingPageSection } from '../../types';
import { P, FadeIn } from './primitives';
import { resolveIcon } from './iconMap';

interface FeaturesSectionProps {
    section: LandingPageSection;
}

export default function FeaturesSection({ section }: FeaturesSectionProps) {
    const c = section.config;
    const items = section.items ?? [];

    return (
        <section
            id="ozellikler"
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
                <FadeIn style={{ flexShrink: 0, marginBottom: '2vh', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.4vh', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: P.primary, marginBottom: '0.8vh' }}>
                        {c.eyebrow ?? 'Özellikler'}
                    </p>
                    <h2 style={{ fontSize: '3vh', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: P.fg }}>
                        {c.title ?? ''}
                    </h2>
                </FadeIn>

                {/* ── GRID ── */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
                    <div
                        className="grid grid-cols-2 lg:grid-cols-3"
                        style={{ gap: '1.5vh', width: '100%' }}
                    >
                        {items.map((f, i) => {
                            const IconComponent = resolveIcon(f.icon);
                            return (
                                <FadeIn key={f.id || i} delay={i * 0.07}>
                                    <div
                                        className="group cursor-default transition-all duration-200 hover:shadow-md hover:-translate-y-1 flex flex-col items-center text-center"
                                        style={{
                                            borderRadius: 12,
                                            padding: '2vh 2vw',
                                            border: `1px solid ${P.border}`,
                                            background: '#fff',
                                        }}
                                    >
                                        <div style={{
                                            width: '3.5vh', height: '3.5vh', borderRadius: 10,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginBottom: '1.2vh',
                                            background: P.primaryBg, color: P.primary,
                                        }}>
                                            {IconComponent ? <IconComponent style={{ width: '2vh', height: '2vh' }} /> : null}
                                        </div>
                                        <h4 style={{ fontSize: '1.6vh', fontWeight: 700, marginBottom: '0.5vh', color: P.fg }}>{f.title}</h4>
                                        <p style={{ fontSize: '1.3vh', lineHeight: 1.4, color: P.muted }}>{f.description}</p>
                                    </div>
                                </FadeIn>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
