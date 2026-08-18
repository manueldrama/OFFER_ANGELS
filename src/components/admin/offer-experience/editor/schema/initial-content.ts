// Per-language seed content for first-time editor open.
// Keys mirror FIELDS in ./fields.ts.

import type { ContentMap } from './fields';

export const INITIAL_CONTENT_TR: ContentMap = {
    nav1: 'Cihaz Seçimi', nav2: 'Tekliflerim', nav3: 'Rezervasyonlarım', nav4: 'Destek',

    product_name: 'Cafepaste Pro',
    product_cat: 'Macchina per Arte delle Bevande',
    product_seg: 'Per Aziende ad Alto Volume',
    tag1: 'Profesyonel seri', tag2: 'Hızlı kurulum',

    countdown_label: 'BU FİYAT SADECE SINIRLI SÜRE GEÇERLİ',
    progress_label: '%30 kontenjan doldu',

    list_price_label: 'Liste Fiyatı',
    launch_price_label: 'Lansman Fiyatı',
    savings_label: '{{discountAmount}} Lansman Avantajı',

    suggestions_title: 'Birlikte Önerilenler',
    suggestions_action: 'Teklife ekle',

    subtotal_label: 'Ara Toplam',
    tax_label: 'KDV',
    grand_label: 'Toplam',

    roi_title: 'İşletmeler Ortalama 2 Ayda Amorti Ediyor',
    roi_sub: 'Yatırımınızın geri dönüş süresini hesaplayın',
    roi_cta: 'Hesapla',

    warn_title: 'Bu teklif kapandığında {{discountAmount}} avantaj kaybolacak',
    warn_body: 'Lansman fiyatı — sadece bu teklif geçerliyken uygulanır. Süre sonrası liste fiyatı {{listPrice}} olacak.',

    payment_title: 'Rezervasyon Seçeneği',
    pay1_name: '%20 Ön Ödeme ile Rezerve Et',
    pay1_detail: '{{prePaymentAmount}} ile Rezerve Et Kalanını 14 Gün içinde öde',
    recommended_badge: 'Önerilen',
    pay2_name: 'Kredi Kartı',
    pay2_detail: 'Tek Çekim',
    pay3_name: '6 Taksit',
    pay3_tag: 'Esnek Vade',
    pay3_detail: 'Esnek vade',
    pay3_amount_label: 'Aylık',
    pay4_name: 'Havale / EFT',
    pay4_detail: '%5 Ek İndirim Avantajı',

    trust1: 'Güvenli Ödeme',
    trust2: 'Kargo',
    trust3: '2-3 iş günü teslimat',

    info1_label: 'Lansman Dönemi', info1_val: 'Aralık 2026',
    info2_label: 'Tahmini Teslimat', info2_val: '2-3 iş günü',

    approved_label: 'Onaylı Özel Teklif',
    validity_label: 'Geçerlilik',

    consent_text: 'Ön bilgilendirme formunu ve mesafeli satış sözleşmesini okudum, onaylıyorum.',
    mobile_cta_sub: 'Min. %20 ön ödeme ile onaylayabilirsiniz',
    mobile_copy_btn: 'Linki Kopyala',
    mobile_pdf_btn: 'PDF',

    back_btn: 'Geri Dön',
    copy_btn: 'Offer Linkini Kopyala',
    pdf_btn: 'PDF Olarak İndir',
    bottom_total_label: 'Toplam (KDV dahil)',
    confirm_btn: 'Teklifi Onayla ve Rezerve Et',
};

export const INITIAL_CONTENT_FR: Partial<ContentMap> = {
    nav1: "Sélection d'appareil", nav2: 'Mes Offres', nav3: 'Mes Réservations', nav4: 'Support',
    product_name: 'Cafepaste Pro',
    product_cat: 'Machine à Art de Boisson',
    product_seg: 'Pour les entreprises à fort volume',
    tag1: 'Série professionnelle', tag2: 'Installation rapide',
    countdown_label: 'OFFRE LIMITÉE DANS LE TEMPS',
    warn_title: "L'offre se termine — perte de {{discountAmount}}",
    payment_title: 'Option de réservation',
    recommended_badge: 'Recommandé',
    bottom_total_label: 'Total (TVA incluse)',
    confirm_btn: "Confirmer l'offre et réserver",
};

export const INITIAL_CONTENT_DE: Partial<ContentMap> = {
    nav1: 'Geräteauswahl', nav2: 'Meine Angebote', nav3: 'Meine Reservierungen', nav4: 'Support',
    product_name: 'Cafepaste Pro',
    countdown_label: 'NUR FÜR BEGRENZTE ZEIT',
    warn_title: 'Dieses Angebot endet — Sie verlieren {{discountAmount}}',
    payment_title: 'Reservierungsoption',
    recommended_badge: 'Empfohlen',
    confirm_btn: 'Angebot bestätigen und reservieren',
};

export const INITIAL_CONTENT_BY_LANG: Record<string, Partial<ContentMap>> = {
    tr: INITIAL_CONTENT_TR,
    fr: INITIAL_CONTENT_FR,
    de: INITIAL_CONTENT_DE,
};

export function getInitialContent(lang: string): ContentMap {
    const partial = INITIAL_CONTENT_BY_LANG[lang] ?? {};
    return { ...INITIAL_CONTENT_TR, ...partial } as ContentMap;
}
