import React, { useEffect, useMemo, useState } from 'react';
import { X, CalendarPlus, Clock, AlertCircle, Calendar } from 'lucide-react';
import { AdminOfferLinksService, OfferLink } from '../../../services/admin/offerLinksService';
import { supabase } from '../../../lib/supabase/client';
import { describeRemaining, computeEffectiveOfferExpiry } from '../../../lib/offerExpiry';

type OfferWithLead = OfferLink & {
    leads?: { customer_name: string; phone_number: string };
    campaign_id?: string;
};

interface ExtendOfferExpiryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    offer: OfferWithLead | null;
    onExtended: (token: string, newValidUntil: string) => void;
    onError?: (title: string, message: string) => void;
    onSuccess?: (title: string, message: string) => void;
}

const QUICK_OPTIONS = [7, 14, 30, 60];

function toDateInputValue(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatTr(d: Date): string {
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export const ExtendOfferExpiryDialog: React.FC<ExtendOfferExpiryDialogProps> = ({
    isOpen, onClose, offer, onExtended, onError, onSuccess,
}) => {
    const [quickDays, setQuickDays] = useState<number | null>(7);
    const [customDate, setCustomDate] = useState<string>('');
    const [customDays, setCustomDays] = useState<string>('');
    const [campaignEnd, setCampaignEnd] = useState<string | null>(null);
    const [maxOfferValidityDays, setMaxOfferValidityDays] = useState<number | null>(null);
    const [firstGeneratedAt, setFirstGeneratedAt] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setQuickDays(7);
            setCustomDate('');
            setCustomDays('');
            setCampaignEnd(null);
            setMaxOfferValidityDays(null);
            setFirstGeneratedAt(null);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !offer?.campaign_id) return;
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('campaigns')
                .select('valid_until, max_offer_validity_days')
                .eq('id', offer.campaign_id)
                .maybeSingle();
            if (cancelled) return;
            if (data?.valid_until) setCampaignEnd(data.valid_until);
            if (typeof data?.max_offer_validity_days === 'number') {
                setMaxOfferValidityDays(data.max_offer_validity_days);
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen, offer?.campaign_id]);

    useEffect(() => {
        if (!isOpen || !offer?.token) return;
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('generated_offers')
                .select('created_at')
                .eq('offer_token', offer.token)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
            if (!cancelled && data?.created_at) setFirstGeneratedAt(data.created_at);
        })();
        return () => { cancelled = true; };
    }, [isOpen, offer?.token]);

    const currentRemaining = useMemo(() => {
        if (!offer) return describeRemaining(null);
        const baseCreatedAt = firstGeneratedAt ?? offer.created_at;
        const days = maxOfferValidityDays ?? 7;
        const effective = computeEffectiveOfferExpiry(baseCreatedAt, offer.valid_until, days);
        return describeRemaining(effective.toISOString());
    }, [offer, firstGeneratedAt, maxOfferValidityDays]);

    const newValidUntilDate = useMemo<Date | null>(() => {
        if (!offer) return null;
        if (customDate) {
            const d = new Date(`${customDate}T23:59:59`);
            return isNaN(d.getTime()) ? null : d;
        }
        const days = quickDays ?? (customDays ? parseInt(customDays, 10) : NaN);
        if (!Number.isFinite(days) || days <= 0) return null;
        const base = offer.valid_until && new Date(offer.valid_until).getTime() > Date.now()
            ? new Date(offer.valid_until)
            : new Date();
        const next = new Date(base);
        next.setDate(next.getDate() + days);
        return next;
    }, [offer, customDate, quickDays, customDays]);

    const exceedsCampaign = useMemo(() => {
        if (!campaignEnd || !newValidUntilDate) return false;
        return newValidUntilDate.getTime() > new Date(campaignEnd).getTime();
    }, [campaignEnd, newValidUntilDate]);

    if (!isOpen || !offer) return null;

    const customerName = offer.leads?.customer_name || 'Müşteri';
    const todayInput = toDateInputValue(new Date());

    const handleQuickSelect = (days: number) => {
        setQuickDays(days);
        setCustomDate('');
        setCustomDays('');
    };

    const handleCustomDaysChange = (val: string) => {
        const clean = val.replace(/\D/g, '');
        setCustomDays(clean);
        if (clean) {
            setQuickDays(null);
            setCustomDate('');
        }
    };

    const handleCustomDateChange = (val: string) => {
        setCustomDate(val);
        if (val) {
            setQuickDays(null);
            setCustomDays('');
        }
    };

    const handleSubmit = async () => {
        if (!newValidUntilDate || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const iso = newValidUntilDate.toISOString();
            await AdminOfferLinksService.extendOfferExpiry(offer.token, iso);
            onSuccess?.('Süre uzatıldı', `Teklif ${formatTr(newValidUntilDate)} tarihine kadar geçerli.`);
            onExtended(offer.token, iso);
        } catch (err: any) {
            console.error('[ExtendOfferExpiryDialog] error:', err);
            onError?.('Hata', err?.message || 'Teklif süresi uzatılamadı.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const remainingToneClass = {
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        red: 'bg-red-50 text-red-700 border-red-200',
        slate: 'bg-slate-50 text-slate-600 border-slate-200',
    }[currentRemaining.tone];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <CalendarPlus className="w-4 h-4 text-indigo-600" />
                        </div>
                        Teklif Süresini Uzat
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-md transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                    {/* Offer context */}
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-800 truncate">{customerName}</div>
                            <div className="text-xs font-mono text-slate-500 mt-0.5">{offer.token}</div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${remainingToneClass}`}>
                            <Clock className="w-3 h-3" />
                            {currentRemaining.label}
                        </span>
                    </div>

                    {/* Current valid_until */}
                    <div className="text-xs text-slate-500">
                        Mevcut bitiş: <span className="font-medium text-slate-700">{offer.valid_until ? formatTr(new Date(offer.valid_until)) : '—'}</span>
                    </div>

                    {/* Quick options */}
                    <div>
                        <div className="text-xs font-semibold text-slate-600 mb-2">Hızlı uzat</div>
                        <div className="grid grid-cols-4 gap-2">
                            {QUICK_OPTIONS.map(days => {
                                const active = quickDays === days;
                                return (
                                    <button
                                        key={days}
                                        type="button"
                                        onClick={() => handleQuickSelect(days)}
                                        className={`px-3 py-2 text-sm font-bold rounded-md border transition-colors ${
                                            active
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                                        }`}
                                    >
                                        +{days} gün
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom days */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Veya özel gün sayısı</label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={customDays}
                                onChange={e => handleCustomDaysChange(e.target.value)}
                                placeholder="Örn. 21"
                                className="w-full h-10 px-3 pr-12 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">gün</span>
                        </div>
                    </div>

                    {/* Custom date picker */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" /> Veya tarih seç
                        </label>
                        <input
                            type="date"
                            min={todayInput}
                            value={customDate}
                            onChange={e => handleCustomDateChange(e.target.value)}
                            className="w-full h-10 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                        />
                    </div>

                    {/* Preview */}
                    {newValidUntilDate && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                            <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Yeni bitiş tarihi</div>
                            <div className="text-base font-bold text-indigo-900 mt-1">{formatTr(newValidUntilDate)}</div>
                            <div className="text-[11px] text-indigo-700 mt-1.5 space-y-0.5">
                                <div>• Bu link altındaki tüm final teklifler de aynı tarihe kadar geçerli olacak.</div>
                                {!offer.is_active && (
                                    <div>• Pasif teklif uzatma ile otomatik aktifleşecek.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Campaign cap warning */}
                    {exceedsCampaign && campaignEnd && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-800">
                                Seçtiğin tarih kampanya bitişini ({formatTr(new Date(campaignEnd))}) aşıyor — yine de uzatılacak.
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        İptal
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!newValidUntilDate || isSubmitting}
                        className="px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                    >
                        <CalendarPlus className="w-4 h-4" />
                        {isSubmitting ? 'Uzatılıyor...' : 'Uzat'}
                    </button>
                </div>
            </div>
        </div>
    );
};
