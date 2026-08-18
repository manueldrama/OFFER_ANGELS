import React, { useEffect, useMemo, useState } from 'react';
import { X, TrendingUp, Loader2, Send, Users, Coffee, AlertTriangle, Minus, Plus } from 'lucide-react';
import { RoiService, type RoiSettings } from '../../../services/roi';
import { getCurrencyForCountry } from '../../../utils/countries';
import { formatPriceCompact, formatNumber, getCurrencySymbol, type SupportedCurrency } from '../../../utils/currency';
import { uploadRoiCardImage } from '../../../lib/roiCardImage';
import { whatsappChatService } from '../../../services/admin/whatsappChatService';
import { supabase } from '../../../lib/supabase/client';
import type { RoiCardLabels } from '../../offer/roi-card/RoiCardImage';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Turkish labels baked into the rendered card — matches the surrounding admin UI. */
const CARD_LABELS: RoiCardLabels = {
    brandName: 'CAFEPASTE',
    eyebrow: 'İşletmenize Özel',
    title: 'Getiri Projeksiyonunuz',
    preparedForLabel: 'Hazırlanan analiz —',
    dailyCustomersLabel: 'Günlük Satış',
    avgPriceLabel: 'Ort. Fiyat',
    monthlyExtraLabel: 'Aylık Ek Gelir',
    monthlyExtraSub: 'Tahmini ek gelir projeksiyonu',
    yearlyLabel: 'Yıllık Projeksiyon',
    yearlySub: 'Yıllık kümülatif',
    newCustomersLabel: 'Yeni Müşteri/Gün',
    newCustomersSub: 'Organik büyüme',
    amortizeLabel: 'Amorti Süresi',
    amortizeSub: 'Tahmini',
    monthSuffix: 'ay',
    recommendedLabel: 'Önerilen Model',
    disclaimer: 'Projeksiyonlar tahminidir · Gerçek sonuçlar değişir',
};

