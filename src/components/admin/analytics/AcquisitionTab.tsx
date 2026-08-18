import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Megaphone, Target as TargetIcon, GitBranch, Sparkles, PlayCircle, MapPin } from 'lucide-react';
import { SectionShell } from './SectionShell';
import { InfoHint } from './InfoHint';
import { AdSessionsDrawer } from './AdSessionsDrawer';
import {
    CHANNEL_COLORS,
    classifyChannel,
    type ChannelAggregate,
    type CampaignAggregate,
    type AdAggregate,
    type SourceMediumCell,
    type LeadAttributionRow,
    type SessionRow,
} from '../../../services/admin/siteAnalyticsService';
import { useClarityProjectId, clarityForUtmContent, clarityForCampaign } from '../../../lib/clarityLinks';

interface AcquisitionTabProps {
    channels: ChannelAggregate[];
    campaigns: CampaignAggregate[];
    ads: AdAggregate[];
    sourceMedium: SourceMediumCell[];
    leads: LeadAttributionRow[];
    sessions: SessionRow[];
    loading: boolean;
}

type DrillTarget =
    | { kind: 'ad'; ad: AdAggregate }
    | { kind: 'campaign'; campaign: CampaignAggregate }
    | null;

export const AcquisitionTab: React.FC<AcquisitionTabProps> = ({ channels, campaigns, ads, sourceMedium, leads, sessions, loading }) => {
    const [drill, setDrill] = useState<DrillTarget>(null);
    const clarityProjectId = useClarityProjectId();

    const drawerProps = useMemo(() => {
        if (!drill) return null;
        if (drill.kind === 'ad') {
            const a = drill.ad;
            return {
                title: `${a.platform} • ${a.content}`,
                subtitle: `${a.sessions} oturum • ${a.leads} lead`,
                groupClarityUrl: clarityProjectId && a.content !== '—'
                    ? clarityForUtmContent(clarityProjectId, a.content)
                    : undefined,
                sessionIds: a.sessionIds,
            };
        }
        const c = drill.campaign;
        return {
            title: c.campaign,
            subtitle: `${c.source ?? '—'}/${c.medium ?? '—'} • ${c.sessions} oturum • ${c.leads} lead`,
            groupClarityUrl: clarityProjectId
                ? clarityForCampaign(clarityProjectId, c.campaign)
                : undefined,
            sessionIds: c.sessionIds,
        };
    }, [drill, clarityProjectId]);

    return (
        <div className="space-y-4">
            <ChannelPerformanceCard channels={channels} loading={loading} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CampaignTable
                    rows={campaigns}
                    loading={loading}
                    clarityProjectId={clarityProjectId}
                    onRowClick={c => setDrill({ kind: 'campaign', campaign: c })}
                />
                <AdLevelTable
                    rows={ads}
                    loading={loading}
                    clarityProjectId={clarityProjectId}
                    onRowClick={a => setDrill({ kind: 'ad', ad: a })}
                />
            </div>
            <AttributionComparison leads={leads} loading={loading} />
            <SourceMediumMatrix cells={sourceMedium} loading={loading} />

            {drawerProps && (
                <AdSessionsDrawer
                    title={drawerProps.title}
                    subtitle={drawerProps.subtitle}
                    groupClarityUrl={drawerProps.groupClarityUrl}
                    sessionIds={drawerProps.sessionIds}
                    allSessions={sessions}
                    allLeads={leads}
                    onClose={() => setDrill(null)}
                />
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────

const ChannelPerformanceCard: React.FC<{ channels: ChannelAggregate[]; loading: boolean }> = ({ channels, loading }) => {
    const chartData = channels.map(c => ({
        channel: c.channel,
        sessions: c.sessions,
        leads: c.leadsLastTouch,
        cvr: c.cvr,
    }));
    return (
        <SectionShell
            title="Kanal Performansı"
            icon={Megaphone}
            description="Reklamlı, organik, referral ve direkt trafik kaynaklarının ziyaretçi → lead dönüşümü."
            loading={loading}
            empty={channels.length === 0}
            emptyText="Henüz kanal verisi yok."
        >
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="channel" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                            <Bar yAxisId="left" dataKey="sessions" name="Oturum" radius={[3, 3, 0, 0]}>
                                {chartData.map((d, i) => (
                                    <Cell key={i} fill={CHANNEL_COLORS[d.channel as keyof typeof CHANNEL_COLORS] || '#94a3b8'} />
                                ))}
                            </Bar>
                            <Bar yAxisId="left" dataKey="leads" name="Lead" fill="#0f172a" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="lg:col-span-2 overflow-y-auto max-h-72">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
                            <tr>
                                <th className="text-left px-3 py-2 font-semibold">Kanal</th>
                                <th className="text-right px-3 py-2 font-semibold">
                                    <span className="inline-flex items-center gap-1 justify-end">Oturum <InfoHint text="Bir ziyaretçinin 30 dakika içindeki kesintisiz seansı. Aynı kişi 2 saat sonra dönerse 2. oturum sayılır. 'Ziyaretçi' = unique kişi, 'Oturum' = o kişinin kaç defa geldiği." /></span>
                                </th>
                                <th className="text-right px-3 py-2 font-semibold">
                                    <span className="inline-flex items-center gap-1 justify-end">Lead <InfoHint text="Form veya WhatsApp ile iletişime geçen kişi sayısı." /></span>
                                </th>
                                <th className="text-right px-3 py-2 font-semibold">
                                    <span className="inline-flex items-center gap-1 justify-end">CVR <InfoHint text="Conversion Rate = Lead ÷ Oturum × 100. Kanalın 'satış üretme' verimi." /></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {channels.map((c, i) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-1.5 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ background: CHANNEL_COLORS[c.channel] || '#94a3b8' }} />
                                        <span className="text-slate-800 text-xs font-medium">{c.channel}</span>
                                    </td>
                                    <td className="px-3 py-1.5 text-right tabular-nums text-xs">{c.sessions}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums text-amber-600 text-xs font-semibold">{c.leadsLastTouch}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums text-xs text-rose-600">%{c.cvr.toFixed(1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </SectionShell>
    );
};

interface CampaignTableProps {
    rows: CampaignAggregate[];
    loading: boolean;
    clarityProjectId?: string;
    onRowClick: (c: CampaignAggregate) => void;
}

const CampaignTable: React.FC<CampaignTableProps> = ({ rows, loading, clarityProjectId, onRowClick }) => {
    return (
        <SectionShell
            title="Kampanya Performansı"
            icon={TargetIcon}
            description="UTM kampanyası bazında oturum, last-touch lead, first-touch lead ve dönüşüm. Satıra tıkla → tüm oturumları gör."
            loading={loading}
            empty={rows.length === 0}
            emptyText="Henüz UTM kampanyası yok."
        >
            <div className="overflow-x-auto max-h-80">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
                        <tr>
                            <th className="text-left px-3 py-2 font-semibold">Kampanya</th>
                            <th className="text-left px-3 py-2 font-semibold">Kaynak</th>
                            <th className="text-left px-3 py-2 font-semibold">
                                <span className="inline-flex items-center gap-1">Şehir <InfoHint text="Bu kampanyadan gelen oturumların en sık 3 şehri. 'Bilinmiyor' = geo provider eşleşmedi (genelde VPN/proxy)." /></span>
                            </th>
                            <th className="text-right px-3 py-2 font-semibold">
                                <span className="inline-flex items-center gap-1 justify-end">Oturum <InfoHint text="Bu kampanyaya gelen toplam seans sayısı." /></span>
                            </th>
                            <th className="text-right px-3 py-2 font-semibold">
                                <span className="inline-flex items-center gap-1 justify-end">L-Lead <InfoHint text="Last-touch lead: Lead'in son tıkladığı reklam/kanal. Direkt satış katkısı." /></span>
                            </th>
                            <th className="text-right px-3 py-2 font-semibold">
                                <span className="inline-flex items-center gap-1 justify-end">F-Lead <InfoHint text="First-touch lead: Lead'i siteye ilk getiren reklam/kanal. Brand-build için kritik." /></span>
                            </th>
                            <th className="text-right px-3 py-2 font-semibold">
                                <span className="inline-flex items-center gap-1 justify-end">CVR <InfoHint text="Conversion Rate = Lead ÷ Oturum × 100." /></span>
                            </th>
                            <th className="text-right px-3 py-2 font-semibold w-8" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.slice(0, 30).map((c, i) => (
                            <tr
                                key={i}
                                className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                                onClick={() => onRowClick(c)}
                                title="Tıkla: bu kampanyadan gelen oturumların tam listesini aç"
                            >
                                <td className="px-3 py-2 text-slate-800 font-medium truncate max-w-[180px]" title={c.campaign}>{c.campaign}</td>
                                <td className="px-3 py-2 text-slate-500 text-xs">{c.source ? `${c.source}/${c.medium ?? ''}` : '—'}</td>
                                <td className="px-3 py-2"><TopCitiesCell cities={c.topCities} /></td>
                                <td className="px-3 py-2 text-right tabular-nums text-xs">{c.sessions}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-amber-600 font-semibold text-xs">{c.leads}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-500 text-xs">{c.firstTouchLeads}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-rose-600 text-xs">%{c.cvr.toFixed(1)}</td>
                                <td className="px-2 py-2 text-right">
                                    {clarityProjectId && (
                                        <a
                                            href={clarityForCampaign(clarityProjectId, c.campaign)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="inline-flex items-center justify-center w-6 h-6 rounded text-indigo-600 hover:bg-indigo-100 transition-colors"
                                            title="Bu kampanyanın Clarity session replay'lerini aç"
                                        >
                                            <PlayCircle size={13} />
                                        </a>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </SectionShell>
    );
};

interface AdLevelTableProps {
    rows: AdAggregate[];
    loading: boolean;
    clarityProjectId?: string;
    onRowClick: (a: AdAggregate) => void;
}

const AdLevelTable: React.FC<AdLevelTableProps> = ({ rows, loading, clarityProjectId, onRowClick }) => {
    return (
        <SectionShell
            title="Reklam Bazlı Performans"
            icon={Sparkles}
            description="fbclid/gclid taşıyan oturumlar utm_content'e göre gruplandı. Satıra tıkla → şehir/cihaz/zaman detayı; 🎬 = Clarity replay."
            loading={loading}
            empty={rows.length === 0}
            emptyText="Henüz reklam tıklaması yok. URL'lere fbclid/gclid + utm_content ekleyince burada görünürler."
        >
            <div className="overflow-x-auto max-h-80">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
                        <tr>
                            <th className="text-left px-3 py-2 font-semibold">Platform</th>
                            <th className="text-left px-3 py-2 font-semibold">Reklam (utm_content)</th>
                            <th className="text-left px-3 py-2 font-semibold">
                                <span className="inline-flex items-center gap-1">Şehir <InfoHint text="Bu reklamdan gelen oturumların en sık 3 şehri. 'Bilinmiyor' = geo provider eşleşmedi." /></span>
                            </th>
                            <th className="text-right px-3 py-2 font-semibold">
                                <span className="inline-flex items-center gap-1 justify-end">Oturum <InfoHint text="Bu reklamı tıklayıp siteye gelen toplam seans." /></span>
                            </th>
                            <th className="text-right px-3 py-2 font-semibold">
                                <span className="inline-flex items-center gap-1 justify-end">Lead <InfoHint text="Bu reklamdan gelip form/WhatsApp dolduran." /></span>
                            </th>
                            <th className="text-right px-3 py-2 font-semibold">
                                <span className="inline-flex items-center gap-1 justify-end">CVR <InfoHint text="Lead ÷ Oturum × 100. Reklam yaratıcısının verimi." /></span>
                            </th>
                            <th className="text-right px-3 py-2 font-semibold w-8" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.slice(0, 30).map((a, i) => (
                            <tr
                                key={i}
                                className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                                onClick={() => onRowClick(a)}
                                title="Tıkla: bu reklamdan gelen oturumların tam listesini aç"
                            >
                                <td className="px-3 py-2">
                                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${a.platform === 'Meta' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                        {a.platform}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-slate-800 truncate max-w-[180px]" title={a.content}>{a.content}</td>
                                <td className="px-3 py-2"><TopCitiesCell cities={a.topCities} /></td>
                                <td className="px-3 py-2 text-right tabular-nums text-xs">{a.sessions}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-amber-600 font-semibold text-xs">{a.leads}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-rose-600 text-xs">%{a.cvr.toFixed(1)}</td>
                                <td className="px-2 py-2 text-right">
                                    {clarityProjectId && a.content !== '—' && (
                                        <a
                                            href={clarityForUtmContent(clarityProjectId, a.content)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="inline-flex items-center justify-center w-6 h-6 rounded text-indigo-600 hover:bg-indigo-100 transition-colors"
                                            title="Bu reklamın Clarity session replay'lerini aç"
                                        >
                                            <PlayCircle size={13} />
                                        </a>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </SectionShell>
    );
};

const TopCitiesCell: React.FC<{ cities: Array<{ city: string; count: number }> }> = ({ cities }) => {
    if (cities.length === 0) {
        return <span className="text-[10px] text-slate-300 italic">—</span>;
    }
    const full = cities.map(c => `${c.city} (${c.count})`).join(', ');
    const allUnknown = cities.every(c => c.city === 'Bilinmiyor');
    return (
        <div className="flex items-center gap-1 text-[10px] text-slate-600" title={full}>
            <MapPin size={10} className={allUnknown ? 'text-slate-300' : 'text-slate-400'} />
            <span className={`truncate max-w-[120px] ${allUnknown ? 'text-slate-400 italic' : ''}`}>{full}</span>
        </div>
    );
};

const AttributionComparison: React.FC<{ leads: LeadAttributionRow[]; loading: boolean }> = ({ leads, loading }) => {
    const { firstTouch, lastTouch } = useMemo(() => {
        const ft = new Map<string, number>();
        const lt = new Map<string, number>();
        for (const l of leads) {
            const f = classifyChannel({
                utm_source: l.first_utm_source, utm_medium: l.first_utm_medium, utm_campaign: l.first_utm_campaign,
                fbclid: l.first_fbclid, gclid: l.first_gclid, referrer: null,
            }).channel;
            const last = classifyChannel({
                utm_source: l.utm_source, utm_medium: l.utm_medium, utm_campaign: l.utm_campaign,
                fbclid: l.fbclid, gclid: l.gclid, referrer: null,
            }).channel;
            ft.set(f, (ft.get(f) || 0) + 1);
            lt.set(last, (lt.get(last) || 0) + 1);
        }
        const toArr = (m: Map<string, number>) => Array.from(m.entries()).map(([name, value]) => ({ name, value }));
        return { firstTouch: toArr(ft), lastTouch: toArr(lt) };
    }, [leads]);

    return (
        <SectionShell
            title="First-Touch vs Last-Touch Atribüsyon"
            icon={GitBranch}
            description="İlk dokunuş = müşteriyi ilk getiren kaynak; son dokunuş = lead'e dönüştüğü kaynak."
            loading={loading}
            empty={leads.length === 0}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AttributionPie title="İlk Dokunuş" data={firstTouch} />
                <AttributionPie title="Son Dokunuş" data={lastTouch} />
            </div>
        </SectionShell>
    );
};

const AttributionPie: React.FC<{ title: string; data: Array<{ name: string; value: number }> }> = ({ title, data }) => (
    <div>
        <p className="text-xs font-semibold text-slate-600 mb-2 text-center">{title}</p>
        <div className="h-64">
            {data.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Veri yok</div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                            label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                            {data.map((d, i) => (
                                <Cell key={i} fill={CHANNEL_COLORS[d.name as keyof typeof CHANNEL_COLORS] || '#94a3b8'} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </div>
    </div>
);

const SourceMediumMatrix: React.FC<{ cells: SourceMediumCell[]; loading: boolean }> = ({ cells, loading }) => {
    const sources = Array.from(new Set(cells.map(c => c.source))).slice(0, 10);
    const mediums = Array.from(new Set(cells.map(c => c.medium))).slice(0, 10);
    const max = Math.max(1, ...cells.map(c => c.sessions));
    const cellAt = (s: string, m: string) => cells.find(c => c.source === s && c.medium === m);

    return (
        <SectionShell
            title="Kaynak × Medium Matrisi"
            icon={GitBranch}
            description="Yoğunluk = oturum sayısı. Sayı = lead. UTM stratejinin haritası."
            loading={loading}
            empty={cells.length === 0}
        >
            <div className="overflow-x-auto">
                <table className="text-xs">
                    <thead>
                        <tr>
                            <th className="px-2 py-1.5 text-left text-slate-500 font-semibold sticky left-0 bg-white">source ╲ medium</th>
                            {mediums.map(m => (
                                <th key={m} className="px-2 py-1.5 text-left text-slate-500 font-semibold whitespace-nowrap">{m}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sources.map(s => (
                            <tr key={s}>
                                <td className="px-2 py-1 text-slate-700 font-medium sticky left-0 bg-white whitespace-nowrap">{s}</td>
                                {mediums.map(m => {
                                    const c = cellAt(s, m);
                                    if (!c) return <td key={m} className="px-2 py-1 text-slate-300">·</td>;
                                    const intensity = Math.min(1, c.sessions / max);
                                    return (
                                        <td key={m}
                                            className="px-2 py-1 text-center tabular-nums"
                                            title={`${c.sessions} oturum, ${c.leads} lead`}
                                            style={{ background: `rgba(99,102,241,${intensity * 0.45})`, color: intensity > 0.5 ? '#1e293b' : '#475569' }}
                                        >
                                            {c.leads > 0 ? <span className="font-semibold text-amber-700">{c.leads}</span> : c.sessions}
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
