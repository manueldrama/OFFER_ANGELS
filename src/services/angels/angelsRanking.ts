// Angels keşif sıralaması — alaka HER ZAMAN baskındır, Spotlight yalnız
// ince bir itici güçtür (maks boost < tek bir alaka bileşeni).
// Küratörlü küçük veri seti: client-side saf fonksiyon yeterli.

import type { DirectoryCreator, ActivePromotion } from './angelsPortalVenueService';

export interface RankingContext {
    /** Venue'nün şehri veya seçili şehir filtresi */
    city?: string | null;
    /** Venue tipi (cafe/hotel/...) veya seçili kategori filtresi */
    venueType?: string | null;
}

const TIER_WEIGHT: Record<string, number> = {
    celebrity: 1,
    premium_creator: 0.7,
    emerging_creator: 0.5,
};

function cityMatch(c: DirectoryCreator, city?: string | null): number {
    if (!city) return 0.5; // filtre yokken nötr
    const target = city.toLowerCase();
    if ((c.city || '').toLowerCase() === target) return 1;
    if ((c.preferred_collaboration_cities || []).some(x => x.toLowerCase() === target)) return 1;
    if (c.travel_available) return 0.35;
    return 0;
}

function typeMatch(c: DirectoryCreator, venueType?: string | null): number {
    if (!venueType) return 0.5;
    const cats = (c.categories || []).map(x => x.toLowerCase());
    const map: Record<string, string[]> = {
        cafe: ['coffee', 'cafe', 'dessert'],
        restaurant: ['restaurant', 'food', 'dessert'],
        hotel: ['hotel', 'travel', 'luxury brand'],
        cocktail_bar: ['cocktail', 'nightlife'],
        beach_club: ['travel', 'nightlife', 'event'],
        event: ['event', 'nightlife'],
        luxury_brand: ['luxury brand', 'travel'],
        agency: [],
        other: [],
    };
    const wanted = map[venueType] || [];
    if (!wanted.length) return 0.5;
    return wanted.some(w => cats.some(cat => cat.includes(w))) ? 1 : 0.2;
}

function completeness(c: DirectoryCreator): number {
    let score = 0;
    if ((c.gallery_images || []).length >= 3) score += 0.4;
    if (c.bio) score += 0.3;
    if (c.rate_min != null || c.rate_max != null) score += 0.3;
    return score;
}

/** Promosyon bu bağlamda geçerli mi? */
export function promotionMatches(p: ActivePromotion, ctx: RankingContext): boolean {
    switch (p.placement_type) {
        case 'discovery_featured':
        case 'homepage_featured':
        case 'venue_recommendation_boost':
            return true;
        case 'city_spotlight':
            return !ctx.city || p.target_cities.some(x => x.toLowerCase() === ctx.city!.toLowerCase());
        case 'category_spotlight':
            return !ctx.venueType || p.target_venue_types.includes(ctx.venueType);
        default:
            return false;
    }
}

export interface RankedCreator extends DirectoryCreator {
    _score: number;
    _promotion: ActivePromotion | null;
}

export function rankCreators(
    creators: DirectoryCreator[],
    promotions: ActivePromotion[],
    ctx: RankingContext,
): RankedCreator[] {
    const promoByCreator = new Map<string, ActivePromotion>();
    for (const p of promotions) {
        if (promotionMatches(p, ctx) && !promoByCreator.has(p.creator_id)) {
            promoByCreator.set(p.creator_id, p);
        }
    }

    return creators
        .map(c => {
            const relevance =
                40 * cityMatch(c, ctx.city) +
                25 * typeMatch(c, ctx.venueType) +
                15 * (TIER_WEIGHT[c.tier] ?? 0.5) +
                10 * completeness(c) +
                10 * (c.is_featured ? 1 : 0);
            const promotion = promoByCreator.get(c.id) || null;
            const boost = promotion ? 12 : 0; // < 40 → alaka daima kazanır
            return { ...c, _score: relevance + boost, _promotion: promotion };
        })
        .sort((a, b) =>
            b._score - a._score ||
            Number(b.is_featured) - Number(a.is_featured) ||
            (b.created_at || '').localeCompare(a.created_at || ''));
}

/** Featured şeridi: yalnız discovery/homepage_featured promosyonlar + admin featured dolgusu. */
export function featuredStrip(ranked: RankedCreator[], limit = 6): RankedCreator[] {
    const promoted = ranked.filter(c =>
        c._promotion && ['discovery_featured', 'homepage_featured'].includes(c._promotion.placement_type));
    const fill = ranked.filter(c => !promoted.includes(c) && c.is_featured);
    return [...promoted, ...fill].slice(0, limit);
}
