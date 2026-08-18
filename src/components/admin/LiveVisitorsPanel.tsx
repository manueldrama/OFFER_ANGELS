import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Radio, Users, Eye, MousePointerClick } from 'lucide-react';
import { motion } from 'framer-motion';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { supabase } from '../../lib/supabase/client';
import { useAdminRealtime } from '../../hooks/useAdminRealtime';
import { countryFlag } from '../../utils/geoFormat';
import worldAtlas from '../../assets/world-atlas-110m.json';

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 30 * 1000;
// Fallback polling. Realtime fires only when `sessions`/`pageviews` are in the
// supabase_realtime publication — they currently aren't, so without this the
// panel never updates after mount and goes empty as old rows age out.
const POLL_INTERVAL_MS = 15 * 1000;

interface ActiveSession {
    id: string;
    visitor_id: string;
    country: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    ip_address: string | null;
    last_activity_at: string;
}

interface PageviewLite {
    session_id: string;
    visitor_id: string;
    created_at: string;
}

export function LiveVisitorsPanel() {
    const [sessions, setSessions] = useState<ActiveSession[]>([]);
    const [pageviewCount, setPageviewCount] = useState(0);
    const [, setNow] = useState(Date.now());
    const inFlight = useRef(false);

    const refetch = async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        try {
            const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();

            // Pageviews in the last 5 minutes tell us which sessions are truly
            // "active right now" — a session started 4 minutes ago but with no
            // recent pageview is effectively idle. We pull both and merge.
            const [sessionsRes, pvRes] = await Promise.all([
                supabase
                    .from('sessions')
                    .select('id, visitor_id, country, city, latitude, longitude, ip_address, started_at')
                    .gte('started_at', since)
                    .order('started_at', { ascending: false })
                    .limit(500),
                supabase
                    .from('pageviews')
                    .select('session_id, visitor_id, created_at')
                    .gte('created_at', since)
                    .order('created_at', { ascending: false })
                    .limit(2000),
            ]);

            const sessionRows = (sessionsRes.data || []) as Array<{
                id: string; visitor_id: string; country: string | null;
                city: string | null; latitude: number | null; longitude: number | null;
                ip_address: string | null; started_at: string;
            }>;
            const pvRows = (pvRes.data || []) as PageviewLite[];

            // Last activity per session = max(started_at, latest pageview).
            const latestPv = new Map<string, string>();
            for (const pv of pvRows) {
                const prev = latestPv.get(pv.session_id);
                if (!prev || pv.created_at > prev) latestPv.set(pv.session_id, pv.created_at);
            }

            const cutoff = Date.now() - ACTIVE_WINDOW_MS;
            const active: ActiveSession[] = [];
            for (const s of sessionRows) {
                const last = latestPv.get(s.id) || s.started_at;
                if (Date.parse(last) >= cutoff) {
                    active.push({
                        id: s.id,
                        visitor_id: s.visitor_id,
                        country: s.country,
                        city: s.city,
                        latitude: s.latitude,
                        longitude: s.longitude,
                        ip_address: s.ip_address,
                        last_activity_at: last,
                    });
                }
            }

            setSessions(active);
            setPageviewCount(pvRows.length);
        } finally {
            inFlight.current = false;
        }
    };

    useEffect(() => { refetch(); /* eslint-disable-next-line */ }, []);
    useAdminRealtime(['sessions', 'pageviews'], refetch, 1500);

    // Belt-and-suspenders: poll every 15s even if Realtime is wired up, because
    // the visitor-analytics tables are not always in the realtime publication
    // and we'd otherwise show stale data for minutes.
    useEffect(() => {
        const t = setInterval(() => { void refetch(); }, POLL_INTERVAL_MS);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sweep stale sessions out of view without waiting for the next realtime
    // event — otherwise the panel shows "still 3 visitors" long after they left.
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), SWEEP_INTERVAL_MS);
        return () => clearInterval(t);
    }, []);

    const visibleSessions = useMemo(() => {
        const cutoff = Date.now() - ACTIVE_WINDOW_MS;
        return sessions.filter(s => Date.parse(s.last_activity_at) >= cutoff);
    }, [sessions]);

    const uniqueVisitors = useMemo(
        () => new Set(visibleSessions.map(s => s.visitor_id)).size,
        [visibleSessions],
    );

    // Cluster sessions by rounded lat/lng so a thousand visitors in İstanbul
    // render as one growing dot rather than overlapping pixel soup.
    const markers = useMemo(() => {
        const m = new Map<string, { lat: number; lng: number; count: number; city: string | null; country: string | null }>();
        for (const s of visibleSessions) {
            if (s.latitude == null || s.longitude == null) continue;
            const key = `${s.latitude.toFixed(1)},${s.longitude.toFixed(1)}`;
            const existing = m.get(key);
            if (existing) existing.count += 1;
            else m.set(key, { lat: s.latitude, lng: s.longitude, count: 1, city: s.city, country: s.country });
        }
        return Array.from(m.values());
    }, [visibleSessions]);

    // Auto-fit: if all visitors are clustered in one region (typical for a
    // single-market product), zoom into that region instead of staring at an
    // empty world map. Falls back to the global view when there are no markers
    // or when markers are spread far apart.
    const mapView = useMemo(() => {
        if (markers.length === 0) return { center: [20, 20] as [number, number], zoom: 1 };
        const lats = markers.map(m => m.lat);
        const lngs = markers.map(m => m.lng);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
        const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
        const span = Math.max(maxLat - minLat, maxLng - minLng);
        // Heuristic: ~1° span → zoom 8x, ~10° → 3x, ~50° → 1x.
        let zoom = 1;
        if (span < 1) zoom = 8;
        else if (span < 5) zoom = 5;
        else if (span < 20) zoom = 3;
        else if (span < 60) zoom = 1.5;
        return { center, zoom };
    }, [markers]);

    const sessionRows = useMemo(() => {
        return [...visibleSessions].sort(
            (a, b) => Date.parse(b.last_activity_at) - Date.parse(a.last_activity_at),
        );
    }, [visibleSessions]);

    const cityList = useMemo(() => {
        const m = new Map<string, { city: string | null; country: string | null; count: number }>();
        for (const s of visibleSessions) {
            const key = `${s.country || '?'}|${s.city || '?'}`;
            const existing = m.get(key);
            if (existing) existing.count += 1;
            else m.set(key, { city: s.city, country: s.country, count: 1 });
        }
        return Array.from(m.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [visibleSessions]);

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    Anlık Ziyaretçiler
                </h2>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Son 5 dakika</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
                <LiveKpi icon={Users} label="Şu Anda Sitede" value={uniqueVisitors} accent="emerald" />
                <LiveKpi icon={MousePointerClick} label="Aktif Oturum" value={visibleSessions.length} accent="indigo" />
                <LiveKpi icon={Eye} label="Sayfa Görüntüleme" value={pageviewCount} accent="cyan" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 relative">
                    <div className="aspect-[2/1] w-full">
                        <ComposableMap
                            projection="geoEqualEarth"
                            projectionConfig={{ scale: 155 }}
                            style={{ width: '100%', height: '100%' }}
                        >
                            <ZoomableGroup
                                center={mapView.center}
                                zoom={mapView.zoom}
                                minZoom={1}
                                maxZoom={32}
                            >
                                <Geographies geography={worldAtlas as any}>
                                    {({ geographies }: any) =>
                                        geographies.map((geo: any) => (
                                            <Geography
                                                key={geo.rsmKey}
                                                geography={geo}
                                                style={{
                                                    default: { fill: '#e2e8f0', stroke: '#cbd5e1', strokeWidth: 0.4, outline: 'none' },
                                                    hover: { fill: '#cbd5e1', outline: 'none' },
                                                    pressed: { fill: '#94a3b8', outline: 'none' },
                                                }}
                                            />
                                        ))
                                    }
                                </Geographies>
                                {markers.map((mk, i) => {
                                    const baseR = Math.min(20, 6 + mk.count * 1.5);
                                    const r = baseR / Math.sqrt(mapView.zoom);
                                    return (
                                        <Marker key={i} coordinates={[mk.lng, mk.lat]}>
                                            <motion.circle
                                                r={r}
                                                initial={{ scale: 0.4, opacity: 0 }}
                                                animate={{ scale: [1, 1.15, 1], opacity: 0.6 }}
                                                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                                                fill="#6366f1"
                                                stroke="#ffffff"
                                                strokeWidth={1.5 / Math.sqrt(mapView.zoom)}
                                            />
                                            {mk.count > 1 && (
                                                <text
                                                    textAnchor="middle"
                                                    y={4 / Math.sqrt(mapView.zoom)}
                                                    style={{ fontSize: 10 / Math.sqrt(mapView.zoom), fontWeight: 700, fill: '#ffffff', pointerEvents: 'none' }}
                                                >
                                                    {mk.count}
                                                </text>
                                            )}
                                        </Marker>
                                    );
                                })}
                            </ZoomableGroup>
                        </ComposableMap>
                    </div>
                    <p className="absolute bottom-2 right-2 text-[10px] text-slate-500 bg-white/80 backdrop-blur px-2 py-0.5 rounded">
                        Sürükle • Mouse tekerleği ile yakınlaştır
                    </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold tracking-wider text-slate-500 mb-3">
                        <Radio size={12} /> Aktif Şehirler
                    </div>
                    {cityList.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-6 text-center">Şu an siteye bağlı kullanıcı yok.</p>
                    ) : (
                        <ul className="space-y-2">
                            {cityList.map((c, i) => (
                                <li key={i} className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-slate-700 truncate">
                                        <span aria-hidden>{countryFlag(c.country)}</span>
                                        <span className="truncate">
                                            {c.city || <span className="italic text-slate-400">Bilinmeyen</span>}
                                            {c.country ? <span className="text-slate-400 ml-1">{c.country}</span> : null}
                                        </span>
                                    </span>
                                    <span className="tabular-nums text-slate-900 font-semibold">{c.count}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {sessionRows.length > 0 && (
                <div className="mt-5 border border-slate-100 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold tracking-wider text-slate-500">
                            <Radio size={12} /> Canlı Oturumlar
                        </div>
                        <span className="text-[10px] text-slate-400 tabular-nums">{sessionRows.length} oturum</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white sticky top-0 z-10">
                                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                                    <th className="px-4 py-2 font-semibold">Konum</th>
                                    <th className="px-4 py-2 font-semibold">IP Adresi</th>
                                    <th className="px-4 py-2 font-semibold">Ziyaretçi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sessionRows.map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-2.5">
                                            <span className="flex items-center gap-1.5 text-slate-700">
                                                <span aria-hidden>{countryFlag(s.country)}</span>
                                                <span className="truncate">
                                                    {s.city || <span className="italic text-slate-400">Bilinmeyen şehir</span>}
                                                    {s.country ? <span className="text-slate-400 ml-1">{s.country}</span> : null}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600 tabular-nums">
                                            {s.ip_address || <span className="text-slate-300 italic">—</span>}
                                        </td>
                                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400">
                                            {s.visitor_id.slice(0, 8)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function LiveKpi({
    icon: Icon, label, value, accent,
}: {
    icon: any; label: string; value: number; accent: 'emerald' | 'indigo' | 'cyan';
}) {
    const bg = accent === 'emerald' ? 'bg-emerald-50' : accent === 'indigo' ? 'bg-indigo-50' : 'bg-cyan-50';
    const fg = accent === 'emerald' ? 'text-emerald-600' : accent === 'indigo' ? 'text-indigo-600' : 'text-cyan-600';
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${bg} ${fg} flex items-center justify-center`}>
                <Icon size={16} />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider truncate">{label}</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
            </div>
        </div>
    );
}
