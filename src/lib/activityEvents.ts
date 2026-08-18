// Canlı müşteri aktivite akışı için ortak olay sözlüğü + yardımcılar.
//
// İki kaynak birleşir:
//   1) lead_events  → müşteri adıyla bağlı temiz olaylar (link açıldı, ürün
//      seçildi, ödeme başladı...). event_type kolonu.
//   2) offer_analytics → granüler mikro hareketler (sekme değişimi, ROI,
//      scroll, CTA...). action_type kolonu.
//
// Her iki kaynaktaki olay anahtarları burada TEK yerde TR'ye çevrilir; renk +
// "sıcak olay" (alarm tetikleyen) tanımı da burada. Hem dashboard widget'ı hem
// /admin/live sayfası bu sözlüğü kullanır.

export type ActivitySource = 'lead_event' | 'offer_analytics';

export interface ActivityEntry {
    id: string;
    source: ActivitySource;
    event_type: string;
    created_at: string;
    customer_name: string | null;
    phone_number: string | null;
    lead_id: string | null;
    token: string | null;
    metadata?: any;
}

/** Olay anahtarı → TR etiket. lead_events + offer_analytics birleşik. */
const EVENT_LABELS: Record<string, string> = {
    // lead_events
    lead_created: 'Sisteme yeni giriş yapıldı',
    status_changed: 'Lead statüsü güncellendi',
    offer_viewed: 'Teklif sayfası görüntülendi',
    link_opened: 'Gönderilen linke tıklandı',
    product_selected: 'Aktif teklif içi ürün seçimi yapıldı',
    payment_started: 'Ödeme ekranına (Iframe) geçildi',
    payment_completed: 'Ödeme tamamlandı',
    payment_failed: 'Ödeme başarısız oldu',
    followup_scheduled: 'Otomatik takip görevi oluşturuldu',
    followup_sent: 'Otomasyon botu WhatsApp tetikledi',
    support_request_created: 'Destek talebi oluşturuldu',
    offer_created_manual: 'Manuel teklif oluşturuldu',
    offer_renewed: 'Teklif yenilendi',
    offer_expiry_extended: 'Teklif süresi uzatıldı',
    // offer_analytics (granüler)
    tab_changed: 'Teklif içinde sekme değiştirdi',
    product_viewed: 'Ürünü inceledi',
    package_selected: 'Aksesuar / paket seçti',
    cta_clicked: 'Harekete geçirme butonuna tıkladı',
    offer_generated: 'Teklif otomatik kaydedildi',
    lp_viewed: 'Tanıtım sayfasını görüntüledi',
    lp_cta_clicked: 'Tanıtım sayfasında CTA tıkladı',
    roi_started: 'ROI hesaplamaya başladı',
    roi_completed: 'ROI hesaplamasını tamamladı',
    roi_skipped: 'ROI hesaplamasını atladı',
    model_selected: 'Ürün modeli seçti',
    lead_form_opened: 'İletişim formunu açtı',
    lead_form_submitted: 'İletişim formunu gönderdi',
    bank_transfer_order_confirmed: 'Havale siparişini onayladı',
    reclaim_request_submitted: 'Yeniden teklif talebi gönderdi',
};

const EVENT_DOT_COLORS: Record<string, string> = {
    lead_created: 'bg-violet-500',
    offer_viewed: 'bg-blue-500',
    link_opened: 'bg-sky-500',
    product_selected: 'bg-indigo-500',
    product_viewed: 'bg-indigo-300',
    model_selected: 'bg-indigo-400',
    package_selected: 'bg-indigo-300',
    payment_started: 'bg-amber-500',
    payment_completed: 'bg-emerald-500',
    payment_failed: 'bg-rose-500',
    followup_sent: 'bg-emerald-500',
    followup_scheduled: 'bg-teal-500',
    status_changed: 'bg-slate-400',
    cta_clicked: 'bg-orange-400',
    lead_form_submitted: 'bg-emerald-500',
    lead_form_opened: 'bg-orange-300',
    bank_transfer_order_confirmed: 'bg-emerald-500',
    reclaim_request_submitted: 'bg-amber-400',
    roi_started: 'bg-cyan-400',
    roi_completed: 'bg-cyan-500',
    roi_skipped: 'bg-slate-300',
    tab_changed: 'bg-slate-300',
    lp_viewed: 'bg-blue-300',
    lp_cta_clicked: 'bg-orange-300',
    offer_generated: 'bg-slate-300',
};

/**
 * Yüksek değerli olaylar — sesli/görsel alarm tetikler. Müşteri tam burada
 * "satın alma niyeti" gösteriyor; ekip hemen müdahale etmeli.
 */
export const HOT_EVENTS = new Set<string>([
    'product_selected',
    'payment_started',
    'payment_completed',
    'lead_form_submitted',
    'bank_transfer_order_confirmed',
]);

/**
 * Olay başına "satın-alma niyeti" puanı (0–100). Müşterinin akıştaki en güçlü
 * olayı sıcaklığını belirler. Eşikler offers tarafındaki AI sıcaklık dili ile
 * aynı kelimeleri (Sıcak / Ilık / Soğuk) kullanır ki panel tutarlı kalsın.
 */
