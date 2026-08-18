import React from 'react';
import { Users, MousePointerClick, Eye, UserPlus, Target, Repeat, ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { DailyPoint } from '../../../services/admin/siteAnalyticsService';

export interface KpiBundle {
    visitors: number;
    sessions: number;
    pageviews: number;
    leads: number;
    cvr: number;
    pageviewsPerSession: number;
    previous: { visitors: number; sessions: number; pageviews: number; leads: number; cvr: number } | null;
    sparkline: DailyPoint[];
}

interface Props {
    data: KpiBundle | null;
    loading: boolean;
}

export const KpiStrip: React.FC<Props> = ({ data, loading }) => {
    const cards = [
        { label: 'Ziyaretçi', value: data?.visitors ?? 0, prev: data?.previous?.visitors, icon: Users, color: 'indigo', sparkKey: 'visitors' as const },
        { label: 'Oturum', value: data?.sessions ?? 0, prev: data?.previous?.sessions, icon: MousePointerClick, color: 'cyan', sparkKey: 'sessions' as const },
        { label: 'Sayfa', value: data?.pageviews ?? 0, prev: data?.previous?.pageviews, icon: Eye, color: 'emerald', sparkKey: 'sessions' as const },
        { label: 'Lead', value: data?.leads ?? 0, prev: data?.previous?.leads, icon: UserPlus, color: 'amber', sparkKey: 'leads' as const },
        { label: 'Dönüşüm', value: `%${(data?.cvr ?? 0).toFixed(2)}`, prev: data?.previous?.cvr, isPct: true, icon: Target, color: 'rose', sparkKey: 'leads' as const },
        { label: 'Sayfa / Oturum', value: (data?.pageviewsPerSession ?? 0).toFixed(2), icon: Repeat, color: 'violet', sparkKey: 'sessions' as const },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map((c, i) => (
                <KpiCard
                    key={i}
                    label={c.label}
                    value={c.value}
                    prev={c.prev}
                    isPct={c.isPct}
                    icon={c.icon}
                    color={c.color}
                    spark={data?.sparkline?.map(p => p[c.sparkKey]) || []}
                    loading={loading}
                />
            ))}
        </div>
    );
};

const colorMap: Record<string, { bg: string; text: string; stroke: string }> = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', stroke: '#6366f1' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', stroke: '#06b6d4' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', stroke: '#10b981' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', stroke: '#f59e0b' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', stroke: '#f43f5e' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', stroke: '#8b5cf6' },
};

interface KpiCardProps {
    label: string;
    value: number | string;
    prev?: number;
    isPct?: boolean;
    icon: LucideIcon;
    color: string;
    spark: number[];
    loading: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, prev, isPct, icon: Icon, color, spark, loading }) => {
    const c = colorMap[color] || colorMap.indigo;
    const curN = typeof value === 'string' ? parseFloat(value.replace(/[^\d.\-]/g, '')) : value;
    const delta = prev != null && Number.isFinite(prev) && prev > 0
        ? ((curN - prev) / prev) * 100
        : null;
    const TrendIcon = delta != null && delta >= 0 ? ArrowUpRight : ArrowDownRight;

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
            <div className="flex items-start justify-between">
                <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center ${c.text}`}>
                    <Icon size={16} />
                </div>
                {delta != null && (
                    <div className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${delta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        <TrendIcon size={10} />
                        {Math.abs(delta).toFixed(0)}%
                    </div>
                )}
            </div>
            <div>
                <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">{label}</p>
                {loading ? (
                    <span className="block h-7 w-16 rounded bg-slate-100 animate-pulse mt-0.5" />
                ) : (
                    <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">{value}</p>
                )}
            </div>
            {spark.length > 1 && (
                <div className="h-7 -mx-1 -mb-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={spark.map((v, i) => ({ i, v }))}>
                            <Line type="monotone" dataKey="v" stroke={c.stroke} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};
