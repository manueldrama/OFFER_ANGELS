import React, { useEffect, useMemo, useState } from 'react';
import { Bug, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../lib/supabase/client';
import { tzHour, tzDateKey } from '../../../utils/turkeyTime';
import { readPvDiagnostics, type PvDiagnostics } from '../../../services/analyticsService';
import type { PageviewRow, SessionRow } from '../../../services/admin/siteAnalyticsService';
import type { Range } from './AnalyticsHeader';

interface Props {
    range: Range;
    bounds: { startISO: string; endISO: string };
    pageviews: PageviewRow[];
    sessions: SessionRow[];
}

const RANGE_LABEL: Record<Range, string> = {
    today: 'Bugün',
    '7d': 'Son 7 Gün',
    '30d': 'Son 30 Gün',
    '90d': 'Son 90 Gün',
};

const META_TZ_OPTIONS: { value: string; label: string; offsetHours: number }[] = [
    { value: 'Europe/Istanbul', label: 'Europe/Istanbul (UTC+3)', offsetHours: 3 },
    { value: 'UTC', label: 'UTC', offsetHours: 0 },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)', offsetHours: -8 },
    { value: 'America/New_York', label: 'America/New_York (EST/EDT)', offsetHours: -5 },
];

function formatIstanbulWallClock(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const fmt = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
    return fmt.format(d);
}

function diffHours(startISO: string, endISO: string): string {
    const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
    const hours = ms / 3_600_000;
    return hours < 24 ? `${hours.toFixed(1)} saat` : `${(hours / 24).toFixed(1)} gün`;
}

