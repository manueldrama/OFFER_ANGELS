import { supabase } from '../../lib/supabase/client';
import { tzDateKey, tzDow, tzHour } from '../../utils/turkeyTime';

export interface SessionRow {
    id: string;
    visitor_id: string;
    started_at: string;
    country: string | null;
    city: string | null;
    region: string | null;
    latitude: number | null;
    longitude: number | null;
    user_agent: string | null;
    device_type: string | null;
    browser: string | null;
    browser_version: string | null;
    os: string | null;
    os_version: string | null;
    geo_provider: string | null;
    geo_confidence: number | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content?: string | null;
    fbclid: string | null;
    gclid: string | null;
    referrer: string | null;
    landing_path: string | null;
    pageviews: number;
}

export interface PageviewRow {
    id: string;
    session_id: string;
    visitor_id: string;
    path: string;
    title: string | null;
    created_at: string;
}

export interface LeadAttributionRow {
    id: string;
    created_at: string;
    country: string | null;
    city: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    fbclid: string | null;
    gclid: string | null;
    first_utm_source: string | null;
    first_utm_medium: string | null;
    first_utm_campaign: string | null;
    first_fbclid: string | null;
    first_gclid: string | null;
    browser: string | null;
    os: string | null;
    visitor_id: string | null;
    // Lead kalitesi (sıcaklık) raporu için — additive; mevcut tüketiciler etkilenmez.
    status: string | null;
    status_source: string | null;
    customer_name: string | null;
    phone_number: string | null;
}

export interface FetchRangeResult {
    sessions: SessionRow[];
    pageviews: PageviewRow[];
    leads: LeadAttributionRow[];
    previous: { sessions: number; leads: number; visitors: number; pageviews: number } | null;
    errors: unknown[];
}

const SESSION_SELECT =
    'id, visitor_id, started_at, country, city, region, latitude, longitude, user_agent, device_type, browser, browser_version, os, os_version, geo_provider, geo_confidence, utm_source, utm_medium, utm_campaign, utm_content, fbclid, gclid, referrer, landing_path, pageviews';

const LEAD_SELECT =
    'id, created_at, country, city, utm_source, utm_medium, utm_campaign, utm_content, fbclid, gclid, first_utm_source, first_utm_medium, first_utm_campaign, first_fbclid, first_gclid, browser, os, visitor_id, status, status_source, customer_name, phone_number';

// Supabase / PostgREST default cap is 1000 rows per request, regardless of
// what `.limit()` says — to read full ranges we paginate via `.range()` in
// 1000-row batches. Without this, 30d/90d windows under-report by silently
// truncating sessions/pageviews/leads to 1000 rows each, making KPIs,
// channel breakdowns, and source matrices all 20-90% low.
const PAGE_SIZE = 1000;
const MAX_PAGES = 100; // 100k row safety stop

async function fetchAllPages<T>(buildQuery: () => any): Promise<{ data: T[]; error: any }> {
    const all: T[] = [];
    let offset = 0;
    for (let i = 0; i < MAX_PAGES; i++) {
        const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
        if (error) return { data: all, error };
        if (!data || data.length === 0) break;
        all.push(...(data as T[]));
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
    }
    return { data: all, error: null };
}

export const SiteAnalyticsService = {
    async fetchRange(
        startISO: string,
        endISO: string,
        opts?: { compare?: { startISO: string; endISO: string } },
    ): Promise<FetchRangeResult> {
        const sessionsPromise = fetchAllPages<SessionRow>(() =>
            supabase
                .from('sessions')
                .select(SESSION_SELECT)
                .gte('started_at', startISO)
                .lte('started_at', endISO)
                .order('started_at', { ascending: false })
        );

        const pageviewsPromise = fetchAllPages<PageviewRow>(() =>
            supabase
                .from('pageviews')
                .select('id, session_id, visitor_id, path, title, created_at')
                .gte('created_at', startISO)
                .lte('created_at', endISO)
                .order('created_at', { ascending: false })
        );

        const leadsPromise = fetchAllPages<LeadAttributionRow>(() =>
            supabase
                .from('leads')
                .select(LEAD_SELECT)
                .gte('created_at', startISO)
                .lte('created_at', endISO)
                .order('created_at', { ascending: false })
        );

        const prevPromise = opts?.compare
            ? supabase.rpc('analytics_kpi_bundle', {
                p_start: opts.compare.startISO,
                p_end: opts.compare.endISO,
            })
            : Promise.resolve(null);

        const [sessionsRes, pageviewsRes, leadsRes, prevRes] = await Promise.all([
            sessionsPromise, pageviewsPromise, leadsPromise, prevPromise,
        ]) as any[];

        let previous: FetchRangeResult['previous'] = null;
        if (prevRes && !prevRes.error && Array.isArray(prevRes.data) && prevRes.data.length > 0) {
            const row = prevRes.data[0];
            previous = {
                sessions: Number(row.sessions) || 0,
                leads: Number(row.leads) || 0,
                visitors: Number(row.visitors) || 0,
                pageviews: Number(row.pageviews) || 0,
            };
        }

        return {
            sessions: (sessionsRes.data || []) as SessionRow[],
            pageviews: (pageviewsRes.data || []) as PageviewRow[],
            leads: (leadsRes.data || []) as LeadAttributionRow[],
            previous,
            errors: [sessionsRes.error, pageviewsRes.error, leadsRes.error, prevRes?.error].filter(Boolean),
        };
    },
};

