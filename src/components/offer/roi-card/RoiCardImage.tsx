import React from 'react';
import { TrendingUp, Users, CalendarClock, Coffee, ShoppingBag, ShieldCheck } from 'lucide-react';
import { formatPriceCompact, formatNumber, type SupportedCurrency } from '../../../utils/currency';
import type { SupportedLanguage } from '../../../i18n';

/**
 * All user-facing strings, pre-resolved via i18n by the caller. The card is
 * rendered off-screen with `createRoot` (see roiCardImage.ts) WITHOUT an i18n
 * provider, so every label must arrive as a prop — mirrors OfferReceiptImage.
 */
export interface RoiCardLabels {
    brandName: string;          // e.g. "CAFEPASTE"
    eyebrow: string;            // e.g. "İŞLETMENİZE ÖZEL"
    title: string;             // e.g. "Getiri Projeksiyonunuz"
    preparedForLabel: string;   // e.g. "Hazırlayan analiz —"
    dailyCustomersLabel: string;
    avgPriceLabel: string;
    monthlyExtraLabel: string;
    monthlyExtraSub: string;
    yearlyLabel: string;
    yearlySub: string;
    newCustomersLabel: string;
    newCustomersSub: string;
    amortizeLabel: string;
    amortizeSub: string;
    monthSuffix: string;        // e.g. "ay"
    recommendedLabel: string;   // e.g. "Önerilen Model"
    disclaimer: string;
}

export interface RoiCardImageProps {
    customerName: string;
    companyName?: string | null;
    dailyDrinks: number;
    avgPrice: number;
    currency: SupportedCurrency;
    language?: SupportedLanguage;
    /** Pre-computed via RoiService — keeps the card a pure presenter. */
    monthly: number;
    yearly: number;
    newCustomers: number;
    /** Optional — only shown when the rep entered a device price. */
    amortizeMonths?: number | null;
    recommendedModel?: 'PRO' | 'LITE' | null;
    brandColor?: string;
    labels: RoiCardLabels;
}

// Square-ish portrait — reads well as a WhatsApp image.
const W = 1080;
const H = 1350;

const INK = '#0F172A';
const SLATE = '#475569';
const MUTED = '#94A3B8';
const HAIR = '#E2E8F0';
const PAPER = '#F8FAFC';

