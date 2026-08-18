import React, { useEffect, useState } from 'react';
import { XCircle, FileText, Zap, RotateCcw, TimerOff, AlertTriangle, CheckCircle2, ExternalLink, MessageCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateTime } from '../../../hooks/useAppSettings';
import { getActiveDeadline } from '../../../lib/reservations/effectiveStatus';
import { STATUS_OPTIONS } from '../../../lib/reservations/orderStatus';
import type { CustomerReservation } from '../../../types/orders';

interface Props {
    order: CustomerReservation;
    onClose: () => void;
    onSaved: () => void;
}

/**
 * Rezervasyon düzenleme modali — Orders.tsx'ten olduğu gibi çıkarıldı.
 * Kapora yaşam döngüsü alanları, Paraşüt taslak faturası ve elle WhatsApp
 * hatırlatması burada; davranışı değiştirilmemelidir.
 */
export const ReservationEditModal: React.FC<Props> = ({ order, onClose, onSaved }) => {
    const [form, setForm] = useState({
        status: order.status,
        deposit_amount: order.deposit_amount || 0,
        deposit_paid_at: order.deposit_paid_at ? order.deposit_paid_at.slice(0, 16) : '',
        remaining_amount: order.remaining_amount || 0,
        original_total: order.original_total || 0,
        updated_total: order.updated_total || 0,
        price_lock_expires_at: order.price_lock_expires_at ? order.price_lock_expires_at.slice(0, 16) : '',
        final_deadline_at: order.final_deadline_at ? order.final_deadline_at.slice(0, 16) : '',
        second_chance_expires_at: order.second_chance_expires_at ? order.second_chance_expires_at.slice(0, 16) : '',
        cancellation_reason: order.cancellation_reason || '',
    });
    const [saving, setSaving] = useState(false);
    const [reminderLoading, setReminderLoading] = useState(false);
    const [parasutLoading, setParasutLoading] = useState(false);
    const [parasutInvoiceId, setParasutInvoiceId] = useState<number | null>(order.parasut_invoice_id ?? null);
    const [parasutInvoiceNumber, setParasutInvoiceNumber] = useState<string | null>(order.parasut_invoice_number ?? null);
    const [offerCountry, setOfferCountry] = useState<string | null>(null);
    const [offerCurrency, setOfferCurrency] = useState<string | null>(null);
    const { error: toastError, success } = useToast();

    useEffect(() => {
        let cancelled = false;
        if (!order.offer_token) return;
        supabase
            .from('generated_offers')
            .select('country_code, currency')
            .eq('offer_token', order.offer_token)
            .limit(1)
            .maybeSingle()
            .then(({ data }) => {
                if (cancelled || !data) return;
                setOfferCountry((data.country_code || '').toUpperCase() || null);
                setOfferCurrency((data.currency || '').toUpperCase() || null);
            });
        return () => { cancelled = true; };
    }, [order.offer_token]);

    const isTurkishMarket = offerCountry === 'TR' || offerCurrency === 'TRY' || offerCurrency === 'TRL';

    const sendToParasut = async () => {
        setParasutLoading(true);
        try {
            const res = await fetch('/api/parasut/send-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservationId: order.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Paraşüt gönderimi başarısız.');
            setParasutInvoiceId(data.invoice_id);
            setParasutInvoiceNumber(data.invoice_number);
            success('Paraşüt\'e gönderildi', `Fatura #${data.invoice_number || data.invoice_id} taslak olarak oluşturuldu. Paraşüt'te kontrol edip onaylayın.`);
            onSaved();
        } catch (err: any) {
            toastError('Paraşüt Hatası', err.message || 'Gönderim başarısız.');
        } finally {
            setParasutLoading(false);
        }
    };

    // Kalan ödeme hatırlatması — aktif son tarih. Kural tek otoritede:
    // src/lib/reservations/effectiveStatus.ts (müşteri sayacı ve cron da aynı).
    // KAYDEDİLMİŞ order değerine bakar, formdaki taslağa değil — admin tarihi
    // uzatıp Kaydet'e bastıktan sonra buton aktifleşir.
    const activeDeadline = getActiveDeadline(order);

    const deadlineRemainingText = (() => {
        if (!activeDeadline) return null;
        const diff = activeDeadline.at.getTime() - Date.now();
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        return days > 0 ? `${days} gün ${hours} saat kaldı` : `${hours} saat kaldı`;
    })();

    const sendDeadlineReminder = async (isSecondChance: boolean = false) => {
        setReminderLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/internal/deposit-deadline-reminder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token ?? ''}`,
                },
                body: JSON.stringify({ reservation_id: order.id, second_chance: isSecondChance }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (data.error === 'deadline_passed') {
                    throw new Error('Son tarih geçmiş. Önce son ödeme tarihini uzatıp kaydedin.');
                }
                // details varsa göster — kapalı hata kodu teşhis ettirmiyor.
                throw new Error([data.error, data.details].filter(Boolean).join(' — ') || 'Hatırlatma gönderilemedi.');
            }
            success('Hatırlatma gönderildi', `${order.customer_name || 'Müşteri'} — ${data.template_name || 'WhatsApp şablonu'}`);
        } catch (err: any) {
            toastError('Gönderilemedi', err.message || 'Hatırlatma gönderilemedi.');
        } finally {
            setReminderLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: any = {
                status: form.status,
                deposit_amount: form.deposit_amount,
                remaining_amount: form.remaining_amount,
                original_total: form.original_total,
                updated_total: form.updated_total || null,
                cancellation_reason: form.cancellation_reason || null,
                deposit_paid_at: form.deposit_paid_at ? new Date(form.deposit_paid_at).toISOString() : null,
                price_lock_expires_at: form.price_lock_expires_at ? new Date(form.price_lock_expires_at).toISOString() : null,
                final_deadline_at: form.final_deadline_at ? new Date(form.final_deadline_at).toISOString() : null,
                second_chance_expires_at: form.second_chance_expires_at ? new Date(form.second_chance_expires_at).toISOString() : null,
            };
            const { error: updateErr } = await supabase
                .from('customer_reservations')
                .update(payload)
                .eq('id', order.id);
            if (updateErr) throw updateErr;
            success('Başarılı', 'Rezervasyon güncellendi.');
            onSaved();
            onClose();
        } catch (err: any) {
            toastError('Hata', err.message || 'Güncelleme başarısız.');
        } finally {
            setSaving(false);
        }
    };

    const shortcutExpirePriceLock = () => {
        const past = new Date(Date.now() - 3600000);
        setForm(f => ({ ...f, price_lock_expires_at: past.toISOString().slice(0, 16) }));
    };

    const shortcutExpireAll = () => {
        const past = new Date(Date.now() - 3600000);
        setForm(f => ({ ...f, price_lock_expires_at: past.toISOString().slice(0, 16), final_deadline_at: past.toISOString().slice(0, 16) }));
    };

    const shortcutReset = () => {
        const now = Date.now();
        setForm(f => ({
            ...f,
            status: 'deposit_paid',
            price_lock_expires_at: new Date(now + 14 * 86400000).toISOString().slice(0, 16),
            final_deadline_at: new Date(now + 19 * 86400000).toISOString().slice(0, 16),
            second_chance_expires_at: '',
        }));
    };

    const shortcutSecondChance = () => {
        const now = Date.now();
        setForm(f => ({
            ...f,
            second_chance_expires_at: new Date(now + 3 * 86400000).toISOString().slice(0, 16),
            updated_total: f.original_total || f.updated_total,
        }));
    };

    const customerUrl = `${window.location.origin}/offer/${order.offer_token}/odeme/${order.id}`;

    const fieldClass = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none";
    const labelClass = "block text-xs font-semibold text-slate-600 mb-1";

    return (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-5">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Rezervasyon Düzenle</h3>
                        <p className="text-xs text-slate-400 mt-0.5">#{order.offer_code} — {order.customer_name}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><XCircle size={20} /></button>
                </div>

                {/* Kısayol butonları */}
                <div className="flex flex-wrap gap-2 mb-5 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 w-full mb-1">Hızlı Test</span>
                    <button onClick={shortcutExpirePriceLock} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer">
                        <Zap size={12} /> Fiyat Kilidini Bitir
                    </button>
                    <button onClick={shortcutExpireAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-lg border border-red-200 hover:bg-red-100 transition-colors cursor-pointer">
                        <TimerOff size={12} /> Tüm Süreyi Bitir
                    </button>
                    <button onClick={shortcutReset} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer">
                        <RotateCcw size={12} /> Sıfırla (14+5 gün)
                    </button>
                    <button onClick={shortcutSecondChance} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 text-xs font-medium rounded-lg border border-violet-200 hover:bg-violet-100 transition-colors cursor-pointer">
                        <CheckCircle2 size={12} /> İkinci Şans (+3 gün)
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Status */}
                    <div>
                        <label className={labelClass}>Durum</label>
                        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={fieldClass}>
                            {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tutarlar */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Kapora Tutarı</label>
                            <input type="number" value={form.deposit_amount} onChange={e => setForm(f => ({ ...f, deposit_amount: +e.target.value }))} className={fieldClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Kalan Tutar</label>
                            <input type="number" value={form.remaining_amount} onChange={e => setForm(f => ({ ...f, remaining_amount: +e.target.value }))} className={fieldClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Orijinal Toplam</label>
                            <input type="number" value={form.original_total} onChange={e => setForm(f => ({ ...f, original_total: +e.target.value }))} className={fieldClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Güncel Toplam (Liste Fiyatı)</label>
                            <input type="number" value={form.updated_total} onChange={e => setForm(f => ({ ...f, updated_total: +e.target.value }))} className={fieldClass} />
                        </div>
                    </div>

                    {/* Tarihler */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Kapora Ödeme Tarihi</label>
                            <input type="datetime-local" value={form.deposit_paid_at} onChange={e => setForm(f => ({ ...f, deposit_paid_at: e.target.value }))} className={fieldClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Fiyat Kilidi Bitiş</label>
                            <input type="datetime-local" value={form.price_lock_expires_at} onChange={e => setForm(f => ({ ...f, price_lock_expires_at: e.target.value }))} className={fieldClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Son Ödeme Tarihi</label>
                            <input type="datetime-local" value={form.final_deadline_at} onChange={e => setForm(f => ({ ...f, final_deadline_at: e.target.value }))} className={fieldClass} />
                        </div>
                        <div>
                            <label className={labelClass}>İkinci Şans Bitiş Tarihi</label>
                            <input type="datetime-local" value={form.second_chance_expires_at} onChange={e => setForm(f => ({ ...f, second_chance_expires_at: e.target.value }))} className={fieldClass} />
                        </div>
                        <div className="col-span-2">
                            <label className={labelClass}>İptal Nedeni</label>
                            <input type="text" value={form.cancellation_reason} onChange={e => setForm(f => ({ ...f, cancellation_reason: e.target.value }))} placeholder="Opsiyonel" className={fieldClass} />
                        </div>
                    </div>

                    {/* Kalan ödeme hatırlatması — cron son 24 saatte otomatik gönderir;
                        bu buton pencere kaçtıysa / temsilci dürtmek isterse elle gönderir. */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => sendDeadlineReminder(false)}
                                disabled={reminderLoading || !activeDeadline}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <MessageCircle size={13} />
                                {reminderLoading ? 'Gönderiliyor...' : 'Ödeme Hatırlatması Gönder (WhatsApp)'}
                            </button>
                            
                            <button
                                onClick={() => sendDeadlineReminder(true)}
                                disabled={reminderLoading || !order.second_chance_expires_at}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <MessageCircle size={13} />
                                {reminderLoading ? 'Gönderiliyor...' : 'İkinci Şans Mesajı Gönder (WhatsApp)'}
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                            {activeDeadline
                                ? `Son tarihe ${deadlineRemainingText} — ${formatDateTime(activeDeadline.at.toISOString())}`
                                : 'Son tarih geçmiş veya tanımsız — önce yukarıdaki tarihi güncelleyip kaydedin.'}
                        </p>
                    </div>
                </div>

                {/* Fatura & Teslimat Bilgileri */}
                {order.info_completed_at ? (
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                        <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Fatura Bilgileri</h4>
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold">Tamamlandı</span>
                            </div>
                            <div className="text-xs text-slate-700 space-y-1">
                                <p><span className="text-slate-400">Tip:</span> {order.invoice_type === 'corporate' ? 'Kurumsal' : 'Bireysel'}</p>
                                <p><span className="text-slate-400">Ad/Unvan:</span> {order.invoice_name || '—'}</p>
                                {order.invoice_type === 'corporate' && (
                                    <>
                                        <p><span className="text-slate-400">Vergi Dairesi:</span> {order.invoice_tax_office || '—'}</p>
                                        <p><span className="text-slate-400">Vergi No:</span> {order.invoice_tax_number || '—'}</p>
                                    </>
                                )}
                                <p><span className="text-slate-400">Adres:</span> {[order.invoice_address, order.invoice_district, order.invoice_city].filter(Boolean).join(', ') || '—'}</p>
                                <p><span className="text-slate-400">E-posta:</span> {order.invoice_email || '—'}</p>
                                <p><span className="text-slate-400">Telefon:</span> {order.invoice_phone || '—'}</p>
                            </div>
                            <div className="pt-2 mt-2 border-t border-slate-200">
                                {parasutInvoiceId ? (
                                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                                        <CheckCircle2 size={14} className="shrink-0" />
                                        <span className="font-semibold">Paraşüt'e gönderildi — Fatura #{parasutInvoiceNumber || parasutInvoiceId}</span>
                                    </div>
                                ) : isTurkishMarket ? (
                                    <button
                                        onClick={sendToParasut}
                                        disabled={parasutLoading}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        <FileText size={13} />
                                        {parasutLoading ? 'Gönderiliyor...' : 'Paraşüt\'e Gönder (Taslak Fatura)'}
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5" title="Paraşüt sadece TR siparişlerinde aktif">
                                        <AlertTriangle size={14} className="shrink-0" />
                                        <span>Paraşüt yalnızca TR siparişleri için aktif{offerCountry ? ` (bu sipariş: ${offerCountry})` : ''}.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Teslimat Bilgileri</h4>
                            <div className="text-xs text-slate-700 space-y-1">
                                {order.delivery_same_as_invoice ? (
                                    <p className="text-slate-400 italic">Fatura adresi ile aynı</p>
                                ) : (
                                    <>
                                        <p><span className="text-slate-400">Kişi:</span> {order.delivery_contact_name || '—'}</p>
                                        <p><span className="text-slate-400">Telefon:</span> {order.delivery_phone || '—'}</p>
                                        <p><span className="text-slate-400">Adres:</span> {[order.delivery_address, order.delivery_district, order.delivery_city].filter(Boolean).join(', ') || '—'}</p>
                                    </>
                                )}
                                {order.delivery_notes && <p><span className="text-slate-400">Not:</span> {order.delivery_notes}</p>}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-center gap-2">
                            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                            <span className="text-xs text-amber-700 font-medium">Fatura ve teslimat bilgileri henüz tamamlanmamış</span>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                    <a href={customerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        <ExternalLink size={14} /> Müşteri Görünümü
                    </a>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">İptal</button>
                        <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer">
                            {saving ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