// ─────────────────────────────────────────────────────────────────────────
// Classification
// ─────────────────────────────────────────────────────────────────────────

/** Legacy bucket — kept for backward compatibility with existing UI bits. */
export function classifySource(s: Pick<SessionRow, 'utm_source' | 'utm_medium' | 'referrer'>): string {
    const m = (s.utm_medium || '').toLowerCase();
    const src = (s.utm_source || '').toLowerCase();
    if (m === 'cpc' || m === 'paid' || m === 'ppc' || m === 'paidsocial' || m === 'paid_social') return 'paid';
    if (m === 'email') return 'email';
    if (m === 'social' || /facebook|instagram|tiktok|twitter|x\.com|linkedin/.test(src)) return 'social';
    if (m === 'referral' || (s.referrer && !s.utm_source)) return 'referral';
    if (m === 'organic') return 'organic';
    if (s.utm_source) return 'campaign';
    if (s.referrer && /google|bing|duckduck|yandex/.test(s.referrer)) return 'organic';
    return 'direct';
}

export type Channel =
    | 'Paid Google'
    | 'Paid Meta'
    | 'Paid Other'
    | 'Email'
    | 'Meta Organic'
    | 'Google Organic'
    | 'WhatsApp'
    | 'TikTok'
    | 'LinkedIn'
    | 'Twitter'
    | 'Referral'
    | 'Direct';

export interface ChannelClassification {
    channel: Channel;
    sub: string;
}

function hostnameOf(url: string | null): string {
    if (!url) return '';
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function classifyChannel(s: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    fbclid?: string | null;
    gclid?: string | null;
    referrer?: string | null;
}): ChannelClassification {
    if (s.gclid) return { channel: 'Paid Google', sub: s.utm_campaign || 'gclid' };
    const med = (s.utm_medium || '').toLowerCase();
    const src = (s.utm_source || '').toLowerCase();
    const ref = s.referrer || '';
    // Meta/Google kaynak kısaltmaları: reklam UTM'lerinde sık sık 'ig'/'fb' gibi kısa
    // değerler kullanılır (örn. utm_source=ig). Tam kelimeyle birlikte bunları da tanı.
    const isMetaSrc = /facebook|instagram|meta|messenger/.test(src) || /^(fb|ig|fbig|fb[_-]?ig)$/.test(src);
    const isGoogleSrc = /google|youtube/.test(src) || src === 'yt' || src === 'gdn';
    if (s.fbclid) return { channel: 'Paid Meta', sub: s.utm_campaign || 'fbclid' };
    if (med === 'cpc' || med === 'ppc' || med === 'paid' || med === 'paid_social' || med === 'paidsocial') {
        if (isMetaSrc) return { channel: 'Paid Meta', sub: s.utm_campaign || src };
        if (isGoogleSrc) return { channel: 'Paid Google', sub: s.utm_campaign || src };
        return { channel: 'Paid Other', sub: s.utm_campaign || src || med };
    }
    if (med === 'email' || src === 'email') return { channel: 'Email', sub: src || 'email' };
    if (isMetaSrc || /facebook\.com|instagram\.com|l\.facebook|m\.facebook/.test(ref))
        return { channel: 'Meta Organic', sub: src || 'meta' };
    if (isGoogleSrc || /google\.[a-z.]+|youtube\.com/.test(ref))
        return { channel: 'Google Organic', sub: 'google' };
    if (/whatsapp/.test(src) || /whatsapp|wa\.me/.test(ref)) return { channel: 'WhatsApp', sub: 'whatsapp' };
    if (/tiktok/.test(src) || /tiktok/.test(ref)) return { channel: 'TikTok', sub: 'tiktok' };
    if (/linkedin/.test(src) || /linkedin/.test(ref)) return { channel: 'LinkedIn', sub: 'linkedin' };
    if (/twitter|x\.com|t\.co/.test(src) || /twitter|t\.co|x\.com/.test(ref)) return { channel: 'Twitter', sub: 'twitter' };
    if (ref) return { channel: 'Referral', sub: hostnameOf(ref) };
    return { channel: 'Direct', sub: 'direct' };
}

