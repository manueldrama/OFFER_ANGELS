import React, { useEffect, useMemo, useState } from 'react';
import { X, BadgeCheck, Search, Wallet, PackageCheck, Info, Loader2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { AdminLeadsService } from '../../../services/admin/leadsService';
import { AdminProductCatalogService } from '../../../services/admin/productCatalogService';
import { ManualOfferItem } from '../../../services/admin/manualOfferService';
import {
    AdminManualSaleService,
    ManualPaymentMethod,
    ManualSaleState,
    MANUAL_PAYMENT_METHOD_LABELS,
} from '../../../services/admin/manualSaleService';
import {
    ProductCartPicker,
    CartRow,
    buildCartRows,
    cartRowsToItems,
    cartTotals,
} from '../products/ProductCartPicker';

/**
 * Manuel Satış Kaydı modalı — telefonda/yüz yüze kapatılan satışı Siparişler
 * hattına aktarır. Üç yerden çağrılır: Siparişler sayfası (müşteri seçicili),
 * Teklif Linkleri satırı (teklif zemini hazır) ve Müşteri detay paneli.
 */

interface ManualSaleModalProps {
    /** Verilirse müşteri seçici gizlenir. */
    leadId?: string;
    /** Teklif Linkleri satırından geliyorsa mevcut teklif zemini kullanılır. */
    offerToken?: string;
    /** Başlıkta gösterilecek müşteri adı (seçici gizliyken). */
    leadName?: string;
    onClose: () => void;
    onSaved?: () => void;
}

const DEFAULT_DEPOSIT_PERCENT = 20;
const DAY_MS = 86400000;

const fieldClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none';
const labelClass = 'block text-xs font-semibold text-slate-600 mb-1';

const toLocalInput = (d: Date) => {
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

const money = (n: number) => `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;

export const ManualSaleModal: React.FC<ManualSaleModalProps> = ({
    leadId, offerToken, leadName, onClose, onSaved,
}) => {
    const { success, error: toastError } = useToast();

    // Müşteri
    const [leads, setLeads] = useState<any[]>([]);
    const [leadSearch, setLeadSearch] = useState('');
    const [selectedLeadId, setSelectedLeadId] = useState(leadId || '');

    // Kalemler
    const [catalogRows, setCatalogRows] = useState<CartRow[]>([]);
    const [prefilledItems, setPrefilledItems] = useState<ManualOfferItem[] | null>(null);
    const [resolvedToken, setResolvedToken] = useState<string | undefined>(offerToken);
    const [useCatalog, setUseCatalog] = useState(false);
    const [loadingOffer, setLoadingOffer] = useState(false);

    // Ödeme
    const [paymentState, setPaymentState] = useState<ManualSaleState>('paid');
    const [manualPaymentMethod, setManualPaymentMethod] = useState<ManualPaymentMethod>('bank-transfer');
    const [depositAmount, setDepositAmount] = useState('');
    const [depositTouched, setDepositTouched] = useState(false);
    const [saleDate, setSaleDate] = useState(toLocalInput(new Date()));
    const [priceLock, setPriceLock] = useState(toLocalInput(new Date(Date.now() + 14 * DAY_MS)));
    const [finalDeadline, setFinalDeadline] = useState(toLocalInput(new Date(Date.now() + 19 * DAY_MS)));
    const [automationOptIn, setAutomationOptIn] = useState(false);
    const [note, setNote] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Katalog — müşteri seçilmeden de yüklenebilir.
    useEffect(() => {
        let cancelled = false;
        AdminProductCatalogService.listProducts({ activeOnly: true, limit: 100 })
            .then(({ products }) => { if (!cancelled) setCatalogRows(buildCartRows(products)); })
            .catch(() => { if (!cancelled) setCatalogRows([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // Müşteri arama (seçici görünürken)
    useEffect(() => {
        if (leadId) return;
        const timer = setTimeout(() => {
            AdminLeadsService.listLeads({ search: leadSearch, page: 1, limit: 20 })
                .then(d => setLeads(d.leads || []))
                .catch(() => { /* sessiz */ });
        }, 300);
        return () => clearTimeout(timer);
    }, [leadSearch, leadId]);

    // Seçili müşterinin son teklifini sepete ön-doldur.
    useEffect(() => {
        if (!selectedLeadId) { setPrefilledItems(null); return; }
        let cancelled = false;
        setLoadingOffer(true);
        AdminManualSaleService.fetchLatestOffer(selectedLeadId, offerToken)
            .then(offer => {
                if (cancelled) return;
                if (offer && offer.items.length) {
                    setPrefilledItems(offer.items);
                    setResolvedToken(offer.token);
                    setUseCatalog(false);
                } else {
                    // Teklif zemini yoksa katalogdan seçilir. Satırdan gelen token
                    // korunur — aksi halde aynı müşteriye ikinci bir link üretilir.
                    setPrefilledItems(null);
                    setResolvedToken(offer?.token ?? offerToken);
                    setUseCatalog(true);
                }
            })
            .catch(() => { if (!cancelled) { setPrefilledItems(null); setUseCatalog(true); } })
            .finally(() => { if (!cancelled) setLoadingOffer(false); });
        return () => { cancelled = true; };
    }, [selectedLeadId, offerToken]);

    const items: ManualOfferItem[] = useMemo(
        () => (useCatalog || !prefilledItems ? cartRowsToItems(catalogRows) : prefilledItems),
        [useCatalog, prefilledItems, catalogRows],
    );
    const { subtotal, vat, total } = cartTotals(items);

    // Kapora tutarı: kullanıcı elle girmediyse toplamın %20'si olarak takip eder.
    useEffect(() => {
        if (paymentState !== 'deposit_paid' || depositTouched) return;
        setDepositAmount(total > 0 ? String(Math.round(total * DEFAULT_DEPOSIT_PERCENT / 100)) : '');
    }, [total, paymentState, depositTouched]);

    const depositValue = Number(depositAmount) || 0;
    const remaining = paymentState === 'deposit_paid' ? Math.max(0, total - depositValue) : 0;
    const collected = paymentState === 'deposit_paid' ? depositValue : total;

    const canSave =
        !!selectedLeadId &&
        items.length > 0 &&
        !saving &&
        (paymentState === 'paid' || (depositValue > 0 && depositValue <= total));

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const res = await AdminManualSaleService.createManualSale({
                leadId: selectedLeadId,
                items,
                paymentState,
                manualPaymentMethod,
                depositAmount: paymentState === 'deposit_paid' ? depositValue : undefined,
                priceLockExpiresAt: paymentState === 'deposit_paid' ? new Date(priceLock).toISOString() : undefined,
                finalDeadlineAt: paymentState === 'deposit_paid' ? new Date(finalDeadline).toISOString() : undefined,
                saleDate: new Date(saleDate).toISOString(),
                note: note.trim() || undefined,
                existingToken: resolvedToken,
                automationOptIn,
            });
            success(
                'Satış kaydedildi',
                `${money(res.total)} tutarındaki satış siparişlere aktarıldı${res.offerCode ? ` (${res.offerCode})` : ''}.`,
            );
            onSaved?.();
            onClose();
        } catch (err: any) {
            toastError('Kaydedilemedi', err?.message || 'Manuel satış kaydedilemedi.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[92vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <BadgeCheck className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Manuel Satış Kaydet</h2>
                            <p className="text-xs text-slate-500">
                                {leadName
                                    ? `${leadName} · Dışarıda kapatılan satışı siparişlere aktarın`
                                    : 'Dışarıda kapatılan satışı siparişlere ve ciroya aktarın'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {loading ? (
                        <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...
                        </div>
                    ) : (
                        <>
                            {/* 1. Müşteri */}
                            {!leadId && (
                                <div>
                                    <label className={labelClass}>Müşteri <span className="text-red-400">*</span></label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                                        <input
                                            type="text"
                                            value={leadSearch}
                                            onChange={e => setLeadSearch(e.target.value)}
                                            placeholder="Müşteri ara..."
                                            className={`${fieldClass} pl-9`}
                                        />
                                    </div>
                                    <select
                                        value={selectedLeadId}
                                        onChange={e => setSelectedLeadId(e.target.value)}
                                        className={`${fieldClass} mt-2`}
                                    >
                                        <option value="">Müşteri seçiniz</option>
                                        {leads.map((l: any) => (
                                            <option key={l.id} value={l.id}>
                                                {l.customer_name} {l.company_name ? `(${l.company_name})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* 2. Kalemler */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className={`${labelClass} mb-0`}>Satış Kalemleri <span className="text-red-400">*</span></label>
                                    {prefilledItems && (
                                        <button
                                            type="button"
                                            onClick={() => setUseCatalog(v => !v)}
                                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                                        >
                                            {useCatalog ? 'Tekliften doldur' : 'Katalogdan seç'}
                                        </button>
                                    )}
                                </div>

                                {loadingOffer && (
                                    <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Son teklif kontrol ediliyor...
                                    </div>
                                )}

                                {!useCatalog && prefilledItems ? (
                                    <>
                                        <div className="flex items-start gap-2 rounded-lg bg-indigo-50/60 border border-indigo-100 px-3 py-2 mb-2">
                                            <Info className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                                            <p className="text-[11px] text-indigo-700 leading-relaxed">
                                                Kalemler müşterinin son teklifinden dolduruldu. Farklı bir sepet için "Katalogdan seç"e geçin.
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-slate-100 divide-y divide-slate-100">
                                            {prefilledItems.map((it, i) => (
                                                <div key={`${it.id}-${i}`} className="flex items-center justify-between px-3 py-2.5">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-slate-700 truncate">{it.name}</p>
                                                        <p className="text-[11px] text-slate-400">{it.quantity} adet × {money(Number(it.price) || 0)}</p>
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-800 shrink-0">
                                                        {money((Number(it.price) || 0) * (Number(it.quantity) || 0))}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <ProductCartPicker rows={catalogRows} onChange={setCatalogRows} />
                                )}
                            </div>

                            {/* 3. Ödeme durumu */}
                            <div>
                                <label className={labelClass}>Tahsilat Durumu</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentState('paid')}
                                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors ${paymentState === 'paid' ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <PackageCheck className={`w-4 h-4 shrink-0 ${paymentState === 'paid' ? 'text-emerald-600' : 'text-slate-400'}`} />
                                        <span>
                                            <span className="block text-sm font-semibold text-slate-800">Tam ödeme alındı</span>
                                            <span className="block text-[11px] text-slate-500">Tutarın tamamı tahsil edildi</span>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentState('deposit_paid')}
                                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors ${paymentState === 'deposit_paid' ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <Wallet className={`w-4 h-4 shrink-0 ${paymentState === 'deposit_paid' ? 'text-amber-600' : 'text-slate-400'}`} />
                                        <span>
                                            <span className="block text-sm font-semibold text-slate-800">Kapora alındı</span>
                                            <span className="block text-[11px] text-slate-500">Kalan tutar bekleniyor</span>
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {paymentState === 'deposit_paid' && (
                                <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/40">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelClass}>Alınan Kapora (₺)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={depositAmount}
                                                onChange={e => { setDepositTouched(true); setDepositAmount(e.target.value); }}
                                                className={fieldClass}
                                            />
                                            <p className="text-[11px] text-slate-400 mt-1">Varsayılan: toplamın %{DEFAULT_DEPOSIT_PERCENT}'si</p>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Kalan Tutar</label>
                                            <div className="h-[38px] flex items-center px-3 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700">
                                                {money(remaining)}
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Fiyat Kilidi Bitişi</label>
                                            <input type="datetime-local" value={priceLock} onChange={e => setPriceLock(e.target.value)} className={fieldClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Son Ödeme Tarihi</label>
                                            <input type="datetime-local" value={finalDeadline} onChange={e => setFinalDeadline(e.target.value)} className={fieldClass} />
                                        </div>
                                    </div>
                                    <label className="flex items-start gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={automationOptIn}
                                            onChange={e => setAutomationOptIn(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                                        />
                                        <span className="text-[11px] text-slate-600 leading-relaxed">
                                            Kapora hatırlatma otomasyonuna dahil et
                                            <span className="block text-slate-400">
                                                Kapalıyken bu kayıt otomatik fiyat güncelleme ve 19 gün sonundaki otomatik iptal kuralının dışında kalır — geriye dönük kayıtlar için önerilir.
                                            </span>
                                        </span>
                                    </label>
                                </div>
                            )}

                            {/* 4. Yöntem + tarih + not */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Tahsilat Yöntemi</label>
                                    <select
                                        value={manualPaymentMethod}
                                        onChange={e => setManualPaymentMethod(e.target.value as ManualPaymentMethod)}
                                        className={fieldClass}
                                    >
                                        {(Object.keys(MANUAL_PAYMENT_METHOD_LABELS) as ManualPaymentMethod[]).map(k => (
                                            <option key={k} value={k}>{MANUAL_PAYMENT_METHOD_LABELS[k]}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Satış Tarihi</label>
                                    <input type="datetime-local" value={saleDate} onChange={e => setSaleDate(e.target.value)} className={fieldClass} />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Not (opsiyonel)</label>
                                <textarea
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    rows={2}
                                    placeholder="Ör. Showroom'da nakit tahsil edildi, dekont Ahmet Bey'de."
                                    className={`${fieldClass} resize-none`}
                                />
                            </div>

                            {/* 5. Özet */}
                            {items.length > 0 && (
                                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-1.5">
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Ara Toplam</span><span>{money(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>KDV (%20)</span><span>{money(vat)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                                        <span>Toplam</span><span>{money(total)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-semibold text-emerald-700 pt-1.5">
                                        <span>Tahsil edilen</span><span>{money(collected)}</span>
                                    </div>
                                    {paymentState === 'deposit_paid' && (
                                        <div className="flex justify-between text-xs font-semibold text-amber-700">
                                            <span>Kalan</span><span>{money(remaining)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
                    <p className="text-[11px] text-slate-400 hidden md:block">
                        Kayıt sonrası müşteri "Kazanıldı" olarak işaretlenir ve sipariş ciroya dahil edilir.
                    </p>
                    <div className="flex gap-3 ml-auto">
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!canSave}
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Kaydediliyor...' : 'Satışı Kaydet'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
