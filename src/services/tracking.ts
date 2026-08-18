import { supabase } from '../lib/supabase/client';
import { firePixelEvent } from '../components/analytics/AdPixels';
import { isStaffViewer } from '../lib/auth/isStaffViewer';

// AI lead skoru, müşteri etkinliğiyle otomatik tazelensin diye etkinlikten sonra
// fire-and-forget yeniden-skorlama tetiklenir. Aynı token için sık çağrıyı önlemek
// adına throttle uygulanır; yüksek değerli olaylar throttle'ı bypass eder.
const RESCORE_THROTTLE_MS = 15_000;
const HIGH_VALUE_EVENTS = new Set(['payment_started', 'payment_completed', 'product_selected']);
const lastRescoreAt = new Map<string, number>();

const triggerRescore = (token: string, eventName: string): void => {
    const now = Date.now();
    const last = lastRescoreAt.get(token) ?? 0;
    if (!HIGH_VALUE_EVENTS.has(eventName) && now - last < RESCORE_THROTTLE_MS) return;
    lastRescoreAt.set(token, now);
    // await edilmez — müşteri akışını bloklamaz, hatalar yutulur.
    void fetch('/api/internal/rescore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    }).catch(() => {});
};

// _fbc / _fbp cookie okuyucu — Meta CAPI'da deduplication ve match quality
// için kritik. fbq scripti yüklendiğinde otomatik yazılır.
const readCookie = (name: string): string | undefined => {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[$()*+?.\\^|]/g, '\\$&') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : undefined;
};

// Browser pixel ile dedupe için event_id üretir. Aynı event_id'yi hem
// fbq('track', name, params, { eventID }) hem de /api/meta/capi-event'e
// gönderiyoruz; Meta ikisini eşleştirip tek dönüşüm sayıyor.
const newEventId = (): string => {
    try {
        const c = (globalThis.crypto as any);
        if (c?.randomUUID) return c.randomUUID();
    } catch { /* fallthrough */ }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

// Read visitor_id from localStorage — used as external_id for Meta CAPI
// deterministic user matching (boosts match quality from ~40% to ~75-85%
// per Meta's benchmark). Same key as analyticsService.VISITOR_KEY.
const readVisitorId = (): string | undefined => {
    if (typeof localStorage === 'undefined') return undefined;
    return localStorage.getItem('cafepaste_visitor_id') || undefined;
};

// Try to split a full name into first/last for Meta's `fn`/`ln` advanced
// matching slots. Single-word names go only to `fn`.
const splitName = (full?: string): { first?: string; last?: string } => {
    if (!full || typeof full !== 'string') return {};
    const parts = full.trim().split(/\s+/);
    if (parts.length === 0) return {};
    if (parts.length === 1) return { first: parts[0] };
    return { first: parts[0], last: parts.slice(1).join(' ') };
};

// country verilmemişse E.164 telefon önekinden türet. Projede telefon-parse
// kütüphanesi yok → TR-odaklı işletme için 90→tr ana kuralı + birkaç yaygın
// önek. Server tarafı buildUserDataFromLead ile AYNI sezgi (tutarlı eşleşme).
// Meta CAPI ülkeyi 2-harf ISO bekler; sunucuda lowercase + hash'lenir.
const deriveCountry = (raw?: unknown, phone?: unknown): string | undefined => {
    if (typeof raw === 'string' && raw.trim()) return raw;
    const d = (typeof phone === 'string' ? phone : '').replace(/\D/g, '');
    if (!d) return undefined;
    if (d.startsWith('90')) return 'tr';
    if (d.startsWith('49')) return 'de';
    if (d.startsWith('44')) return 'gb';
    if (d.startsWith('971')) return 'ae';
    if (d.startsWith('1')) return 'us';
    return undefined;
};

// CAPI'ye PII (email/phone/name/city/etc) gönderebilmek için event'in
// metadata'sından güvenli alanlar çekilir. Sunucuda SHA-256 + lowercase
// normalizasyonu yapılır. Daha fazla alan = Meta match quality artışı.
const buildCapiUserData = (metadata?: Record<string, any>) => {
    const name = splitName(metadata?.customer_name || metadata?.fullName || metadata?.name);
    return {
        email: typeof metadata?.email === 'string' ? metadata.email : undefined,
        phone: typeof metadata?.phone === 'string' ? metadata.phone : undefined,
        first_name: name.first,
        last_name: name.last,
        city: typeof metadata?.city === 'string' ? metadata.city : undefined,
        // country boşsa telefon önekinden türet → ülke coverage'ı yükselir (%26 sorunu).
        country: deriveCountry(metadata?.country, metadata?.phone),
        state: typeof metadata?.region === 'string' ? metadata.region : undefined,
        external_id: readVisitorId(),
        client_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        fbc: readCookie('_fbc'),
        fbp: readCookie('_fbp'),
    };
};

const buildCapiCustomData = (eventName: string, metadata?: Record<string, any>) => {
    const data: Record<string, unknown> = {};
    if (metadata?.value !== undefined) data.value = Number(metadata.value);
    if (metadata?.amount !== undefined && data.value === undefined) data.value = Number(metadata.amount);
    if (metadata?.cartValue !== undefined && data.value === undefined) data.value = Number(metadata.cartValue);
    data.currency = metadata?.currency || 'TRY';
    if (Array.isArray(metadata?.contents)) data.contents = metadata.contents;
    if (eventName === 'Purchase' || eventName === 'InitiateCheckout') {
        if (metadata?.payment_method) data.content_category = metadata.payment_method;
    }
    return data;
};

async function fireCapiEvent(params: {
    eventName: string;
    eventId: string;
    metadata?: Record<string, any>;
}) {
    try {
        await fetch('/api/meta/capi-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_name: params.eventName,
                event_id: params.eventId,
                event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
                event_time: Math.floor(Date.now() / 1000),
                user_data: buildCapiUserData(params.metadata),
                custom_data: buildCapiCustomData(params.eventName, params.metadata),
            }),
        });
    } catch {
        // Pixel zaten browser tarafında fire ettiği için CAPI sessizce başarısız olabilir.
    }
}