export const CHANNEL_COLORS: Record<Channel, string> = {
    'Paid Google': '#22c55e',
    'Paid Meta': '#3b82f6',
    'Paid Other': '#a855f7',
    'Email': '#f59e0b',
    'Meta Organic': '#0ea5e9',
    'Google Organic': '#16a34a',
    'WhatsApp': '#10b981',
    'TikTok': '#ec4899',
    'LinkedIn': '#0a66c2',
    'Twitter': '#1d9bf0',
    'Referral': '#06b6d4',
    'Direct': '#94a3b8',
};

// ─────────────────────────────────────────────────────────────────────────
// Aggregation helpers — pure functions used by the page
// ─────────────────────────────────────────────────────────────────────────

export interface ChannelAggregate {
    channel: Channel;
    sessions: number;
    visitors: number;
    leadsLastTouch: number;
    leadsFirstTouch: number;
    cvr: number;
}

/**
 * Build a visitor_id → latest session lookup. Used to back-fill the converting
 * session's referrer/utm onto leads — without this, a lead whose URL params
 * dropped during the funnel falls into "Direct" even though their session
 * row carries the correct ad attribution.
 */
export function buildLatestSessionByVisitor(sessions: SessionRow[]): Map<string, SessionRow> {
    const out = new Map<string, SessionRow>();
    for (const s of sessions) {
        if (!s.visitor_id) continue;
        const prev = out.get(s.visitor_id);
        if (!prev || Date.parse(s.started_at) > Date.parse(prev.started_at)) {
            out.set(s.visitor_id, s);
        }
    }
    return out;
}

export function buildChannelAggregates(
    sessions: SessionRow[],
    leads: LeadAttributionRow[],
): ChannelAggregate[] {
    const map = new Map<Channel, { sessions: number; visitors: Set<string>; leadsLT: number; leadsFT: number }>();
    const ensure = (ch: Channel) => {
        if (!map.has(ch)) map.set(ch, { sessions: 0, visitors: new Set(), leadsLT: 0, leadsFT: 0 });
        return map.get(ch)!;
    };
    for (const s of sessions) {
        const { channel } = classifyChannel(s);
        const e = ensure(channel);
        e.sessions += 1;
        if (s.visitor_id) e.visitors.add(s.visitor_id);
    }
    // Lead-side: prefer the converting visitor's actual session signals
    // (referrer, utm_*, fbclid, gclid). The lead row may have only partial
    // attribution if its URL params were stripped at submit time.
    const sessionByVisitor = buildLatestSessionByVisitor(sessions);
    for (const l of leads) {
        const sess = l.visitor_id ? sessionByVisitor.get(l.visitor_id) : null;
        const ltCh = classifyChannel({
            utm_source: l.utm_source ?? sess?.utm_source ?? null,
            utm_medium: l.utm_medium ?? sess?.utm_medium ?? null,
            utm_campaign: l.utm_campaign ?? sess?.utm_campaign ?? null,
            fbclid: l.fbclid ?? sess?.fbclid ?? null,
            gclid: l.gclid ?? sess?.gclid ?? null,
            referrer: sess?.referrer ?? null,
        }).channel;
        ensure(ltCh).leadsLT += 1;
        const ftCh = classifyChannel({
            utm_source: l.first_utm_source, utm_medium: l.first_utm_medium, utm_campaign: l.first_utm_campaign,
            fbclid: l.first_fbclid, gclid: l.first_gclid,
            // First-touch referrer not stored on lead row — use session's
            // referrer as best-effort hint for "Referral" classification.
            referrer: sess?.referrer ?? null,
        }).channel;
        ensure(ftCh).leadsFT += 1;
    }
    return Array.from(map.entries())
        .map(([channel, v]) => ({
            channel,
            sessions: v.sessions,
            visitors: v.visitors.size,
            leadsLastTouch: v.leadsLT,
            leadsFirstTouch: v.leadsFT,
            cvr: v.sessions > 0 ? Math.min((v.leadsLT / v.sessions) * 100, 100) : 0,
        }))
        .sort((a, b) => b.leadsLastTouch - a.leadsLastTouch || b.sessions - a.sessions);
}

export interface CampaignAggregate {
    campaign: string;
    source: string | null;
    medium: string | null;
    sessions: number;
    leads: number;
    firstTouchLeads: number;
    cvr: number;
    topCities: Array<{ city: string; count: number }>;
    sessionIds: string[];
}

interface CampaignAccum {
    campaign: string;
    source: string | null;
    medium: string | null;
    sessions: number;
    leads: number;
    firstTouchLeads: number;
    cityCounts: Map<string, number>;
    sessionIds: string[];
}

function topCitiesFrom(counts: Map<string, number>, limit = 3): Array<{ city: string; count: number }> {
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([city, count]) => ({ city, count }));
}

