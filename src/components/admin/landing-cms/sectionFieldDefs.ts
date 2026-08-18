export interface FieldDef {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'image' | 'icon' | 'select' | 'number' | 'boolean';
    nested?: boolean;
    options?: { value: string; label: string }[];
    circularCrop?: boolean;
    acceptVideo?: boolean;
    min?: number;
    max?: number;
}

export const STICKY_TARGET_OPTIONS: FieldDef['options'] = [
    { value: 'go', label: 'Teklif Sayfası (Ana CTA)' },
    { value: 'hero', label: 'Hero' },
    { value: 'stats', label: 'İstatistikler' },
    { value: 'how_it_works', label: 'Nasıl Çalışır?' },
    { value: 'usage_scenarios', label: 'Kullanım Senaryoları' },
    { value: 'revenue_model', label: 'Gelir Modeli' },
    { value: 'roi_calculator', label: 'ROI Hesaplayıcı' },
    { value: 'use_cases', label: 'Kullanım Alanları' },
    { value: 'features', label: 'Özellikler' },
    { value: 'visual_proof', label: 'Görsel Kanıt' },
    { value: 'faq', label: 'SSS' },
];

const stickyFields: FieldDef[] = [
    { key: 'sticky_cta_label', label: 'Sticky Bar — Buton Yazısı', type: 'text' },
    { key: 'sticky_cta_target', label: 'Sticky Bar — Buton Hedefi', type: 'select', options: STICKY_TARGET_OPTIONS },
];

