// Field metadata for the inline editor — drives label, char limit, hint, and icon
// in the floating popover. Keys must match the flat content schema in initial-content.ts.

export type FieldIcon =
    | 'tab' | 'type' | 'badge' | 'price' | 'button' | 'warn' | 'info'
    | 'truck' | 'check' | 'cal';

export interface EditorFieldMeta {
    label: string;
    path: string;
    icon: FieldIcon;
    max: number;
    multiline?: boolean;
    hint?: string;
    kind?: string;
}

export const FIELDS: Record<string, EditorFieldMeta> = {
    nav1: { label: 'Nav · Cihaz Seçimi', path: 'Header / Nav', icon: 'tab', max: 24 },
    nav2: { label: 'Nav · Tekliflerim', path: 'Header / Nav', icon: 'tab', max: 24 },
    nav3: { label: 'Nav · Rezervasyonlarım', path: 'Header / Nav', icon: 'tab', max: 28 },
    nav4: { label: 'Nav · Destek', path: 'Header / Nav', icon: 'tab', max: 16 },

    product_name: { label: 'Ürün Adı', path: 'Ürün Kartı', icon: 'type', max: 40, hint: 'Genelde dinamik. Sadece statik ekleme yapacaksanız değiştirin.' },
    product_cat: { label: 'Ürün Kategorisi', path: 'Ürün Kartı', icon: 'type', max: 60 },
    product_seg: { label: 'Hedef Segment', path: 'Ürün Kartı', icon: 'type', max: 80 },
    tag1: { label: 'Etiket 1', path: 'Ürün Kartı / Etiketler', icon: 'badge', max: 24 },
    tag2: { label: 'Etiket 2', path: 'Ürün Kartı / Etiketler', icon: 'badge', max: 24 },

    countdown_label: { label: 'Geri Sayım Etiketi', path: 'Ürün Kartı / Aciliyet', icon: 'warn', max: 60, hint: 'Aciliyet hissi yaratır. Tüm büyük harfle yazın.' },
    progress_label: { label: 'İlerleme Çubuğu Metni', path: 'Ürün Kartı / Aciliyet', icon: 'type', max: 40 },

    list_price_label: { label: 'Liste Fiyatı Etiketi', path: 'Ürün Kartı / Fiyat', icon: 'price', max: 24 },
    launch_price_label: { label: 'Lansman Fiyatı Etiketi', path: 'Ürün Kartı / Fiyat', icon: 'price', max: 24 },
    savings_label: { label: 'Tasarruf Etiketi', path: 'Ürün Kartı / Fiyat', icon: 'badge', max: 40, hint: 'Yeşil rozet. Tasarruf miktarını vurgular.' },

    suggestions_title: { label: 'Öneriler Bölüm Başlığı', path: 'Birlikte Önerilenler', icon: 'type', max: 32 },
    suggestions_action: { label: 'Eylem Linki', path: 'Birlikte Önerilenler', icon: 'button', max: 20 },

    subtotal_label: { label: 'Ara Toplam', path: 'Toplamlar', icon: 'type', max: 20 },
    tax_label: { label: 'Vergi Etiketi', path: 'Toplamlar', icon: 'type', max: 12 },
    grand_label: { label: 'Toplam Etiketi', path: 'Toplamlar', icon: 'type', max: 16 },

    roi_title: { label: 'ROI Başlığı', path: 'ROI Banner', icon: 'type', max: 60 },
    roi_sub: { label: 'ROI Açıklama', path: 'ROI Banner', icon: 'type', max: 80 },
    roi_cta: { label: 'ROI Buton', path: 'ROI Banner', icon: 'button', max: 16 },

    warn_title: { label: 'Uyarı Başlığı', path: 'Uyarı Bandı', icon: 'warn', max: 80, hint: 'FOMO yaratır. Kayıp odaklı yazın.' },
    warn_body: { label: 'Uyarı Açıklama', path: 'Uyarı Bandı', icon: 'warn', multiline: true, max: 220 },

    payment_title: { label: 'Ödeme Bölüm Başlığı', path: 'Rezervasyon Seçeneği', icon: 'type', max: 32 },
    pay1_name: { label: 'Ödeme 1 — Ad', path: 'Rezervasyon / Önerilen', icon: 'price', max: 40 },
    pay1_detail: { label: 'Ödeme 1 — Detay', path: 'Rezervasyon / Önerilen', icon: 'type', max: 80 },
    recommended_badge: { label: 'Önerilen Rozeti', path: 'Rezervasyon', icon: 'badge', max: 16 },
    pay2_name: { label: 'Ödeme 2 — Ad', path: 'Rezervasyon', icon: 'price', max: 24 },
    pay2_detail: { label: 'Ödeme 2 — Detay', path: 'Rezervasyon', icon: 'type', max: 40 },
    pay3_name: { label: 'Ödeme 3 — Ad', path: 'Rezervasyon', icon: 'price', max: 24 },
    pay3_tag: { label: 'Ödeme 3 — Etiket', path: 'Rezervasyon', icon: 'badge', max: 20 },
    pay3_detail: { label: 'Ödeme 3 — Detay', path: 'Rezervasyon', icon: 'type', max: 40 },
    pay3_amount_label: { label: 'Ödeme 3 — Periyot', path: 'Rezervasyon', icon: 'type', max: 12 },
    pay4_name: { label: 'Ödeme 4 — Ad', path: 'Rezervasyon', icon: 'price', max: 24 },
    pay4_detail: { label: 'Ödeme 4 — Detay', path: 'Rezervasyon', icon: 'type', max: 40 },

    trust1: { label: 'Güven 1', path: 'Güven Bandı', icon: 'info', max: 24 },
    trust2: { label: 'Güven 2', path: 'Güven Bandı', icon: 'truck', max: 24 },
    trust3: { label: 'Güven 3', path: 'Güven Bandı', icon: 'truck', max: 32, hint: '⚠ Bu alan placeholder gösteriyor — gerçek değerle doldurulmalı.' },

    info1_label: { label: 'Bilgi 1 — Etiket', path: 'Bilgi Şeritleri', icon: 'type', max: 24 },
    info1_val: { label: 'Bilgi 1 — Değer', path: 'Bilgi Şeritleri', icon: 'type', max: 32, hint: '⚠ Placeholder kalmış.' },
    info2_label: { label: 'Bilgi 2 — Etiket', path: 'Bilgi Şeritleri', icon: 'type', max: 24 },
    info2_val: { label: 'Bilgi 2 — Değer', path: 'Bilgi Şeritleri', icon: 'type', max: 32, hint: '⚠ Placeholder kalmış.' },

    approved_label: { label: 'Onaylı Teklif Etiketi', path: 'Onaylı Teklif Bandı', icon: 'check', max: 32 },
    validity_label: { label: 'Geçerlilik Etiketi', path: 'Onaylı Teklif Bandı', icon: 'cal', max: 16 },

    consent_text: { label: 'Onay Metni', path: 'Footer / Consent', icon: 'type', multiline: true, max: 200 },

    back_btn: { label: 'Geri Butonu', path: 'Sticky Bar', icon: 'button', max: 16 },
    mobile_cta_sub: { label: 'Mobil CTA Altyazısı', path: 'Mobil / Sticky CTA', icon: 'type', max: 60, hint: 'Sadece mobilde görünür. Ana butonun altında küçük açıklama.' },
    mobile_copy_btn: { label: 'Mobil · Linki Kopyala', path: 'Mobil / İkincil', icon: 'button', max: 16 },
    mobile_pdf_btn: { label: 'Mobil · PDF', path: 'Mobil / İkincil', icon: 'button', max: 8 },
    copy_btn: { label: 'Link Kopyala Butonu', path: 'Sticky Bar', icon: 'button', max: 32 },
    pdf_btn: { label: 'PDF Butonu', path: 'Sticky Bar', icon: 'button', max: 24 },
    bottom_total_label: { label: 'Alt Toplam Etiketi', path: 'Sticky Bar', icon: 'type', max: 24 },
    confirm_btn: { label: 'Onay Butonu', path: 'Sticky Bar / CTA', icon: 'button', max: 40, hint: 'Ana CTA. Eylem fiili ile başlatın.' },
};

export type EditorFieldId = string;

export type ContentMap = Record<string, string>;

export const FIELD_IDS: EditorFieldId[] = Object.keys(FIELDS);
