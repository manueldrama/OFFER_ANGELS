// CAFEPASTE Angels — section/field metadata for the editable page content.
// Single source of truth for which config/item fields each section_type has,
// shared by the admin editor (/admin/angels/content) and the AI translation
// writer (angelsTranslationService), which uses field types to decide what is
// translatable (text/textarea) vs. structural (image/icon/boolean/URL).
// Extracted verbatim from AngelsContent.tsx — labels/hints are admin-UI Turkish.

import type { AngelsPageKey } from '../types/angels';

export interface FieldDef {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'image' | 'icon' | 'boolean';
    hint?: string; // ör: "{{name}} davetlinin adıyla değiştirilir"
}

export interface SectionMeta {
    label: string;
    fields: FieldDef[];
    itemFields?: FieldDef[];
    itemLabel?: string; // "+ Öğe ekle" butonundaki isim
    note?: string;
}

const NAME_HINT = '{{name}} davetlinin adıyla değiştirilir';

export const SECTION_META: Record<AngelsPageKey, Record<string, SectionMeta>> = {
    landing: {
        hero: {
            label: 'Hero (Başlık Alanı)',
            fields: [
                { key: 'eyebrow', label: 'Eyebrow (Üst Etiket)', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea' },
            ],
        },
        pillars: {
            label: 'Değer Kartları (3 Sütun)',
            fields: [],
            itemLabel: 'Kart',
            itemFields: [
                { key: 'icon', label: 'İkon', type: 'icon' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'description', label: 'Açıklama', type: 'textarea' },
            ],
        },
        worlds: {
            label: 'Kategori Rozetleri',
            fields: [],
            itemLabel: 'Rozet',
            itemFields: [
                { key: 'icon', label: 'İkon', type: 'icon' },
                { key: 'title', label: 'Etiket', type: 'text' },
            ],
        },
        invite_box: {
            label: 'Davet Kutusu',
            fields: [
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'body', label: 'Metin', type: 'textarea' },
                { key: 'cta_label', label: 'Link Yazısı', type: 'text' },
                { key: 'cta_href', label: 'Link Hedefi (URL)', type: 'text' },
            ],
        },
        landing_overrides: {
            label: 'Ana Sayfa Metin Farkları',
            fields: [
                { key: 'badge_text', label: 'Hero + Üst Bar Rozeti', type: 'text' },
                { key: 'hero_cta_label', label: 'Hero Ana Buton Yazısı', type: 'text' },
                { key: 'hero_secondary_cta_label', label: 'Hero İkincil Buton Yazısı', type: 'text' },
                { key: 'confirm_eyebrow', label: 'Başvuru Kartı Eyebrow', type: 'text' },
                { key: 'confirm_title', label: 'Başvuru Kartı Başlığı', type: 'text' },
                { key: 'confirm_subtitle', label: 'Başvuru Kartı Alt Yazısı', type: 'textarea' },
                { key: 'confirm_statement', label: 'Başvuru Kartı Açıklaması', type: 'textarea' },
                { key: 'confirm_cta_label', label: 'Başvuru Kartı Buton Yazısı', type: 'text' },
                { key: 'confirm_footnote', label: 'Başvuru Kartı Alt Notu', type: 'textarea' },
            ],
            note: '/ ana sayfası davet sayfasının bölümlerini birebir kullanır; yalnızca buradaki metinler davet dilinden başvuru diline çevrilir. Sayfada ayrı bir blok olarak görünmez.',
        },
    },
    invite: {
        header: {
            label: 'Üst Bar Rozeti',
            fields: [{ key: 'pill_text', label: 'Rozet Yazısı', type: 'text' }],
            note: 'Bu bölüm gizlenirse üst bardaki "PRIVATE INVITATION" rozeti kaybolur; bar kendisi kalır.',
        },
        hero: {
            label: 'Hero (Karşılama)',
            fields: [
                { key: 'badge_text', label: 'Rozet Yazısı', type: 'text' },
                { key: 'headline', label: 'Ana Başlık', type: 'text', hint: NAME_HINT },
                { key: 'subheadline', label: 'Alt Başlık', type: 'text' },
                { key: 'description', label: 'Açıklama', type: 'textarea' },
                { key: 'cta_primary_label', label: 'Ana Buton Yazısı', type: 'text' },
                { key: 'cta_secondary_label', label: 'İkincil Buton Yazısı', type: 'text' },
                { key: 'trust_left', label: 'Güven Yazısı (Sol)', type: 'text' },
                { key: 'trust_right', label: 'Güven Yazısı (Sağ)', type: 'text' },
                { key: 'active_until_line', label: 'Geçerlilik Satırı', type: 'text', hint: '{{date}} bitiş tarihiyle değişir' },
                { key: 'venues_label', label: 'Venue Bandı Başlığı', type: 'text' },
                { key: 'bg_image_url', label: 'Arka Plan Görseli', type: 'image' },
                { key: 'show_venue_tags', label: 'Venue Etiketlerini Göster', type: 'boolean' },
                { key: 'show_marquee', label: 'Logo Bandını Göster', type: 'boolean' },
            ],
            itemLabel: 'Venue Etiketi',
            itemFields: [{ key: 'title', label: 'Etiket (BÜYÜK HARF)', type: 'text' }],
        },
        moments: {
            label: 'Moments Galerisi',
            fields: [
                { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea' },
                { key: 'drag_hint', label: 'Sürükleme İpucu Yazısı', type: 'text' },
            ],
            itemLabel: 'Kart',
            itemFields: [
                { key: 'value_text', label: 'Rozet (BÜYÜK HARF)', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'media_url', label: 'Görsel', type: 'image' },
            ],
        },
        why_invited: {
            label: 'Neden Davet Edildin',
            fields: [
                { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea', hint: NAME_HINT },
            ],
            itemLabel: 'Kart',
            itemFields: [
                { key: 'value_text', label: 'Numara (01, 02…)', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'description', label: 'Açıklama', type: 'textarea' },
            ],
        },
        what_is: {
            label: 'Angels Nedir',
            fields: [
                { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
                { key: 'title', label: 'Başlık (satır kırmak için Enter)', type: 'textarea' },
                { key: 'p1', label: 'Paragraf 1', type: 'textarea' },
                { key: 'p2', label: 'Paragraf 2', type: 'textarea' },
                { key: 'p3', label: 'Paragraf 3', type: 'textarea' },
                { key: 'bg_image_url', label: 'Arka Plan Görseli', type: 'image' },
            ],
            itemLabel: 'Kart',
            itemFields: [
                { key: 'value_text', label: 'Numara (01, 02…)', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'description', label: 'Açıklama', type: 'textarea' },
                { key: 'media_url', label: 'Kart Görseli', type: 'image' },
            ],
        },
        what_is_cafepaste: {
            label: 'CAFEPASTE Nedir',
            fields: [
                { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'subtitle', label: 'Alt Başlık', type: 'textarea' },
                { key: 'p1', label: 'Paragraf 1', type: 'textarea' },
                { key: 'p2', label: 'Paragraf 2', type: 'textarea' },
                { key: 'closing_line', label: 'Kapanış Metni', type: 'textarea' },
                { key: 'cta_label', label: 'Buton Yazısı', type: 'text' },
                { key: 'bg_image_url', label: 'Arka Plan Görseli / Video', type: 'image' },
            ],
        },
        how_to_join: {
            label: 'Nasıl Katılırım',
            fields: [
                { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea' },
            ],
            itemLabel: 'Adım',
            itemFields: [
                { key: 'value_text', label: 'Numara (01, 02…)', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'description', label: 'Açıklama', type: 'textarea' },
            ],
        },
        joining_network: {
            label: 'Ağa Katılım',
            fields: [
                { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'lead', label: 'Öne Çıkan Metin', type: 'textarea' },
                { key: 'body', label: 'Gövde Metni', type: 'textarea' },
                { key: 'footnote', label: 'Alt Not', type: 'textarea' },
            ],
            itemLabel: 'Madde',
            itemFields: [{ key: 'title', label: 'Madde Metni', type: 'text' }],
        },
        confirm: {
            label: 'Davet Onayı',
            fields: [
                { key: 'eyebrow', label: 'Eyebrow', type: 'text', hint: NAME_HINT },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea' },
                { key: 'statement', label: 'Onay Açıklaması', type: 'textarea' },
                { key: 'checkbox_label', label: 'Checkbox Yazısı', type: 'text' },
                { key: 'cta_label', label: 'Buton Yazısı', type: 'text' },
                { key: 'footnote', label: 'Alt Not', type: 'textarea' },
                { key: 'agree_error', label: 'Onaysız Tıklama Hata Mesajı', type: 'text' },
            ],
            note: 'Bu bölüm gizlenirse hero\'daki "Accept" butonu doğrudan kabul formuna yönlendirir.',
        },
        status_copy: {
            label: 'Durum Metinleri',
            fields: [
                { key: 'loading_title', label: 'Yükleniyor Başlığı', type: 'text' },
                { key: 'invalid_title', label: 'Geçersiz Link Başlığı', type: 'text' },
                { key: 'invalid_body', label: 'Geçersiz Link Metni', type: 'textarea' },
                { key: 'expired_title', label: 'Süresi Dolmuş Başlığı', type: 'text' },
                { key: 'expired_body', label: 'Süresi Dolmuş Metni', type: 'textarea' },
                { key: 'expired_badge', label: 'Süresi Dolmuş Rozeti', type: 'text' },
                { key: 'expired_until_line', label: 'Süresi Dolmuş Tarih Satırı', type: 'text', hint: '{{date}} bitiş tarihiyle değişir' },
                { key: 'expired_request_button', label: 'Yeni Davet Talep Butonu', type: 'text' },
                { key: 'expired_contact_button', label: 'İletişim Butonu', type: 'text' },
                { key: 'expired_requested_title', label: 'Talep Alındı Başlığı', type: 'text' },
                { key: 'expired_requested_body', label: 'Talep Alındı Metni', type: 'textarea' },
                { key: 'accepted_title', label: 'Zaten Kabul Edilmiş Başlığı', type: 'text' },
                { key: 'accepted_body', label: 'Zaten Kabul Edilmiş Metni', type: 'textarea' },
            ],
            note: 'Geçersiz / süresi dolmuş / zaten kabul edilmiş davet ekranlarının metinleri. Sayfada bir blok olarak görünmez.',
        },
    },
    accept: {
        intro: {
            label: 'Giriş Başlığı',
            fields: [
                { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea' },
            ],
        },
        form_copy: {
            label: 'Form Metinleri',
            fields: [
                { key: 'photos_title', label: 'Fotoğraflar Başlığı', type: 'text' },
                { key: 'photos_desc', label: 'Fotoğraflar Açıklaması', type: 'textarea' },
                { key: 'categories_title', label: 'Kategoriler Başlığı', type: 'text' },
                { key: 'categories_desc', label: 'Kategoriler Açıklaması', type: 'textarea' },
                { key: 'bio_label', label: 'Bio Alan Etiketi', type: 'text' },
                { key: 'bio_placeholder', label: 'Bio Placeholder', type: 'text' },
                { key: 'submit_label', label: 'Gönder Butonu', type: 'text' },
                { key: 'disclaimer', label: 'Gönderim Alt Notu', type: 'textarea' },
                { key: 'full_name_label', label: 'Ad Soyad Etiketi', type: 'text' },
                { key: 'full_name_placeholder', label: 'Ad Soyad Placeholder', type: 'text' },
                { key: 'instagram_label', label: 'Instagram Etiketi', type: 'text' },
                { key: 'email_label', label: 'E-posta Etiketi', type: 'text' },
                { key: 'whatsapp_label', label: 'WhatsApp Etiketi', type: 'text' },
                { key: 'city_label', label: 'Şehir Etiketi', type: 'text' },
                { key: 'country_label', label: 'Ülke Etiketi', type: 'text' },
                { key: 'profile_photo_title', label: 'Profil Fotoğrafı Başlığı', type: 'text' },
                { key: 'profile_photo_hint', label: 'Profil Fotoğrafı İpucu', type: 'text' },
                { key: 'gallery_add_label', label: 'Galeri "Ekle" Etiketi', type: 'text' },
                { key: 'loading_text', label: 'Yükleniyor Yazısı', type: 'text' },
                { key: 'error_full_name', label: 'Hata: Ad Soyad', type: 'text' },
                { key: 'error_instagram', label: 'Hata: Instagram', type: 'text' },
                { key: 'error_email', label: 'Hata: E-posta', type: 'text' },
                { key: 'error_photos', label: 'Hata: Fotoğraf', type: 'text' },
                { key: 'error_categories', label: 'Hata: Kategori', type: 'text' },
                { key: 'error_submit', label: 'Hata: Gönderim', type: 'text' },
                { key: 'upload_error', label: 'Hata: Yükleme', type: 'text' },
            ],
            note: 'Form alanlarının doğrulama ve gönderim mantığı koddan gelir; tüm etiket, ipucu ve hata metinleri buradan düzenlenir.',
        },
        invalid_copy: {
            label: 'Geçersiz Davet Metni',
            fields: [
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'body', label: 'Metin', type: 'textarea' },
            ],
        },
    },
    thank_you: {
        main: {
            label: 'Ana Mesaj',
            fields: [
                { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'body', label: 'Metin', type: 'textarea' },
            ],
        },
        next_steps: {
            label: 'Sonraki Adımlar',
            fields: [{ key: 'title', label: 'Kutu Başlığı', type: 'text' }],
            itemLabel: 'Adım',
            itemFields: [{ key: 'title', label: 'Adım Metni (numara otomatik)', type: 'text' }],
        },
    },
    venue_directory: {
        intro: {
            label: 'Başlık + Filtre Metinleri',
            fields: [
                { key: 'eyebrow_with_venue', label: 'Eyebrow (venue adıyla)', type: 'text', hint: '{{venue}} mekan adıyla değiştirilir' },
                { key: 'eyebrow_fallback', label: 'Eyebrow (venue adı yoksa)', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea' },
                { key: 'search_placeholder', label: 'Arama Placeholder', type: 'text' },
                { key: 'all_cities_label', label: '"Tüm şehirler" Etiketi', type: 'text' },
                { key: 'all_categories_label', label: '"Tüm kategoriler" Etiketi', type: 'text' },
                { key: 'empty_text', label: 'Boş Sonuç Metni', type: 'text' },
            ],
        },
        gate_copy: {
            label: 'Erişim Kapısı Metinleri',
            fields: [
                { key: 'verifying', label: 'Doğrulanıyor Yazısı', type: 'text' },
                { key: 'title', label: 'Geçersiz Token Başlığı', type: 'text' },
                { key: 'body', label: 'Geçersiz Token Metni', type: 'textarea' },
            ],
        },
    },
    venue_creator: {
        copy: {
            label: 'Sayfa Metinleri',
            fields: [
                { key: 'loading', label: 'Yükleniyor Yazısı', type: 'text' },
                { key: 'back_label', label: 'Geri Butonu', type: 'text' },
                { key: 'featured_label', label: '"Featured" Rozeti', type: 'text' },
                { key: 'portfolio_title', label: 'Portfolyo Başlığı', type: 'text' },
                { key: 'request_cta', label: 'İşbirliği Butonu', type: 'text' },
                { key: 'not_available_title', label: 'Creator Bulunamadı Başlığı', type: 'text' },
                { key: 'gate_title', label: 'Geçersiz Token Başlığı', type: 'text' },
                { key: 'gate_body', label: 'Geçersiz Token Metni', type: 'textarea' },
            ],
        },
    },
    venue_request: {
        intro: {
            label: 'Başlık',
            fields: [
                { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
                { key: 'title_with_creator', label: 'Başlık (creator adıyla)', type: 'text', hint: '{{creator}} creator adıyla değiştirilir' },
                { key: 'title_fallback', label: 'Başlık (creator yüklenmediyse)', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea' },
            ],
        },
        disclaimer: {
            label: 'Form / Buton Metinleri',
            fields: [
                { key: 'back_label', label: 'Geri Butonu', type: 'text' },
                { key: 'submit_label', label: 'Gönder Butonu', type: 'text' },
                { key: 'text', label: 'Alt Not', type: 'textarea' },
                { key: 'error_venue_name', label: 'Venue Adı Eksik Hatası', type: 'text' },
                { key: 'error_generic', label: 'Genel Hata Mesajı', type: 'text' },
            ],
        },
        success_copy: {
            label: 'Başarı Ekranı',
            fields: [
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'body', label: 'Metin', type: 'textarea', hint: '{{creator}} creator adıyla değiştirilir' },
                { key: 'back_label', label: 'Geri Dön Butonu', type: 'text' },
            ],
        },
        gate_copy: {
            label: 'Erişim Kapısı',
            fields: [
                { key: 'title', label: 'Geçersiz Token Başlığı', type: 'text' },
                { key: 'body', label: 'Geçersiz Token Metni', type: 'textarea' },
            ],
        },
    },
};

/** True when a config field is translatable copy (text/textarea, not a URL/href). */
export function isTranslatableConfigField(f: FieldDef): boolean {
    return (f.type === 'text' || f.type === 'textarea') && !/href|url/i.test(f.key);
}

/** Item text fields (title/description/value_text) are translatable; icon/image are structural. */
export function isTranslatableItemField(f: FieldDef): boolean {
    return (f.type === 'text' || f.type === 'textarea') && !/href|url/i.test(f.key);
}
