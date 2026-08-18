// Kayan "trust" logo marquee'sinin TEK kaynağı. Landing hero (mobil+masaüstü),
// Final Offer Hero ve Customer Offer sayfalarındaki marquee'ler bu listeden beslenir.
//
// Logo dosyaları /public/logos/ altında durur. Format SVG ZORUNLU DEĞİL — şeffaf
// arka planlı PNG / WebP de çalışır. Marquee, görseli `brightness(0) invert(1)`
// filtresiyle otomatik tek-renk (grayscale silüet) gösterir; logoyu önceden griye
// çevirmeye gerek yok. En temiz sonuç için: wordmark/amblem tipi, şeffaf arka planlı.
//
// Gerçek müşteri/referans logolarını eklerken SADECE bu listeyi güncelle (dosya adı + alt).

export interface BrandLogo {
    src: string;
    alt: string;
}

export const BRAND_LOGOS: BrandLogo[] = [
    { src: '/logos/sheraton.png', alt: 'Sheraton Hotels & Resorts' },
    { src: '/logos/jumeriah.png', alt: 'Jumeirah Hotels & Resorts' },
    { src: '/logos/athene.png', alt: 'Hôtel Plaza Athénée Paris' },
    { src: '/logos/mandarin.png', alt: 'Mandarin Oriental' },
];