export function buildCampaignAggregates(
    sessions: SessionRow[],
    leads: LeadAttributionRow[],
): CampaignAggregate[] {
    const map = new Map<string, CampaignAccum>();
    const ensure = (k: string, source: string | null, medium: string | null): CampaignAccum => {
        if (!map.has(k)) {
            map.set(k, {
                campaign: k, source, medium,
                sessions: 0, leads: 0, firstTouchLeads: 0,
                cityCounts: new Map(), sessionIds: [],
            });
        }
        return map.get(k)!;
    };
    for (const s of sessions) {
        if (!s.utm_campaign) continue;
        const entry = ensure(s.utm_campaign, s.utm_source, s.utm_medium);
        entry.sessions += 1;
        entry.sessionIds.push(s.id);
        const city = s.city || 'Bilinmiyor';
        entry.cityCounts.set(city, (entry.cityCounts.get(city) || 0) + 1);
    }
    for (const l of leads) {
        if (l.utm_campaign) {
            ensure(l.utm_campaign, l.utm_source, l.utm_medium).leads += 1;
        }
        if (l.first_utm_campaign) {
            ensure(l.first_utm_campaign, l.first_utm_source, l.first_utm_medium).firstTouchLeads += 1;
        }
    }
    return Array.from(map.values())
        .map(c => ({
            campaign: c.campaign,
            source: c.source,
            medium: c.medium,
            sessions: c.sessions,
            leads: c.leads,
            firstTouchLeads: c.firstTouchLeads,
            cvr: c.sessions > 0 ? Math.min((c.leads / c.sessions) * 100, 100) : 0,
            topCities: topCitiesFrom(c.cityCounts),
            sessionIds: c.sessionIds,
        }))
        .sort((a, b) => b.leads - a.leads || b.sessions - a.sessions);
}

export interface AdAggregate {
    platform: 'Meta' | 'Google';
    content: string;
    clickIds: number;
    sessions: number;
    leads: number;
    cvr: number;
    topCities: Array<{ city: string; count: number }>;
    sessionIds: string[];
}

interface AdAccum {
    platform: 'Meta' | 'Google';
    content: string;
    clickIds: number;
    sessions: number;
    leads: number;
    cityCounts: Map<string, number>;
    sessionIds: string[];
}

/**
 * Group sessions that arrived with a click ID by ad content (utm_content)
 * to give a coarse "which ad" view. Without a CRM-level ad ID we can't go
 * deeper, but utm_content is what most teams use for ad-variant labelling.
 *
 * topCities + sessionIds eklendi: admin drill-down panelinde "bu reklamdan
 * gelen tek tek session'lari ve hangi sehirden geldiklerini" gosterebilmek
 * icin. Hicbir geo verisi yoksa 'Bilinmiyor' olarak bucketlanir — boylece
 * geo provider eksikligi gizlenmek yerine gorunur olur.
 */
export function buildAdAggregates(sessions: SessionRow[], leads: LeadAttributionRow[]): AdAggregate[] {
    const map = new Map<string, AdAccum>();
    const key = (p: 'Meta' | 'Google', c: string) => `${p}|${c}`;
    const ensure = (p: 'Meta' | 'Google', c: string): AdAccum => {
        const k = key(p, c);
        if (!map.has(k)) {
            map.set(k, {
                platform: p, content: c,
                clickIds: 0, sessions: 0, leads: 0,
                cityCounts: new Map(), sessionIds: [],
            });
        }
        return map.get(k)!;
    };
    // Session-side: count every session that EITHER carries a click ID OR
    // carries a paid-channel UTM source/medium. Without this, sessions whose
    // fbclid dropped mid-funnel (SPA route change, redirect strip) don't get
    // counted against their utm_content bucket — producing "0 oturum / 4 lead"
    // rows in the dashboard.
    const isMetaSession = (s: SessionRow): boolean => {
        if (s.fbclid) return true;
        const src = (s.utm_source || '').toLowerCase();
        const med = (s.utm_medium || '').toLowerCase();
        if (/facebook|instagram|meta/.test(src) && (med === 'cpc' || med === 'paid' || med === 'paidsocial' || med === 'paid_social')) return true;
        return false;
    };
    const isGoogleSession = (s: SessionRow): boolean => {
        if (s.gclid) return true;
        const src = (s.utm_source || '').toLowerCase();
        const med = (s.utm_medium || '').toLowerCase();
        if (/google|youtube/.test(src) && (med === 'cpc' || med === 'paid')) return true;
        return false;
    };
    for (const s of sessions) {
        const content = s.utm_content || '—';
        const city = s.city || 'Bilinmiyor';
        if (isMetaSession(s)) {
            const e = ensure('Meta', content);
            e.sessions += 1;
            if (s.fbclid) e.clickIds += 1;
            e.sessionIds.push(s.id);
            e.cityCounts.set(city, (e.cityCounts.get(city) || 0) + 1);
        }
        if (isGoogleSession(s)) {
            const e = ensure('Google', content);
            e.sessions += 1;
            if (s.gclid) e.clickIds += 1;
            e.sessionIds.push(s.id);
            e.cityCounts.set(city, (e.cityCounts.get(city) || 0) + 1);
        }
    }
    // Lead-side: count leads under the SESSION's utm_content when the lead's
    // own utm_content is missing — the converting session is the authoritative
    // source for ad-variant attribution.
    const sessionByVisitor = buildLatestSessionByVisitor(sessions);
    for (const l of leads) {
        const sess = l.visitor_id ? sessionByVisitor.get(l.visitor_id) : null;
        const content = l.utm_content || sess?.utm_content || '—';
        if (l.fbclid || sess?.fbclid || (sess && isMetaSession(sess))) ensure('Meta', content).leads += 1;
        if (l.gclid || sess?.gclid || (sess && isGoogleSession(sess))) ensure('Google', content).leads += 1;
    }
    return Array.from(map.values())
        .map(a => ({
            platform: a.platform,
            content: a.content,
            clickIds: a.clickIds,
            sessions: a.sessions,
            leads: a.leads,
            cvr: a.sessions > 0 ? Math.min((a.leads / a.sessions) * 100, 100) : 0,
            topCities: topCitiesFrom(a.cityCounts),
            sessionIds: a.sessionIds,
        }))
        .sort((a, b) => b.leads - a.leads || b.sessions - a.sessions);
}

