import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Users, FileText, CreditCard, Wallet, RefreshCw } from 'lucide-react';
import { supabase } from '../../../../lib/supabase/client';
import { useAdminRealtime } from '../../../../hooks/useAdminRealtime';
import { WidgetState } from '../WidgetState';

interface TodayStats {
    leads: number;
    offers: number;
    payments: number;
    revenue: number;
}

function startOfTodayIso(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

function formatTRY(n: number): string {
    return '₺' + (Number(n) || 0).toLocaleString('tr-TR');
}

export function TodayActivityWidget() {
    const [stats, setStats] = useState<TodayStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const startIso = startOfTodayIso();
        const [leadsRes, offersRes, paymentsRes] = await Promise.all([
            supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', startIso),
            supabase.from('generated_offers').select('id', { count: 'exact', head: true }).gte('created_at', startIso),
            supabase.from('payment_transactions').select('amount').eq('status', 'success').gte('paid_at', startIso),
        ]);

        // Üç sorgudan HERHANGİ biri patlarsa "bugün 0 lead, ₺0 ciro" göstermek yanlış
        // bilgidir — sıfır ile "okuyamadım" aynı şey değil.
        const failed = [leadsRes.error, offersRes.error, paymentsRes.error].filter(Boolean);
        if (failed.length > 0) {
            console.error('[TodayActivityWidget] load failed:', failed);
            setError(failed[0]?.message || 'Bilinmeyen hata');
            setStats(null);
            setLoading(false);
            return;
        }

        const revenue = (paymentsRes.data || []).reduce((s, p: any) => s + (Number(p.amount) || 0), 0);
        setError(null);
        setStats({
            leads: leadsRes.count || 0,
            offers: offersRes.count || 0,
            payments: (paymentsRes.data || []).length,
            revenue,
        });
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);
    useAdminRealtime(['leads', 'generated_offers', 'payment_transactions'], load);

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                        <TrendingUp size={16} />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-bold text-slate-900 leading-tight">Bugün</h3>
                        <p className="text-[11px] text-slate-500 leading-tight">Günlük aktivite özeti</p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    title="Yenile"
                >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {error ? (
                <div className="flex-1">
                    <WidgetState kind="error" detail={error} onRetry={load} />
                </div>
            ) : (
            <div className="flex-1 grid grid-cols-2 gap-2">
                <Cell
                    icon={<Users size={13} className="text-blue-500" />}
                    label="Lead"
                    value={loading ? '—' : String(stats?.leads ?? 0)}
                />
                <Cell
                    icon={<FileText size={13} className="text-violet-500" />}
                    label="Teklif"
                    value={loading ? '—' : String(stats?.offers ?? 0)}
                />
                <Cell
                    icon={<CreditCard size={13} className="text-emerald-500" />}
                    label="Ödeme"
                    value={loading ? '—' : String(stats?.payments ?? 0)}
                />
                <Cell
                    icon={<Wallet size={13} className="text-amber-500" />}
                    label="Ciro"
                    value={loading ? '—' : formatTRY(stats?.revenue ?? 0)}
                    valueClass="text-[13px]"
                />
            </div>
            )}
        </div>
    );
}

function Cell({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
    return (
        <div className="bg-slate-50 rounded-lg p-2.5 flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
                {icon}
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
            </div>
            <span className={`font-bold text-slate-900 ${valueClass || 'text-[18px]'}`}>{value}</span>
        </div>
    );
}
