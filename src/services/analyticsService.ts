// Site-wide visitor / session / UTM / pageview tracking.
// Powers the admin Analytics dashboard and lead attribution.
//
// Storage layout:
//   localStorage  cafepaste_visitor_id   — durable visitor UUID
//   localStorage  cp_first_touch         — JSON {utm_*, referrer, landing_path}, set ONCE
//   sessionStorage  cp_last_touch        — JSON, refreshed on every UTM-bearing visit
//   sessionStorage  cp_session           — JSON {id, started_at, last_activity_at}
//
// Session = 30min idle timeout. New session triggers geo-resolve + sessions row insert.

import { supabase } from '../lib/supabase/client';

const VISITOR_KEY = 'cafepaste_visitor_id';
const FIRST_TOUCH_KEY = 'cp_first_touch';
const LAST_TOUCH_KEY = 'cp_last_touch';
const SESSION_KEY = 'cp_session';
const SESSION_IDLE_MS = 30 * 60 * 1000;

// ─── Pageview tracking diagnostics ────────────────────────────────────
// Lightweight sessionStorage counters. Read by the admin debug panel to
// surface the gap between attempted vs. successfully recorded pageviews
// (incognito + 3rd-party cookies blocked, network errors, RLS denials).
// No network, no cookies — sessionStorage only.
const PV_COUNTER_KEY = 'cafepaste_pv_counters';
const PV_SKIP_KEY = 'cafepaste_pv_skips';
const PV_SKIP_MAX = 10;

function bumpPvCounter(field: 'attempts' | 'success'): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
        const raw = sessionStorage.getItem(PV_COUNTER_KEY);
        const obj = raw ? JSON.parse(raw) : { attempts: 0, success: 0 };
        obj[field] = (obj[field] || 0) + 1;
        sessionStorage.setItem(PV_COUNTER_KEY, JSON.stringify(obj));
    } catch { /* sessionStorage unavailable */ }
}

function recordPvSkip(reason: string): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
        const raw = sessionStorage.getItem(PV_SKIP_KEY);
        const arr: { reason: string; at: string }[] = raw ? JSON.parse(raw) : [];
        arr.push({ reason, at: new Date().toISOString() });
        sessionStorage.setItem(PV_SKIP_KEY, JSON.stringify(arr.slice(-PV_SKIP_MAX)));
    } catch { /* ignore */ }
}

export interface PvDiagnostics {
    attempts: number;
    success: number;
    skips: { reason: string; at: string }[];
}

/** Read pageview tracking diagnostics for the current browser session. */
export function readPvDiagnostics(): PvDiagnostics {
    if (typeof sessionStorage === 'undefined') return { attempts: 0, success: 0, skips: [] };
    let counters = { attempts: 0, success: 0 };
    let skips: PvDiagnostics['skips'] = [];
    try {
        const rawC = sessionStorage.getItem(PV_COUNTER_KEY);
        if (rawC) counters = { ...counters, ...JSON.parse(rawC) };
        const rawS = sessionStorage.getItem(PV_SKIP_KEY);
        if (rawS) skips = JSON.parse(rawS);
    } catch { /* ignore */ }
    return { ...counters, skips };
}

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
type UtmKey = typeof UTM_PARAMS[number];

const CLICK_ID_PARAMS = ['fbclid', 'gclid'] as const;
type ClickIdKey = typeof CLICK_ID_PARAMS[number];

export interface Touch {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    utm_content: string | null;
    fbclid: string | null;
    gclid: string | null;
    referrer: string | null;
    landing_path: string | null;
    captured_at: string;
}

export interface Geo {
    ip: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    latitude: number | null;
    longitude: number | null;
    geo_provider?: string | null;
    geo_confidence?: number | null;
    // Turkish mobile carriers route all subscribers through a single BGP PoP
    // → every IP-geo provider returns the same NOC city. The resolver tags
    // these as mobile and the dashboard renders "Mobile (Vodafone TR)"
    // instead of a fake city.
    carrier?: string | null;
    is_mobile?: boolean;
}

export interface SessionState {
    id: string;
    started_at: string;
    last_activity_at: string;
}

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

/**
 * Read Microsoft Clarity's _clck (per-browser userId) and _clsk (per-tab
 * sessionId) cookies. Clarity stores multi-field strings delimited by either
 * "^" or "|" — first segment is the ID we need for the player URL:
 *   https://clarity.microsoft.com/player/{projectId}/{userId}/{sessionId}
 * Returns nulls when the script hasn't dropped cookies yet (consent denied,
 * adblock, or first page load before the script runs).
 */
