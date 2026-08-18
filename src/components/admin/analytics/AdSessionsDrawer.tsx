import React, { useEffect, useMemo } from 'react';
import { X, MapPin, Smartphone, Monitor, Tablet, Globe, ExternalLink, PlayCircle, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { SessionRow, LeadAttributionRow } from '../../../services/admin/siteAnalyticsService';
import { useClarityProjectId, clarityForVisitor, clarityForLead } from '../../../lib/clarityLinks';

interface Props {
    title: string;
    subtitle?: string;
    groupClarityUrl?: string;
    sessionIds: string[];
    allSessions: SessionRow[];
    allLeads: LeadAttributionRow[];
    onClose: () => void;
}

export const AdSessionsDrawer: React.FC<Props> = ({
    title, subtitle, groupClarityUrl, sessionIds, allSessions, allLeads, onClose,
}) => {
    const clarityProjectId = useClarityProjectId();

    const sessions = useMemo(() => {
        const idSet = new Set(sessionIds);
        return allSessions
            .filter(s => idSet.has(s.id))
            .sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
    }, [sessionIds, allSessions]);

    // visitor_id -> lead lookup (so we can show "lead oldu" rozeti + lead-bazlı Clarity link).
    const visitorLeadMap = useMemo(() => {
        const m = new Map<string, LeadAttributionRow>();
        for (const l of allLeads) {
            if (l.visitor_id) m.set(l.visitor_id, l);
        }
        return m;
    }, [allLeads]);

    const stats = useMemo(() => {
        const uniqueVisitors = new Set(sessions.map(s => s.visitor_id)).size;
        const leadCount = sessions.filter(s => visitorLeadMap.has(s.visitor_id)).length;
        const cvr = sessions.length > 0 ? Math.min((leadCount / sessions.length) * 100, 100) : 0;
        return { total: sessions.length, uniqueVisitors, leadCount, cvr };
    }, [sessions, visitorLeadMap]);

    // ESC kapatma + body scroll lock
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <button
                aria-label="Kapat"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] cursor-default"
            />

            {/* Panel */}
            <aside
                role="dialog"
                aria-label={title}
                className="relative ml-auto w-full max-w-[640px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            >
                {/* Header */}
                <header className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold text-slate-900 truncate">{title}</h2>
                        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {groupClarityUrl && clarityProjectId && (
                            <a
                                href={groupClarityUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md inline-flex items-center gap-1.5 transition-colors"
                                title="Bu grubun tüm Clarity oturum kayıtlarını aç"
                            >
                                <PlayCircle size={12} /> Hepsi Clarity
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                            aria-label="Kapat"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </header>

                {/* Özet stripi */}
                <div className="px-5 py-3 grid grid-cols-4 gap-2 border-b border-slate-100 bg-slate-50/50">
                    <Stat label="Oturum" value={stats.total} />
                    <Stat label="Ziyaretçi" value={stats.uniqueVisitors} />
                    <Stat label="Lead" value={stats.leadCount} accent="amber" />
                    <Stat label="CVR" value={`%${stats.cvr.toFixed(1)}`} accent="rose" />
                </div>

                {!clarityProjectId && (
                    <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-[10px] text-amber-800">
                        ⚠ Clarity yapılandırılmamış — replay butonları gizli. `VITE_CLARITY_PROJECT_ID` ekleyince aktif olur.
                    </div>
                )}

                {/* Session listesi */}
                <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                    {sessions.length === 0 ? (
                        <div className="text-center py-12 text-sm text-slate-400">
                            Bu seçim için oturum bulunamadı.
                        </div>
                    ) : (
                        sessions.map(s => (
                            <SessionCard
                                key={s.id}
                                session={s}
                                lead={visitorLeadMap.get(s.visitor_id)}
                                clarityProjectId={clarityProjectId}
                            />
                        ))
                    )}
                </div>
            </aside>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────

const Stat: React.FC<{ label: string; value: string | number; accent?: 'amber' | 'rose' }> = ({ label, value, accent }) => {
    const color = accent === 'amber' ? 'text-amber-600' : accent === 'rose' ? 'text-rose-600' : 'text-slate-900';
    return (
        <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">{label}</span>
            <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
        </div>
    );
};

const DeviceIcon: React.FC<{ type: string | null }> = ({ type }) => {
    const Icon = type === 'mobile' ? Smartphone : type === 'tablet' ? Tablet : Monitor;
    return <Icon size={12} className="text-slate-500" />;
};

interface SessionCardProps {
    session: SessionRow;
    lead?: LeadAttributionRow;
    clarityProjectId?: string;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, lead, clarityProjectId }) => {
    const when = session.started_at
        ? format(new Date(session.started_at), 'dd MMM yyyy, HH:mm', { locale: tr })
        : '—';
    const cityLabel = session.city
        ? `${session.city}${session.country ? `, ${session.country}` : ''}`
        : 'Bilinmiyor';
    const geoProvider = session.geo_provider;
    const referrerHost = (() => {
        if (!session.referrer) return null;
        try { return new URL(session.referrer).hostname.replace(/^www\./, ''); }
        catch { return session.referrer.slice(0, 40); }
    })();

    const visitorClarityUrl = clarityProjectId ? clarityForVisitor(clarityProjectId, session.visitor_id) : null;
    const leadClarityUrl = clarityProjectId && lead?.id ? clarityForLead(clarityProjectId, lead.id) : null;

    return (
        <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 hover:shadow-sm transition-all bg-white">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Zaman + lead rozeti */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 font-medium">
                            <Clock size={11} className="text-slate-400" /> {when}
                        </span>
                        {lead ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <CheckCircle2 size={10} /> Lead oldu
                            </span>
                        ) : (
                            <span className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                Sadece ziyaret
                            </span>
                        )}
                    </div>

                    {/* Konum */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <MapPin size={11} className="text-slate-400" />
                        <span className={session.city ? 'font-medium text-slate-800' : 'italic text-slate-400'}>
                            {cityLabel}
                        </span>
                        {geoProvider && (
                            <span
                                className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-500 font-mono"
                                title={`Geo kaynak: ${geoProvider}`}
                            >
                                {geoProvider}
                            </span>
                        )}
                    </div>

                    {/* Cihaz + tarayıcı */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <DeviceIcon type={session.device_type} />
                        <span>{session.device_type || 'desktop'}</span>
                        {session.browser && <span className="text-slate-400">• {session.browser}</span>}
                        {session.os && <span className="text-slate-400">• {session.os}</span>}
                    </div>

                    {/* Landing + referrer */}
                    {(session.landing_path || referrerHost) && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                            {session.landing_path && (
                                <a
                                    href={session.landing_path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 hover:text-indigo-600 hover:underline truncate max-w-[280px]"
                                    title={session.landing_path}
                                >
                                    <ExternalLink size={10} /> {session.landing_path}
                                </a>
                            )}
                            {referrerHost && (
                                <span className="inline-flex items-center gap-1" title={session.referrer || ''}>
                                    <Globe size={10} /> {referrerHost}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Sağ aksiyonlar — Clarity butonları */}
                <div className="flex flex-col gap-1 shrink-0">
                    {visitorClarityUrl && (
                        <a
                            href={visitorClarityUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded inline-flex items-center gap-1 transition-colors"
                            title="Bu ziyaretçinin sitedeki tüm hareketlerini Clarity'de izle"
                        >
                            <PlayCircle size={11} /> İzle
                        </a>
                    )}
                    {leadClarityUrl && (
                        <a
                            href={leadClarityUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-[10px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded inline-flex items-center gap-1 transition-colors border border-emerald-100"
                            title="Bu lead'in tüm oturum kayıtları (daha dar filtre)"
                        >
                            <PlayCircle size={11} /> Lead
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};
