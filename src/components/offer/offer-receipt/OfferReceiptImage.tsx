import React from 'react';
import { Calendar, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { CartItem } from '../../../types';

/** All user-facing strings, pre-resolved via i18n by the caller. */
export interface OfferReceiptLabels {
    documentLabel: string;
    tagline: string;
    verifiedOffer: string;
    offerInfoTitle: string;
    customerTitle: string;
    dateLabel: string;
    validityLabel: string;
    documentNoLabel: string;
    detailsTitle: string;
    colProduct: string;
    colQty: string;
    colUnitPrice: string;
    colAmount: string;
    subtotalLabel: string;
    vatLabel: string;       // already interpolated, e.g. "KDV (%20)"
    grandTotalLabel: string;
    listPriceLabel: string;       // e.g. "Liste Fiyatı"
    launchDiscountLabel: string;  // e.g. "Lansman İndirimi"
    vatIncluded?: string;

    // Premium Design New Labels
    companyLabel?: string;
    customerLabel?: string;
    offerNoLabel?: string;
    imagePlaceholder?: string;
    bankInfoTitle: string;
    bankLabel: string;
    accountHolderLabel: string;
    ibanLabel: string;
    descLabel: string;

    bankName: string;
    accountHolder: string;
    iban: string;
    bankDesc: string;

    paymentOptionsTitle: string;
    paymentOptions: Array<{ title: string; desc: string; amount?: number | null; amountLabel?: string }>;

    checklist: string[];

    footerContact: string;
    footerDisclaimer: string;

    companyLogoText: string;
    companySlogan: string;
    brandColor: string;

    // Marketing (AI Translatable)
    marketingTitle: string;
    marketingDesc: string;
    feature1Title: string;
    feature1Desc: string;
    feature2Title: string;
    feature2Desc: string;
    feature3Title: string;
    feature3Desc: string;
    heroImage?: string;
}

export interface OfferReceiptImageProps {
    offerNumber: string;
    customerName: string;
    companyName: string;
    validUntil: string;        // formatted date string (e.g. "25 Mayıs 2026")
    cart: CartItem[];
    vatRate: number;
    offerUrl: string;
    /** Currency-aware formatter (from useOfferLocale().fpc). */
    fpc: (n: number) => string;
    /** Date formatter for "tarih" (today). */
    todayLabel: string;
    /** Pre-resolved i18n strings — rendered off-screen without an i18n provider. */
    labels: OfferReceiptLabels;
    /** Download filename (no extension). */
    fileName: string;
}

// A4 portrait @ ~150 DPI. width / height = 1 / 1.4145
const W = 1240;
const H = 1754;

const INK = '#0F172A';
const SLATE = '#475569';
const MUTED = '#94A3B8';
const HAIR = '#E2E8F0';
const PAPER = '#F8FAFC';


export const OfferReceiptImage: React.FC<OfferReceiptImageProps> = ({
    offerNumber, customerName, companyName, validUntil, cart, vatRate, fpc, todayLabel, labels,
}) => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = Math.round(subtotal * (vatRate / 100));
    const grand = subtotal + tax;
    // Lansman fiyatı (item.price) vs liste fiyatı (item.listPrice) indirimi —
    // final offer'daki gibi görselde de gösterilir.
    const listSubtotal = cart.reduce((sum, item) => sum + ((item.listPrice || item.price) * item.quantity), 0);
    const discountAmount = Math.max(0, listSubtotal - subtotal);
    
    const BRAND = labels.brandColor || '#C41E2A';

    return (
        <div
            style={{
                width: W,
                height: 1754, // STRICT A4 HEIGHT
                background: '#FFFFFF',
                color: INK,
                fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* ── 1. COMPACT MARKETING COVER (Height: ~640px) ──────────────────────────────────────── */}
            <div style={{
                position: 'relative',
                height: 640,
                borderBottom: `1px solid ${HAIR}`,
                flexShrink: 0
            }}>
                {/* Background Hero Image */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
                    <img 
                        src={labels.heroImage || cart[0]?.image || "/products/cafepaste-pro-main.webp"} 
                        alt="Hero" 
                        crossOrigin="anonymous"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} 
                    />
                    {/* Gradient to fade from left (white) to right (transparent) for text readability */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to right, rgba(253,253,253,1) 0%, rgba(253,253,253,0.95) 45%, rgba(253,253,253,0) 100%)'
                    }} />
                </div>

                {/* Content Container */}
                <div style={{
                    position: 'relative',
                    zIndex: 10,
                    padding: '48px 48px 60px 48px',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                }}>
                    {/* Header inside cover */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <img src="/logo.svg" alt="Cafepaste" style={{ maxHeight: 40, objectFit: 'contain' }} />
                        </div>
                        <div style={{ padding: '8px 16px', background: '#FFF', border: `2px solid ${BRAND}33`, borderRadius: 100, color: BRAND, fontWeight: 700, fontSize: 15, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            {labels.verifiedOffer || 'Profesyonel Teklif'}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                        {/* Left: Marketing Copy */}
                        <div style={{ flex: 1.2, paddingRight: 40, display: 'flex', flexDirection: 'column' }}>
                            <h1 style={{ fontSize: 48, fontWeight: 900, color: INK, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-0.02em' }}>
                                {labels.marketingTitle}
                            </h1>
                            <p style={{ fontSize: 19, color: SLATE, lineHeight: 1.5, marginBottom: 32, maxWidth: 500 }}>
                                {labels.marketingDesc}
                            </p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFF', border: `1px solid ${BRAND}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: 16 }}>💎</span>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>{labels.feature1Title}</div>
                                        <div style={{ fontSize: 15, color: SLATE, lineHeight: 1.4 }}>{labels.feature1Desc}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFF', border: `1px solid ${BRAND}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: 16 }}>🔄</span>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>{labels.feature2Title}</div>
                                        <div style={{ fontSize: 15, color: SLATE, lineHeight: 1.4 }}>{labels.feature2Desc}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFF', border: `1px solid ${BRAND}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: 16 }}>📈</span>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>{labels.feature3Title}</div>
                                        <div style={{ fontSize: 15, color: SLATE, lineHeight: 1.4 }}>{labels.feature3Desc}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Right: Offer Summary Box overlapping bottom right */}
                        <div style={{ flex: 1, position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                bottom: -40,
                                right: 0,
                                background: '#FFF',
                                padding: 24,
                                borderRadius: 16,
                                boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
                                width: 380,
                                zIndex: 10,
                                border: `1px solid ${HAIR}`
                            }}>
                                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.2em', color: BRAND, textTransform: 'uppercase', marginBottom: 20, textAlign: 'center' }}>
                                    {labels.offerInfoTitle || 'TEKLİF BİLGİLERİ'}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 0', fontSize: 17 }}>
                                    <div style={{ color: MUTED }}>{labels.companyLabel}</div>
                                    <div style={{ fontWeight: 800, color: INK }}>{companyName}</div>
                                    
                                    <div style={{ color: MUTED }}>{labels.customerLabel}</div>
                                    <div style={{ fontWeight: 800, color: INK }}>{customerName}</div>
                                    
                                    <div style={{ color: MUTED }}>{labels.dateLabel}</div>
                                    <div style={{ fontWeight: 800, color: INK }}>{todayLabel}</div>
                                    
                                    <div style={{ color: MUTED }}>{labels.offerNoLabel}</div>
                                    <div style={{ fontWeight: 800, color: INK }}>{offerNumber}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 2. COMMERCIAL DETAILS SECTION ────────────────────────────────────── */}
            <div style={{ padding: '60px 48px 40px 48px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: INK }}>
                        {labels.detailsTitle || 'Fiyatlandırma Detayları'}
                    </div>
                    <div style={{ fontSize: 16, color: SLATE, textAlign: 'right' }}>
                        {labels.validityLabel}:<br/>
                        <span style={{ fontSize: 22, fontWeight: 800, color: BRAND }}>{validUntil}</span>
                    </div>
                </div>

                {/* ── PRODUCT TABLE ── */}
                <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 150px 150px', borderBottom: `2px solid ${INK}`, paddingBottom: 16, marginBottom: 16 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.15em', color: SLATE, textTransform: 'uppercase' }}>{labels.colProduct}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.15em', color: SLATE, textTransform: 'uppercase', textAlign: 'center' }}>{labels.colQty}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.15em', color: SLATE, textTransform: 'uppercase', textAlign: 'right' }}>{labels.colUnitPrice}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.15em', color: SLATE, textTransform: 'uppercase', textAlign: 'right' }}>{labels.colAmount}</div>
                    </div>

                    {cart.map((item, idx) => (
                        <div key={item.id || idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 150px 150px', padding: '16px 0', borderBottom: `1px solid ${HAIR}`, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                <div style={{ width: 76, height: 76, borderRadius: 12, border: `1px solid ${HAIR}`, background: PAPER, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {item.image ? (
                                        <img src={item.image} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: '0.1em' }}>{labels.imagePlaceholder || 'GÖRSEL'}</span>
                                    )}
                                </div>
                                <div>
                                    <div style={{ fontSize: 21, fontWeight: 800, color: INK, marginBottom: 4 }}>{item.name}</div>
                                    <div style={{ fontSize: 16, color: SLATE }}>{item.description || 'Profesyonel seri'}</div>
                                </div>
                            </div>
                            <div style={{ fontSize: 19, fontWeight: 700, textAlign: 'center' }}>{item.quantity}</div>
                            <div style={{ textAlign: 'right' }}>
                                {item.listPrice && item.listPrice > item.price ? (
                                    <div style={{ fontSize: 14, color: MUTED, textDecoration: 'line-through', marginBottom: 2 }}>{fpc(item.listPrice)}</div>
                                ) : null}
                                <div style={{ fontSize: 19, color: SLATE }}>{fpc(item.price)}</div>
                            </div>
                            <div style={{ fontSize: 23, fontWeight: 900, color: INK, textAlign: 'right' }}>{fpc(item.price * item.quantity)}</div>
                        </div>
                    ))}
                </div>

                {/* ── TOTALS ── */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
                    <div style={{ width: 400 }}>
                        {discountAmount > 0 && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                                    <div style={{ fontSize: 18, color: SLATE }}>{labels.listPriceLabel}</div>
                                    <div style={{ fontSize: 19, fontWeight: 700, color: MUTED, textDecoration: 'line-through' }}>{fpc(listSubtotal)}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: BRAND }}>{labels.launchDiscountLabel}</div>
                                    <div style={{ fontSize: 19, fontWeight: 800, color: BRAND }}>−{fpc(discountAmount)}</div>
                                </div>
                            </>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                            <div style={{ fontSize: 18, color: SLATE }}>{labels.subtotalLabel}</div>
                            <div style={{ fontSize: 19, fontWeight: 800, color: INK }}>{fpc(subtotal)}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', marginBottom: 16 }}>
                            <div style={{ fontSize: 18, color: SLATE }}>{labels.vatLabel}</div>
                            <div style={{ fontSize: 19, fontWeight: 800, color: INK }}>{fpc(tax)}</div>
                        </div>
                        <div style={{ 
                            background: `linear-gradient(135deg, ${BRAND}, ${BRAND}DD)`, 
                            color: '#FFFFFF', 
                            borderRadius: 16, 
                            padding: '24px', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            boxShadow: `0 10px 30px ${BRAND}40`
                        }}>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FFFFFF', opacity: 0.9 }}>{labels.grandTotalLabel}</div>
                                <div style={{ fontSize: 14, color: '#FFFFFF', opacity: 0.7, marginTop: 4 }}>{labels.vatIncluded || 'KDV Dahil'}</div>
                            </div>
                            <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                                {fpc(grand)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── PAYMENT OPTIONS (tam genişlik, yatay kartlar — final offer gibi) ── */}
                <div style={{ flex: 1, minHeight: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.16em', color: MUTED, textTransform: 'uppercase', marginBottom: 20 }}>
                        {labels.paymentOptionsTitle}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {labels.paymentOptions.map((opt, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: 16, background: PAPER, borderRadius: 12 }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: BRAND }}>
                                        {String(i + 1).padStart(2, '0')}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: INK, marginBottom: 4 }}>{opt.title}</div>
                                        <div style={{ fontSize: 15, color: SLATE, lineHeight: 1.4 }}>{opt.desc}</div>
                                    </div>
                                </div>
                                {opt.amount != null && (
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: 20, fontWeight: 900, color: INK, whiteSpace: 'nowrap' }}>{fpc(opt.amount)}</div>
                                        <div style={{ fontSize: 12, fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{opt.amountLabel}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── CHECKLIST ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}`, padding: '24px 0', marginTop: 32, marginBottom: 24 }}>
                    {labels.checklist.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <CheckCircle2 size={20} color={BRAND} fill={BRAND} stroke="#FFF" />
                            <span style={{ fontSize: 16, color: INK, fontWeight: 600 }}>{item}</span>
                        </div>
                    ))}
                </div>

                {/* ── FOOTER ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: SLATE }}>
                        {labels.footerContact}
                    </div>
                    <div style={{ fontSize: 15, color: MUTED }}>
                        {labels.footerDisclaimer}
                    </div>
                </div>
            </div>
        </div>
    );
};