export function getClarityIds(): { user_id: string | null; session_id: string | null } {
    if (!isBrowser() || typeof document === 'undefined') return { user_id: null, session_id: null };
    const cookies = document.cookie.split(';');
    let clck: string | null = null;
    let clsk: string | null = null;
    for (const raw of cookies) {
        const [k, ...rest] = raw.trim().split('=');
        if (!k || rest.length === 0) continue;
        const v = decodeURIComponent(rest.join('='));
        if (k === '_clck') clck = v;
        else if (k === '_clsk') clsk = v;
    }
    const firstSegment = (s: string | null): string | null => {
        if (!s) return null;
        const seg = s.includes('^') ? s.split('^')[0] : s.split('|')[0];
        return seg && seg.length > 0 ? seg : null;
    };
    return { user_id: firstSegment(clck), session_id: firstSegment(clsk) };
}

// Session başına aktif yoklamayı takip et — getOrCreateSession sık çağrıldığı
// için aynı session'a birden fazla interval yığılmasını engeller.
const clarityBindPolling = new Set<string>();

// Lead başına aktif yoklamayı takip et (bindLeadClarityIdsWhenReady).
const clarityLeadBindPolling = new Set<string>();

/**
 * Clarity'nin _clck/_clsk cookie'leri DROP edene kadar kısa bir pencere boyunca
 * yoklar ve göründükleri an sessions satırına yazar. KRİTİK: Clarity scripti
 * (AdPixels) tembel yüklenir — ilk etkileşim/idle sonrası inject olur, sonra
 * clarity.ms'den inip cookie düşürmesi saniyeler sürer. Eski yaklaşımda yakalama
 * yalnızca trackPageview'a bağlıydı; tek-sayfalık ziyaretlerde ikinci bir pageview
 * olmadığından kimlikler kalıcı olarak NULL kalıyordu → admin lead kartında
 * doğrudan "Kaydı Aç" linki hiç çıkmıyordu. Bu poller yakalamayı pageview'dan
 * ayırır.
 *
 * İdempotent + best-effort: session başına en fazla bir başarılı UPDATE
 * (sessionStorage flag + .is('clarity_user_id', null) ile guard'lı), tüm hatalar
 * yutulur. ~60sn sonra vazgeçer (adblock/consent ile Clarity hiç yüklenmeyebilir).
 */
export function bindClarityIdsWhenReady(sessionId: string): void {
    if (!isBrowser() || !sessionId) return;
    const flagKey = `cafepaste_clarity_bound_${sessionId}`;
    if (sessionStorage.getItem(flagKey)) return;
    if (clarityBindPolling.has(sessionId)) return;

    const tryBind = (): boolean => {
        const ids = getClarityIds();
        if (!ids.user_id || !ids.session_id) return false;
        // Başarı varsayımıyla flag'i hemen set et — aynı tarayıcıda tekrar
        // denenmesin. UPDATE .is(null) guard'ı yarış durumunda da güvenli.
        sessionStorage.setItem(flagKey, '1');
        void supabase
            .from('sessions')
            .update({ clarity_user_id: ids.user_id, clarity_session_id: ids.session_id })
            .eq('id', sessionId)
            .is('clarity_user_id', null)
            .then(() => undefined);
        return true;
    };

    // Cookie'ler zaten hazırsa interval kurma.
    if (tryBind()) return;

    clarityBindPolling.add(sessionId);
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // ~60sn (2sn aralık)
    const timer = setInterval(() => {
        attempts += 1;
        if (tryBind() || attempts >= MAX_ATTEMPTS) {
            clearInterval(timer);
            clarityBindPolling.delete(sessionId);
        }
    }, 2000);
}

/**
 * Clarity'nin _clck/_clsk cookie'leri DROP edene kadar yoklar ve göründükleri an
 * DOĞRUDAN lead satırına yazar (sessions değil). bindClarityIdsWhenReady ile aynı
 * poll desenini kullanır; tek farkı hedef tablo. Sebep: admin lead kartı derin-link
 * hedefini (clarity.microsoft.com/player/{pid}/{uid}/{sid}) lead'in kendi alanından
 * kurabilsin — kırılgan lead↔visitor↔session join'ine bağlı kalmadan.
 *
 * Anon UPDATE; leads anon-yazılabilir (bkz. guest.ts assigned_to update), RLS'e
 * takılmaz. İdempotent + best-effort: lead başına en fazla bir başarılı UPDATE
 * (sessionStorage flag + .is('clarity_user_id', null) guard'ı), tüm hatalar yutulur.
 * ~60sn sonra vazgeçer (adblock/consent ile Clarity hiç yüklenmeyebilir).
 */
