import React from 'react';
import { LandingPageSection } from '../../types';
import { P, FadeIn } from './primitives';
import SmartFaqSearch from '../SmartFaqSearch';

interface FaqSectionProps {
    section: LandingPageSection;
}

export default function FaqSection({ section }: FaqSectionProps) {
    const c = section.config;
    const items = section.items ?? [];

    const faqItems = items.map((faq) => ({
        id: faq.id,
        title: faq.title || '',
        description: faq.value_text || faq.description || '',
    }));

    return (
        <section
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
            <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

                {/* ── HEADER ── */}
                <FadeIn style={{ flexShrink: 0, marginBottom: '2vh', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.4vh', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: P.primary, marginBottom: '0.8vh' }}>
                        {c.eyebrow ?? 'Sık Sorulan Sorular'}
                    </p>
                    <h2 style={{ fontSize: '3vh', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: P.fg }}>
                        {c.title ?? 'Aklınızdaki Sorular'}
                    </h2>
                    {c.subtitle && (
                        <p style={{ fontSize: '1.5vh', lineHeight: 1.5, color: P.muted, marginTop: '0.5vh' }}>{c.subtitle}</p>
                    )}
                </FadeIn>

                {/* ── SMART FAQ SEARCH + AI ── */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    <SmartFaqSearch
                        faqItems={faqItems}
                        placeholder="Sorunuzu yazın veya arayın..."
                    />
                </div>
            </div>
        </section>
    );
}