export interface SourceMediumCell {
    source: string;
    medium: string;
    sessions: number;
    leads: number;
}

export function buildSourceMediumMatrix(sessions: SessionRow[], leads: LeadAttributionRow[]): SourceMediumCell[] {
    const map = new Map<string, SourceMediumCell>();
    const k = (s: string, m: string) => `${s}|${m}`;
    for (const s of sessions) {
        const src = s.utm_source || '(none)';
        const med = s.utm_medium || '(none)';
        const key = k(src, med);
        if (!map.has(key)) map.set(key, { source: src, medium: med, sessions: 0, leads: 0 });
        map.get(key)!.sessions += 1;
    }
    for (const l of leads) {
        const src = l.utm_source || '(none)';
        const med = l.utm_medium || '(none)';
        const key = k(src, med);
        if (!map.has(key)) map.set(key, { source: src, medium: med, sessions: 0, leads: 0 });
        map.get(key)!.leads += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.sessions - a.sessions);
}

export interface GeoAggregate {
    country: string | null;
    city: string | null;
    visitors: number;
    sessions: number;
    leads: number;
    cvr: number;
    geoProvider: string | null;
}

// Geo confidence below this is treated as "no signal" — the row is folded
// into the "Bilinmeyen konum" bucket instead of inflating a specific city
// (typically the TR ISP NOC: Izmir / Ankara backbone PoP). Tuned to 0.5 to
// match the geo-resolve.ts confidence scale where real cities score ≥ 0.8.
const GEO_TRUST_THRESHOLD = 0.5;

export function buildGeoAggregates(sessions: SessionRow[], leads: LeadAttributionRow[]): GeoAggregate[] {
    const map = new Map<string, { country: string | null; city: string | null; visitors: Set<string>; sessions: number; leads: number; geoProvider: string | null }>();
    for (const s of sessions) {
        // Low-confidence geo → fold into Bilinmeyen so a single mis-located
        // backbone IP doesn't visually inflate Izmir/Ankara.
        const trustworthy = s.geo_confidence == null || s.geo_confidence >= GEO_TRUST_THRESHOLD;
        const country = trustworthy ? s.country : null;
        const city = trustworthy ? s.city : null;
        const key = `${country || '?'}|${city || '?'}`;
        if (!map.has(key)) map.set(key, { country, city, visitors: new Set(), sessions: 0, leads: 0, geoProvider: s.geo_provider });
        const row = map.get(key)!;
        row.visitors.add(s.visitor_id);
        row.sessions += 1;
        // Prefer the latest non-null provider tag.
        if (s.geo_provider) row.geoProvider = s.geo_provider;
    }
    for (const l of leads) {
        const key = `${l.country || '?'}|${l.city || '?'}`;
        if (!map.has(key)) map.set(key, { country: l.country, city: l.city, visitors: new Set(), sessions: 0, leads: 0, geoProvider: null });
        map.get(key)!.leads += 1;
    }
    return Array.from(map.values())
        .map(r => ({
            country: r.country,
            city: r.city,
            visitors: r.visitors.size,
            sessions: r.sessions,
            leads: r.leads,
            cvr: r.sessions > 0 ? Math.min((r.leads / r.sessions) * 100, 100) : 0,
            geoProvider: r.geoProvider,
        }))
        .sort((a, b) => {
            const au = !a.country && !a.city ? 1 : 0;
            const bu = !b.country && !b.city ? 1 : 0;
            if (au !== bu) return au - bu;
            return b.visitors - a.visitors;
        });
}

