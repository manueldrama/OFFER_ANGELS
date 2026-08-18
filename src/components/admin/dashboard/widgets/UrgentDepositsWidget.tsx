import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Phone, MessageCircle, CheckCircle2, History } from 'lucide-react';
import { supabase } from '../../../../lib/supabase/client';
import { useAdminRealtime } from '../../../../hooks/useAdminRealtime';
import { SecondChanceModal } from '../../orders/SecondChanceModal';
import { WidgetState } from '../WidgetState';

interface Reservation {
    id: string;
    offer_code: string | null;
    items: any[] | null;
    remaining_amount: number | null;
    total: number;
    status: string;
    customer_name: string | null;
    created_at: string;
    payment_method: string | null;
    deposit_amount: number | null;
    deposit_paid_at: string | null;
    price_lock_expires_at: string | null;
    final_deadline_at: string | null;
    sale_source: string | null;
    manual_automation_opt_in: boolean | null;
    second_chance_expires_at: string | null;
    lead_id: string | null;
    // DİKKAT: burada YALNIZCA `leads` tablosunda gerçekten var olan kolonlar durabilir.
    // `whatsapp_number` diye bir kolon YOKTUR (bkz. supabase/schema_phase1.sql:36-47);
    // select'e eklendiğinde PostgREST 42703 ile TÜM sorguyu 400'e düşürür ve widget
    // sessizce boş kalır. WhatsApp linki `phone_number` üzerinden kurulur.
    leads?: { phone_number: string | null } | null;
    /** `load` içinde türetilir: ikinci şans → final deadline → fiyat kilidi sırasıyla. */
    targetDate?: Date | null;
}

function formatTRY(n: number | null): string {
    return '₺' + (Number(n) || 0).toLocaleString('tr-TR');
}

