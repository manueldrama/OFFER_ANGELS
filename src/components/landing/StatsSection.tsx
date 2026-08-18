import React from 'react';
import { LandingPageSection } from '../../types';
import { P, Counter, FadeIn } from './primitives';

interface StatsSectionProps {
    section: LandingPageSection;
}

export default function StatsSection({ section }: StatsSectionProps) {
    const items = section.items ?? [];

    return (
        <section
            className="border-b"
            style={{
                background: P.secondary,
                borderColor: P.border,
                height: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '7vh 4vw 10vh',
                overflow: 'hidden',
            }}
        >
            <FadeIn>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2vw', maxWidth: 1100, width: '100%' }}>
                    {items.map((s, i) => (
                        <div
                            key={s.id || i}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center',
                                borderRadius: 16,
                                padding: '3vh 2vw',
                                border: `1px solid ${P.border}`,
                                background: P.card,
                            }}
                        >
                            <p style={{ fontSize: '4vh', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '1vh', color: P.primary }}>
                                <Counter
                                    end={parseFloat(s.value_text ?? '0')}
                                    suffix={s.extra?.suffix ?? ''}
                                    prefix={s.extra?.prefix ?? ''}
                                />
                            </p>
                            <p style={{ fontSize: '1.4vh', fontWeight: 600, lineHeight: 1.3, color: P.muted }}>
                                {s.title}
                            </p>
                        </div>
                    ))}
                </div>
            </FadeIn>
        </section>
    );
}