export interface FunnelStats {
    visitors: number;
    sessions: number;
    leads: number;
    customers: number;
}

export function buildFunnel(sessions: SessionRow[], leads: LeadAttributionRow[]): FunnelStats {
    return {
        visitors: new Set(sessions.map(s => s.visitor_id)).size,
        sessions: sessions.length,
        leads: leads.length,
        customers: 0, // wired separately when customer linkage lands
    };
}

export interface BreakdownRow {
    label: string;
    value: number;
}

export function buildBreakdown<T>(items: T[], keyFn: (x: T) => string | null, fallback = 'Bilinmiyor'): BreakdownRow[] {
    const counts: Record<string, number> = {};
    for (const it of items) {
        const k = keyFn(it) || fallback;
        counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
}

export interface LandingPageStat {
    path: string;
    sessions: number;
    leads: number;
    bouncePct: number;
    cvr: number;
}

export function buildLandingPageStats(sessions: SessionRow[], leads: LeadAttributionRow[]): LandingPageStat[] {
    // Map session → landing path with bounce flag.
    const sessionsByPath = new Map<string, { sessions: number; bounced: number; visitorIds: Set<string> }>();
    for (const s of sessions) {
        const path = s.landing_path || '/';
        if (!sessionsByPath.has(path)) sessionsByPath.set(path, { sessions: 0, bounced: 0, visitorIds: new Set() });
        const e = sessionsByPath.get(path)!;
        e.sessions += 1;
        if ((s.pageviews ?? 0) <= 1) e.bounced += 1;
        e.visitorIds.add(s.visitor_id);
    }
    // Attribute leads through visitor_id → landing_path. Sessions don't
    // carry the lead linkage directly, so we approximate via visitor.
    const visitorLandingMap = new Map<string, string>();
    for (const s of sessions) {
        if (!visitorLandingMap.has(s.visitor_id)) visitorLandingMap.set(s.visitor_id, s.landing_path || '/');
    }
    const leadsByPath = new Map<string, number>();
    for (const l of leads) {
        if (!l.visitor_id) continue;
        const path = visitorLandingMap.get(l.visitor_id);
        if (!path) continue;
        leadsByPath.set(path, (leadsByPath.get(path) || 0) + 1);
    }
    return Array.from(sessionsByPath.entries())
        .map(([path, v]) => {
            const leads = leadsByPath.get(path) || 0;
            return {
                path,
                sessions: v.sessions,
                leads,
                bouncePct: v.sessions > 0 ? (v.bounced / v.sessions) * 100 : 0,
                cvr: v.sessions > 0 ? Math.min((leads / v.sessions) * 100, 100) : 0,
            };
        })
        .sort((a, b) => b.sessions - a.sessions);
}

/** 7×24 matrix indexed [dow][hour]; counts can be sessions or leads. */
export function buildHourDow(items: Array<{ when: string }>): number[][] {
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const it of items) {
        const d = tzDow(it.when);
        const h = tzHour(it.when);
        if (d >= 0 && d < 7 && h >= 0 && h < 24) matrix[d][h] += 1;
    }
    return matrix;
}

export interface DailyPoint {
    date: string;
    visitors: number;
    sessions: number;
    leads: number;
}