export function bindLeadClarityIdsWhenReady(leadId: string): void {
    if (!isBrowser() || !leadId) return;
    const flagKey = `cafepaste_lead_clarity_${leadId}`;
    if (sessionStorage.getItem(flagKey)) return;
    if (clarityLeadBindPolling.has(leadId)) return;

    const tryBind = (): boolean => {
        const ids = getClarityIds();
        if (!ids.user_id || !ids.session_id) return false;
        // Başarı varsayımıyla flag'i hemen set et — aynı tarayıcıda tekrar
        // denenmesin. UPDATE .is(null) guard'ı yarış durumunda da güvenli.
        sessionStorage.setItem(flagKey, '1');
        void supabase
            .from('leads')
            .update({ clarity_user_id: ids.user_id, clarity_session_id: ids.session_id })
            .eq('id', leadId)
            .is('clarity_user_id', null)
            .then(() => undefined);
        return true;
    };

    if (tryBind()) return;

    clarityLeadBindPolling.add(leadId);
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // ~60sn (2sn aralık)
    const timer = setInterval(() => {
        attempts += 1;
        if (tryBind() || attempts >= MAX_ATTEMPTS) {
            clearInterval(timer);
            clarityLeadBindPolling.delete(leadId);
        }
    }, 2000);
}

/**
 * Microsoft Clarity'ye visitor + session bilgilerini gonder. Clarity script
 * yuklenmemis ise sessizce yutar. Admin lead detayinda 'lead_id' tag'i ile
 * o lead'in session'ini filtreleyebiliriz.
 */
export function pushClarityIdentity(opts: {
    visitor_id?: string | null;
    session_id?: string | null;
    lead_id?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    fbclid?: string | null;
    gclid?: string | null;
}): void {
    if (!isBrowser()) return;
    const c = (window as any).clarity;
    if (typeof c !== 'function') return;
    try {
        if (opts.visitor_id) {
            // identify -> Clarity'nin built-in userId alanı (heatmap segmentation için).
            // set('visitor_id', ...) -> bizim admin dashboard'da customTags filtresi
            // (clarityForVisitor) ile spesifik ziyaretçinin replay'ini açabilmek için.
            c('identify', opts.visitor_id);
            c('set', 'visitor_id', opts.visitor_id);
        }
        if (opts.session_id) c('set', 'session_id', opts.session_id);
        if (opts.lead_id) c('set', 'lead_id', opts.lead_id);
        if (opts.utm_source) c('set', 'utm_source', opts.utm_source);
        if (opts.utm_medium) c('set', 'utm_medium', opts.utm_medium);
        if (opts.utm_campaign) c('set', 'utm_campaign', opts.utm_campaign);
        if (opts.utm_content) c('set', 'utm_content', opts.utm_content);
        if (opts.fbclid) c('set', 'has_fbclid', 'true');
        if (opts.gclid) c('set', 'has_gclid', 'true');
    } catch { /* swallow */ }
}

// Skip bots — they don't carry useful analytics signal and inflate counts.
// Tightened to specific crawler/preview agents only. Real users on Meta
// in-app browsers (Instagram, Facebook app WebViews) carry FBAN/FBAV/IGAB
// tokens — we explicitly do NOT match those. Previously a loose "whatsapp"
// substring also matched WhatsApp's link-preview crawler UA which was fine,
// but the broader "preview" token risked false-positive on edge UAs.
const BOT_RE = /Googlebot|bingbot|YandexBot|DuckDuckBot|Baiduspider|AhrefsBot|SemrushBot|MJ12bot|facebookexternalhit|WhatsApp\/|TelegramBot|Slackbot|TwitterBot|LinkedInBot|Discordbot|PetalBot|Applebot|HeadlessChrome/;
function isBot(): boolean {
    return typeof navigator !== 'undefined' && BOT_RE.test(navigator.userAgent || '');
}

export function getOrCreateVisitorId(): string {
    if (!isBrowser()) return '';
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
}

/**
 * Bind current browser visitor to a known lead. Used when a lead arrives via
 * a channel that bypasses the landing form (e.g. WhatsApp offer link from a
 * Google-Sheets-imported lead). Without this, visitor history & Clarity
 * session replays never surface in the admin lead card.
 *
 * Safe to call repeatedly — guarded by sessionStorage per (visitor, lead) pair.
 */
