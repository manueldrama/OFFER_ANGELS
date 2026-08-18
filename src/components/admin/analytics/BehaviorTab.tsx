import React, { useMemo, useState } from 'react';
import { Filter, MapPin, Calendar } from 'lucide-react';
import { SectionShell } from './SectionShell';
import { normalizePath } from '../../../utils/normalizePath';
import { TURKEY_DOW_LABELS } from '../../../utils/turkeyTime';
import type { FunnelStats, LandingPageStat, SessionRow, LeadAttributionRow } from '../../../services/admin/siteAnalyticsService';
import { buildHourDow } from '../../../services/admin/siteAnalyticsService';

interface BehaviorTabProps {
    funnel: FunnelStats;
    landingPages: LandingPageStat[];
    sessions: SessionRow[];
    leads: LeadAttributionRow[];
    loading: boolean;
}

export const BehaviorTab: React.FC<BehaviorTabProps> = ({ funnel, landingPages, sessions, leads, loading }) => {
    return (
        <div className="space-y-4">
            <ConversionFunnel funnel={funnel} loading={loading} />
            <LandingPagesTable rows={landingPages} loading={loading} />
            <HourDowHeatmap sessions={sessions} leads={leads} loading={loading} />
        </div>
    );
};

const ConversionFunnel: React.FC<{ funnel: FunnelStats; loading: boolean }> = ({ funnel, loading }) => {
    const steps = [
        { label: 'Ziyaretçi', value: funnel.visitors, color: '#6366f1' },
        { label: 'Oturum', value: funnel.sessions, color: '#06b6d4' },
        { label: 'Lead', value: funnel.leads, color: '#f59e0b' },
        { label: 'Müşteri', value: funnel.customers, color: '#10b981' },
    ];
    const max = Math.max(1, ...steps.map(s => s.value));
    return (
        <SectionShell
            title="Dönüşüm Hunisi"
            icon={Filter}
            description="Ziyaretçi → Oturum → Lead → Müşteri. Her adım arasındaki yüzde düşüş gerçek funnel sızıntınız."
            loading={loading}
            empty={funnel.visitors === 0 && funnel.sessions === 0}
        >
            <div className="space-y-3">
                {steps.map((s, i) => {
                    const widthPct = (s.value / max) * 100;
                    const prev = i > 0 ? steps[i - 1].value : null;
                    const dropPct = prev != null && prev > 0 ? ((prev - s.value) / prev) * 100 : null;
                    return (
                        <div key={s.label} className="relative">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-600 w-20 shrink-0">{s.label}</span>
                                <div className="flex-1 h-9 bg-slate-50 rounded-md relative overflow-hidden">
                                    <div
                                        className="h-full rounded-md flex items-center justify-end pr-3 text-white text-xs font-semibold tabular-nums transition-all"
                                        style={{ width: `${widthPct}%`, background: s.color, minWidth: '60px' }}
                                    >
                                        {s.label === 'Müşteri' && s.value === 0 ? '—' : s.value}
                                    </div>
                                </div>
                                {dropPct != null && (
                                    <span className={`text-[10px] font-semibold w-16 text-right ${dropPct > 50 ? 'text-rose-600' : 'text-slate-500'}`}>
                                        ↓ {dropPct.toFixed(0)}%
                                    </span>
                                )}
                                {i === 0 && <span className="text-[10px] w-16 text-right text-slate-400">başlangıç</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </SectionShell>
    );
};

const LandingPagesTable: React.FC<{ rows: LandingPageStat[]; loading: boolean }> = ({ rows, loading }) => {
    const normalized = useMemo(() => {
        const map = new Map<string, LandingPageStat>();
        for (const r of rows) {
            const k = normalizePath(r.path);
            if (!map.has(k)) {
                map.set(k, { ...r, path: k });
            } else {
                const e = map.get(k)!;
                const sessions = e.sessions + r.sessions;
                const leads = e.leads + r.leads;
                const bouncePct = sessions > 0 ? ((e.bouncePct * e.sessions + r.bouncePct * r.sessions) / sessions) : 0;
                map.set(k, {
                    path: k,
                    sessions,
                    leads,
                    bouncePct,
                    cvr: sessions > 0 ? Math.min((leads / sessions) * 100, 100) : 0,
                });
            }
        }
        return Array.from(map.values()).sort((a, b) => b.sessions - a.sessions).slice(0, 25);
    }, [rows]);

    return (
        <SectionShell
            title="Landing Sayfası Performansı"
            icon={MapPin}
            description="Ziyaretçinin siteye girdiği ilk sayfa — oturum, lead, dönüşüm, bounce."
            loading={loading}
            empty={normalized.length === 0}
        >
            <div className="overflow-x-auto max-h-[420px]">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
                        <tr>
                            <th className="text-left px-3 py-2 font-semibold">Sayfa</th>
                            <th className="text-right px-3 py-2 font-semibold">Oturum</th>
                            <th className="text-right px-3 py-2 font-semibold">Lead</th>
                            <th className="text-right px-3 py-2 font-semibold">CVR</th>
                            <th className="text-right px-3 py-2 font-semibold">Bounce</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {normalized.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 text-slate-800 font-mono text-xs truncate max-w-[300px]" title={r.path}>{r.path}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{r.sessions}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-amber-600 font-semibold">{r.leads}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-rose-600 text-xs">%{r.cvr.toFixed(1)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-500 text-xs">%{r.bouncePct.toFixed(0)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </SectionShell>
    );
};

const HourDowHeatmap: React.FC<{ sessions: SessionRow[]; leads: LeadAttributionRow[]; loading: boolean }> = ({ sessions, leads, loading }) => {
    const [mode, setMode] = useState<'sessions' | 'leads'>('sessions');
    const matrix = useMemo(() => {
        if (mode === 'sessions') return buildHourDow(sessions.map(s => ({ when: s.started_at })));
        return buildHourDow(leads.map(l => ({ when: l.created_at })));
    }, [mode, sessions, leads]);
    const max = Math.max(1, ...matrix.flat());

    return (
        <SectionShell
            title="Saatlik × Haftalık Isı Haritası"
            icon={Calendar}
            description="Türkiye saatine göre — hangi gün ve saatte gerçek aksiyon var? Reklam takvimini buna göre planlayın."
            loading={loading}
            empty={sessions.length === 0 && leads.length === 0}
            action={
                <div className="flex bg-slate-100 p-0.5 rounded text-[11px] font-semibold">
                    <button onClick={() => setMode('sessions')} className={`px-2 py-1 rounded ${mode === 'sessions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Oturum</button>
                    <button onClick={() => setMode('leads')} className={`px-2 py-1 rounded ${mode === 'leads' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Lead</button>
                </div>
            }
        >
            <div className="overflow-x-auto">
                <table className="text-[10px] border-separate" style={{ borderSpacing: '2px' }}>
                    <thead>
                        <tr>
                            <th></th>
                            {Array.from({ length: 24 }, (_, h) => (
                                <th key={h} className="text-slate-400 font-semibold w-7 text-center">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.map((row, d) => (
                            <tr key={d}>
                                <td className="text-slate-500 font-semibold pr-2 text-right">{TURKEY_DOW_LABELS[d]}</td>
                                {row.map((v, h) => {
                                    const intensity = v / max;
                                    return (
                                        <td
                                            key={h}
                                            className="w-7 h-7 text-center align-middle tabular-nums rounded"
                                            title={`${TURKEY_DOW_LABELS[d]} ${h}:00 — ${v} ${mode === 'sessions' ? 'oturum' : 'lead'}`}
                                            style={{
                                                background: intensity === 0 ? '#f1f5f9' : `rgba(99,102,241,${0.15 + intensity * 0.75})`,
                                                color: intensity > 0.55 ? '#fff' : '#475569',
                                            }}
                                        >
                                            {v > 0 ? v : ''}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </SectionShell>
    );
};
