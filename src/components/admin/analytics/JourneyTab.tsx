import React, { useMemo, useState } from 'react';
import { Footprints, Hourglass, Search, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SectionShell } from './SectionShell';
import { countryFlag } from '../../../utils/geoFormat';
import type {
    TouchpointBucket,
    SessionRow,
    LeadAttributionRow,
    PageviewRow,
} from '../../../services/admin/siteAnalyticsService';
import { classifyChannel } from '../../../services/admin/siteAnalyticsService';

interface JourneyTabProps {
    touchpoints: TouchpointBucket[];
    timeToConvert: TouchpointBucket[];
    sessions: SessionRow[];
    leads: LeadAttributionRow[];
    pageviews: PageviewRow[];
    loading: boolean;
}

export const JourneyTab: React.FC<JourneyTabProps> = ({ touchpoints, timeToConvert, sessions, leads, pageviews, loading }) => {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <HistogramCard
                    title="Dönüşüme Kadar Oturum Sayısı"
                    description="Müşteri lead'e dönüşmeden önce siteyi kaç oturumda ziyaret etti?"
                    icon={Footprints}
                    data={touchpoints}
                    color="#6366f1"
                    loading={loading}
                />
                <HistogramCard
                    title="Dönüşüm Süresi"
                    description="İlk ziyaretten lead olmaya kadar geçen süre."
                    icon={Hourglass}
                    data={timeToConvert}
                    color="#f59e0b"
                    loading={loading}
                />
            </div>
            <VisitorExplorer sessions={sessions} leads={leads} pageviews={pageviews} loading={loading} />
        </div>
    );
};

const HistogramCard: React.FC<{ title: string; description: string; icon: any; data: TouchpointBucket[]; color: string; loading: boolean }> = ({ title, description, icon, data, color, loading }) => {
    const total = data.reduce((s, d) => s + d.count, 0);
    return (
        <SectionShell title={title} icon={icon} description={description} loading={loading} empty={total === 0}>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </SectionShell>
    );
};

interface VisitorRow {
    visitor_id: string;
    sessions: number;
    pageviews: number;
    firstSeen: string;
    lastSeen: string;
    country: string | null;
    city: string | null;
    channel: string;
    campaign: string | null;
    leadId: string | null;
}