export const RoiCardImage: React.FC<RoiCardImageProps> = ({
    customerName, companyName, dailyDrinks, avgPrice, currency, language = 'tr',
    monthly, yearly, newCustomers, amortizeMonths, recommendedModel, brandColor, labels,
}) => {
    const BRAND = brandColor || '#C41E2A';
    const fpc = (n: number) => formatPriceCompact(Math.round(n), currency, language);
    const fn = (n: number) => formatNumber(Math.round(n), language);

    const secondary = [
        {
            icon: <CalendarClock size={26} color={BRAND} />,
            label: labels.yearlyLabel,
            value: fpc(yearly),
            sub: labels.yearlySub,
        },
        {
            icon: <Users size={26} color={BRAND} />,
            label: labels.newCustomersLabel,
            value: `+${fn(newCustomers)}`,
            sub: labels.newCustomersSub,
        },
        ...(amortizeMonths != null && amortizeMonths > 0
            ? [{
                icon: <ShoppingBag size={26} color={BRAND} />,
                label: labels.amortizeLabel,
                value: `${formatNumber(amortizeMonths, language)} ${labels.monthSuffix}`,
                sub: labels.amortizeSub,
            }]
            : []),
    ];

    return (
        <div
            style={{
                width: W,
                height: H,
                background: '#FFFFFF',
                color: INK,
                fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                padding: '64px 64px 56px 64px',
            }}
        >
            {/* Soft brand wash in the corner */}
            <div style={{
                position: 'absolute', top: -180, right: -180, width: 520, height: 520,
                borderRadius: '50%', background: `${BRAND}0D`, zIndex: 0,
            }} />

            {/* ── HEADER ── */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 44 }}>
                <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '0.04em', color: INK }}>
                    {labels.brandName}
                </div>
                <div style={{
                    padding: '10px 20px', background: '#FFF', border: `2px solid ${BRAND}33`,
                    borderRadius: 100, color: BRAND, fontWeight: 800, fontSize: 16,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                }}>
                    {labels.eyebrow}
                </div>
            </div>

            {/* ── TITLE + CUSTOMER ── */}
            <div style={{ position: 'relative', zIndex: 1, marginBottom: 36 }}>
                <h1 style={{ fontSize: 60, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.02em', color: INK, marginBottom: 18 }}>
                    {labels.title}
                </h1>
                <div style={{ fontSize: 20, color: MUTED }}>
                    {labels.preparedForLabel}{' '}
                    <span style={{ fontWeight: 800, color: SLATE }}>{customerName}</span>
                    {companyName ? <span style={{ color: SLATE }}> · {companyName}</span> : null}
                </div>
            </div>

            {/* ── INPUT SUMMARY ── */}
            <div style={{
                position: 'relative', zIndex: 1, display: 'flex', gap: 16, marginBottom: 32,
            }}>
                <div style={{ flex: 1, background: PAPER, border: `1px solid ${HAIR}`, borderRadius: 16, padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Users size={30} color={SLATE} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED }}>{labels.dailyCustomersLabel}</div>
                        <div style={{ fontSize: 30, fontWeight: 900, color: INK, lineHeight: 1.1 }}>{fn(dailyDrinks)}</div>
                    </div>
                </div>
                <div style={{ flex: 1, background: PAPER, border: `1px solid ${HAIR}`, borderRadius: 16, padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Coffee size={30} color={SLATE} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED }}>{labels.avgPriceLabel}</div>
                        <div style={{ fontSize: 30, fontWeight: 900, color: INK, lineHeight: 1.1 }}>{fpc(avgPrice)}</div>
                    </div>
                </div>
            </div>

            {/* ── HERO METRIC: Monthly extra ── */}
            <div style={{
                position: 'relative', zIndex: 1,
                background: `linear-gradient(135deg, ${BRAND}, ${BRAND}DD)`,
                borderRadius: 24, padding: '40px 44px', marginBottom: 28,
                boxShadow: `0 24px 60px ${BRAND}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <TrendingUp size={28} color="#FFF" />
                        <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FFF', opacity: 0.92 }}>
                            {labels.monthlyExtraLabel}
                        </span>
                    </div>
                    <div style={{ fontSize: 22, color: '#FFF', opacity: 0.78 }}>{labels.monthlyExtraSub}</div>
                </div>
                <div style={{ fontSize: 68, fontWeight: 900, letterSpacing: '-0.02em', color: '#FFF', whiteSpace: 'nowrap' }}>
                    {fpc(monthly)}
                </div>
            </div>

            {/* ── SECONDARY METRICS ── */}
            <div style={{
                position: 'relative', zIndex: 1, display: 'grid',
                gridTemplateColumns: `repeat(${secondary.length}, 1fr)`, gap: 16, marginBottom: 28,
            }}>
                {secondary.map((m, i) => (
                    <div key={i} style={{ background: '#FFF', border: `1px solid ${HAIR}`, borderRadius: 18, padding: '26px 24px' }}>
                        <div style={{ marginBottom: 14 }}>{m.icon}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED, marginBottom: 6 }}>{m.label}</div>
                        <div style={{ fontSize: 34, fontWeight: 900, color: INK, lineHeight: 1, marginBottom: 6 }}>{m.value}</div>
                        <div style={{ fontSize: 15, color: MUTED }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── RECOMMENDED MODEL (optional) ── */}
            {recommendedModel ? (
                <div style={{
                    position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 14,
                    background: `${BRAND}0D`, border: `1px solid ${BRAND}26`, borderRadius: 16,
                    padding: '20px 26px', marginBottom: 'auto',
                }}>
                    <ShieldCheck size={26} color={BRAND} />
                    <div style={{ fontSize: 19, color: SLATE }}>
                        {labels.recommendedLabel}: <span style={{ fontWeight: 900, color: BRAND }}>CAFEPASTE {recommendedModel}</span>
                    </div>
                </div>
            ) : <div style={{ marginBottom: 'auto' }} />}

            {/* ── FOOTER ── */}
            <div style={{
                position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10,
                borderTop: `1px solid ${HAIR}`, paddingTop: 24, fontSize: 16, color: MUTED,
            }}>
                <span>{labels.disclaimer}</span>
            </div>
        </div>
    );
};