export function buildDailyTrend(sessions: SessionRow[], leads: LeadAttributionRow[]): DailyPoint[] {
    const map = new Map<string, { visitors: Set<string>; sessions: number; leads: number }>();
    for (const s of sessions) {
        const k = tzDateKey(s.started_at);
        if (!k) continue;
        if (!map.has(k)) map.set(k, { visitors: new Set(), sessions: 0, leads: 0 });
        const r = map.get(k)!;
        r.visitors.add(s.visitor_id);
        r.sessions += 1;
    }
    for (const l of leads) {
        const k = tzDateKey(l.created_at);
        if (!k) continue;
        if (!map.has(k)) map.set(k, { visitors: new Set(), sessions: 0, leads: 0 });
        map.get(k)!.leads += 1;
    }
    return Array.from(map.entries())
        .map(([date, r]) => ({ date, visitors: r.visitors.size, sessions: r.sessions, leads: r.leads }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

export interface TouchpointBucket {
    label: string;
    count: number;
}

/**
 * For visitors who converted (have a lead), how many sessions did they have
 * before converting? Bucketed into {1, 2, 3, 4–5, 6–10, 11+}.
 */
export function buildTouchpointDistribution(sessions: SessionRow[], leads: LeadAttributionRow[]): TouchpointBucket[] {
    const sessionsPerVisitor = new Map<string, number>();
    for (const s of sessions) {
        sessionsPerVisitor.set(s.visitor_id, (sessionsPerVisitor.get(s.visitor_id) || 0) + 1);
    }
    const buckets = { '1': 0, '2': 0, '3': 0, '4–5': 0, '6–10': 0, '11+': 0 } as Record<string, number>;
    const seen = new Set<string>();
    for (const l of leads) {
        if (!l.visitor_id || seen.has(l.visitor_id)) continue;
        seen.add(l.visitor_id);
        const n = sessionsPerVisitor.get(l.visitor_id) || 1;
        if (n === 1) buckets['1'] += 1;
        else if (n === 2) buckets['2'] += 1;
        else if (n === 3) buckets['3'] += 1;
        else if (n <= 5) buckets['4–5'] += 1;
        else if (n <= 10) buckets['6–10'] += 1;
        else buckets['11+'] += 1;
    }
    return Object.entries(buckets).map(([label, count]) => ({ label, count }));
}

// ─────────────────────────────────────────────────────────────────────────
// Lead kalitesi (sıcaklık) — reklam/kanal × sıcaklık kırılımı
// ─────────────────────────────────────────────────────────────────────────

/** Status → kaba sıcaklık kovası. 'other' = new/contacted/follow_up/offer_sent/payment_started/null. */
export type TempBucket = 'hot' | 'warm' | 'cold' | 'won' | 'lost' | 'other';

export function tempBucketOf(status: string | null | undefined): TempBucket {
    switch (status) {
        case 'hot': return 'hot';
        case 'warm': return 'warm';
        case 'cold': return 'cold';
        case 'won': return 'won';
        case 'lost': return 'lost';
        default: return 'other';
    }
}

export interface ResolvedLeadAttribution {
    channel: Channel;
    campaign: string | null;
    adContent: string | null;
    source: string | null;
    medium: string | null;
}

/**
 * Lead'in atribüsyonunu kendi UTM'i + (boşsa) dönüşen ziyaretçinin son
 * session'ından doldur. buildChannelAggregates/buildAdAggregates ile aynı
 * back-fill mantığı — burada tek bir lead için merkezi olarak çözer.
 */
export function resolveLeadAttribution(
    lead: LeadAttributionRow,
    sessionByVisitor: Map<string, SessionRow>,
): ResolvedLeadAttribution {
    const sess = lead.visitor_id ? sessionByVisitor.get(lead.visitor_id) : null;
    const source = lead.utm_source ?? sess?.utm_source ?? null;
    const medium = lead.utm_medium ?? sess?.utm_medium ?? null;
    const campaign = lead.utm_campaign ?? sess?.utm_campaign ?? null;
    const adContent = lead.utm_content ?? sess?.utm_content ?? null;
    const channel = classifyChannel({
        utm_source: source,
        utm_medium: medium,
        utm_campaign: campaign,
        fbclid: lead.fbclid ?? sess?.fbclid ?? null,
        gclid: lead.gclid ?? sess?.gclid ?? null,
        referrer: sess?.referrer ?? null,
    }).channel;
    return { channel, campaign, adContent, source, medium };
}

export type LeadQualityDimension = 'channel' | 'campaign' | 'ad';

/**
 * Ham utm_campaign / utm_content değerini okunaklı Meta kampanya/reklam ismine
 * çevirir. Değer Meta sayısal ID'si ise haritadan ismi döner; değilse (zaten
 * isimse, çözülemeyen tıklama token'ıysa veya haritada yoksa) değeri olduğu gibi
 * bırakır. Harita yoksa no-op.
 */
export function resolveCampaignLabel(
    value: string | null | undefined,
    campaignNames?: Record<string, string>,
): string | null {
    if (!value) return null;
    if (campaignNames && campaignNames[value]) return campaignNames[value];
    return value;
}

/**
 * Meta kampanya ID → isim haritasını backend ucundan çeker. Token/hesap canlıda
 * yapılandırılmamışsa boş harita döner — çağıran taraf ham ID gösterir. Asla
 * hata fırlatmaz (rapor akışını kırmaz).
 */
export async function fetchMetaCampaignNames(): Promise<Record<string, string>> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return {};
        const res = await fetch('/api/admin/meta/campaign-names', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return {};
        const body = await res.json() as { map?: Record<string, string> };
        return body.map || {};
    } catch (err) {
        console.error('[fetchMetaCampaignNames]', err);
        return {};
    }
}

export interface LeadQualityGroup {
    key: string;          // gruplama anahtarı (channel adı / kampanya / utm_content)
    channel: Channel;     // satır rengi/etiketi için baskın kanal
    source: string | null;
    medium: string | null;
    total: number;
    hot: number;
    warm: number;
    cold: number;
    won: number;
    lost: number;
    other: number;
    qualityRate: number;  // (hot + warm + won) / total × 100
}

/**
 * Lead'leri seçilen boyuta (kanal / kampanya / reklam) göre grupla ve her grup
 * içinde sıcaklık kırılımını + kalite oranını hesapla. classifyChannel +
 * session back-fill yeniden kullanılır.
 */
export function buildLeadQualityGroups(
    sessions: SessionRow[],
    leads: LeadAttributionRow[],
    dimension: LeadQualityDimension,
    campaignNames?: Record<string, string>,
): LeadQualityGroup[] {
    const sessionByVisitor = buildLatestSessionByVisitor(sessions);
    const map = new Map<string, LeadQualityGroup>();
    const ensure = (key: string, channel: Channel, source: string | null, medium: string | null): LeadQualityGroup => {
        if (!map.has(key)) {
            map.set(key, {
                key, channel, source, medium,
                total: 0, hot: 0, warm: 0, cold: 0, won: 0, lost: 0, other: 0, qualityRate: 0,
            });
        }
        return map.get(key)!;
    };
    for (const l of leads) {
        const att = resolveLeadAttribution(l, sessionByVisitor);
        let key: string;
        if (dimension === 'channel') key = att.channel;
        // Kampanya boyutunda ID'yi Meta isim haritasıyla çöz. Böylece hem okunaklı
        // isim görünür hem de aynı kampanyanın ID + isim varyantları tek satırda
        // birleşir (ör. "Yeni Trafik Kampanyası" ve onun 120... ID'si).
        else if (dimension === 'campaign') key = resolveCampaignLabel(att.campaign, campaignNames) || '(kampanyasız)';
        // Reklam boyutunda da utm_content ID'sini (varsa) reklam ismine çevir.
        else key = resolveCampaignLabel(att.adContent, campaignNames) || '(reklamsız)';
        const g = ensure(key, att.channel, att.source, att.medium);
        g.total += 1;
        g[tempBucketOf(l.status)] += 1;
    }
    return Array.from(map.values())
        .map(g => ({ ...g, qualityRate: g.total > 0 ? ((g.hot + g.warm + g.won) / g.total) * 100 : 0 }))
        .sort((a, b) => b.total - a.total || b.qualityRate - a.qualityRate);
}

export interface LeadQualityRow {
    id: string;
    customer_name: string | null;
    phone_number: string | null;
    channel: Channel;
    campaign: string | null;
    adContent: string | null;
    source: string | null;
    medium: string | null;
    status: string | null;
    status_source: string | null;
    created_at: string;
}

/** Düz, lead bazlı detay listesi — detay tablosu + CSV export'u besler. */
export function buildLeadQualityRows(
    sessions: SessionRow[],
    leads: LeadAttributionRow[],
): LeadQualityRow[] {
    const sessionByVisitor = buildLatestSessionByVisitor(sessions);
    return leads
        .map(l => {
            const att = resolveLeadAttribution(l, sessionByVisitor);
            return {
                id: l.id,
                customer_name: l.customer_name,
                phone_number: l.phone_number,
                channel: att.channel,
                campaign: att.campaign,
                adContent: att.adContent,
                source: att.source,
                medium: att.medium,
                status: l.status,
                status_source: l.status_source,
                created_at: l.created_at,
            };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Time from visitor's FIRST session to lead creation. Bucketed into
 * {<1sa, 1–6sa, 6–24sa, 1–3g, 3–7g, >7g}.
 */
export function buildTimeToConvert(sessions: SessionRow[], leads: LeadAttributionRow[]): TouchpointBucket[] {
    const firstSessionByVisitor = new Map<string, number>();
    for (const s of sessions) {
        const t = Date.parse(s.started_at);
        if (isNaN(t)) continue;
        const cur = firstSessionByVisitor.get(s.visitor_id);
        if (cur == null || t < cur) firstSessionByVisitor.set(s.visitor_id, t);
    }
    const buckets = { '<1sa': 0, '1–6sa': 0, '6–24sa': 0, '1–3g': 0, '3–7g': 0, '>7g': 0 } as Record<string, number>;
    const HOUR = 3600 * 1000;
    const DAY = 24 * HOUR;
    for (const l of leads) {
        if (!l.visitor_id) continue;
        const t0 = firstSessionByVisitor.get(l.visitor_id);
        const t1 = Date.parse(l.created_at);
        if (t0 == null || isNaN(t1) || t1 < t0) continue;
        const dt = t1 - t0;
        if (dt < HOUR) buckets['<1sa'] += 1;
        else if (dt < 6 * HOUR) buckets['1–6sa'] += 1;
        else if (dt < 24 * HOUR) buckets['6–24sa'] += 1;
        else if (dt < 3 * DAY) buckets['1–3g'] += 1;
        else if (dt < 7 * DAY) buckets['3–7g'] += 1;
        else buckets['>7g'] += 1;
    }
    return Object.entries(buckets).map(([label, count]) => ({ label, count }));
}
