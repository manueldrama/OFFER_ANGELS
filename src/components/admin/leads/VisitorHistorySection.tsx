import React, { useEffect, useState } from 'react';
import { Globe, Eye, MousePointerClick, Smartphone, Laptop, Tablet, ChevronDown, ChevronUp, PlayCircle, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { VisitorHistoryService, type VisitorHistory } from '../../../services/admin/visitorHistoryService';
import { countryFlag, utmShortLabel } from '../../../utils/geoFormat';
import { buildClarityPlayerUrl, clarityForLead, useClarityProjectId } from '../../../lib/clarityLinks';

interface Props {
    leadId: string;
}

export const VisitorHistorySection: React.FC<Props> = ({ leadId }) => {
    const [data, setData] = useState<VisitorHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const CLARITY_PROJECT_ID = useClarityProjectId();

    const copyLeadId = () => {
        navigator.clipboard.writeText(leadId).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => { /* swallow */ });
    };

    useEffect(() => {
        let alive = true;
        setLoading(true);
        VisitorHistoryService.forLead(leadId)
            .then(d => { if (alive) setData(d); })
            .catch(() => { if (alive) setData(null); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [leadId]);

    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-3 tracking-tight">Ziyaretçi Geçmişi</h3>
                <div className="h-12 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
                </div>
            </div>
        );
    }

    if (!data || !data.profile) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-2 tracking-tight">Ziyaretçi Geçmişi</h3>
                <p className="text-xs text-slate-400 italic mb-3">
                    Bu lead için ziyaretçi izi yok. (Form öncesi tracking devreye girmeden gelmiş olabilir.)
                </p>
                {/* Profil DB'de olmasa bile Clarity'ye lead_id tag'i bagimsiz
                    gonderiliyor (services/guest.ts -> pushClarityIdentity), o yuzden
                    kayit yine bulunabilir. Link her durumda gosterilir. */}
                {CLARITY_PROJECT_ID && (
                    <ClarityLinkBlock
                        leadId={leadId}
                        projectId={CLARITY_PROJECT_ID}
                        copied={copied}
                        onCopy={copyLeadId}
                        clarityUserId={data?.leadClarity?.user_id ?? null}
                        claritySessionId={data?.leadClarity?.session_id ?? null}
                    />
                )}
            </div>
        );
    }

    const { profile, sessions, pageviews, totals } = data;
    const firstUtm = utmShortLabel(profile.first_utm_source, profile.first_utm_medium);
    const lastSession = sessions[0];
    const lastUtm = lastSession ? utmShortLabel(lastSession.utm_source, lastSession.utm_medium) : null;
    const visiblePageviews = expanded ? pageviews : pageviews.slice(0, 8);
    // Derin-link kaynak önceliği:
    //  (1) leadClarity — lead satırına DOĞRUDAN yazılan ID'ler (en güvenilir,
    //      join'e bağlı değil; migration 20260609_leads_clarity_ids.sql).
    //  (2) clarity_user_id + clarity_session_id'si dolu en güncel session
    //      (migration 20260526_sessions_clarity_ids.sql).
    //  (3) Aksi halde Recordings listesi fallback'i.
    const clarityPlayableSession = sessions.find(s => s.clarity_user_id && s.clarity_session_id);
    const resolvedClarityUserId = data.leadClarity?.user_id ?? clarityPlayableSession?.clarity_user_id ?? null;
    const resolvedClaritySessionId = data.leadClarity?.session_id ?? clarityPlayableSession?.clarity_session_id ?? null;

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4 gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Globe size={14} className="text-indigo-500" />
                    Ziyaretçi Geçmişi
                </h3>
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]" title={profile.visitor_id}>
                    {profile.visitor_id.slice(0, 8)}…
                </span>
            </div>

            {/* Microsoft Clarity — session replay & heatmap.
                Filtreli URL ile dogrudan bu lead'in oturumlarini acar. URL formati
                src/lib/clarityLinks.ts'de — degisirse tek noktada guncellenir.
                "Lead ID" butonu manuel arama fallback'i. */}
            {CLARITY_PROJECT_ID && (
                <ClarityLinkBlock
                    leadId={leadId}
                    projectId={CLARITY_PROJECT_ID}
                    copied={copied}
                    onCopy={copyLeadId}
                    clarityUserId={resolvedClarityUserId}
                    claritySessionId={resolvedClaritySessionId}
                />
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <Stat icon={MousePointerClick} label="Oturum" value={totals.sessions} />
                <Stat icon={Eye} label="Sayfa" value={totals.pageviews} />
                <Stat
                    icon={Globe}
                    label="İlk Ziyaret"
                    value={format(new Date(profile.first_seen_at), 'dd MMM', { locale: tr })}
                    isText
                />
            </div>

            {/* First / Last touch */}
            <div className="space-y-2 mb-4">
                <TouchRow
                    label="İlk geliş"
                    flag={countryFlag(profile.first_country)}
                    place={profile.first_city || profile.first_country}
                    utm={firstUtm}
                    referrer={profile.first_referrer}
                    landing={profile.first_landing_path}
                    when={profile.first_seen_at}
                />
                {lastSession && (
                    <TouchRow
                        label="Son geliş"
                        flag={countryFlag(lastSession.country)}
                        place={lastSession.city || lastSession.country}
                        utm={lastUtm}
                        referrer={lastSession.referrer}
                        landing={lastSession.landing_path}
                        when={lastSession.started_at}
                        device={lastSession.device_type}
                    />
                )}
            </div>

            {/* Pageview timeline */}
            {pageviews.length > 0 && (
                <>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Gezinti Geçmişi ({pageviews.length})
                    </h4>
                    <ul className="space-y-1.5 border-l-2 border-slate-100 pl-3">
                        {visiblePageviews.map(pv => (
                            <li key={pv.id} className="text-xs">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-slate-700 font-medium truncate" title={pv.title || pv.path}>
                                        {pv.path}
                                    </span>
                                    <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                                        {format(new Date(pv.created_at), 'dd MMM HH:mm', { locale: tr })}
                                    </span>
                                </div>
                                {pv.title && pv.title !== pv.path && (
                                    <p className="text-[11px] text-slate-400 truncate">{pv.title}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                    {pageviews.length > 8 && (
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="mt-2 text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
                        >
                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {expanded ? 'Daha az göster' : `${pageviews.length - 8} sayfa daha`}
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

interface ClarityLinkBlockProps {
    leadId: string;
    projectId: string;
    copied: boolean;
    onCopy: () => void;
    clarityUserId?: string | null;
    claritySessionId?: string | null;
}

function ClarityLinkBlock({ leadId, projectId, copied, onCopy, clarityUserId, claritySessionId }: ClarityLinkBlockProps) {
    // Direct player URL acts ONLY when both Clarity cookie IDs were captured
    // for at least one of the lead's sessions (new tracking, post-migration
    // 20260526_sessions_clarity_ids.sql). Otherwise fall back to the
    // Recordings list + clipboard flow.
    const hasDirectLink = !!(clarityUserId && claritySessionId);
    const directUrl = hasDirectLink ? buildClarityPlayerUrl(projectId, clarityUserId!, claritySessionId!) : null;
    const recordingsUrl = clarityForLead(projectId, leadId);
    const targetUrl = directUrl ?? recordingsUrl;

    const openAndCopy = () => {
        // Copy even when we have a direct link — useful if the user wants to
        // tag another tool or paste into a Clarity custom-tag search later.
        onCopy();
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="mb-4 p-3 rounded-md bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-indigo-900 flex items-center gap-1.5">
                        <PlayCircle size={12} /> Clarity Session Replay
                    </p>
                    <p className="text-[10px] text-indigo-700/80 mt-0.5 leading-relaxed">
                        {hasDirectLink
                            ? <>Tek tıkla doğrudan bu lead'in <span className="font-semibold">oturum kaydına</span> gider.</>
                            : <>Aç'a tıkla → Lead ID kopyalanır → Clarity'de <span className="font-semibold">Filters → Custom tags → lead_id</span>'ye yapıştır.</>}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={onCopy}
                        className="px-2 py-1 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100 rounded inline-flex items-center gap-1 transition-colors"
                        title="Sadece Lead ID'yi panoya kopyala"
                    >
                        {copied ? <Check size={10} /> : <Copy size={10} />}
                        {copied ? 'Kopyalandı' : 'ID'}
                    </button>
                    <button
                        onClick={openAndCopy}
                        className="px-2.5 py-1 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded inline-flex items-center gap-1 transition-colors"
                        title={hasDirectLink
                            ? "Bu lead'in Clarity oturum kaydini dogrudan ac"
                            : "Lead ID'yi kopyalar ve Clarity Recordings'i acar"}
                    >
                        <PlayCircle size={11} /> {hasDirectLink ? 'Kaydı Aç' : 'Kayıtları Aç'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Stat({ icon: Icon, label, value, isText }: { icon: any; label: string; value: number | string; isText?: boolean }) {
    return (
        <div className="bg-slate-50 rounded-md p-2.5 text-center">
            <Icon size={14} className="mx-auto text-slate-400 mb-1" />
            <p className={`text-slate-900 font-bold ${isText ? 'text-xs' : 'text-base tabular-nums'}`}>{value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
        </div>
    );
}

interface TouchRowProps {
    label: string;
    flag: string;
    place: string | null;
    utm: string | null;
    referrer: string | null;
    landing: string | null;
    when: string;
    device?: string | null;
}

function TouchRow({ label, flag, place, utm, referrer, landing, when, device }: TouchRowProps) {
    const DeviceIcon = device === 'mobile' ? Smartphone : device === 'tablet' ? Tablet : Laptop;
    return (
        <div className="border border-slate-100 rounded-md p-2.5 bg-slate-50/50">
            <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">{label}</span>
                <span className="text-[10px] text-slate-400 tabular-nums">
                    {format(new Date(when), 'dd MMM yyyy HH:mm', { locale: tr })}
                </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700 flex-wrap">
                {flag && <span aria-hidden>{flag}</span>}
                {place && <span className="font-medium">{place}</span>}
                {utm && (
                    <>
                        <span className="text-slate-300">·</span>
                        <span className="text-indigo-600 font-medium">{utm}</span>
                    </>
                )}
                {device && (
                    <>
                        <span className="text-slate-300">·</span>
                        <DeviceIcon size={11} className="text-slate-400" />
                    </>
                )}
            </div>
            {(referrer || landing) && (
                <div className="mt-1.5 space-y-0.5 text-[10px] text-slate-500">
                    {landing && <p className="truncate" title={landing}>İniş: {landing}</p>}
                    {referrer && <p className="truncate" title={referrer}>Referrer: {referrer}</p>}
                </div>
            )}
        </div>
    );
}