export async function linkVisitorToLead(leadId: string): Promise<void> {
    if (!isBrowser() || !leadId || isBot()) return;
    const visitor_id = getOrCreateVisitorId();
    if (!visitor_id) return;
    const flagKey = `cafepaste_vlink_${visitor_id}_${leadId}`;
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, '1');
    try {
        const now = new Date().toISOString();
        // Düz insert (upsert ON CONFLICT anon'da 42501 RLS'e takılıyor). Visitor
        // çoğu zaman session tracking'den zaten vardır; 23505 (zaten var) yok sayılır.
        await supabase
            .from('visitors')
            .insert({
                visitor_id,
                first_seen_at: now,
                last_seen_at: now,
                first_landing_path: typeof window !== 'undefined' ? window.location.pathname : null,
                first_referrer: typeof document !== 'undefined' ? (document.referrer || null) : null,
            });
        await supabase
            .from('visitors')
            .update({ lead_id: leadId, last_seen_at: now })
            .eq('visitor_id', visitor_id)
            .is('lead_id', null);
        pushClarityIdentity({ lead_id: leadId });
        // Clarity cookie'leri düşünce userId/sessionId'yi DOĞRUDAN lead'e yaz —
        // admin kartı derin-linki session join'e bağlı kalmadan bu lead'in
        // kaydına gitsin.
        bindLeadClarityIdsWhenReady(leadId);
    } catch { /* swallow */ }
}

function readUrlUtm(): Partial<Record<UtmKey, string>> {
    if (!isBrowser()) return {};
    const sp = new URLSearchParams(window.location.search);
    const out: Partial<Record<UtmKey, string>> = {};
    for (const k of UTM_PARAMS) {
        const v = sp.get(k);
        if (v) out[k] = v;
    }
    return out;
}

function readUrlClickIds(): Partial<Record<ClickIdKey, string>> {
    if (!isBrowser()) return {};
    const sp = new URLSearchParams(window.location.search);
    const out: Partial<Record<ClickIdKey, string>> = {};
    for (const k of CLICK_ID_PARAMS) {
        const v = sp.get(k);
        if (v) out[k] = v;
    }
    return out;
}

function detectDeviceType(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent;
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
}

interface BrowserOS {
    browser: string;
    browser_version: string;
    os: string;
    os_version: string;
}

/**
 * Lightweight UA parser — no dependency. Order matters: Edge before Chrome,
 * Opera before Chrome, Safari last because Chrome on iOS also matches Safari.
 */
export function detectBrowserAndOs(ua: string): BrowserOS {
    let browser = 'Unknown', browser_version = '';
    let os = 'Unknown', os_version = '';
    if (!ua) return { browser, browser_version, os, os_version };

    let m: RegExpMatchArray | null;
    if ((m = ua.match(/Edg\/(\d+(?:\.\d+)?)/))) { browser = 'Edge'; browser_version = m[1]; }
    else if ((m = ua.match(/OPR\/(\d+(?:\.\d+)?)/))) { browser = 'Opera'; browser_version = m[1]; }
    else if ((m = ua.match(/SamsungBrowser\/(\d+(?:\.\d+)?)/))) { browser = 'Samsung Internet'; browser_version = m[1]; }
    else if ((m = ua.match(/Firefox\/(\d+(?:\.\d+)?)/))) { browser = 'Firefox'; browser_version = m[1]; }
    else if ((m = ua.match(/Chrome\/(\d+(?:\.\d+)?)/))) { browser = 'Chrome'; browser_version = m[1]; }
    else if ((m = ua.match(/Version\/(\d+(?:\.\d+)?).*Safari/))) { browser = 'Safari'; browser_version = m[1]; }

    if ((m = ua.match(/Windows NT (\d+(?:\.\d+)?)/))) { os = 'Windows'; os_version = m[1]; }
    else if ((m = ua.match(/Android (\d+(?:\.\d+)?)/))) { os = 'Android'; os_version = m[1]; }
    else if ((m = ua.match(/iPhone OS (\d+[_\.]\d+)/)) || (m = ua.match(/CPU OS (\d+[_\.]\d+)/))) { os = 'iOS'; os_version = m[1].replace('_', '.'); }
    else if ((m = ua.match(/Mac OS X (\d+[_\.]\d+)/))) { os = 'macOS'; os_version = m[1].replace('_', '.'); }
    else if (/Linux/.test(ua)) { os = 'Linux'; }

    return { browser, browser_version, os, os_version };
}