// Map our internal event names → Meta/Google standard event names so the ad
// platforms recognize them as conversions. Keys not in this map are forwarded
// as-is (custom events still work but won't show as conversions).
const PIXEL_EVENT_MAP: Partial<Record<string, string>> = {
    lead_form_submitted: 'SubmitApplication',
    payment_completed: 'Purchase',
    payment_started: 'InitiateCheckout',
    bank_transfer_order_confirmed: 'Purchase',
    cta_clicked: 'AddToCart',
    offer_generated: 'Lead',
};

// LinkedIn Insight Tag conversion_id eşlemesi (client-side lintrk için). ID'ler
// Campaign Manager'da oluşturulan conversion'lara karşılık gelir; env'den okunur,
// yoksa undefined → no-op. Server-side LinkedIn Conversions API ayrıca aynı
// eventId ile /api/linkedin/conversion-event üzerinden tetiklenir (dedup).
const liConvId = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
};
const LINKEDIN_CONVERSION_MAP: Partial<Record<string, number | undefined>> = {
    lead_form_submitted: liConvId(import.meta.env.VITE_LINKEDIN_CONVERSION_LEAD),
    offer_generated: liConvId(import.meta.env.VITE_LINKEDIN_CONVERSION_LEAD),
    payment_started: liConvId(import.meta.env.VITE_LINKEDIN_CONVERSION_CHECKOUT),
    payment_completed: liConvId(import.meta.env.VITE_LINKEDIN_CONVERSION_PURCHASE),
    bank_transfer_order_confirmed: liConvId(import.meta.env.VITE_LINKEDIN_CONVERSION_PURCHASE),
};

// LinkedIn Conversions API user_data — hashed email server tarafında üretilir;
// burada plaintext + li_fat_id cookie (Insight Tag set eder) gönderilir.
const buildLinkedInUserData = (metadata?: Record<string, any>) => {
    const name = splitName(metadata?.customer_name || metadata?.fullName || metadata?.name);
    return {
        email: typeof metadata?.email === 'string' ? metadata.email : undefined,
        first_name: name.first,
        last_name: name.last,
        company: typeof metadata?.company_name === 'string' ? metadata.company_name
            : typeof metadata?.companyName === 'string' ? metadata.companyName : undefined,
        title: typeof metadata?.job_title === 'string' ? metadata.job_title
            : typeof metadata?.title === 'string' ? metadata.title : undefined,
        country: typeof metadata?.country === 'string' ? metadata.country : undefined,
        li_fat_id: readCookie('li_fat_id'),
    };
};

async function fireLinkedInConversion(params: {
    eventName: string;   // Meta-standart isim (server rule URN'üne map'ler)
    eventId: string;
    metadata?: Record<string, any>;
}) {
    try {
        await fetch('/api/linkedin/conversion-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_name: params.eventName,
                event_id: params.eventId,
                user_data: buildLinkedInUserData(params.metadata),
                custom_data: buildCapiCustomData(params.eventName, params.metadata),
            }),
        });
    } catch {
        // Insight Tag zaten client tarafında fire ettiği için sessizce başarısız olabilir.
    }
}