const EVENT_INTENT_SCORE: Record<string, number> = {
    payment_completed: 100,
    bank_transfer_order_confirmed: 95,
    payment_started: 85,
    lead_form_submitted: 75,
    product_selected: 65,
    reclaim_request_submitted: 60,
    cta_clicked: 45,
    lp_cta_clicked: 42,
    model_selected: 38,
    package_selected: 36,
    roi_completed: 35,
    product_viewed: 30,
    lead_form_opened: 28,
    roi_started: 26,
    offer_viewed: 25,
    tab_changed: 15,
    lp_viewed: 12,
    link_opened: 10,
    roi_skipped: 8,
    status_changed: 5,
    lead_created: 5,
    offer_created_manual: 5,
    offer_renewed: 5,
    offer_expiry_extended: 3,
    payment_failed: 30,
    followup_scheduled: 0,
    followup_sent: 0,
    offer_generated: 0,
    support_request_created: 20,
};

/**
 * "Geliş" olayları — müşterinin teklife/sayfaya yeniden dönüşünü sayar.
 * Bunların adedi "kaç kez geldi / tekrar geldi mi" sinyalini verir.
 */
export const VISIT_EVENTS = new Set<string>(['link_opened', 'offer_viewed', 'lp_viewed']);

export type Temperature = 'hot' | 'warm' | 'cold';

export interface CustomerSignal {
    /** Akıştaki toplam hareket sayısı. */
    totalEvents: number;
    /** Kaç kez geldi (link/teklif/tanıtım açılışı adedi). */
    visits: number;
    /** Ulaşılan en yüksek niyet puanı. */
    maxScore: number;
    temperature: Temperature;
    /** En az 2 kez gelmiş → tekrar gelen müşteri. */
    returning: boolean;
    firstAt: string;
    lastAt: string;
}

const TEMPERATURE_META: Record<Temperature, { label: string; tone: StatusTone }> = {
    hot: { label: 'Sıcak', tone: 'danger' },
    warm: { label: 'Ilık', tone: 'warning' },
    cold: { label: 'Soğuk', tone: 'neutral' },
};

/** Bir StatusBadge tonu — sıcaklık rozetinde kullanılır. */
export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export function eventIntentScore(type: string): number {
    return EVENT_INTENT_SCORE[type] ?? 0;
}

export function temperatureFromScore(maxScore: number): Temperature {
    if (maxScore >= 60) return 'hot';
    if (maxScore >= 25) return 'warm';
    return 'cold';
}

export function temperatureMeta(t: Temperature): { label: string; tone: StatusTone } {
    return TEMPERATURE_META[t];
}

/**
 * Müşteri kimliği — aynı kişinin farklı olaylarını tek başlık altında toplar.
 * lead > token > ad > olay-id sırasıyla en güvenilir anahtar seçilir.
 */
export function customerKeyOf(
    e: { lead_id?: string | null; token?: string | null; customer_name?: string | null; id?: string },
): string {
    return e.lead_id || e.token || e.customer_name || e.id || '';
}

/**
 * Yüklü akıştan müşteri-bazlı sinyalleri türetir (sıcaklık, geliş sayısı,
 * toplam hareket). Akış son N olayla sınırlı olduğundan sinyaller bu pencere
 * üzerinden hesaplanır.
 */
export function buildCustomerSignals(entries: ActivityEntry[]): Map<string, CustomerSignal> {
    const map = new Map<string, CustomerSignal>();
    for (const e of entries) {
        const key = customerKeyOf(e);
        const score = eventIntentScore(e.event_type);
        const isVisit = VISIT_EVENTS.has(e.event_type);
        const existing = map.get(key);
        if (!existing) {
            map.set(key, {
                totalEvents: 1,
                visits: isVisit ? 1 : 0,
                maxScore: score,
                temperature: temperatureFromScore(score),
                returning: false,
                firstAt: e.created_at,
                lastAt: e.created_at,
            });
        } else {
            existing.totalEvents += 1;
            if (isVisit) existing.visits += 1;
            if (score > existing.maxScore) {
                existing.maxScore = score;
                existing.temperature = temperatureFromScore(score);
            }
            if (e.created_at < existing.firstAt) existing.firstAt = e.created_at;
            if (e.created_at > existing.lastAt) existing.lastAt = e.created_at;
            existing.returning = existing.visits >= 2;
        }
    }
    return map;
}

export function eventLabel(type: string): string {
    return EVENT_LABELS[type] || type;
}

export function eventDotColor(type: string): string {
    return EVENT_DOT_COLORS[type] || 'bg-slate-300';
}

export function isHotEvent(type: string): boolean {
    return HOT_EVENTS.has(type);
}

/**
 * WhatsApp deeplink üretir. Telefon non-digit karakterlerden arındırılır
 * (kod tabanında her yerde kullanılan `/\D/g` kalıbının tek noktası).
 */
export function buildWhatsAppLink(phone: string | null | undefined, text?: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    const base = `https://wa.me/${digits}`;
    return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
