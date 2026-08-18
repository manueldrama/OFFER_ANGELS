import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MoreHorizontal } from 'lucide-react';
import { supabase } from '../../../../lib/supabase/client';
import { formatDate } from '../../../../hooks/useAppSettings';
import { useAdminRealtime } from '../../../../hooks/useAdminRealtime';
import { WidgetState } from '../WidgetState';

interface RecentOffer {
    id: string;
    customer_name: string;
    service_type: string;
    rep_name: string;
    payment_method: string;
    amount: number;
    status: string;
    created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-600',
    pending: 'bg-amber-50 text-amber-600',
    started: 'bg-blue-50 text-blue-600',
    failed: 'bg-rose-50 text-rose-600',
};

const STATUS_LABELS: Record<string, string> = {
    success: 'Tamamlandı',
    pending: 'Bekliyor',
    started: 'İşlemde',
    failed: 'Başarısız',
};

// leadIds verilirse sadece o leadlerin teklifleri listelenir (temsilci dashboard'u).
export function RecentOffersWidget({ leadIds }: { leadIds?: string[] } = {}) {
    const [offers, setOffers] = useState<RecentOffer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const leadIdsKey = leadIds ? leadIds.join(',') : undefined;

    const loadRecentOffers = useCallback(async () => {
        try {
            if (leadIds && leadIds.length === 0) { setOffers([]); setLoading(false); return; }
            // Join offer_links with leads and payment_transactions for recent activity.
            // NOT: offer_links PK'sı token'dır, "id" kolonu YOKTUR — id seçmek sorguyu
            // sessizce 400'e düşürüp widget'ı hep boş gösteriyordu.
            let query = supabase
                .from('offer_links')
                .select(`
                    token, created_at, view_count,
                    leads(customer_name, assigned_to, status),
                    payment_transactions(amount, status, payment_method)
                `)
                .order('created_at', { ascending: false })
                .limit(6);
            if (leadIds) query = query.in('lead_id', leadIds);
            const { data: links, error: linksErr } = await query;

            // Yukarıdaki NOT'ta anlatılan vakanın tekrar etmemesi için: PostgREST
            // hatası throw ETMEZ, `error` alanında döner. Okunmazsa 400 sessizce
            // "hiç teklif yok" olarak görünür.
            if (linksErr) throw linksErr;
            if (!links) { setError(null); setOffers([]); setLoading(false); return; }

            // Get rep names for assigned leads
            const repIds = [...new Set(
                links
                    .map(l => (l.leads as any)?.assigned_to)
                    .filter(Boolean)
            )];

            let repMap: Record<string, string> = {};
            if (repIds.length > 0) {
                const { data: reps, error: repsErr } = await supabase
                    .from('sales_users')
                    .select('id, full_name')
                    .in('id', repIds);
                // Temsilci adı ikincil bilgidir: alınamazsa teklifler yine listelenir,
                // yalnızca "Atanmamış" yazar. Bu yüzden throw EDİLMEZ, log'lanır.
                if (repsErr) console.error('[RecentOffersWidget] rep name lookup failed:', repsErr);
                if (reps) {
                    reps.forEach(r => { repMap[r.id] = r.full_name; });
                }
            }

            const mapped: RecentOffer[] = links.map(link => {
                const lead = link.leads as any;
                const payment = Array.isArray(link.payment_transactions)
                    ? link.payment_transactions[0]
                    : link.payment_transactions;

                return {
                    id: link.token,
                    customer_name: lead?.customer_name || 'Bilinmiyor',
                    service_type: 'Makine Teklifi',
                    rep_name: lead?.assigned_to ? (repMap[lead.assigned_to] || 'Atanmamış') : 'Atanmamış',
                    payment_method: payment?.payment_method || 'Kart',
                    amount: payment?.amount ? Number(payment.amount) : 0,
                    status: payment?.status || 'pending',
                    created_at: link.created_at,
                };
            });

            setError(null);
            setOffers(mapped);
        } catch (err: any) {
            // Sayfayı çökertmiyoruz ama SESSİZ de kalmıyoruz: hata kutucukta görünür.
            console.error('[RecentOffersWidget] load failed:', err);
            setError(err?.message || 'Bilinmeyen hata');
            setOffers([]);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadIdsKey]);

    useEffect(() => { loadRecentOffers(); }, [loadRecentOffers]);
    useAdminRealtime(['offer_links', 'payment_transactions', 'leads'], loadRecentOffers);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">Son İşlem Gören Teklifler</h3>
                <Link to="/admin/offers" className="text-sky-500 text-[13px] font-medium flex items-center gap-1 hover:text-sky-700 transition-colors">
                    Tümünü Gör <ArrowRight size={14} />
                </Link>
            </div>

            {/* Table */}
            <div className="overflow-x-auto -mx-2">
                <table className="w-full text-left">
                    <thead>
                        <tr>
                            <th className="pb-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Müşteri</th>
                            <th className="pb-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Hizmet</th>
                            <th className="pb-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Temsilci</th>
                            <th className="pb-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Tutar</th>
                            <th className="pb-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Durum</th>
                            <th className="pb-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">Yükleniyor...</td></tr>
                        ) : error ? (
                            <tr><td colSpan={6}>
                                <WidgetState kind="error" detail={error} onRetry={() => { setLoading(true); loadRecentOffers(); }} />
                            </td></tr>
                        ) : offers.length === 0 ? (
                            <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">Henüz teklif kaydı yok.</td></tr>
                        ) : offers.map(offer => (
                            <tr key={offer.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="py-4 px-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                            {offer.customer_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{offer.customer_name}</p>
                                            <p className="text-xs text-slate-400">{formatDate(offer.created_at)}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 px-2 text-sm text-slate-600 hidden md:table-cell">{offer.service_type}</td>
                                <td className="py-4 px-2 hidden lg:table-cell">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                                            {offer.rep_name.charAt(0)}
                                        </div>
                                        <span className="text-[13px] text-slate-700 font-medium">{offer.rep_name}</span>
                                    </div>
                                </td>
                                <td className="py-4 px-2 text-sm font-semibold text-slate-800 hidden sm:table-cell">
                                    {offer.amount > 0
                                        ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(offer.amount)
                                        : '—'}
                                </td>
                                <td className="py-4 px-2">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[offer.status] || STATUS_STYLES.pending}`}>
                                        {STATUS_LABELS[offer.status] || offer.status}
                                    </span>
                                </td>
                                <td className="py-4 px-2 text-right">
                                    <button className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                                        <MoreHorizontal size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
