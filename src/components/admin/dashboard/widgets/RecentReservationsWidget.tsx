import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ChevronRight, Package } from 'lucide-react';
import { supabase } from '../../../../lib/supabase/client';
import { useAdminRealtime } from '../../../../hooks/useAdminRealtime';
import { WidgetState } from '../WidgetState';

interface Reservation {
    id: string;
    offer_code: string | null;
    items: any[] | null;
    total: number;
    status: string;
    payment_method: string | null;
    created_at: string;
    customer_name: string | null;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
    pending: { label: 'Bekliyor', bg: 'bg-amber-50', text: 'text-amber-700' },
    deposit_paid: { label: 'Kapora', bg: 'bg-violet-50', text: 'text-violet-700' },
    paid: { label: 'Tam Ödeme', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    fully_paid: { label: 'Tam Ödeme', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    confirmed: { label: 'Onaylandı', bg: 'bg-blue-50', text: 'text-blue-700' },
    shipped: { label: 'Kargoda', bg: 'bg-indigo-50', text: 'text-indigo-700' },
    delivered: { label: 'Teslim', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    cancelled: { label: 'İptal', bg: 'bg-red-50', text: 'text-red-600' },
    price_lock_expired: { label: 'Fiyat Güncel', bg: 'bg-amber-50', text: 'text-amber-700' },
};

function relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diffMs / 60000);
    if (m < 1) return 'az önce';
    if (m < 60) return `${m} dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} sa önce`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d} gün önce`;
    return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

function formatTRY(n: number): string {
    return '₺' + (Number(n) || 0).toLocaleString('tr-TR');
}

export function RecentReservationsWidget() {
    const [items, setItems] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { data, error: qErr } = await supabase
            .from('customer_reservations')
            .select('id, offer_code, items, total, status, payment_method, created_at, customer_name')
            .order('created_at', { ascending: false })
            .limit(6);

        if (qErr) {
            console.error('[RecentReservationsWidget] load failed:', qErr);
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
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <ShoppingBag size={16} />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-bold text-slate-900 leading-tight">Son Rezervasyonlar</h3>
                        <p className="text-[11px] text-slate-500 leading-tight">Yeni siparişler</p>
                    </div>
                </div>
                <Link to="/admin/orders" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5">
                    Tümü <ChevronRight size={12} />
                </Link>
            </div>

            <div className="flex-1 -mx-1">
                {loading ? (
                    <WidgetState kind="loading" />
                ) : error ? (
                    <WidgetState kind="error" detail={error} onRetry={() => { setLoading(true); load(); }} />
                ) : items.length === 0 ? (
                    <WidgetState kind="empty" icon={Package} title="Henüz rezervasyon yok" />
                ) : (
                    <div className="divide-y divide-slate-100">
                        {items.map(r => {
                            const productName = r.items?.[0]?.name || r.customer_name || 'Sipariş';
                            const style = STATUS_STYLES[r.status] || { label: r.status, bg: 'bg-slate-100', text: 'text-slate-600' };
                            return (
                                <Link
                                    key={r.id}
                                    to={`/admin/orders?focus=${r.id}`}
                                    className="block px-1 py-2 hover:bg-slate-50/80 rounded-md transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12.5px] font-semibold text-slate-800 truncate leading-tight">{productName}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {r.offer_code && (
                                                    <span className="text-[10px] font-mono text-slate-400">{r.offer_code}</span>
                                                )}
                                                <span className="text-[10px] text-slate-400">·</span>
                                                <span className="text-[10px] text-slate-400">{relativeTime(r.created_at)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[12px] font-bold text-slate-900">{formatTRY(r.total)}</p>
                                            <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${style.bg} ${style.text}`}>
                                                {style.label}
                                            </span>
                                        </div>
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
