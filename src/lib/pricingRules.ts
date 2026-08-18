// pricing_rules eşleştirme + fiyat semantiği — TEK doğruluk noktası (SAF modül).
//
// Neden ayrı dosya: fiyat çözüm mantığı hem müşteri teklif sayfasında (offerContext →
// PricingResolutionService, browser supabase client'ı ile) hem de Cloudflare worker'da
// (functions/api/remarketing — REST supaFetch ile) gerekiyor. Veri çekme katmanları
// farklı ama KURAL SEÇİMİ ve FİYAT SEMANTİĞİ birebir aynı olmak zorunda; kopyalanırsa
// müşteriye görünen fiyatla remarketing'de basılan fiyat sessizce ayrışır. Bu modül
// supabase/browser bağımlılığı içermez — iki taraf da buradan import eder.
//
// Fiyat semantiği (offerContext.getLiveProducts ile birebir; oradaki blok buraya taşındı):
//   • price_type='full_price'.amount        → LİSTE fiyatı (üstü çizili)
//   • price_type='full_price'.launch_amount → ülke-bazlı lansman fiyatı
//   • price_type='deposit'.amount           → KAMPANYA lansman fiyatı (YALNIZ kampanya-scoped
//     deposit; campaign_id'siz legacy 'deposit' satırı eski kapora tutarıdır, lansman DEĞİL)
//   • Satış fiyatı = kampanya lansmanı → full_price.launch_amount → liste
//   • Para birimi eşleşen kuralı izler (full_price → deposit → 'TRY')
//
// INVARIANT'LAR (31 Tem 2026 vakası — kampanya geçişinde uyduruk fiyat):
//   1. ÜLKE fiyat kuralları campaign_id=NULL olmalı. Kampanyaya kilitlenirse
//      kampanya değiştiği an eşleşmez olur ve fiyat legacy products kolonlarına
//      düşer (müşteriye bayat/yanlış fiyat gider).
//   2. KAMPANYA kuralları mutlaka country_code/market_code + doğru currency
//      taşımalı. Kapsamsız kampanya kuralı (özgüllük 1000) TÜM ülkelerin
//      kurallarını (100) ezer ve tek para birimini dünyaya zorlar.
//   3. products.list_price/launch_price LEGACY'dir; canlı fiyat için asla
//      güvenilmez. Bu kolonlara düşülüyorsa veri hatası var demektir
//      (offerContext bu durumda console.error basar).

export interface PricingRuleLike {
    product_id?: string | null;
    product_package_id?: string | null;
    campaign_id?: string | null;
    country_code?: string | null;
    market_code?: string | null;
    currency_code?: string | null;
    price_type?: string | null;
    amount?: number | null;
    launch_amount?: number | null;
    valid_from?: string | null;
    valid_to?: string | null;
    priority?: number | null;
}

export interface PricingRuleContext {
    campaign_id?: string | null;
    country_code?: string | null;
    market_code?: string | null;
    /** Verilirse kural bu para biriminde olmak ZORUNDA (strict filtre). */
    currency_code?: string | null;
}

/**
 * Null-veya-eşit eşleşme + geçerlilik penceresi. Bir kuralın scope alanı doluysa
 * context ile birebir eşleşmeli; boşsa (null) her context'e uyar (global kural).
 */
export function ruleMatchesContext(r: PricingRuleLike, ctx: PricingRuleContext, now: Date = new Date()): boolean {
    if (r.campaign_id && r.campaign_id !== ctx.campaign_id) return false;
    if (r.country_code && r.country_code !== ctx.country_code) return false;
    if (r.market_code && r.market_code !== ctx.market_code) return false;
    if (ctx.currency_code && r.currency_code !== ctx.currency_code) return false;
    if (r.valid_from && new Date(r.valid_from) > now) return false;
    if (r.valid_to && new Date(r.valid_to) < now) return false;
    return true;
}

/**
 * Hedefleme özgüllüğü: Kampanya+Ülke > Kampanya+Market > Kampanya > Ülke > Market > Global.
 * Paket hedefli kural, jenerik ürün kuralından bir tık daha özgül.
 */
export function calculateSpecificity(rule: PricingRuleLike): number {
    let score = 0;
    if (rule.campaign_id) score += 1000;
    if (rule.country_code) score += 100;
    if (rule.market_code) score += 10;
    if (rule.product_package_id) score += 1;
    return score;
}

/** En özgül kural kazanır; eşitlikte DB priority kolonu bozar. Boş liste → null. */
export function pickBestRule<T extends PricingRuleLike>(rules: T[]): T | null {
    if (!rules.length) return null;
    return [...rules].sort((a, b) => {
        const sa = calculateSpecificity(a);
        const sb = calculateSpecificity(b);
        if (sa !== sb) return sb - sa;
        return (b.priority || 0) - (a.priority || 0);
    })[0];
}

/** Context'e uyan kuralları full_price / deposit olarak ayırıp her tip için en iyisini seçer. */
export function resolveRulePair<T extends PricingRuleLike>(
    rules: T[],
    ctx: PricingRuleContext,
    now: Date = new Date(),
): { fullPrice: T | null; deposit: T | null } {
    const matching = rules.filter((r) => ruleMatchesContext(r, ctx, now));
    return {
        fullPrice: pickBestRule(matching.filter((r) => r.price_type === 'full_price')),
        deposit: pickBestRule(matching.filter((r) => r.price_type === 'deposit')),
    };
}

export interface DerivedOfferPrice {
    /** Liste (üstü çizili) fiyat; kural liste fiyatı vermediyse 0 — çağıran legacy fallback uygular. */
    listPrice: number;
    /** Efektif satış fiyatı (lansman). ruleMatched=true iken her zaman > 0. */
    launchPrice: number;
    currency: string;
    /** En az bir kural fiyat belirledi mi; false → çağıran legacy products kolonlarına düşebilir. */
    ruleMatched: boolean;
}

/** Seçilmiş kural çiftinden fiyat semantiğini türetir (offerContext bloğunun birebir taşınması). */
export function deriveOfferPrice(pair: { fullPrice: PricingRuleLike | null; deposit: PricingRuleLike | null }): DerivedOfferPrice {
    const ruleListPrice = pair.fullPrice?.amount;
    const ruleLaunchAmount = pair.fullPrice?.launch_amount;
    // Kampanya lansmanı yalnız kampanya-scoped deposit kuralından okunur; campaign_id'siz
    // legacy deposit satırı eski kapora tutarıdır, lansman fiyatı olarak OKUNMAZ.
    const campaignLaunch = pair.deposit?.campaign_id ? pair.deposit?.amount : undefined;
    const ruleMatched =
        (typeof ruleListPrice === 'number' && ruleListPrice > 0) ||
        (typeof campaignLaunch === 'number' && campaignLaunch > 0);
    const currency = pair.fullPrice?.currency_code || pair.deposit?.currency_code || 'TRY';

    const listPrice = (typeof ruleListPrice === 'number' && ruleListPrice > 0) ? ruleListPrice : 0;
    const launchPrice =
        (typeof campaignLaunch === 'number' && campaignLaunch > 0) ? campaignLaunch
        : (typeof ruleLaunchAmount === 'number' && ruleLaunchAmount > 0) ? ruleLaunchAmount
        : listPrice;

    return { listPrice, launchPrice, currency, ruleMatched };
}