export function getConfigFields(sectionType: string): FieldDef[] {
    const common: FieldDef[] = [
        { key: 'eyebrow', label: 'Eyebrow (Üst Etiket)', type: 'text' },
        { key: 'title', label: 'Başlık', type: 'text' },
        { key: 'subtitle', label: 'Alt Başlık', type: 'textarea' },
        ...stickyFields,
    ];

    switch (sectionType) {
        case 'hero':
            return [
                { key: 'headline', label: 'Ana Başlık', type: 'text' },
                { key: 'headline_accent', label: 'Vurgulu Kelime (Renkli)', type: 'text' },
                { key: 'headline_suffix', label: 'Başlık Sonu', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea' },
                { key: 'product_description', label: 'Ürün Açıklaması (Mobil — başlık altı)', type: 'textarea' },
                { key: 'cta_label', label: 'CTA Buton Yazısı', type: 'text' },
                { key: 'cta_target', label: 'CTA Buton Hedefi', type: 'select', options: STICKY_TARGET_OPTIONS },
                { key: 'secondary_cta_label', label: 'İkincil Buton Yazısı', type: 'text' },
                { key: 'secondary_cta_target', label: 'İkincil Buton Hedefi', type: 'select', options: STICKY_TARGET_OPTIONS },
                { key: 'hero_image_url', label: 'Hero Görseli', type: 'image' },
                { key: 'hero_video_url', label: 'Masaüstü Hero Videosu (opsiyonel)', type: 'image', acceptVideo: true },
                { key: 'brand_stat_text', label: 'Marka İstatistik Yazısı', type: 'text' },
                { key: 'hide_launch_badge', label: 'Masaüstü — Lansman Rozetini Gizle (“… Lansmanı · Sınırlı Kontenjan”)', type: 'boolean' },
                { key: 'hide_post_header', label: 'Mobil — Post Başlığını Gizle (kullanıcı adı + konum)', type: 'boolean' },
                { key: 'slide_duration_ms', label: 'Slayt Geçiş Süresi (ms — varsayılan 3500, min 1500, max 15000)', type: 'number', min: 1500, max: 15000 },
                ...stickyFields,
            ];
        case 'stats':
            return [
                { key: 'title', label: 'Başlık (İlk Satır)', type: 'text' },
                { key: 'title_accent', label: 'Vurgulu Başlık (Renkli)', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea' },
                { key: 'image_url', label: 'Makine Görseli', type: 'image' },
                { key: 'badge_text', label: 'Alt Badge Yazısı', type: 'text' },
                ...stickyFields,
            ];
        case 'instagram_feed':
            return [
                { key: 'eyebrow', label: 'Eyebrow (Üst Etiket)', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'handle', label: 'Instagram Kullanıcı Adı (@ olmadan)', type: 'text' },
                { key: 'profile_url', label: 'Profil URL', type: 'text' },
                { key: 'item_limit', label: 'Gösterilecek Gönderi Sayısı (4-12)', type: 'text' },
                ...stickyFields,
            ];
        case 'revenue_model':
            return [
                ...common,
                { key: 'badge_text', label: 'Alt Badge Yazısı', type: 'text' },
            ];
        case 'roi_calculator':
            return common;
        case 'testimonials':
            return common;
        case 'footer_cta':
            return [
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea' },
                { key: 'cta_label', label: 'CTA Buton Yazısı', type: 'text' },
                { key: 'sub_text', label: 'Alt Bilgi Metni', type: 'text' },
                ...stickyFields,
            ];
        case 'header_nav':
            return [
                { key: 'tagline', label: 'Logo Altı Slogan', type: 'text' },
                { key: 'logo_url', label: 'Logo URL', type: 'image' },
                { key: 'cta_header_label', label: 'Sağ CTA Buton Yazısı', type: 'text' },
                { key: 'cta_header_target', label: 'Sağ CTA Buton Hedefi', type: 'select', nested: true, options: STICKY_TARGET_OPTIONS },
                { key: 'show_cta_button', label: 'Sağ CTA Butonunu Göster', type: 'boolean', nested: true },
                { key: 'show_cta_button_mobile', label: 'Sağ CTA Butonunu Mobilde Göster (1024px altı)', type: 'boolean', nested: true },
                { key: 'show_language_switcher', label: 'Dil Seçiciyi Göster', type: 'boolean', nested: true },
                { key: 'show_tagline_mobile', label: 'Logo Altı Sloganı Mobilde Göster', type: 'boolean', nested: true },
            ];
        case 'footer_nav':
            return [
                { key: 'logo_url', label: 'Footer Logo URL', type: 'image' },
                { key: 'copyright_text', label: 'Telif Hakkı Metni', type: 'text' },
                { key: 'show_logo', label: 'Logoyu Göster', type: 'boolean', nested: true },
            ];
        case 'sticky_mobile_cta':
            return [
                { key: 'show_scroll_threshold', label: 'Görünme Eşiği (piksel scroll)', type: 'number', nested: true, min: 0 },
                { key: 'show_arrow_icon', label: 'CTA Butonda Aşağı-Ok İkonu Göster', type: 'boolean', nested: true },
                { key: 'show_scroll_to_top', label: 'Scroll-to-Top Butonunu Göster', type: 'boolean', nested: true },
                { key: 'scroll_to_top_tooltip', label: 'Scroll-to-Top Buton Tooltip', type: 'text' },
                { key: 'fallback_cta_label', label: 'Fallback CTA Yazısı (section sticky_cta_label boş ise)', type: 'text' },
                { key: 'fallback_cta_target', label: 'Fallback CTA Hedefi', type: 'select', nested: true, options: STICKY_TARGET_OPTIONS },
                { key: 'cta_bg_color', label: 'CTA Buton Arka Rengi (örn: #C41E2A)', type: 'text', nested: true },
                { key: 'cta_text_color', label: 'CTA Buton Yazı Rengi (örn: #FAFAFA)', type: 'text', nested: true },
            ];
        case 'lead_capture_popup':
            return [
                { key: 'badge_text', label: 'Üst Etiket (Badge)', type: 'text' },
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'subtitle', label: 'Alt Yazı', type: 'textarea' },
                { key: 'benefit_1', label: 'Madde 1', type: 'text' },
                { key: 'benefit_2', label: 'Madde 2', type: 'text' },
                { key: 'benefit_3', label: 'Madde 3', type: 'text' },
                { key: 'cta_label', label: 'CTA Buton Yazısı', type: 'text' },
                { key: 'cta_target', label: 'CTA Buton Hedefi', type: 'select', nested: true, options: STICKY_TARGET_OPTIONS },
                { key: 'dismiss_label', label: 'Vazgeç Linki Metni', type: 'text' },
                { key: 'show_badge', label: 'Üst Etiketi Göster', type: 'boolean', nested: true },
                { key: 'show_dismiss_link', label: 'Vazgeç Linkini Göster', type: 'boolean', nested: true },
                { key: 'show_close_x', label: 'Kapatma (X) Butonunu Göster', type: 'boolean', nested: true },
                { key: 'delay_seconds', label: 'İnaktivite Sonrası Açılma (sn)', type: 'number', nested: true, min: 0 },
                { key: 'trigger_on_exit_intent', label: 'Mouse-Leave Tetiği Aktif', type: 'boolean', nested: true },
                { key: 'trigger_on_back_button', label: 'Geri Tuşu Tetiği Aktif', type: 'boolean', nested: true },
                { key: 'trigger_on_tab_close', label: 'Sekme Kapatma Tetiği Aktif', type: 'boolean', nested: true },
                { key: 'cooldown_type', label: 'Bekleme Tipi', type: 'select', nested: true, options: [
                    { value: 'hours', label: 'Saat (X saat tekrar gösterme)' },
                    { value: 'session', label: 'Oturum (sekme açık kaldıkça bir kere)' },
                    { value: 'always', label: 'Her zaman (cooldown yok — test modu)' },
                ] },
                { key: 'cooldown_hours', label: 'Bekleme Süresi (saat)', type: 'number', nested: true, min: 0 },
                { key: 'max_per_session', label: 'Oturum Başına Maks. Gösterim', type: 'number', nested: true, min: 1 },
            ];
        default:
            return common;
    }
}

export function getItemFields(sectionType: string): FieldDef[] {
    switch (sectionType) {
        case 'header_nav':
            return [
                { key: 'title', label: 'Buton/Link Yazısı', type: 'text' },
                { key: 'value_text', label: 'Hedef (Section type veya URL)', type: 'text' },
                { key: 'target_type', label: 'Hedef Tipi', type: 'select', nested: true, options: [
                    { value: 'section', label: 'Sayfa İçi Section (smooth scroll)' },
                    { value: 'url', label: 'Harici URL (yeni sekmede aç)' },
                    { value: 'go', label: 'Ana Teklif Sayfası (go)' },
                ] },
            ];
        case 'footer_nav':
            return [
                { key: 'title', label: 'Link Yazısı', type: 'text' },
                { key: 'value_text', label: 'Hedef (URL veya section)', type: 'text' },
                { key: 'target_type', label: 'Hedef Tipi', type: 'select', nested: true, options: [
                    { value: 'url', label: 'URL' },
                    { value: 'section', label: 'Sayfa İçi Section' },
                ] },
            ];
        case 'hero':
            return [
                { key: 'ig_user', label: 'Instagram Kullanıcı Adı', type: 'text', nested: true },
                { key: 'ig_location', label: 'Lokasyon / Mekan', type: 'text', nested: true },
                { key: 'description', label: 'Caption (Çevrilebilir)', type: 'textarea' },
                { key: 'hashtag', label: 'Hashtag', type: 'text', nested: true },
                { key: 'emoji', label: 'Emoji (caption sonu)', type: 'text', nested: true },
                { key: 'likes', label: 'Beğeni Sayısı', type: 'text', nested: true },
                { key: 'object_pos', label: 'Görsel Pozisyon (ör: center 30%)', type: 'text', nested: true },
                { key: 'media_type', label: 'Medya Tipi', type: 'select', nested: true, options: [
                    { value: 'image', label: 'Görsel' },
                    { value: 'video', label: 'Video' },
                ] },
                { key: 'media_url', label: 'Görsel / Video', type: 'image', acceptVideo: true },
            ];
        case 'stats':
            return [
                { key: 'title', label: 'Etiket', type: 'text' },
                { key: 'value_text', label: 'Değer (Rakam)', type: 'text' },
                { key: 'suffix', label: 'Sonek (%, x)', type: 'text', nested: true },
                { key: 'prefix', label: 'Önek (+, -)', type: 'text', nested: true },
                { key: 'icon', label: 'İkon', type: 'icon' },
            ];
        case 'how_it_works':
            return [
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'description', label: 'Açıklama', type: 'textarea' },
                { key: 'icon', label: 'İkon', type: 'icon' },
                { key: 'media_type', label: 'Medya Tipi', type: 'select', nested: true, options: [
                    { value: 'image', label: 'Görsel' },
                    { value: 'video', label: 'Video' },
                ] },
                { key: 'media_url', label: 'Görsel / Video URL', type: 'image', acceptVideo: true },
            ];
        case 'usage_scenarios':
            return [
                { key: 'title', label: 'Başlık (İş Sonucu)', type: 'text' },
                { key: 'card_subtitle', label: 'Kart Açıklaması', type: 'text', nested: true },
                { key: 'highlight', label: 'Vurgu Metni (→)', type: 'text', nested: true },
                { key: 'drink_type', label: 'İçecek Türü (Badge)', type: 'text', nested: true },
                { key: 'detail_text', label: 'Detaylı Açıklama', type: 'textarea', nested: true },
                { key: 'ig_user', label: 'Instagram Kullanıcı Adı', type: 'text', nested: true },
                { key: 'ig_location', label: 'Mekan / Kategori', type: 'text', nested: true },
                { key: 'media_url', label: 'Görsel', type: 'image' },
            ];
        case 'revenue_model':
            return [
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'description', label: 'Açıklama', type: 'textarea' },
                { key: 'icon', label: 'İkon', type: 'icon' },
                { key: 'highlight', label: 'Vurgu Metni', type: 'text', nested: true },
            ];
        case 'use_cases':
            return [
                { key: 'title', label: 'Sekme Adı', type: 'text' },
                { key: 'value_text', label: 'Badge Yazısı', type: 'text' },
                { key: 'description', label: 'Başlık', type: 'text' },
                { key: 'desc', label: 'Açıklama', type: 'textarea', nested: true },
                { key: 'icon', label: 'İkon', type: 'icon' },
                { key: 'media_url', label: 'Görsel', type: 'image' },
            ];
        case 'features':
            return [
                { key: 'title', label: 'Başlık', type: 'text' },
                { key: 'description', label: 'Açıklama', type: 'textarea' },
                { key: 'icon', label: 'İkon', type: 'icon' },
            ];
        case 'visual_proof':
            return [
                { key: 'title', label: 'Alt Yazı', type: 'text' },
                { key: 'media_url', label: 'Görsel', type: 'image', circularCrop: true },
            ];
        case 'testimonials':
            return [
                { key: 'title', label: 'İsim', type: 'text' },
                { key: 'description', label: 'Yorum', type: 'textarea' },
                { key: 'value_text', label: 'Unvan / Şirket', type: 'text' },
                { key: 'initials', label: 'Baş Harfler (ED, SK...)', type: 'text', nested: true },
                { key: 'result', label: 'Sonuç Badge (+140% vs)', type: 'text', nested: true },
            ];
        case 'faq':
            return [
                { key: 'title', label: 'Soru', type: 'text' },
                { key: 'value_text', label: 'Cevap', type: 'textarea' },
            ];
        default:
            return [];
    }
}
