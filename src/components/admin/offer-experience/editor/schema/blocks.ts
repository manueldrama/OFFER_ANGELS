// Block types catalog + structure mapping (which fields each block contains).

import type { EditorFieldId, FieldIcon } from './fields';

export type BlockTypeId =
    | 'product' | 'countdown' | 'price' | 'suggestions' | 'totals'
    | 'roi' | 'warn' | 'payment' | 'trust' | 'info_strips'
    | 'approved' | 'consent'
    | 'faq' | 'testimonials' | 'video' | 'gallery' | 'comparison' | 'spec'
    // PDP section block tipleri — admin ProductDesigner'da section'lari hazirlar,
    // burada hangisinin nerede gosterilecegini secer (drag-drop sirasi + visibility).
    | 'pdp_features' | 'pdp_features_desktop' | 'pdp_audience' | 'pdp_how_it_works'
    | 'pdp_faq' | 'pdp_specs' | 'pdp_box_contents' | 'pdp_video_gallery'
    | 'pdp_image_gallery' | 'pdp_visual_proof' | 'pdp_roi_calculator' | 'pdp_usage_scenarios'
    // Landing-level bloklar — landing page'deki section'larin aynisi (Instagram + Stats).
    // contentSections'tan degil, landing variant/defaults'tan beslenir.
    | 'landing_instagram' | 'landing_stats';

export type BlockColumn = 'left' | 'right';

export interface BlockTypeMeta {
    label: string;
    icon: FieldIcon | 'box' | 'layers' | 'activity' | 'user' | 'eye' | 'docs';
    desc: string;
    isNew?: boolean;
    /** Default lock recommendation; user can override per-instance. */
    defaultLocked?: boolean;
}

export const BLOCK_TYPES: Record<BlockTypeId, BlockTypeMeta> = {
    product: { label: 'Ürün Kartı', icon: 'box', defaultLocked: true, desc: 'Ürün adı, görsel, kategori, etiketler' },
    countdown: { label: 'Geri Sayım', icon: 'warn', desc: 'Aciliyet bandı + ilerleme çubuğu' },
    price: { label: 'Fiyat Bloğu', icon: 'price', defaultLocked: true, desc: 'Liste / lansman fiyatı, tasarruf' },
    suggestions: { label: 'Birlikte Önerilenler', icon: 'layers', desc: 'Cross-sell ürün listesi' },
    totals: { label: 'Toplamlar', icon: 'price', defaultLocked: true, desc: 'Ara toplam, KDV, genel toplam' },
    roi: { label: 'ROI Banner', icon: 'activity', desc: 'Yatırım geri dönüş kalıcı bandı' },
    warn: { label: 'Uyarı Bandı', icon: 'warn', desc: 'FOMO / kayıp uyarısı' },
    payment: { label: 'Rezervasyon Seçenekleri', icon: 'price', defaultLocked: true, desc: 'Ödeme yöntemleri' },
    trust: { label: 'Güven Bandı', icon: 'info', desc: 'Güvenli ödeme, kargo, vs.' },
    info_strips: { label: 'Bilgi Şeritleri', icon: 'info', desc: 'Lansman dönemi, teslimat' },
    approved: { label: 'Onaylı Teklif Bandı', icon: 'check', desc: 'Onay numarası + geçerlilik' },
    consent: { label: 'Onay Kutusu', icon: 'check', defaultLocked: true, desc: 'KVKK / mesafeli satış onayı' },

    faq: { label: 'Sıkça Sorulan Sorular', icon: 'info', desc: 'Genişleyebilir SSS listesi', isNew: true },
    testimonials: { label: 'Müşteri Yorumları', icon: 'user', desc: '3-5 müşteri görüşü', isNew: true },
    video: { label: 'Video Bloğu', icon: 'eye', desc: 'Tanıtım videosu embed', isNew: true },
    gallery: { label: 'Görsel Galeri', icon: 'layers', desc: '4-8 ürün fotoğrafı grid', isNew: true },
    comparison: { label: 'Karşılaştırma Tablosu', icon: 'tab', desc: 'Diğer modellerle karşılaştırma', isNew: true },
    spec: { label: 'Teknik Özellikler', icon: 'docs', desc: 'Detaylı specs listesi', isNew: true },

    // PDP Section blocks — admin ProductDesigner'da hazirlanan section'lari final teklif sayfasinda gosterir.
    pdp_features:        { label: 'PDP: Öne Çıkan Özellikler', icon: 'activity', desc: "Ürün PDP features section'ı (4-column grid)", isNew: true },
    pdp_features_desktop:{ label: 'PDP: Pro Özellikler', icon: 'activity', desc: 'Horizontal scroll cards', isNew: true },
    pdp_audience:        { label: 'PDP: Kimler İçin Uygun', icon: 'user', desc: 'Hedef kitle kartları', isNew: true },
    pdp_how_it_works:    { label: 'PDP: Nasıl Çalışır', icon: 'info', desc: 'Adım adım kart carousel', isNew: true },
    pdp_faq:             { label: 'PDP: Sıkça Sorulan Sorular', icon: 'info', desc: 'PDP\'deki SSS bloğu', isNew: true },
    pdp_specs:           { label: 'PDP: Teknik Özellikler', icon: 'docs', desc: '2-column değer grid', isNew: true },
    pdp_box_contents:    { label: 'PDP: Kutu İçeriği', icon: 'box', desc: 'Check-listed paket içeriği', isNew: true },
    pdp_video_gallery:   { label: 'PDP: Video Galeri', icon: 'eye', desc: 'Video embedleri', isNew: true },
    pdp_image_gallery:   { label: 'PDP: Görsel Galeri', icon: 'layers', desc: '2-column görsel grid', isNew: true },
    pdp_visual_proof:    { label: 'PDP: Görsel Kanıt', icon: 'eye', desc: 'Yuvarlak görsel carousel', isNew: true },
    pdp_roi_calculator:  { label: 'PDP: ROI Hesaplayıcı', icon: 'activity', desc: 'Yatırımın geri dönüşü', isNew: true },
    pdp_usage_scenarios: { label: 'PDP: Kullanım Senaryoları', icon: 'layers', desc: 'Instagram-style use case kartları', isNew: true },

    landing_instagram: { label: 'Landing: Instagram Akışı', icon: 'eye', desc: "Landing'deki kayan Instagram post şeridi", isNew: true },
    landing_stats:     { label: 'Landing: İstatistikler', icon: 'activity', desc: "Landing'deki 3'lü sayaç istatistik kartları", isNew: true },
};