const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Number stepper — module-level so it isn't remounted (and focus-lost) each render. */
function Stepper({ value, set, min, max, step }: { value: number; set: (v: number) => void; min: number; max: number; step: number }) {
    return (
        <div className="flex items-center gap-2">
            <button onClick={() => set(Math.max(min, value - step))} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 shrink-0"><Minus size={14} /></button>
            <input
                type="number" value={value} min={min} max={max}
                onChange={e => set(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
                className="flex-1 text-center border border-slate-200 rounded-md px-2 py-1.5 text-sm font-bold focus:ring-2 focus:ring-emerald-200 outline-none"
            />
            <button onClick={() => set(Math.min(max, value + step))} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 shrink-0"><Plus size={14} /></button>
        </div>
    );
}

export interface RoiSendLead {
    id: string;
    customer_name: string;
    company_name?: string | null;
    phone_number?: string | null;
    country_code?: string | null;
}

export function RoiSendPanel({
    lead, lastInboundAt, onClose, onSent,
}: {
    lead: RoiSendLead;
    /** ISO timestamp of the last inbound message, or null if none. Drives the 24h warning. */
    lastInboundAt?: string | null;
    onClose: () => void;
    onSent: () => void;
}) {
    // country_code / company_name may not be supplied by the caller (e.g. the
    // WhatsApp inbox only knows phone + lead_id). Self-fetch from the lead when
    // we have a real lead UUID so the currency + card stay accurate.
    const [countryCode, setCountryCode] = useState<string | null>(lead.country_code ?? null);
    const [companyName, setCompanyName] = useState<string | null>(lead.company_name ?? null);

    useEffect(() => {
        if (lead.country_code != null) return;        // caller already gave it
        if (!lead.id || !UUID_RE.test(lead.id)) return; // phone fallback — skip DB
        let alive = true;
        supabase.from('leads').select('country_code, company_name').eq('id', lead.id).maybeSingle()
            .then(({ data }) => {
                if (!alive || !data) return;
                setCountryCode(data.country_code ?? null);
                setCompanyName(prev => prev ?? data.company_name ?? null);
            });
        return () => { alive = false; };
    }, [lead.id, lead.country_code]);

    const currency = useMemo<SupportedCurrency>(
        () => getCurrencyForCountry(countryCode || '') as SupportedCurrency,
        [countryCode],
    );

    const [settings, setSettings] = useState<RoiSettings | null>(null);
    const [dailyDrinks, setDailyDrinks] = useState(200);
    const [avgPrice, setAvgPrice] = useState(0);
    const [devicePrice, setDevicePrice] = useState<number | ''>('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        RoiService.fetchSettings(currency).then(s => {
            if (!alive) return;
            setSettings(s);
            setAvgPrice(s.slider_default);
        });
        return () => { alive = false; };
    }, [currency]);

    const isActiveWindow = useMemo(() => {
        if (!lastInboundAt) return false;
        return Date.now() - new Date(lastInboundAt).getTime() < ACTIVE_WINDOW_MS;
    }, [lastInboundAt]);

    // ROI derivations — mirrors CustomerOffer.tsx (D × P × effect% × 30).
    const effectMul = (settings?.effect_percent ?? 40) / 100;
    const monthly = Math.round(dailyDrinks * avgPrice * effectMul * 30);
    const yearly = monthly * 12;
    const newCustomers = Math.round(dailyDrinks * effectMul);
    const amortizeMonths = (typeof devicePrice === 'number' && devicePrice > 0 && monthly > 0)
        ? Math.max(0.1, Math.round((devicePrice / monthly) * 10) / 10)
        : null;
    const recommendedModel = settings ? RoiService.resolveRecommendedModel(dailyDrinks, settings).recommendedModel : null;

    const fpc = (n: number) => formatPriceCompact(Math.round(n), currency, 'tr');
    const fn = (n: number) => formatNumber(Math.round(n), 'tr');
    const symbol = getCurrencySymbol(currency);

    const firstName = (lead.customer_name || '').trim().split(/\s+/)[0] || lead.customer_name;

    const handleSend = async () => {
        if (!lead.phone_number || sending || !settings) return;
        if (monthly <= 0) { setError('Geçerli değerler girin.'); return; }
        setSending(true); setError('');
        try {
            // lead.id may be a phone-number fallback (anonymous WhatsApp contact);
            // whatsapp_messages.lead_id is a UUID FK, so only pass a real UUID.
            const dbLeadId = UUID_RE.test(lead.id) ? lead.id : null;
            const storageKey = (lead.id || lead.phone_number || 'roi').replace(/[^a-zA-Z0-9_-]/g, '');
            const storagePath = `roi-cards/${storageKey}-${Date.now()}.png`;
            const imageUrl = await uploadRoiCardImage(
                {
                    customerName: lead.customer_name,
                    companyName,
                    dailyDrinks,
                    avgPrice,
                    currency,
                    language: 'tr',
                    monthly,
                    yearly,
                    newCustomers,
                    amortizeMonths,
                    recommendedModel,
                    labels: CARD_LABELS,
                },
                storagePath,
            );
            const caption = `${firstName}, işletmenize özel getiri analizinizi hazırladık 👇\n\n📈 Aylık ek gelir: ${fpc(monthly)}\n🗓️ Yıllık projeksiyon: ${fpc(yearly)}`;
            await whatsappChatService.sendMessage(lead.phone_number, caption, dbLeadId, imageUrl, 'image');
            onSent();
            onClose();
        } catch (err: any) {
            setError(err.message || 'ROI kartı gönderilemedi');
        } finally {
            setSending(false);
        }
    };

    const outputs = [
        { label: 'Aylık Ek Gelir', value: fpc(monthly), highlight: true },
        { label: 'Yıllık Projeksiyon', value: fpc(yearly), highlight: false },
        { label: 'Yeni Müşteri/Gün', value: `+${fn(newCustomers)}`, highlight: false },
        { label: 'Amorti Süresi', value: amortizeMonths ? `${formatNumber(amortizeMonths, 'tr')} ay` : '—', highlight: false },
    ];

    return (
        <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center rounded-lg" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[92%] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp size={16} className="text-emerald-600" />
                            Müşteriye Özel ROI Gönder
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">{lead.customer_name} · {currency}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-md"><X size={16} className="text-slate-400" /></button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {!settings ? (
                        <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2"><Loader2 size={16} className="animate-spin" /> Ayarlar yükleniyor...</div>
                    ) : (
                        <>
                            {/* 24h warning */}
                            {!isActiveWindow && (
                                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-amber-700 leading-snug">
                                        Bu müşteri son 24 saatte yazmadı. Serbest medya (görsel) yalnızca son 24 saatte sana yazmış kişilere ulaşır; mesaj iletilmeyebilir.
                                    </p>
                                </div>
                            )}

                            {/* Inputs */}
                            <div>
                                <label className="text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5"><Users size={13} className="text-slate-400" /> Günlük Satış (adet)</label>
                                <Stepper value={dailyDrinks} set={setDailyDrinks} min={10} max={2000} step={10} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5"><Coffee size={13} className="text-slate-400" /> Ortalama Fiyat ({symbol})</label>
                                <Stepper value={avgPrice} set={setAvgPrice} min={settings.slider_min} max={settings.slider_max} step={settings.slider_step} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-700 mb-1.5 block">Cihaz Fiyatı ({symbol}) <span className="text-slate-400 font-normal">— opsiyonel, amorti için</span></label>
                                <input
                                    type="number" value={devicePrice} placeholder="örn. 50000"
                                    onChange={e => setDevicePrice(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200 outline-none"
                                />
                            </div>

                            {/* Live preview */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                {outputs.map((o, i) => (
                                    <div key={i} className={`rounded-lg p-3 border ${o.highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{o.label}</p>
                                        <p className={`text-lg font-extrabold leading-none ${o.highlight ? 'text-emerald-700' : 'text-slate-800'}`}>{o.value}</p>
                                    </div>
                                ))}
                            </div>
                            {recommendedModel && (
                                <p className="text-[11px] text-slate-500">Önerilen model: <span className="font-bold text-emerald-700">CAFEPASTE {recommendedModel}</span></p>
                            )}

                            {error && <p className="text-red-500 text-[11px] font-bold">{error}</p>}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
                    <button onClick={onClose} className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-md">İptal</button>
                    <button
                        onClick={handleSend}
                        disabled={!settings || sending || !lead.phone_number || monthly <= 0}
                        className="px-4 py-2 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        {sending ? 'Görsel hazırlanıyor...' : 'ROI Kartı Gönder'}
                    </button>
                </div>
            </div>
        </div>
    );
}
