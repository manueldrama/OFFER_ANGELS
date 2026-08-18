import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Users, MousePointerClick, Eye, UserPlus, RefreshCw, ArrowRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { supabase } from '../../../../lib/supabase/client';
import { useAdminRealtime } from '../../../../hooks/useAdminRealtime';
import { WidgetState } from '../WidgetState';

interface KpiBundle {
    visitors: number;
    sessions: number;
    pageviews: number;
    leads: number;
}

interface SiteAnalyticsStats {
    current: KpiBundle;
    previous: KpiBundle;
    liveNow: number;
    spark: number[]; // günlük oturum sayısı (7 nokta)
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_BUNDLE: KpiBundle = { visitors: 0, sessions: 0, pageviews: 0, leads: 0 };

function deltaPct(cur: number, prev: number): number | null {
    if (!prev) return null; // önceki dönem 0 ise oran anlamsız → gizle
    return ((cur - prev) / prev) * 100;
}

function bucketByDay(timestamps: string[], startMs: number, days: number): number[] {
    const buckets = new Array(days).fill(0);
    for (const ts of timestamps) {
        const t = new Date(ts).getTime();
        if (Number.isNaN(t)) continue;
        const idx = Math.floor((t - startMs) / DAY_MS);
        if (idx >= 0 && idx < days) buckets[idx] += 1;
    }
    return buckets;
}

export function SiteAnalyticsWidget() {
    const [stats, setStats] = useState<SiteAnalyticsStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const now = Date.now();
        const start7 = new Date(now - 7 * DAY_MS).toISOString();
        const start14 = new Date(now - 14 * DAY_MS).toISOString();
        const end7 = new Date(now - 7 * DAY_MS).toISOString();
        const nowIso = new Date(now).toISOString();
        const liveSince = new Date(now - 5 * 60 * 1000).toISOString();

        const [curRes, prevRes, liveRes, sparkRes] = await Promise.all([
            supabase.rpc('analytics_kpi_bundle', { p_start: start7, p_end: nowIso }),
            supabase.rpc('analytics_kpi_bundle', { p_start: start14, p_end: end7 }),
            supabase.from('sessions').select('visitor_id').gte('started_at', liveSince).limit(2000),
            supabase.from('sessions').select('started_at').gte('started_at', start7).limit(20000),
        ]);

        // RPC yoksa / izin yoksa dördü de hata döner ve tüm KPI'lar EMPTY_BUNDLE'a,
        // yani 0'a düşerdi. "0 ziyaretçi" ile "sorgu patladı" aynı şey değildir.
        const failed = [curRes.error, prevRes.error, liveRes.error, sparkRes.error].filter(Boolean);
        if (failed.length > 0) {
            console.error('[SiteAnalyticsWidget] load failed:', failed);
            setError(failed[0]?.message || 'Bilinmeyen hata');
            setStats(null);
            setLoading(false);
            return;
        }

        const curRow = (Array.isArray(curRes.data) ? curRes.data[0] : curRes.data) as KpiBundle | null;
        const prevRow = (Array.isArray(prevRes.data) ? prevRes.data[0] : prevRes.data) as KpiBundle | null;
        const liveNow = new Set((liveRes.data || []).map((r: any) => r.visitor_id)).size;
        const spark = bucketByDay(
            (sparkRes.data || []).map((r: any) => r.started_at as string),
            now - 7 * DAY_MS,
            7,
        );

        setError(null);
        setStats({
            current: curRow || EMPTY_BUNDLE,
            previous: prevRow || EMPTY_BUNDLE,
            liveNow,
            spark,
        });
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);
    useAdminRealtime(['sessions', 'pageviews', 'leads'], load);

    const c = stats?.current ?? EMPTY_BUNDLE;
    const p = stats?.previous ?? EMPTY_BUNDLE;

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                        <Activity size={16} />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-bold text-slate-900 leading-tight">Site Analitiği</h3>
                        <p className="text-[11px] text-slate-500 leading-tight">Son 7 gün</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        disabled={loading}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                        title="Yenile"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <Link
                        to="/admin/analytics"
                        className="text-sky-500 text-[13px] font-medium flex items-center gap-1 hover:text-sky-700 transition-colors"
                    >
                        Detay <ArrowRight size={14} />
                    </Link>
                </div>
            </div>

            {error ? (
                <div className="flex-1 flex items-center justify-center">
                    <WidgetState kind="error" detail={error} onRetry={load} />
                </div>
            ) : (
            <>
            {/* Canlı rozeti */}
            <div className="flex items-center gap-1.5 mb-3">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[12px] text-slate-600">
                    Şu an <span className="font-bold text-slate-900">{loading ? '—' : stats?.liveNow ?? 0}</span> aktif ziyaretçi
                </span>
            </div>

            {/* KPI hücreleri */}
            <div className="grid grid-cols-2 gap-2">
                <KpiCell icon={<Users size={13} className="text-blue-500" />} label="Ziyaretçi" value={c.visitors} delta={deltaPct(c.visitors, p.visitors)} loading={loading} />
                <KpiCell icon={<MousePointerClick size={13} className="text-violet-500" />} label="Oturum" value={c.sessions} delta={deltaPct(c.sessions, p.sessions)} loading={loading} />
                <KpiCell icon={<Eye size={13} className="text-sky-500" />} label="Sayfa Görüntüleme" value={c.pageviews} delta={deltaPct(c.pageviews, p.pageviews)} loading={loading} />
                <KpiCell icon={<UserPlus size={13} className="text-emerald-500" />} label="Lead" value={c.leads} delta={deltaPct(c.leads, p.leads)} loading={loading} />
            </div>

            {/* Sparkline */}
            <div className="mt-auto pt-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">7 günlük oturum trendi</p>
                <div className="h-10 -mx-1">
                    {stats && stats.spark.some(v => v > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.spark.map((v, i) => ({ i, v }))}>
                                <Line type="monotone" dataKey="v" stroke="#0ea5e9" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[11px] text-slate-300">
                            {loading ? 'Yükleniyor…' : 'Veri yok'}
                        </div>
                    )}
                </div>
            </div>
            </>
            )}
        </div>
    );
}

function KpiCell({ icon, label, value, delta, loading }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    delta: number | null;
    loading: boolean;
}) {
    return (
        <div className="bg-slate-50 rounded-lg p-2.5 flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
                {icon}
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</span>
            </div>
            <div className="flex items-end justify-between gap-1">
                <span className="font-bold text-slate-900 text-[18px] tabular-nums leading-none">
                    {loading ? '—' : value.toLocaleString('tr-TR')}
                </span>
                {!loading && delta != null && (
                    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {Math.abs(delta).toFixed(0)}%
                    </span>
                )}
            </div>
        </div>
    );
}