export interface BlockInstance {
    id: string;
    type: BlockTypeId;
    visible: boolean;
    locked?: boolean;
    column: BlockColumn;
}

/**
 * Mobil siralamayi (mobile_order = blok id dizisi) somut blok listesine cevirir.
 * - `orderIds` icindeki bayat id'ler (artik var olmayan bloklar) elenir.
 * - `orderIds`'te bulunmayan bloklar (yeni eklenmis) listenin sonuna eklenir.
 * Bu reconciliation sayesinde blok ekle/sil/kopyala islemleri mobile_order'a
 * dokunmak zorunda kalmaz. Hem editor hem musteri sayfasi ayni mantigi kullanir.
 */
export function resolveMobileOrder<T extends { id: string }>(blocks: T[], orderIds: string[]): T[] {
    const byId = new Map(blocks.map(b => [b.id, b]));
    const ordered = orderIds
        .map(id => byId.get(id))
        .filter((b): b is T => !!b);
    const seen = new Set(ordered.map(b => b.id));
    const missing = blocks.filter(b => !seen.has(b.id));
    return [...ordered, ...missing];
}

/** Which fields belong to which block in the structure tree. */
export const BLOCK_FIELDS: Record<BlockTypeId, EditorFieldId[]> = {
    product: ['product_name', 'product_cat', 'product_seg', 'tag1', 'tag2'],
    countdown: ['countdown_label', 'progress_label'],
    price: ['list_price_label', 'launch_price_label', 'savings_label'],
    suggestions: ['suggestions_title', 'suggestions_action'],
    totals: ['subtotal_label', 'tax_label', 'grand_label'],
    roi: ['roi_title', 'roi_sub', 'roi_cta'],
    warn: ['warn_title', 'warn_body'],
    payment: [
        'payment_title',
        'pay1_name', 'pay1_detail', 'recommended_badge',
        'pay2_name', 'pay2_detail',
        'pay3_name', 'pay3_tag', 'pay3_detail', 'pay3_amount_label',
        'pay4_name', 'pay4_detail',
    ],
    trust: ['trust1', 'trust2', 'trust3'],
    info_strips: ['info1_label', 'info1_val', 'info2_label', 'info2_val'],
    approved: ['approved_label', 'validity_label'],
    consent: ['consent_text'],
    faq: [],
    testimonials: [],
    video: [],
    gallery: [],
    comparison: [],
    spec: [],

    pdp_features: [], pdp_features_desktop: [], pdp_audience: [], pdp_how_it_works: [],
    pdp_faq: [], pdp_specs: [], pdp_box_contents: [], pdp_video_gallery: [],
    pdp_image_gallery: [], pdp_visual_proof: [], pdp_roi_calculator: [], pdp_usage_scenarios: [],

    landing_instagram: [], landing_stats: [],
};

/** Field shown in the left header & footer (nav + sticky bar) — not tied to a single block. */
export const HEADER_FIELDS: EditorFieldId[] = ['nav1', 'nav2', 'nav3', 'nav4'];
export const FOOTER_FIELDS: EditorFieldId[] = [
    'back_btn', 'copy_btn', 'pdf_btn', 'bottom_total_label', 'confirm_btn',
    'mobile_cta_sub', 'mobile_copy_btn', 'mobile_pdf_btn',
];
