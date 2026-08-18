// Deterministik kapak görseli seçimi — blog kartları ve makale hero zemini.
//
// Sorun: seo_pages.hero_image pratikte hiç set edilmiyordu; tüm kartlar aynı
// jenerik ".ph" (koyu küre) placeholder'ına düşüyordu — botlar fotoğraf
// görürken insanlar görmüyordu. Çözüm: her sayfa, slug'ına göre STABİL bir
// gerçek fotoğraf alır (yenilemede/karta göre değişmez); admin hero_image
// yüklerse o her zaman kazanır.
//
// Havuz self-hosted (public/) — CDN bağımlılığı yok, LCP dostu. Kareler
// mevcut landing/ürün çekimlerinden küratörlü seçkidir.

// Device-forward on purpose (operator decision, 2026-08-15): the pool leads
// with real CAFEPASTE Pro/Lite shots so a blog card — and, since this now also
// feeds og:image, a shared link — shows the machine rather than a generic
// lifestyle frame. Art/lifestyle frames stay in the pool for variety, but the
// device shots outnumber them.
export const SEO_COVER_POOL: string[] = [
    // device
    '/products/cafepaste-pro-main.webp',
    '/products/cafepaste-pro-desktop.webp',
    '/products/cafepaste-pro-pdp-1.webp',
    '/products/cafepaste-pro-pdp-2.webp',
    '/products/cafepaste-lite-main.webp',
    '/products/cafepaste-lite-desktop.webp',
    // device in use
    '/products/usage-selfie.webp',
    // output / lifestyle
    '/cafepaste-selfie-art.webp',
    '/cafepaste-selfie-art2.webp',
    '/cafepaste-selfie-art3.webp',
];

/** djb2 — slug başına stabil, dağılımı yeterli basit hash. */
function hashSlug(slug: string): number {
    let h = 5381;
    for (let i = 0; i < slug.length; i++) {
        h = ((h << 5) + h + slug.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

/**
 * Sayfanın kapak görseli: hero_image > (extraPool + statik havuz)[hash(slug)].
 * extraPool = landing CMS'in visual_proof fotoğrafları (varsa) — önceliklidir
 * çünkü operatörün seçtiği gerçek müşteri kareleridir.
 */
export function coverForPage(
    slug: string,
    heroImage?: string | null,
    extraPool?: string[],
): string {
    if (heroImage) return heroImage;
    const pool = [...(extraPool ?? []), ...SEO_COVER_POOL];
    if (pool.length === 0) return '';
    return pool[hashSlug(slug) % pool.length];
}
