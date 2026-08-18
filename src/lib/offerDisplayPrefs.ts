// Per-teklif görünüm tercihleri (offer_links.offer_snapshot.display).
// Alan yoksa render anında deriveOfferDisplayDefaults ile türetilir —
// AI/remarketing/reissue gibi UI'sız üretim yolları bu sayede ayarsız çalışır.

export interface OfferDisplayPrefs {
    /** Geri sayım bloğu (süre baskısı). */
    countdown?: boolean;
    /** "%X kontenjan doldu" çubuğu — kampanya verisi olmadan uydurma kalır. */
    capacity?: boolean;
    /** ROI / amortisman bloğu — makinesiz sepette anlamsız. */
    roi?: boolean;
    /** Tahmini teslimat metni (örn. "3-5 İş Günü"). Boş/yok ise mevcut zincir
     *  çalışır: kampanya estimated_delivery → offer_experiences → i18n. */
    delivery?: string;
}

export interface OfferDisplayDerivationInput {
    hasCampaign: boolean;
    hasMachine: boolean;
}

/** Boolean toggle'ların efektif hali — delivery serbest metin olduğu için ayrı. */
export type OfferDisplayToggles = Required<Pick<OfferDisplayPrefs, 'countdown' | 'capacity' | 'roi'>>;

/** Admin hiçbir tercih kaydetmediyse kullanılacak otomatik varsayılanlar. */
export function deriveOfferDisplayDefaults(args: OfferDisplayDerivationInput): OfferDisplayToggles {
    return {
        // Kampanyasız + sarf-only teklifte süre baskısı kapalı; makineli veya
        // kampanyalı teklifte 7 günlük geçerlilik gerçek bir son tarih.
        countdown: args.hasCampaign || args.hasMachine,
        capacity: args.hasCampaign,
        roi: args.hasMachine,
    };
}

/** offer_snapshot.display'i güvenle parse et — sadece literal boolean kabul. */
export function parseOfferDisplayPrefs(raw: unknown): OfferDisplayPrefs | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const src = raw as Record<string, unknown>;
    const prefs: OfferDisplayPrefs = {};
    if (typeof src.countdown === 'boolean') prefs.countdown = src.countdown;
    if (typeof src.capacity === 'boolean') prefs.capacity = src.capacity;
    if (typeof src.roi === 'boolean') prefs.roi = src.roi;
    if (typeof src.delivery === 'string' && src.delivery.trim()) prefs.delivery = src.delivery.trim().slice(0, 80);
    return Object.keys(prefs).length > 0 ? prefs : null;
}