export const AttributionDebugPanel: React.FC<Props> = ({ range, bounds, pageviews, sessions }) => {
    const [open, setOpen] = useState(false);
    const [rawCount, setRawCount] = useState<number | null>(null);
    const [rawCountLoading, setRawCountLoading] = useState(false);
    const [rawCountError, setRawCountError] = useState<string | null>(null);
    const [metaTz, setMetaTz] = useState<string>('Europe/Istanbul');
    const [diag, setDiag] = useState<PvDiagnostics>({ attempts: 0, success: 0, skips: [] });

    const fetchRawCount = async () => {
        setRawCountLoading(true);
        setRawCountError(null);
        try {
            const { count, error } = await supabase
                .from('pageviews')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', bounds.startISO)
                .lte('created_at', bounds.endISO);
            if (error) {
                setRawCountError(error.message);
                setRawCount(null);
            } else {
                setRawCount(count ?? 0);
            }
        } catch (err: any) {
            setRawCountError(err?.message || 'fetch error');
        } finally {
            setRawCountLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            void fetchRawCount();
            setDiag(readPvDiagnostics());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, bounds.startISO, bounds.endISO]);

    // ─── Hourly histogram (Istanbul TZ) ─────────────────────────────────
    const hourly = useMemo(() => {
        const buckets = Array.from({ length: 24 }, () => 0);
        for (const pv of pageviews) buckets[tzHour(pv.created_at)] += 1;
        const max = Math.max(1, ...buckets);
        return { buckets, max };
    }, [pageviews]);

    // ─── Daily breakdown (Istanbul TZ) — only for 7d+ ──────────────────
    const daily = useMemo(() => {
        if (range === 'today') return null;
        const map = new Map<string, number>();
        for (const pv of pageviews) {
            const k = tzDateKey(pv.created_at);
            map.set(k, (map.get(k) || 0) + 1);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [pageviews, range]);

    // ─── Source breakdown — link pageviews to sessions via session_id ──
    const sourceBreakdown = useMemo(() => {
        const sessById = new Map<string, SessionRow>();
        for (const s of sessions) sessById.set(s.id, s);

        const counts = {
            meta_paid: 0,
            google_paid: 0,
            other_paid: 0,
            organic_or_direct: 0,
            untracked: 0,
        };
        for (const pv of pageviews) {
            const sess = sessById.get(pv.session_id);
            if (!sess) { counts.untracked += 1; continue; }
            const src = (sess.utm_source || '').toLowerCase();
            const med = (sess.utm_medium || '').toLowerCase();
            const isPaid = med === 'cpc' || med === 'paid' || med === 'ppc' || med === 'paidsocial' || med === 'paid_social';
            const hasFbclid = !!sess.fbclid;
            const hasGclid = !!sess.gclid;
            if (hasFbclid || /facebook|instagram|meta|fb/.test(src)) counts.meta_paid += 1;
            else if (hasGclid || /google/.test(src) && isPaid) counts.google_paid += 1;
            else if (isPaid) counts.other_paid += 1;
            else counts.organic_or_direct += 1;
        }
        return counts;
    }, [pageviews, sessions]);

    // ─── Meta TZ window shift ──────────────────────────────────────────
    const metaTzInfo = useMemo(() => {
        const opt = META_TZ_OPTIONS.find(o => o.value === metaTz);
        const offsetHours = opt?.offsetHours ?? 3;
        const shift = 3 - offsetHours; // bizim Istanbul (UTC+3) vs Meta TZ offset farkı
        if (metaTz === 'Europe/Istanbul') {
            return { shift: 0, msg: 'Pencere kayması yok — bizim ve Meta\'nın "bugün"ü birebir aynı.' };
        }
        return {
            shift,
            msg: `Meta'nın "bugün"ü, bizim penceremize göre ${Math.abs(shift)} saat ${shift > 0 ? 'geç' : 'erken'} başlıyor.`,
        };
    }, [metaTz]);

    const adjustedBounds = useMemo(() => {
        if (metaTzInfo.shift === 0) return null;
        const startAdj = new Date(new Date(bounds.startISO).getTime() + metaTzInfo.shift * 3_600_000);
        const endAdj = new Date(new Date(bounds.endISO).getTime() + metaTzInfo.shift * 3_600_000);
        return {
            startISO: startAdj.toISOString(),
            endISO: endAdj.toISOString(),
        };
    }, [metaTzInfo.shift, bounds.startISO, bounds.endISO]);

    const successRate = diag.attempts > 0 ? (diag.success / diag.attempts) * 100 : null;

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-3 text-left"
            >
                <div className="flex items-center gap-2">
                    <Bug size={14} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">Debug · Tanı paneli</span>
                    <span className="text-[11px] text-slate-500">
                        {RANGE_LABEL[range]} · Meta uyumu / tracking coverage
                    </span>
                </div>
                {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 pt-1 space-y-5">

                            {/* ─── Bounds card ─────────────────────────── */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Sorgu penceresi</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <div className="text-slate-500">Başlangıç (UTC)</div>
                                        <div className="font-mono text-slate-800">{bounds.startISO}</div>
                                        <div className="text-slate-500 mt-1">Istanbul wall-clock</div>
                                        <div className="text-slate-800">{formatIstanbulWallClock(bounds.startISO)}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500">Bitiş (UTC)</div>
                                        <div className="font-mono text-slate-800">{bounds.endISO}</div>
                                        <div className="text-slate-500 mt-1">Istanbul wall-clock</div>
                                        <div className="text-slate-800">{formatIstanbulWallClock(bounds.endISO)}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">
                                    Pencere uzunluğu: <span className="text-slate-800 font-medium">{diffHours(bounds.startISO, bounds.endISO)}</span>
                                </div>
                            </div>

                            {/* ─── Raw count card ──────────────────────── */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Ham pageview sayımı (DB)</div>
                                    <button
                                        onClick={fetchRawCount}
                                        disabled={rawCountLoading}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        <RefreshCw size={11} className={rawCountLoading ? 'animate-spin' : ''} />
                                        Yenile
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-slate-500 text-xs">Bağımsız DB sayımı</div>
                                        <div className="text-2xl font-bold text-slate-900">
                                            {rawCountLoading ? '…' : rawCountError ? 'Hata' : (rawCount ?? '—')}
                                        </div>
                                        {rawCountError && <div className="text-[10px] text-red-500">{rawCountError}</div>}
                                    </div>
                                    <div>
                                        <div className="text-slate-500 text-xs">Frontend hesabı</div>
                                        <div className="text-2xl font-bold text-slate-900">{pageviews.length}</div>
                                        {rawCount !== null && rawCount !== pageviews.length && (
                                            <div className="text-[10px] text-amber-600 mt-0.5">
                                                Fark: {Math.abs((rawCount || 0) - pageviews.length)} (limit/cache)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ─── Hourly histogram ───────────────────── */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-3">Saatlik dağılım (Europe/Istanbul)</div>
                                <div className="grid grid-cols-24 gap-px items-end h-24" style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)' }}>
                                    {hourly.buckets.map((c, h) => (
                                        <div key={h} className="flex flex-col items-center justify-end h-full" title={`${h.toString().padStart(2, '0')}:00 — ${c} pv`}>
                                            <div
                                                className="w-full bg-indigo-500 rounded-t"
                                                style={{ height: `${(c / hourly.max) * 100}%`, minHeight: c > 0 ? '2px' : '0' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                                    <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
                                </div>
                            </div>

                            {/* ─── Daily breakdown (only multi-day) ────── */}
                            {daily && daily.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Günlük dağılım (Europe/Istanbul)</div>
                                    <div className="space-y-1 text-xs font-mono">
                                        {daily.map(([day, count]) => (
                                            <div key={day} className="flex justify-between">
                                                <span className="text-slate-600">{day}</span>
                                                <span className="text-slate-900 font-semibold">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ─── Source breakdown ────────────────────── */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Kaynak dağılımı (session attribution)</div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                                    <div>
                                        <div className="text-slate-500">Meta paid (fbclid+)</div>
                                        <div className="text-lg font-bold text-slate-900">{sourceBreakdown.meta_paid}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500">Google paid</div>
                                        <div className="text-lg font-bold text-slate-900">{sourceBreakdown.google_paid}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500">Diğer paid</div>
                                        <div className="text-lg font-bold text-slate-900">{sourceBreakdown.other_paid}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500">Organic / direct</div>
                                        <div className="text-lg font-bold text-slate-900">{sourceBreakdown.organic_or_direct}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500">Untracked session</div>
                                        <div className="text-lg font-bold text-amber-600">{sourceBreakdown.untracked}</div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2">
                                    Meta paid satırı, Meta Ads Manager raporundaki "Landing page views" ile karşılaştırılmalı.
                                </p>
                            </div>

                            {/* ─── Meta TZ comparison ──────────────────── */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Meta TZ karşılaştırması</div>
                                <div className="flex items-center gap-3">
                                    <label className="text-xs text-slate-600">Meta hesap TZ:</label>
                                    <select
                                        value={metaTz}
                                        onChange={(e) => setMetaTz(e.target.value)}
                                        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                                    >
                                        {META_TZ_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-slate-600">{metaTzInfo.msg}</p>
                                {adjustedBounds && (
                                    <div className="text-[11px] text-slate-500 bg-slate-50 rounded p-2 font-mono">
                                        <div>Meta'nın penceresi (UTC):</div>
                                        <div>start: {adjustedBounds.startISO}</div>
                                        <div>end:   {adjustedBounds.endISO}</div>
                                    </div>
                                )}
                            </div>

                            {/* ─── Tracking coverage ───────────────────── */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
                                    Tracking coverage (sadece bu admin oturumu)
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-xs">
                                    <div>
                                        <div className="text-slate-500">Denenen pageview</div>
                                        <div className="text-lg font-bold text-slate-900">{diag.attempts}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500">Başarılı insert</div>
                                        <div className="text-lg font-bold text-slate-900">{diag.success}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500">Başarı oranı</div>
                                        <div className="text-lg font-bold text-slate-900">
                                            {successRate === null ? '—' : `%${successRate.toFixed(0)}`}
                                        </div>
                                    </div>
                                </div>
                                {diag.skips.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                        <div className="text-[11px] text-slate-500 mb-1">Son skip sebepleri:</div>
                                        <div className="space-y-0.5 text-[11px] font-mono">
                                            {diag.skips.slice().reverse().map((s, i) => (
                                                <div key={i} className="flex justify-between">
                                                    <span className="text-amber-600">{s.reason}</span>
                                                    <span className="text-slate-400">{new Date(s.at).toLocaleTimeString('tr-TR')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <p className="text-[10px] text-slate-400 mt-2">
                                    Not: Bu sayaç sadece <strong>senin bu sekmedeki gezintini</strong> ölçer (sessionStorage). Tüm ziyaretçi coverage'ı ölçmek için, beklenen Meta tıklama × dönüşüm oranıyla karşılaştır.
                                </p>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
