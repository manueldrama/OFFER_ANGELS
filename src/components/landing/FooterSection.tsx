import React from 'react';
import { useTranslation } from 'react-i18next';
import { LandingPageSection } from '../../types';
import { P } from './primitives';

interface FooterSectionProps {
    section?: LandingPageSection;
}

export default function FooterSection({ section }: FooterSectionProps) {
    const { i18n, t } = useTranslation('influencer');
    const lang = i18n.language?.split('-')[0] || 'tr';
    const influencerLabel = t('footer.link', { defaultValue: 'Influencer İşbirliği' });

    return (
        <footer
            style={{
                height: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '7vh 4vw 10vh',
                background: P.secondary,
                borderTop: `1px solid ${P.border}`,
            }}
        >
            <div style={{ maxWidth: 1100, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3vh' }}>
                <img src="/logo.svg" alt="CAFEPASTE" style={{ height: '3vh', objectFit: 'contain' }} />

                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '3vw' }}>
                    {[
                        { label: t('footer.privacy', { defaultValue: 'Gizlilik Politikası' }), href: `/${lang}/gizlilik` },
                        { label: 'Kullanım Koşulları', href: '#' },
                        { label: 'İletişim', href: '#' },
                        { label: influencerLabel, href: `/${lang}/influencer` },
                    ].map(l => (
                        <a
                            key={l.label}
                            href={l.href}
                            style={{
                                fontSize: '1.4vh', fontWeight: 600,
                                color: P.muted,
                                textDecoration: 'none',
                                transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                            {l.label}
                        </a>
                    ))}
                </div>

                <p style={{ fontSize: '1.2vh', color: P.muted, opacity: 0.6 }}>
                    © {new Date().getFullYear()} CAFEPASTE. Tüm hakları saklıdır.
                </p>
            </div>
        </footer>
    );
}