const VisitorExplorer: React.FC<{ sessions: SessionRow[]; leads: LeadAttributionRow[]; pageviews: PageviewRow[]; loading: boolean }> = ({ sessions, leads, pageviews, loading }) => {
    const [q, setQ] = useState('');
    const [selected, setSelected] = useState<string | null>(null);

    const rows = useMemo<VisitorRow[]>(() => {
        const map = new Map<string, VisitorRow>();
        const pvCount = new Map<string, number>();
        for (const p of pageviews) pvCount.set(p.visitor_id, (pvCount.get(p.visitor_id) || 0) + 1);
        const leadByVisitor = new Map<string, string>();
        for (const l of leads) if (l.visitor_id) leadByVisitor.set(l.visitor_id, l.id);
        for (const s of sessions) {
            const ex = map.get(s.visitor_id);
            const ch = classifyChannel(s).channel;
            if (!ex) {
                map.set(s.visitor_id, {
                    visitor_id: s.visitor_id,
                    sessions: 1,
                    pageviews: pvCount.get(s.visitor_id) || 0,
                    firstSeen: s.started_at,
                    lastSeen: s.started_at,
                    country: s.country,
                    city: s.city,
                    channel: ch,
                    campaign: s.utm_campaign,
                    leadId: leadByVisitor.get(s.visitor_id) || null,
                });
            } else {
                ex.sessions += 1;
                if (s.started_at < ex.firstSeen) ex.firstSeen = s.started_at;
                if (s.started_at > ex.lastSeen) ex.lastSeen = s.started_at;
                if (!ex.country && s.country) ex.country = s.country;
                if (!ex.city && s.city) ex.city = s.city;
                if (s.utm_campaign && !ex.campaign) ex.campaign = s.utm_campaign;
            }
        }
        const all = Array.from(map.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
        if (!q.trim()) return all.slice(0, 200);
        const needle = q.toLowerCase();
        return all
            .filter(r =>
                r.visitor_id.toLowerCase().includes(needle) ||
                (r.city || '').toLowerCase().includes(needle) ||
                (r.country || '').toLowerCase().includes(needle) ||
                (r.campaign || '').toLowerCase().includes(needle) ||
                r.channel.toLowerCase().includes(needle),
            )
            .slice(0, 200);
    }, [sessions, leads, pageviews, q]);

    const drill = useMemo(() => {
        if (!selected) return null;
        const visitor = rows.find(r => r.visitor_id === selected);
        if (!visitor) return null;
        const ss = sessions.filter(s => s.visitor_id === selected).sort((a, b) => a.started_at.localeCompare(b.started_at));
        const pv = pageviews.filter(p => p.visitor_id === selected).sort((a, b) => a.created_at.localeCompare(b.created_at));
        const lead = leads.find(l => l.visitor_id === selected);
        return { visitor, sessions: ss, pageviews: pv, lead };
    }, [selected, rows, sessions, pageviews, leads]);

    return (
        <SectionShell
            title="Ziyaretçi Yolculuk Kâşifi"
            icon={Search}
            description="Tek tek ziyaretçileri ara, satıra tıkla, tüm oturumlarını ve sayfa gezisini gör."
            loading={loading}
            empty={rows.length === 0 && !q.trim()}
            action={
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="visitor_id, şehir, kampanya..."
                        className="pl-6 pr-2 py-1.5 text-xs border border-slate-200 rounded-md w-56 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                    />
                </div>
            }
        >
            <div className="overflow-x-auto max-h-[420px]">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
                        <tr>
                            <th className="text-left px-3 py-2 font-semibold">Ziyaretçi</th>
                            <th className="text-left px-3 py-2 font-semibold">Konum</th>
                            <th className="text-left px-3 py-2 font-semibold">Kanal</th>
                            <th className="text-left px-3 py-2 font-semibold">Kampanya</th>
                            <th className="text-right px-3 py-2 font-semibold">Oturum</th>
                            <th className="text-right px-3 py-2 font-semibold">Sayfa</th>
                            <th className="text-center px-3 py-2 font-semibold">Lead</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map(r => (
                            <tr key={r.visitor_id} className="hover:bg-indigo-50/30 cursor-pointer" onClick={() => setSelected(r.visitor_id)}>
                                <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{r.visitor_id.slice(0, 12)}…</td>
                                <td className="px-3 py-2 text-xs text-slate-600">
                                    <span aria-hidden className="mr-1">{countryFlag(r.country)}</span>
                                    {r.city || r.country || '—'}
                                </td>
                                <td className="px-3 py-2 text-xs">{r.channel}</td>
                                <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[160px]">{r.campaign || '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-xs">{r.sessions}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-500">{r.pageviews}</td>
                                <td className="px-3 py-2 text-center text-xs">
                                    {r.leadId ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Lead</span> : <span className="text-slate-300">—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {drill && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between sticky top-0 bg-white">
                            <div>
                                <h3 className="font-semibold text-slate-900 text-sm">Ziyaretçi Yolculuğu</h3>
                                <p className="font-mono text-[11px] text-slate-500 mt-0.5">{drill.visitor.visitor_id}</p>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <DataPoint label="Oturum" value={drill.visitor.sessions} />
                                <DataPoint label="Sayfa" value={drill.visitor.pageviews} />
                                <DataPoint label="Konum" value={(drill.visitor.city || drill.visitor.country || '—')} />
                                <DataPoint label="Lead" value={drill.lead ? '✓' : '—'} />
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold text-slate-700 mb-2">Oturum Geçmişi</h4>
                                <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-60 overflow-y-auto">
                                    {drill.sessions.map((s, i) => (
                                        <div key={s.id} className="px-3 py-2 text-xs flex items-center gap-3">
                                            <span className="text-slate-400 font-mono w-4">#{i + 1}</span>
                                            <span className="text-slate-700 tabular-nums">{new Date(s.started_at).toLocaleString('tr-TR')}</span>
                                            <span className="text-slate-500 truncate">{s.landing_path}</span>
                                            <span className="ml-auto text-[10px] text-slate-400">{classifyChannel(s).channel}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold text-slate-700 mb-2">Sayfa Gezisi</h4>
                                <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-60 overflow-y-auto">
                                    {drill.pageviews.slice(0, 100).map(p => (
                                        <div key={p.id} className="px-3 py-1.5 text-xs flex items-center gap-3">
                                            <span className="text-slate-400 tabular-nums">{new Date(p.created_at).toLocaleTimeString('tr-TR')}</span>
                                            <span className="font-mono text-slate-700 truncate">{p.path}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </SectionShell>
    );
};

const DataPoint: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="bg-slate-50 rounded-lg p-3">
        <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">{label}</p>
        <p className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">{value}</p>
    </div>
);
