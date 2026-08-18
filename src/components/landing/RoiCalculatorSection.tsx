import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Coffee, Minus, Plus, ArrowRight } from 'lucide-react';
import { LandingPageSection } from '../../types';
import { P, FadeIn } from './primitives';
import { EditableI18nText } from './EditableI18nText';

interface RoiCalculatorSectionProps {
    section: LandingPageSection;
    go: () => void;
    cheapestPrice: number;
}

export default function RoiCalculatorSection({ section, go, cheapestPrice }: RoiCalculatorSectionProps) {
    const { t } = useTranslation('offer');
    const c = section.config;
    const [dailyCustomers, setDailyCustomers] = useState(200);
    const [avgPrice, setAvgPrice] = useState(85);

    const monthlyExtra = useMemo(() => Math.round(dailyCustomers * avgPrice * 0.4 * 30), [dailyCustomers, avgPrice]);
    const yearlyExtra = monthlyExtra * 12;
    const newCustomers = Math.round(dailyCustomers * 0.4);
    const amortize = monthlyExtra > 0 ? Math.max(0.1, Math.round(cheapestPrice / monthlyExtra * 10) / 10) : 0;

    // ROI labels come from i18n only — config fields would shadow translations and break EN.
    const sliders = [
        { label: t('landing.roiDailyCustomers'), value: dailyCustomers, set: setDailyCustomers, min: 50, max: 500, step: 10, display: `${dailyCustomers} ${t('landing.roiCustomerSuffix')}`, icon: <Users style={{ width: '1.5vh', height: '1.5vh', color: P.muted }} /> },
        { label: t('landing.roiAvgPrice'), value: avgPrice, set: setAvgPrice, min: 30, max: 2000, step: 10, display: `₺${avgPrice}`, icon: <Coffee style={{ width: '1.5vh', height: '1.5vh', color: P.muted }} /> },
    ] as const;

    const monthSuffix = t('landing.roiAmortizeMonthSuffix');
    const outputs = [
        { label: t('landing.roiMonthlyExtra'), value: `₺${monthlyExtra.toLocaleString('tr-TR')}`, sub: t('landing.roiMonthlyExtraSub'), highlight: true },
        { label: t('landing.roiYearly'), value: `₺${yearlyExtra.toLocaleString('tr-TR')}`, sub: t('landing.roiYearlySub'), highlight: false },
        { label: t('landing.roiNewCustomers'), value: `+${newCustomers}`, sub: t('landing.roiNewCustomersSub'), highlight: false },
        { label: t('landing.roiAmortize'), value: amortize > 0 ? `${amortize} ${monthSuffix}` : '—', sub: t('landing.roiAmortizeSub'), highlight: false },
    ];

    return (
        <section
            id="roi"
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
            <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

                {/* ── HEADER ── */}
                <FadeIn style={{ flexShrink: 0, marginBottom: '2vh', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.4vh', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: P.primary, marginBottom: '0.8vh' }}>
                        {c.eyebrow ?? t('landing.roiEyebrow')}
                    </p>
                    <h2 style={{ fontSize: '3vh', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: P.fg, marginBottom: '0.5vh' }}>
                        {c.title ?? t('landing.roiTitle')}
                    </h2>
                    {c.subtitle && (
                        <p style={{ fontSize: '1.5vh', lineHeight: 1.5, color: P.muted }}>{c.subtitle}</p>
                    )}
                </FadeIn>

                {/* ── CALCULATOR ── */}
                <FadeIn delay={0.1} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ borderRadius: 16, border: `1px solid ${P.border}`, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.05)' }}>

                        {/* Sliders */}
                        <div style={{ padding: '2vh 3vw', borderBottom: `1px solid ${P.border}` }}>
                            <div className="lg:grid lg:grid-cols-2" style={{ gap: '2vw' }}>
                                {sliders.map((s, i) => (
                                    <div key={i} style={{ marginBottom: i === 0 ? '1.5vh' : 0 }} className="lg:!mb-0">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1vh' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5vw', fontSize: '1.4vh', fontWeight: 600, color: P.fg }}>{s.icon}{s.label}</span>
                                            <span style={{ fontSize: '1.4vh', fontWeight: 700, borderRadius: 8, padding: '0.4vh 1vw', background: P.secondary, color: P.fg }}>{s.display}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
                                            <button onClick={() => s.set(v => Math.max(s.min, v - s.step))} style={{ width: '3vh', height: '3vh', borderRadius: '50%', border: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none' }} aria-label="Azalt">
                                                <Minus style={{ width: '1.4vh', height: '1.4vh', color: P.fg }} />
                                            </button>
                                            <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={e => s.set(Number(e.target.value))} className="flex-1 accent-[#C41E2A] cursor-pointer" />
                                            <button onClick={() => s.set(v => Math.min(s.max, v + s.step))} style={{ width: '3vh', height: '3vh', borderRadius: '50%', border: `1px solid ${P.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: 'none' }} aria-label="Artır">
                                                <Plus style={{ width: '1.4vh', height: '1.4vh', color: P.fg }} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Outputs */}
                        <div style={{ padding: '2vh 3vw', background: P.bg }}>
                            <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '1vh', marginBottom: '1.5vh' }}>
                                {outputs.map((o, i) => (
                                    <div key={i} style={{
                                        borderRadius: 10, padding: '1.2vh 1.5vw',
                                        background: o.highlight ? P.primaryBg : P.card,
                                        border: `1px solid ${o.highlight ? P.primary + '25' : P.border}`,
                                    }}>
                                        <p style={{ fontSize: '1.1vh', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3vh', color: P.muted }}>{o.label}</p>
                                        <p style={{ fontSize: '2.2vh', fontWeight: 700, lineHeight: 1, marginBottom: '0.2vh', color: o.highlight ? P.primary : P.fg }}>{o.value}</p>
                                        <p style={{ fontSize: '1.1vh', color: P.muted }}>{o.sub}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col sm:flex-row" style={{ alignItems: 'center', gap: '1vw' }}>
                                <button
                                    onClick={go}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8vw',
                                        padding: '1.2vh 3vw', borderRadius: 12,
                                        fontSize: '1.5vh', fontWeight: 600,
                                        background: P.primary, color: '#FAFAFA',
                                        cursor: 'pointer', border: 'none',
                                        boxShadow: `0 0.8vh 3vh ${P.primary}40`,
                                    }}
                                >
                                    <EditableI18nText i18nKey="landing.ctaButton" value={t('landing.ctaButton')} />
                                    <ArrowRight style={{ width: '1.6vh', height: '1.6vh' }} />
                                </button>
                                <p style={{ fontSize: '1.1vh', color: P.muted }}><EditableI18nText i18nKey="landing.roiDisclaimer" value={t('landing.roiDisclaimer')} /></p>
                            </div>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}