export function UrgentDepositsWidget() {
    const [items, setItems] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [secondChanceResId, setSecondChanceResId] = useState<string | null>(null);

    const load = useCallback(async () => {
        // `cancelled` kovası SUNUCUDA daraltılır. Aksi halde zamanla biriken iptal
        // kayıtları 100'lük pencereyi doldurur ve pencereleme ölçütü (created_at) ile
        // sıralama ölçütü (deadline) farklı olduğu için EN ACİL kayıt dışarıda kalabilir.
        // Bu `.or()` aşağıdaki `isPending` mantığının sunucu tarafı karşılığıdır;
        // client yalnızca ikinci şansın SÜRESİNİ ayrıca kontrol eder.
        const { data, error: qErr } = await supabase
            .from('customer_reservations')
            .select('id, offer_code, items, remaining_amount, total, status, customer_name, created_at, payment_method, deposit_amount, deposit_paid_at, price_lock_expires_at, final_deadline_at, sale_source, manual_automation_opt_in, second_chance_expires_at, lead_id, leads:lead_id(phone_number)')
            .or('status.in.(deposit_paid,price_lock_expired),and(status.eq.cancelled,second_chance_expires_at.not.is.null)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (qErr) {
            // Sessizce boş liste GÖSTERME. Hata "veri yok" gibi görünürse operatör
            // süresi dolmuş kaporaları hiç görmez — bu widget tam olarak böyle aylarca
            // bozuk kaldı (leads.whatsapp_number → 42703 → 400).
            console.error('[UrgentDepositsWidget] load failed:', qErr);
            setError(qErr.message || 'Bilinmeyen hata');
            setItems([]);
            setLoading(false);
            return;
        }

        const nowMs = Date.now();
        const itemsWithDeadline = ((data as any[]) || []).map(r => {
            const targetDateStr = r.second_chance_expires_at || r.final_deadline_at || r.price_lock_expires_at;
            const targetDate = targetDateStr ? new Date(targetDateStr) : null;

            // İptal edilmiş kayıt yalnızca AKTİF bir ikinci şansı varsa listede kalır.
            const isPending =
                r.status === 'deposit_paid' ||
                r.status === 'price_lock_expired' ||
                (r.status === 'cancelled' &&
                    r.second_chance_expires_at &&
                    new Date(r.second_chance_expires_at).getTime() > nowMs);

            return { ...r, targetDate, isPending };
        }).filter(r => r.isPending);

        itemsWithDeadline.sort((a, b) => {
            const timeA = a.targetDate ? a.targetDate.getTime() : Infinity;
            const timeB = b.targetDate ? b.targetDate.getTime() : Infinity;
            return timeA - timeB; // Eskiler (süresi geçenler) en üstte görünsün
        });

        setError(null);
        setItems(itemsWithDeadline.slice(0, 8));
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);
    useAdminRealtime(['customer_reservations'], load);

    const hasUrgent = !loading && !error && items.length > 0;

    return (
        <div className={`bg-white border rounded-xl p-4 h-full flex flex-col ${hasUrgent ? 'border-amber-200 ring-1 ring-amber-100/60' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasUrgent ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                        <Clock size={16} />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-bold text-slate-900 leading-tight">Bekleyen Kaporalar</h3>
                        <p className="text-[11px] text-slate-500 leading-tight">Kalan ödemesi beklenen rezervasyonlar</p>
                    </div>
                </div>
                {hasUrgent && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-bold">{items.length}</span>
                )}
            </div>

            <div className="flex-1 -mx-1">
                {loading ? (
                    <WidgetState kind="loading" />
                ) : error ? (
                    <WidgetState kind="error" detail={error} onRetry={() => { setLoading(true); load(); }} />
                ) : !hasUrgent ? (
                    <WidgetState
                        kind="empty"
                        icon={CheckCircle2}
                        iconClassName="text-emerald-400"
                        title="Bekleyen kapora yok"
                        description="Kalan ödemesi beklenen rezervasyon bulunmuyor"
                    />
                ) : (
                    <div className="divide-y divide-slate-100">
                        {items.map(r => {
                            const productName = r.items?.[0]?.name || 'Sipariş';
                            // Tarihi olmayan kayıtta "999 gün" YAZMA — anlamsız bir sayı
                            // operatöre gerçek bir son tarih varmış gibi görünür.
                            const left = r.targetDate
                                ? Math.max(0, Math.ceil((r.targetDate.getTime() - Date.now()) / 86400000))
                                : null;
                            const urgent = left !== null && left <= 1;
                            const isExpired = r.targetDate && r.targetDate.getTime() < Date.now();
                            const phone = r.leads?.phone_number;
                            // `leads` tablosunda ayrı bir WhatsApp kolonu yok; telefon kullanılır.
                            const whatsapp = phone;
                            return (
                                <div key={r.id} className={`px-1 py-2 ${isExpired ? 'bg-red-50/50 rounded-lg -mx-1 px-2' : ''}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <Link to={`/admin/orders?focus=${r.id}`} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
                                            <p className="text-[12.5px] font-semibold text-slate-800 truncate leading-tight">
                                                {productName}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {r.customer_name && (
                                                    <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{r.customer_name}</span>
                                                )}
                                                <span className="text-[10px] text-slate-400">·</span>
                                                <span className="text-[10px] text-slate-400">Kalan: {formatTRY(r.remaining_amount ?? r.total)}</span>
                                            </div>
                                        </Link>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                isExpired ? 'bg-red-500 text-white'
                                                    : left === null ? 'bg-slate-100 text-slate-500'
                                                        : urgent ? 'bg-red-100 text-red-700'
                                                            : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {isExpired ? 'Süresi Geçti' : left === null ? 'Tarih yok' : `${left} gün`}
                                            </span>
                                            {isExpired && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setSecondChanceResId(r.id);
                                                    }}
                                                    className="p-1 rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors ml-1"
                                                    title="2. Şans Ver"
                                                >
                                                    <History size={13} />
                                                </button>
                                            )}
                                            {whatsapp && (
                                                <a
                                                    href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                    title="WhatsApp"
                                                >
                                                    <MessageCircle size={13} />
                                                </a>
                                            )}
                                            {phone && (
                                                <a
                                                    href={`tel:${phone}`}
                                                    className="p-1 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                                                    title="Ara"
                                                >
                                                    <Phone size={13} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {secondChanceResId && (
                <SecondChanceModal
                    order={items.find(r => r.id === secondChanceResId) as any}
                    onClose={() => setSecondChanceResId(null)}
                    onSaved={() => {
                        setSecondChanceResId(null);
                        load();
                    }}
                />
            )}
        </div>
    );
}