export type TrackingEventType =
    | 'link_opened'
    | 'tab_changed'
    | 'product_viewed'
    | 'product_selected'
    | 'package_selected'
    | 'cta_clicked'
    | 'offer_generated'
    | 'payment_started'
    | 'payment_completed'
    | 'payment_failed'
    | 'lp_viewed'
    | 'lp_cta_clicked'
    | 'roi_started'
    | 'roi_completed'
    | 'roi_skipped'
    | 'model_selected'
    | 'lead_form_opened'
    | 'lead_form_submitted'
    | 'bank_transfer_order_confirmed'
    | 'bank_transfer_notified'
    | 'reclaim_request_submitted';

export interface TrackingEventPayload {
    eventName: TrackingEventType;
    token: string | undefined;
    timestamp: string;
    metadata?: Record<string, any>;
}

class TrackingService {
    private static instance: TrackingService;
    private isInitialized = false;
    private invalidTokens = new Set<string>();
    private validatedTokens = new Set<string>();

    private constructor() {
        this.isInitialized = true;
    }

    public static getInstance(): TrackingService {
        if (!TrackingService.instance) {
            TrackingService.instance = new TrackingService();
        }
        return TrackingService.instance;
    }

    /**
     * Validates that the token exists in offer_links before inserting analytics.
     */
    private async validateToken(token: string): Promise<boolean> {
        if (this.validatedTokens.has(token)) return true;
        if (this.invalidTokens.has(token)) return false;

        try {
            const { data } = await supabase
                .from('offer_links')
                .select('token')
                .eq('token', token)
                .maybeSingle();

            if (data) {
                this.validatedTokens.add(token);
                return true;
            } else {
                this.invalidTokens.add(token);
                return false;
            }
        } catch {
            this.invalidTokens.add(token);
            return false;
        }
    }

    /**
     * Dispatches an event to the tracking provider (Supabase).
     */
    public async track(eventName: TrackingEventType, metadata?: Record<string, any>) {
        // URL format: /offer/:token or /offer/:token/teklif/:offerId
        const parts = window.location.pathname.split('/');
        const offerIdx = parts.indexOf('offer');
        const token = offerIdx !== -1 ? parts[offerIdx + 1] : undefined;

        if (!token) return;

        // Admin/satışçı kendi teklif sayfasına bakıyorsa hiçbir şey kaydetme:
        // ne offer_analytics (skor + görüntüleme sayısı), ne de reklam pikseli.
        // Sadece gerçek (anonim) müşteri etkinliği sayılır. Bkz. isStaffViewer.
        if (await isStaffViewer()) {
            if (import.meta.env.DEV) {
                console.debug(`[TRACKING SKIP] ${eventName} — iç kullanıcı (admin oturumu açık)`);
            }
            return;
        }

        // Developer logging
        if (import.meta.env.DEV) {
            console.groupCollapsed(`[TRACKING EVENT] ${eventName}`);
            console.log('Payload:', { offer_token: token, action_type: eventName, metadata });
            console.groupEnd();
        }

        // Validate token exists before inserting (prevents 409 FK violations)
        const isValid = await this.validateToken(token);
        if (!isValid) return;

        const payload = {
            offer_token: token,
            action_type: eventName,
            metadata: metadata || {},
            user_agent: navigator.userAgent
        };

        try {
            const { error } = await supabase.from('offer_analytics').insert([payload]);
            if (error) {
                // Mark token as invalid on persistent FK errors
                this.invalidTokens.add(token);
            } else {
                // Etkinlik kaydedildi → AI skorunu/durumunu otomatik tazele (throttle'lı).
                triggerRescore(token, eventName);
            }
        } catch {
            // Silently ignore — non-critical
        }

        // Forward conversion-relevant events to ad pixels (Meta + Google Ads)
        // AND Meta Conversions API (CAPI) server-side. Browser pixel ile CAPI
        // arasında deduplication için aynı event_id kullanılır.
        const pixelEventName = PIXEL_EVENT_MAP[eventName];
        if (pixelEventName) {
            const eventId = newEventId();
            const liId = LINKEDIN_CONVERSION_MAP[eventName];
            firePixelEvent(pixelEventName, metadata, eventId, liId);
            // CAPI çağrıları async, await etmiyoruz — kullanıcı flow'unu bloklamasın.
            // Meta + LinkedIn aynı eventId ile gönderilir (her platform kendi dedup'unu yapar).
            void fireCapiEvent({ eventName: pixelEventName, eventId, metadata });
            void fireLinkedInConversion({ eventName: pixelEventName, eventId, metadata });
        }
    }
}

export const tracker = TrackingService.getInstance();