/** Capture UTM + click IDs from URL into first-touch (once) + last-touch (every time). */
export function captureUtm(): void {
    if (!isBrowser()) return;
    const utm = readUrlUtm();
    const click = readUrlClickIds();
    const hasUtm = Object.keys(utm).length > 0;
    const hasClick = Object.keys(click).length > 0;
    const referrer = document.referrer || null;
    const landing_path = window.location.pathname || '/';

    // First-touch: only set if missing.
    if (!localStorage.getItem(FIRST_TOUCH_KEY)) {
        const ft: Touch = {
            utm_source: utm.utm_source ?? null,
            utm_medium: utm.utm_medium ?? null,
            utm_campaign: utm.utm_campaign ?? null,
            utm_term: utm.utm_term ?? null,
            utm_content: utm.utm_content ?? null,
            fbclid: click.fbclid ?? null,
            gclid: click.gclid ?? null,
            referrer,
            landing_path,
            captured_at: new Date().toISOString(),
        };
        localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(ft));
    }

    // Last-touch: refresh if this visit carries UTM OR a click ID — a fresh
    // ad click without UTM still warrants overwriting prior session attribution.
    //
    // CRITICAL: merge with previous last-touch instead of overwriting fields
    // with null. If a visitor lands with ?fbclid=X (no utm) and then re-visits
    // via ?utm_source=email (no fbclid), we MUST preserve fbclid=X — otherwise
    // ad attribution gets wiped by every subsequent direct/organic touch.
    // A new fbclid/gclid value of course overrides any prior one.
    if (hasUtm || hasClick) {
        const prev = getLastTouch();
        const lt: Touch = {
            utm_source: utm.utm_source ?? prev?.utm_source ?? null,
            utm_medium: utm.utm_medium ?? prev?.utm_medium ?? null,
            utm_campaign: utm.utm_campaign ?? prev?.utm_campaign ?? null,
            utm_term: utm.utm_term ?? prev?.utm_term ?? null,
            utm_content: utm.utm_content ?? prev?.utm_content ?? null,
            fbclid: click.fbclid ?? prev?.fbclid ?? null,
            gclid: click.gclid ?? prev?.gclid ?? null,
            referrer: referrer ?? prev?.referrer ?? null,
            landing_path,
            captured_at: new Date().toISOString(),
        };
        sessionStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(lt));
    }
}

export function getFirstTouch(): Touch | null {
    if (!isBrowser()) return null;
    const raw = localStorage.getItem(FIRST_TOUCH_KEY);
    return raw ? safeParse<Touch>(raw) : null;
}

export function getLastTouch(): Touch | null {
    if (!isBrowser()) return null;
    const raw = sessionStorage.getItem(LAST_TOUCH_KEY);
    return raw ? safeParse<Touch>(raw) : null;
}

