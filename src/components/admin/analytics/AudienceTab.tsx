import React from 'react';
import { Globe2, Smartphone, Laptop, Monitor, Compass } from 'lucide-react';
import { SectionShell } from './SectionShell';
import { countryFlag } from '../../../utils/geoFormat';
import type { GeoAggregate, BreakdownRow, SessionRow } from '../../../services/admin/siteAnalyticsService';

interface AudienceTabProps {
    geo: GeoAggregate[];
    deviceRows: BreakdownRow[];
    browserRows: BreakdownRow[];
    osRows: BreakdownRow[];
    sessions: SessionRow[];
    loading: boolean;
}

export const AudienceTab: React.FC<AudienceTabProps> = ({ geo, deviceRows, browserRows, osRows, sessions, loading }) => {
    return (
        <div className="space-y-4">
            <GeoPanel rows={geo} loading={loading} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <BreakdownPanel title="Cihaz" icon={Smartphone} rows={deviceRows} accent="bg-cyan-500" loading={loading} />
                <BreakdownPanel title="Tarayıcı" icon={Compass} rows={browserRows} accent="bg-violet-500" loading={loading} />
                <BreakdownPanel title="İşletim Sistemi" icon={Monitor} rows={osRows} accent="bg-emerald-500" loading={loading} />
            </div>
            <MobileVsDesktop sessions={sessions} loading={loading} />
        </div>
    );
};

const GeoPanel: React.FC<{ rows: GeoAggregate[]; loading: boolean }> = ({ rows, loading }) => {
    return (
        <SectionShell
            title="Coğrafi Dağılım"
            icon={Globe2}
            description="Ülke + şehir bazında oturum, ziyaretçi, lead ve dönüşüm. Şehir; Cloudflare CDN + ipinfo + ipapi + ip-api oylamasıyla hesaplanır. Boş hücre = hiçbir provider eşleşmedi (genelde VPN/proxy)."
            loading={loading}
            empty={rows.length === 0}
        >
            <div className="overflow-x-auto max-h-[420px]">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
                        <tr>
                            <th className="text-left px-3 py-2 font-semibold">Konum</th>
                            <th className="text-right px-3 py-2 font-semibold">Ziyaretçi</th>
                            <th className="text-right px-3 py-2 font-semibold">Oturum</th>
                            <th className="text-right px-3 py-2 font-semibold">Lead</th>
                            <th className="text-right px-3 py-2 font-semibold">CVR</th>
                            <th className="text-left px-3 py-2 font-semibold">Geo Kaynak</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.slice(0, 50).map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 text-slate-800 flex items-center gap-1.5">
                                    <span aria-hidden>{countryFlag(r.country)}</span>
                                    {(() => {
                                        // Mobile carrier IPs intentionally have city=null (the
                                        // honest answer for TR mobile backbone routing). Show
                                        // a carrier badge instead of "Bilinmeyen şehir".
                                        const mobileMatch = (r.geoProvider || '').match(/^mobile:(.+)$/);
                                        if (mobileMatch) {
                                            const carrier = mobileMatch[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                            return (
                                                <>
                                                    <span className="text-slate-600">Mobil</span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">{carrier}</span>
                                                    {r.country && <span className="text-slate-400">, {r.country}</span>}
                                                </>
                                            );
                                        }
                                        if (r.city) return <>{r.city}{r.country ? `, ${r.country}` : ''}</>;
                                        if (r.country) return <span className="italic text-slate-400">Bilinmeyen şehir, {r.country}</span>;
                                        return <span className="italic text-slate-400">Bilinmeyen konum</span>;
                                    })()}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">{r.visitors}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.sessions}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-amber-600 font-semibold">{r.leads}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-rose-600">%{r.cvr.toFixed(1)}</td>
                                <td className="px-3 py-2 text-[10px]">
                                    {r.geoProvider ? (
                                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">{r.geoProvider}</span>
                                    ) : (
                                        <span className="text-slate-300">—</span>
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

const BreakdownPanel: React.FC<{ title: string; icon: any; rows: BreakdownRow[]; accent: string; loading: boolean }> = ({ title, icon: Icon, rows, accent, loading }) => {
    const total = rows.reduce((s, r) => s + r.value, 0);
    return (
        <SectionShell title={title} icon={Icon} loading={loading} empty={rows.length === 0}>
            <ul className="space-y-2.5">
                {rows.slice(0, 8).map((r, i) => {
                    const pct = total > 0 ? (r.value / total) * 100 : 0;
                    return (
                        <li key={i}>
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-slate-700 font-medium truncate">{r.label}</span>
                                <span className="text-slate-500 tabular-nums">{r.value} (%{pct.toFixed(0)})</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${accent} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                        </li>
                    );
                })}
            </ul>
        </SectionShell>
    );
};

const MobileVsDesktop: React.FC<{ sessions: SessionRow[]; loading: boolean }> = ({ sessions, loading }) => {
    const mobile = sessions.filter(s => s.device_type === 'mobile');
    const desktop = sessions.filter(s => s.device_type === 'desktop');
    const avgPv = (arr: SessionRow[]) => arr.length === 0 ? 0 : arr.reduce((s, x) => s + (x.pageviews || 0), 0) / arr.length;

    return (
        <SectionShell title="Mobil vs Masaüstü" icon={Laptop} loading={loading} empty={sessions.length === 0}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Tile label="Mobil" Icon={Smartphone} count={mobile.length} avgPv={avgPv(mobile)} share={mobile.length / Math.max(1, sessions.length) * 100} color="cyan" />
                <Tile label="Masaüstü" Icon={Laptop} count={desktop.length} avgPv={avgPv(desktop)} share={desktop.length / Math.max(1, sessions.length) * 100} color="indigo" />
            </div>
        </SectionShell>
    );
};

const Tile: React.FC<{ label: string; Icon: any; count: number; avgPv: number; share: number; color: string }> = ({ label, Icon, count, avgPv, share, color }) => {
    const bg = color === 'cyan' ? 'bg-cyan-50' : 'bg-indigo-50';
    const text = color === 'cyan' ? 'text-cyan-600' : 'text-indigo-600';
    return (
        <div className="p-4 border border-slate-200 rounded-lg flex items-start gap-4">
            <div className={`w-11 h-11 rounded-lg ${bg} flex items-center justify-center ${text}`}>
                <Icon size={20} />
            </div>
            <div className="flex-1">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{count}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>Pay: <span className="text-slate-700 font-semibold">%{share.toFixed(0)}</span></span>
                    <span>Avg. PV: <span className="text-slate-700 font-semibold">{avgPv.toFixed(1)}</span></span>
                </div>
            </div>
        </div>
    );
};
