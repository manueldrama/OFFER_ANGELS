import React from 'react';
import { useTranslation } from 'react-i18next';
import { LandingPageSection } from '../../types';
import { P, FadeIn, Eyebrow, SectionTitle, PrimaryBtn } from './primitives';
import { EditableI18nText } from './EditableI18nText';

const AVATAR_COLORS = ['#DE2530', '#1A73E8', '#0F9D58', '#F4A234', '#7C3AED'];

interface UsageScenariosSectionProps {
    section: LandingPageSection;
    go: () => void;
}

export default function UsageScenariosSection({ section, go }: UsageScenariosSectionProps) {
    const { t } = useTranslation('offer');
    const c = section.config;
    const items = (section.items ?? [])
        .filter(i => i.is_active !== false)
        .sort((a, b) => a.sort_order - b.sort_order);

    return (
        <section className="py-16 lg:py-24 border-b overflow-hidden" style={{ background: P.secondary, borderColor: P.border }}>
            <FadeIn>
                <div className="px-6 lg:px-10 lg:text-center lg:max-w-[600px] lg:mx-auto mb-8 lg:mb-12">
                    <Eyebrow>{c.eyebrow ?? 'Kullanım Senaryoları'}</Eyebrow>
                    <SectionTitle className="mb-3 lg:mb-4">{c.title ?? ''}</SectionTitle>
                    {c.subtitle && (
                        <p className="text-[15px] lg:text-[18px] leading-relaxed" style={{ color: P.muted }}>{c.subtitle}</p>
                    )}
                </div>
            </FadeIn>

            {/* Carousel */}
            <div
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 lg:max-w-[1200px] lg:mx-auto"
                style={{
                    paddingLeft: 'clamp(1.25rem,5vw,2.5rem)',
                    paddingRight: 'clamp(1.25rem,5vw,2.5rem)',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                }}
            >
                {items.map((s, i) => {
                    const igUser: string = (s.extra?.ig_user as string) || (s.title?.toLowerCase().replace(/\s+/g, '_') ?? 'cafepaste');
                    const igLocation: string = (s.extra?.ig_location as string) || 'CAFEPASTE';
                    const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    const avatarLetter = igUser[0]?.toUpperCase() ?? 'C';

                    return (
                        <div
                            key={s.id || i}
                            className="shrink-0 snap-start rounded-lg overflow-hidden border flex flex-col"
                            style={{
                                width: 'clamp(272px, 76vw, 320px)',
                                background: P.card,
                                borderColor: P.border,
                            }}
                        >
                            {/* IG Header */}
                            <div className="flex items-center gap-3 px-4 py-3">
                                <div className="relative shrink-0">
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-[14px]"
                                        style={{
                                            background: avatarColor,
                                            boxShadow: `0 0 0 2px ${P.card}, 0 0 0 3.5px #DE2530`,
                                        }}
                                    >
                                        {avatarLetter}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[13px] leading-tight truncate" style={{ color: P.fg }}>{igUser}</p>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide truncate" style={{ color: P.muted }}>{igLocation}</p>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: P.muted }}>
                                    <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
                                </svg>
                            </div>

                            {/* Image */}
                            {s.media_url ? (
                                <div className="w-full overflow-hidden" style={{ aspectRatio: '4/3' }}>
                                    <img
                                        src={s.media_url}
                                        alt={s.title ?? ''}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="w-full flex items-center justify-center" style={{ aspectRatio: '4/3', background: P.primaryBg }}>
                                    <span className="text-[11px] font-semibold" style={{ color: P.primary }}><EditableI18nText i18nKey="offer:usageScenariosSection.gorselYok" value={t('offer:usageScenariosSection.gorselYok')} /></span>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="px-4 py-4 flex flex-col gap-1.5 flex-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: P.primary }}>
                                    {(s.extra?.result_label as string) || 'İŞ SONUCU'}
                                </span>
                                <h4 className="font-bold text-[15px] leading-snug" style={{ color: P.fg }}>{s.title}</h4>
                                {s.extra?.highlight && (
                                    <p className="text-[13px] font-semibold" style={{ color: P.primary }}>
                                        → {s.extra.highlight as string}
                                    </p>
                                )}
                                {s.description && (
                                    <p className="text-[12px] leading-relaxed mt-0.5" style={{ color: P.muted }}>{s.description}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <FadeIn delay={0.3} className="mt-8 lg:mt-10 text-center px-6">
                <PrimaryBtn onClick={go} label={c.cta_label ?? 'Modelleri İncele'} size="sm" />
            </FadeIn>
        </section>
    );
}
