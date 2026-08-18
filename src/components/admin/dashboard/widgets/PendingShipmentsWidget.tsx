import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Truck, ChevronRight, PartyPopper } from 'lucide-react';
import { supabase } from '../../../../lib/supabase/client';
import { useAdminRealtime } from '../../../../hooks/useAdminRealtime';
import { WidgetState } from '../WidgetState';

interface Reservation {
    id: string;
    offer_code: string | null;
    items: any[] | null;
    total: number;
    status: string;
    customer_name: string | null;
    deposit_paid_at: string | null;
    updated_at: string | null;
    created_at: string;
}

function daysAgo(iso: string | null): string {
    if (!iso) return '';
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d < 1) return 'bugün';
    if (d === 1) return 'dün';
    return `${d} gün önce`;
}

function formatTRY(n: number): string {
    return '₺' + (Number(n) || 0).toLocaleString('tr-TR');
}

export function PendingShipmentsWidget() {
    const [items, setItems] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { data, error: qErr } = await supabase
            .from('customer_reservations')
            .select('id, offer_code, items, total, status, customer_name, deposit_paid_at, updated_at, created_at, tracking_number')
            // Siparişler sayfasındaki "Kargolanacak" kovası ile TAM eşleşme:
            // "confirmed" durumu havale/EFT siparişlerinde "Ödeme Onayı Bekliyor"
            // anlamına gelse de, stoktan düştüğü için kargo sürecine dahil edilir.
            .in('status', ['confirmed', 'paid', 'fully_paid'])
            .is('tracking_number', null)
            .order('updated_at', { ascending: false })
            .limit(8);

        if (qErr) {
            // Hata kutlama ikonuyla "Tüm siparişler kargolanmış" olarak GÖSTERİLEMEZ —
            // kargolanmayı bekleyen sipariş varken operatöre tam tersini söylerdi.
            console.error('[PendingShipmentsWidget] load failed:', qErr);
            setError(qErr.message || 'Bilinmeyen hata');
            setItems([]);
            setLoading(false);
            return;
        }

        setError(null);
        setItems((data as Reservation[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);
    useAdminRealtime(['customer_reservations'], load);

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Truck size={16} />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-bold text-slate-900 leading-tight">Bekleyen Sevkiyatlar</h3>
                        {/* "Tahsilat tamam" DEĞİL: kova `confirmed` durumunu da içeriyor ve
                            o durum havale/EFT'de "ödeme onayı bekliyor" demek. Alt başlık
                            Siparişler sayfasındaki kova yardımıyla ("Onaylı, henüz
                            gönderilmedi", orderStatus.ts ORDER_BUCKETS) aynı şeyi söyler. */}
                        <p className="text-[11px] text-slate-500 leading-tight">Onaylı, henüz gönderilmedi</p>
                    </div>
                </div>
                {!loading && items.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold">{items.length}</span>
                )}
            </div>

            <div className="flex-1 -mx-1">
                {loading ? (
                    <WidgetState kind="loading" />
                ) : error ? (
                    <WidgetState kind="error" detail={error} onRetry={() => { setLoading(true); load(); }} />
                ) : items.length === 0 ? (
                    <WidgetState
                        kind="empty"
                        icon={PartyPopper}
                        iconClassName="text-emerald-400"
                        title="Tüm siparişler kargolanmış"
                        description="Bekleyen sevkiyat yok"
                    />
                ) : (
                    <div className="divide-y divide-slate-100">
                        {items.map(r => {
                            const productName = r.items?.[0]?.name || r.customer_name || 'Sipariş';
                            const paidAt = r.deposit_paid_at || r.updated_at || r.created_at;
                            return (
                                <Link
                                    key={r.id}
                                    to={`/admin/orders?focus=${r.id}`}
                                    className="block px-1 py-2 hover:bg-slate-50/80 rounded-md transition-colors group"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12.5px] font-semibold text-slate-800 truncate leading-tight">{productName}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {r.offer_code && (
                                                    <span className="text-[10px] font-mono text-slate-400">{r.offer_code}</span>
                                                )}
                                                <span className="text-[10px] text-slate-400">· {formatTRY(r.total)}</span>
                                                <span className="text-[10px] text-slate-400">· {daysAgo(paidAt)}</span>
                                            </div>
                                        </div>
                                        <span className="text-[10.5px] font-bold text-indigo-600 inline-flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                                            Kargo Ekle <ChevronRight size={11} />
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