function safeParse<T>(raw: string): T | null {
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

async function resolveGeo(sessionId?: string): Promise<Geo> {
    const empty: Geo = { ip: null, country: null, city: null, region: null, latitude: null, longitude: null, geo_provider: null, geo_confidence: null };
    try {
        // Worker side: CF sync (~0ms) + ipinfo (~2.5s timeout) + maybe ipapi (~2.5s).
        // Worst-case wire = ~5.5s, so we allow 8s here to avoid spurious aborts on
        // mobile networks. The Worker negative-caches null results so any single
        // slow lookup pollutes at most one session per IP per hour.
        // session_id geçilirse Worker geo'yu service-role ile o oturuma yazar
        // (tarayıcı UPDATE'i anon RLS'e takıldığı için IP çoğu satırda boş kalıyordu).
        const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
        const r = await fetch(`/api/internal/geo-resolve${qs}`, {
            method: 'GET',
            signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return empty;
        return (await r.json()) as Geo;
    } catch {
        return empty;
    }
}

function readSessionState(): SessionState | null {
    if (!isBrowser()) return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? safeParse<SessionState>(raw) : null;
}

function writeSessionState(s: SessionState): void {
    if (!isBrowser()) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

/**
 * Returns the current session id, creating a new session row in Supabase if
 * none exists or the previous one is idle > 30min.
 */
export async function getOrCreateSession(): Promise<string | null> {
    if (!isBrowser() || isBot()) return null;
    const visitor_id = getOrCreateVisitorId();
    captureUtm();

    const now = Date.now();
    const existing = readSessionState();
    if (existing) {
        const last = Date.parse(existing.last_activity_at);
        if (!isNaN(last) && now - last < SESSION_IDLE_MS) {
            // Bump activity timestamp.
            writeSessionState({ ...existing, last_activity_at: new Date(now).toISOString() });
            // Clarity tag'lerini hatirlat (sayfa refresh sonrasinda Clarity script
            // yeniden yuklenirken bizim cagriyi kaybedebilir).
            pushClarityIdentity({ visitor_id, session_id: existing.id });
            // Cookie'ler (yeni sekme/geç yüklenen Clarity) henüz düşmemiş olabilir —
            // sürdürülen oturum için de yoklamayı garanti et.
            bindClarityIdsWhenReady(existing.id);
            // Mid-session ad re-click: if THIS pageview carried a fresh
            // fbclid/gclid/utm_*, patch the existing session row so admin
            // analytics doesn't keep classifying the visitor as "Direct".
            // captureUtm() above already wrote them into sessionStorage; we
            // just mirror the just-arrived URL params (not the merged last-touch,
            // which may also include older fbclid we don't want re-stamping).
            const freshClick = readUrlClickIds();
            const freshUtm = readUrlUtm();
            if (Object.keys(freshClick).length > 0 || Object.keys(freshUtm).length > 0) {
                const patch: Record<string, string | null> = {};
                if (freshClick.fbclid) patch.fbclid = freshClick.fbclid;
                if (freshClick.gclid) patch.gclid = freshClick.gclid;
                if (freshUtm.utm_source) patch.utm_source = freshUtm.utm_source;
                if (freshUtm.utm_medium) patch.utm_medium = freshUtm.utm_medium;
                if (freshUtm.utm_campaign) patch.utm_campaign = freshUtm.utm_campaign;
                if (freshUtm.utm_term) patch.utm_term = freshUtm.utm_term;
                if (freshUtm.utm_content) patch.utm_content = freshUtm.utm_content;
                if (Object.keys(patch).length > 0) {
                    void supabase
                        .from('sessions')
                        .update(patch)
                        .eq('id', existing.id)
                        .then(() => undefined);
                }
            }
            return existing.id;
        }
    }

    // Need a fresh session. CRITICAL: do NOT await geo-resolve here — that
    // call can take up to 8s on cold paths, and users who close the tab
    // during that window get LOST entirely (no session row, no lead
    // attribution). Insert the session row with what we have synchronously,
    // then PATCH it with geo when the resolver returns.
    const last = getLastTouch() || getFirstTouch();
    const bos = detectBrowserAndOs(navigator.userAgent);
    // Clarity cookies dropped by clarity.js — may be null on the very first
    // pageview if the script hasn't initialized yet. trackPageview retries
    // via the late-binding update below.
    const clarityIds = getClarityIds();
    // Session id'yi CLIENT'ta üret — insert sonrası satırı geri OKUMAYALIM.
    // sessions SELECT politikası yalnızca authenticated olduğu için
    // `.insert().select('id')` (PostgREST RETURNING) anon ziyaretçide RLS'e
    // takılıp 42501 dönüyordu → HER reklam/organik oturum sessizce düşüyor,
    // utm/fbclid atribüsyonu sıfırlanıyordu. Kendi uuid'mizi verip
    // return=minimal ile insert etmek, SELECT'i gevşetmeden anon insert'i çalıştırır.
    const newSessionId = crypto.randomUUID();
    const sessionRow = {
        id: newSessionId,
        visitor_id,
        ip_address: null,
        country: null,
        city: null,
        region: null,
        latitude: null,
        longitude: null,
        user_agent: navigator.userAgent,
        device_type: detectDeviceType(),
        browser: bos.browser,
        browser_version: bos.browser_version || null,
        os: bos.os,
        os_version: bos.os_version || null,
        geo_provider: null,
        geo_confidence: null,
        utm_source: last?.utm_source ?? null,
        utm_medium: last?.utm_medium ?? null,
        utm_campaign: last?.utm_campaign ?? null,
        utm_term: last?.utm_term ?? null,
        utm_content: last?.utm_content ?? null,
        fbclid: last?.fbclid ?? null,
        gclid: last?.gclid ?? null,
        referrer: document.referrer || null,
        landing_path: window.location.pathname || '/',
        pageviews: 0,
        clarity_user_id: clarityIds.user_id,
        clarity_session_id: clarityIds.session_id,
    };

    // Visitor satırı session'dan ÖNCE var olmalı — FK: sessions.visitor_id →
    // visitors(visitor_id). ensureVisitor upsert + ignoreDuplicates kullanır
    // (anon INSERT RLS'i geçer, dönüş minimal). Önceden ensureVisitor session
    // insert'inden SONRA çağrılıyordu; yeni ziyaretçide session FK'ye (23503)
    // takılıp düşüyordu — ki bu daha önce .select('id') kaynaklı 401 RLS hatası
    // tarafından maskeleniyordu.
    const noGeo: Geo = { ip: null, country: null, city: null, region: null, latitude: null, longitude: null };
    await ensureVisitor(visitor_id, noGeo);

    const { error } = await supabase
        .from('sessions')
        .insert(sessionRow);

    if (error) return null;

    const state: SessionState = {
        id: newSessionId,
        started_at: new Date(now).toISOString(),
        last_activity_at: new Date(now).toISOString(),
    };
    writeSessionState(state);

    // Clarity cookie'leri insert anında çoğu zaman henüz yok (script tembel
    // yüklenir). Yoklamayı başlat — cookie düşünce session satırına yazılır.
    bindClarityIdsWhenReady(newSessionId);

    // Geo resolution runs AFTER the session row exists. If the user closes
    // the tab before this finishes, we still have the session counted —
    // just without a city. The PATCH below back-fills it for users who stay.
    void resolveGeo(newSessionId).then(geo => {
        if (!geo.country && !geo.city && !geo.ip) return;
        void supabase
            .from('sessions')
            .update({
                ip_address: geo.ip,
                country: geo.country,
                city: geo.city,
                region: geo.region,
                latitude: geo.latitude,
                longitude: geo.longitude,
                geo_provider: geo.geo_provider ?? null,
                geo_confidence: geo.geo_confidence ?? null,
            })
            .eq('id', newSessionId)
            .then(() => undefined);
    });

    // Bump visitor last_seen_at (best-effort, non-blocking).
    void supabase
        .from('visitors')
        .update({ last_seen_at: new Date(now).toISOString() })
        .eq('visitor_id', visitor_id)
        .then(() => undefined);

    // Clarity'ye visitor + session + UTM bilgilerini gonder (varsa).
    // utm_content/fbclid/gclid de gonderiliyor cunku admin dashboard'da
    // "reklam-bazli session replay" filtreleri bu tag'leri kullaniyor.
    pushClarityIdentity({
        visitor_id,
        session_id: newSessionId,
        utm_source: last?.utm_source ?? null,
        utm_medium: last?.utm_medium ?? null,
        utm_campaign: last?.utm_campaign ?? null,
        utm_content: last?.utm_content ?? null,
        fbclid: last?.fbclid ?? null,
        gclid: last?.gclid ?? null,
    });

    return newSessionId;
}

async function ensureVisitor(visitor_id: string, geo: Geo): Promise<void> {
    const ft = getFirstTouch();
    // DÜZ insert — upsert (ON CONFLICT ... ) anon rolünde RLS'e (42501) takılıyor;
    // düz INSERT WITH CHECK(true) politikasını geçer. Dönen ziyaretçide 23505
    // (unique_violation) beklenir ve YOK SAYILIR (satır zaten var; first-touch'ı
    // ezmek istemiyoruz, last_seen_at zaten ayrı UPDATE ile güncelleniyor).
    // .select() YOK — sessions ile aynı sebepten anon SELECT politikası yok.
    const { error } = await supabase
        .from('visitors')
        .insert({
            visitor_id,
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            first_ip: geo.ip,
            first_country: geo.country,
            first_city: geo.city,
            first_region: geo.region,
            first_utm_source: ft?.utm_source ?? null,
            first_utm_medium: ft?.utm_medium ?? null,
            first_utm_campaign: ft?.utm_campaign ?? null,
            first_utm_term: ft?.utm_term ?? null,
            first_utm_content: ft?.utm_content ?? null,
            first_fbclid: ft?.fbclid ?? null,
            first_gclid: ft?.gclid ?? null,
            first_referrer: ft?.referrer ?? null,
            first_landing_path: ft?.landing_path ?? null,
        });
    // 23505 = visitor zaten var (normal, dönen ziyaretçi). Diğer hataları da
    // best-effort olarak yutarız — FK için satırın var olması yeterli.
    void error;
}

/** Record a pageview for the current session. Safe to call on every route change. */
export async function trackPageview(path: string, title?: string): Promise<void> {
    if (!isBrowser()) return;
    if (isBot()) {
        recordPvSkip('bot');
        return;
    }
    bumpPvCounter('attempts');
    const visitor_id = getOrCreateVisitorId();
    const session_id = await getOrCreateSession();
    if (!session_id) {
        recordPvSkip('no_session');
        return;
    }

    const { error: pvError } = await supabase.from('pageviews').insert({
        session_id,
        visitor_id,
        path,
        title: title ?? document.title ?? null,
    });
    if (pvError) {
        recordPvSkip(`insert_error:${pvError.code || pvError.message?.slice(0, 40) || 'unknown'}`);
    } else {
        bumpPvCounter('success');
    }

    // Late-bind Clarity IDs: the clarity.js script often drops _clck/_clsk
    // cookies AFTER our first sessions row insert. bindClarityIdsWhenReady
    // yoklamayı yönetir (zaten çalışıyorsa no-op) — pageview'a bağlı kalmadan
    // deep-link hedefini (clarity.microsoft.com/player/{pid}/{uid}/{sid}) yazar.
    bindClarityIdsWhenReady(session_id);
}

/**
 * Build the attribution + geo bundle for inclusion in lead INSERT payloads.
 * Reads from current session state — no network call.
 */
export async function getLeadAttribution(): Promise<{
    visitor_id: string;
    ip_address: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    latitude: number | null;
    longitude: number | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
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
    referrer: string | null;
    landing_path: string | null;
    fbp: string | null;
    fbc: string | null;
    user_agent: string | null;
}> {
    if (!isBrowser()) {
        return {
            visitor_id: '',
            ip_address: null, country: null, city: null, region: null, latitude: null, longitude: null,
            utm_source: null, utm_medium: null, utm_campaign: null,
            utm_term: null, utm_content: null,
            fbclid: null, gclid: null,
            first_utm_source: null, first_utm_medium: null, first_utm_campaign: null,
            first_fbclid: null, first_gclid: null,
            browser: null, os: null,
            referrer: null, landing_path: null,
            fbp: null, fbc: null, user_agent: null,
        };
    }

    const visitor_id = getOrCreateVisitorId();
    const ft = getFirstTouch();
    const lt = getLastTouch() || ft;

    // Read geo from the current session row (we already resolved it once).
    const sessionState = readSessionState();
    let geo: Geo = { ip: null, country: null, city: null, region: null, latitude: null, longitude: null };
    if (sessionState) {
        const { data } = await supabase
            .from('sessions')
            .select('ip_address, country, city, region, latitude, longitude')
            .eq('id', sessionState.id)
            .maybeSingle();
        if (data) {
            geo = {
                ip: data.ip_address ?? null,
                country: data.country ?? null,
                city: data.city ?? null,
                region: data.region ?? null,
                latitude: data.latitude != null ? Number(data.latitude) : null,
                longitude: data.longitude != null ? Number(data.longitude) : null,
            };
        }
    }

    const bos = detectBrowserAndOs(navigator.userAgent);
    return {
        visitor_id,
        ip_address: geo.ip,
        country: geo.country,
        city: geo.city,
        region: geo.region,
        latitude: geo.latitude,
        longitude: geo.longitude,
        utm_source: lt?.utm_source ?? null,
        utm_medium: lt?.utm_medium ?? null,
        utm_campaign: lt?.utm_campaign ?? null,
        utm_term: lt?.utm_term ?? null,
        utm_content: lt?.utm_content ?? null,
        fbclid: lt?.fbclid ?? null,
        gclid: lt?.gclid ?? null,
        first_utm_source: ft?.utm_source ?? null,
        first_utm_medium: ft?.utm_medium ?? null,
        first_utm_campaign: ft?.utm_campaign ?? null,
        first_fbclid: ft?.fbclid ?? null,
        first_gclid: ft?.gclid ?? null,
        browser: bos.browser,
        os: bos.os,
        referrer: lt?.referrer ?? null,
        landing_path: lt?.landing_path ?? null,
        // Meta CAPI advanced matching: _fbp/_fbc cookie'leri (Meta Pixel set eder) +
        // user agent. Lead'e kalıcılaştırılır → CRM cron / Purchase olayları (tarayıcı
        // bağlamı yokken) bunları server-side gönderebilir.
        fbp: readMetaCookie('_fbp'),
        fbc: readMetaCookie('_fbc'),
        user_agent: navigator.userAgent || null,
    };
}

// Meta Pixel cookie okuyucu (_fbp / _fbc). Yoksa null.
function readMetaCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[$()*+?.\\^|]/g, '\\$&') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}
