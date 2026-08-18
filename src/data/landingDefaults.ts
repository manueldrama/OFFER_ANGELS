import { LandingPageSection } from '../types';

/**
 * Default landing page sections — used as fallback when edge-prerender AND the
 * client variant fetch both fail to deliver content (last-resort safety net).
 *
 * AUTO-GENERATED from the live active TR variant by:
 *   node scripts/sync-landing-defaults.mjs
 * Variant: "A VARYANT" (8860be91-e130-4ea3-98d3-682c7d287c1f)
 *
 * DO NOT hand-edit — re-run the script after changing the variant in admin.
 * Edge-prerender always serves live content, so this only needs to be "recent",
 * not real-time.
 */
export const DEFAULT_SECTIONS: LandingPageSection[] = [
    {
        "id": "a60951d7-2e8e-4833-b4fc-22d73437225b",
        "section_type": "hero",
        "title": null,
        "is_active": true,
        "sort_order": 10,
        "config": {
            "headline": "Her İçeceği",
            "subtitle": "CAFEPASTE içecek art makinesi ile işletme gelirinizi artırın, sosyal medya görünürlüğü katlayın ve müşterilerinize unutulmaz deneyimler yaşatın.",
            "cta_label": "Özel Teklif Oluştur",
            "cta_target": "go",
            "hero_cat_0": "kafeler",
            "brand_names": [
                "Hilton",
                "Marriott",
                "Soho House",
                "W Hotels"
            ],
            "hero_image_url": "/hero-desktop.webp",
            "hero_video_url": "",
            "brand_stat_text": "Dünyaca Ünlü İşletmelerin Tercihi",
            "headline_accent": "Marka Deneyimine",
            "headline_suffix": "Dönüştürün",
            "hide_post_header": true,
            "slide_duration_ms": 4000,
            "product_description": "Kahve, kokteyl ve pastalarınızı markanıza özel logo, mesaj ve görsellerle premium sunumlara dönüştüren profesyonel içecek art makinesi.",
            "secondary_cta_label": "Detaylı Bilgi",
            "secondary_cta_target": "stats"
        },
        "items": [
            {
                "id": "a357fc33-c60b-48e1-935f-be3177a9b8ec",
                "section_id": "a60951d7-2e8e-4833-b4fc-22d73437225b",
                "title": "Yeni öğe",
                "description": null,
                "value_text": null,
                "media_url": "/videos/hero-post-2.mp4",
                "icon": null,
                "extra": {
                    "media_type": "video",
                    "object_pos": "center 30%"
                },
                "is_active": true,
                "sort_order": 0
            },
            {
                "id": "24bcf86c-cdee-4707-acd1-13b1f09cfe87",
                "section_id": "a60951d7-2e8e-4833-b4fc-22d73437225b",
                "title": null,
                "description": "Portrem kahveme basıldı, inanamıyorum!",
                "value_text": null,
                "media_url": "/cafepaste-selfie-art.webp",
                "icon": null,
                "extra": {
                    "user": "latte_artisan",
                    "emoji": "☕",
                    "likes": "2847",
                    "hashtag": "#CAFEPASTE #LatteArt #CoffeePortrait",
                    "ig_user": "latte_artisan",
                    "location": "Specialty Coffee Lab",
                    "media_type": "image",
                    "object_pos": "center 95%"
                },
                "is_active": true,
                "sort_order": 10
            },
            {
                "id": "cc1f4a63-dcc2-4a4e-98ac-fe29d413cbd6",
                "section_id": "a60951d7-2e8e-4833-b4fc-22d73437225b",
                "title": null,
                "description": "Cheers yazılı kokteyl, gece başka güzel",
                "value_text": null,
                "media_url": "/ig-post-2.webp",
                "icon": null,
                "extra": {
                    "user": "cocktail_queen",
                    "emoji": "🍸",
                    "likes": "1523",
                    "hashtag": "#Cheers #CocktailArt #SohoHouse",
                    "ig_user": "cocktail_queen",
                    "location": "Soho House Istanbul",
                    "media_type": "image",
                    "object_pos": "center 25%"
                },
                "is_active": true,
                "sort_order": 20
            }
        ]
    },
    {
        "id": "d2253713-c9dd-4e05-b613-b8f1d5a3103d",
        "section_type": "footer_nav",
        "title": null,
        "is_active": true,
        "sort_order": 20,
        "config": {
            "logo_url": "/logo.svg",
            "show_logo": true,
            "copyright_text": "CAFEPASTE. Tüm hakları saklıdır."
        },
        "items": [
            {
                "id": "7745bc36-e75c-42f4-80e4-63f1033fac66",
                "section_id": "d2253713-c9dd-4e05-b613-b8f1d5a3103d",
                "title": "Influencer İşbirliği Başvuru",
                "description": null,
                "value_text": "influencer",
                "media_url": null,
                "icon": null,
                "extra": {
                    "target_type": "url"
                },
                "is_active": true,
                "sort_order": 0
            }
        ]
    },
    {
        "id": "513ac986-43eb-49ec-8b37-7c83b5ae4849",
        "section_type": "header_nav",
        "title": null,
        "is_active": true,
        "sort_order": 30,
        "config": {
            "tagline": "İÇECEK ART MAKİNESİ",
            "logo_url": "/logo.svg",
            "show_cta_button": true,
            "cta_header_label": "Teklif Oluştur",
            "cta_header_target": "go",
            "show_tagline_mobile": true,
            "show_language_switcher": true
        },
        "items": [
            {
                "id": "787a0ff9-c26d-4383-ad58-9580d990faab",
                "section_id": "513ac986-43eb-49ec-8b37-7c83b5ae4849",
                "title": "Nasıl Çalışır?",
                "description": null,
                "value_text": "nasil-calisir",
                "media_url": null,
                "icon": null,
                "extra": {
                    "target_type": "section"
                },
                "is_active": true,
                "sort_order": 10
            },
            {
                "id": "a5eeb483-e0e4-4ea7-992d-cadb3f67a7f2",
                "section_id": "513ac986-43eb-49ec-8b37-7c83b5ae4849",
                "title": "Galeri",
                "description": null,
                "value_text": "gorsel-kanit",
                "media_url": null,
                "icon": null,
                "extra": {
                    "target_type": "section"
                },
                "is_active": true,
                "sort_order": 20
            }
        ]
    },
    {
        "id": "0fb89fdb-3776-4f02-807f-c7b5b769264f",
        "section_type": "sticky_mobile_cta",
        "title": null,
        "is_active": true,
        "sort_order": 40,
        "config": {
            "cta_bg_color": "#C41E2A",
            "cta_text_color": "#FAFAFA",
            "show_arrow_icon": true,
            "fallback_cta_label": "Teklif Oluştur",
            "show_scroll_to_top": true,
            "fallback_cta_target": "go",
            "scroll_to_top_tooltip": "En üste git",
            "show_scroll_threshold": 50
        },
        "items": []
    },
    {
        "id": "a51f9552-aa50-46df-8161-b7b4f2a26aef",
        "section_type": "how_it_works",
        "title": null,
        "is_active": true,
        "sort_order": 50,
        "config": {
            "title": "3 Adımda Premium Sunum",
            "eyebrow": "Nasıl Çalışır?",
            "subtitle": "Uygulama yok. Eğitim yok. İlk günden kullanılır.",
            "sticky_cta_label": "Kullanım Senaryoları",
            "sticky_cta_target": "usage_scenarios"
        },
        "items": [
            {
                "id": "409282fe-8c07-4157-ade9-d2396e61f7e4",
                "section_id": "a51f9552-aa50-46df-8161-b7b4f2a26aef",
                "title": "1. QR Kodu Tarat",
                "description": "Müşteriler içeceklerini beklerken masadaki QR kodu telefonlarıyla taratıyor.",
                "value_text": null,
                "media_url": "/videos/step-1-qr.mp4",
                "icon": "QrCode",
                "extra": {
                    "media_type": "video"
                },
                "is_active": true,
                "sort_order": 0
            },
            {
                "id": "e31d7f57-a216-4ba7-8f4c-93bf6570e31d",
                "section_id": "a51f9552-aa50-46df-8161-b7b4f2a26aef",
                "title": "2. Fotoğraf veya Logo Yükle",
                "description": "Selfie veya herhangi bir fotoğrafı veya logo — direkt tarayıcıdan, saniyeler içinde.",
                "value_text": null,
                "media_url": "/videos/step-2-upload.mp4",
                "icon": "UploadCloud",
                "extra": {
                    "media_type": "video"
                },
                "is_active": true,
                "sort_order": 10
            },
            {
                "id": "96773ad1-35de-418a-8260-1197988371f1",
                "section_id": "a51f9552-aa50-46df-8161-b7b4f2a26aef",
                "title": "3. İmza Sunumu Servis Edin",
                "description": "Bardağı makineye ve premium sunuma dönüştürür.",
                "value_text": null,
                "media_url": "/videos/step-3-art.mp4",
                "icon": "Sparkles",
                "extra": {
                    "media_type": "video"
                },
                "is_active": true,
                "sort_order": 20
            }
        ]
    },
    {
        "id": "1c50ea2d-ba6a-4590-b50d-b44d83a88da8",
        "section_type": "stats",
        "title": null,
        "is_active": true,
        "sort_order": 60,
        "config": {
            "title": "Sadece Bir Sunum Değil",
            "cta_label": "Nasıl Çalışır",
            "image_url": "https://laonuwjnjkaawsreynuk.supabase.co/storage/v1/object/public/whatsapp_media/landing-cms-8qee2azwpt8_1774539888847.png",
            "cta_target": "nasil-calisir",
            "title_accent": "Pazarlama Aracı",
            "sticky_cta_label": "Nasıl Çalışır ?",
            "sticky_cta_target": "how_it_works"
        },
        "items": [
            {
                "id": "09bf2b98-5b56-4ddd-9c7d-6c7da2ee0d9e",
                "section_id": "1c50ea2d-ba6a-4590-b50d-b44d83a88da8",
                "title": "İçecek Satış Artışı",
                "description": null,
                "value_text": "30",
                "media_url": null,
                "icon": null,
                "extra": {
                    "prefix": "+",
                    "suffix": "%"
                },
                "is_active": true,
                "sort_order": 0
            },
            {
                "id": "9b95f219-1e20-4dcc-900a-d121f0268d60",
                "section_id": "1c50ea2d-ba6a-4590-b50d-b44d83a88da8",
                "title": "Sosyal Medya Erişimi",
                "description": null,
                "value_text": "10",
                "media_url": null,
                "icon": null,
                "extra": {
                    "prefix": "",
                    "suffix": "x"
                },
                "is_active": true,
                "sort_order": 10
            },
            {
                "id": "9a2346f6-525b-4fc1-84a0-b91380326f22",
                "section_id": "1c50ea2d-ba6a-4590-b50d-b44d83a88da8",
                "title": "Müşteri Geri Dönüşü",
                "description": null,
                "value_text": "85",
                "media_url": null,
                "icon": null,
                "extra": {
                    "prefix": "",
                    "suffix": "%"
                },
                "is_active": true,
                "sort_order": 20
            }
        ]
    },
    {
        "id": "7698dfc0-0ca2-4f49-8e3c-708d44c5ccc3",
        "section_type": "usage_scenarios",
        "title": null,
        "is_active": true,
        "sort_order": 70,
        "config": {
            "title": "İşletmeniz İçin Neler Yapabilirsiniz?",
            "eyebrow": "Kullanım Senaryoları",
            "subtitle": "CAFEPASTE ile sınır hayal gücünüz. İşte işletmenize hemen değer katacak senaryolar.",
            "sticky_cta_label": "Getiri Hesaplama",
            "sticky_cta_target": "roi_calculator"
        },
        "items": [
            {
                "id": "7666bb15-eb33-480d-bd7a-09f2befb8595",
                "section_id": "7698dfc0-0ca2-4f49-8e3c-708d44c5ccc3",
                "title": "Kişiye Özel İçecek Deneyimi",
                "description": "Müşteriler kendi selfie'lerini veya evcil hayvan fotoğraflarını yükleyip içeceklerine bastırıyor. Her bardak paylaşılabilir bir an.",
                "value_text": null,
                "media_url": "https://laonuwjnjkaawsreynuk.supabase.co/storage/v1/object/public/whatsapp_media/landing-cms-aatabu422z_1775165826849.png",
                "icon": "Camera",
                "extra": {
                    "highlight": "Müşteri başına 2+ sosyal paylaşım",
                    "drink_type": "Kahve",
                    "card_subtitle": "Müşteri kendi fotoğrafını içeceğinde görür."
                },
                "is_active": true,
                "sort_order": 0
            },
            {
                "id": "be399c20-6d59-4fa9-9880-2ef9ce85c7d3",
                "section_id": "7698dfc0-0ca2-4f49-8e3c-708d44c5ccc3",
                "title": "Kurumsal Marka Sunumu",
                "description": "İşletme logonuzu her sabah kahvesine basın. Kurumsal etkinliklerde sponsor logolarını içeceklere yerleştirin.",
                "value_text": null,
                "media_url": "https://laonuwjnjkaawsreynuk.supabase.co/storage/v1/object/public/whatsapp_media/landing-cms-rpr16qz5j8_1775165839073.png",
                "icon": "Building2",
                "extra": {
                    "highlight": "Marka bilinirliğinde %300 artış"
                },
                "is_active": true,
                "sort_order": 10
            },
            {
                "id": "92302763-739d-4cb2-8ccc-ac6e1d1102d5",
                "section_id": "7698dfc0-0ca2-4f49-8e3c-708d44c5ccc3",
                "title": "Özel Gün Kampanyaları",
                "description": "Sevgililer Günü kalpleri, yılbaşı temaları, doğum günü mesajları — sezonluk kampanyalarla ek gelir yaratın.",
                "value_text": null,
                "media_url": "https://laonuwjnjkaawsreynuk.supabase.co/storage/v1/object/public/whatsapp_media/landing-cms-q0ixj7fb50f_1775165393574.png",
                "icon": "Sparkles",
                "extra": {
                    "highlight": "Kampanya günlerinde +50% satış",
                    "drink_type": "Kokteyl"
                },
                "is_active": true,
                "sort_order": 20
            },
            {
                "id": "a56141d9-b8d3-4938-b0c2-939801c97639",
                "section_id": "7698dfc0-0ca2-4f49-8e3c-708d44c5ccc3",
                "title": "Paylaş & Kazan Programı",
                "description": "Müşteriler içeceklerini paylaştığında indirim veya ücretsiz içecek kazansın. Viral döngü otomatik çalışır.",
                "value_text": null,
                "media_url": "https://laonuwjnjkaawsreynuk.supabase.co/storage/v1/object/public/whatsapp_media/landing-cms-vfzdo2obljp_1775165843151.png",
                "icon": "Share2",
                "extra": {
                    "highlight": "Organik müşteri kazanım maliyeti ₺0",
                    "drink_type": "Kokteyl"
                },
                "is_active": true,
                "sort_order": 40
            }
        ]
    },
    {
        "id": "288c492d-d83c-475c-a86c-d00fb79040c1",
        "section_type": "roi_calculator",
        "title": null,
        "is_active": true,
        "sort_order": 80,
        "config": {
            "title": "Yatırım Geri Dönüşünü Hesaplayın",
            "eyebrow": "Gelir Projeksiyo­nu",
            "subtitle": "Kendi işletme rakamlarınızı girin, aylık ek gelirinizi görün.",
            "sticky_cta_label": "Özel Teklifi Görün"
        },
        "items": []
    },
    {
        "id": "2bb711d5-12fa-4fbf-85ba-314e25299e26",
        "section_type": "visual_proof",
        "title": null,
        "is_active": true,
        "sort_order": 110,
        "config": {
            "title": "Her İçeceğe Çalışır",
            "eyebrow": "Görsel Kanıt",
            "subtitle": "Kahve, kokteyl, bira, milkshake ve dahası. Köpüğü varsa, sanata dönüştürürüz."
        },
        "items": [
            {
                "id": "01dc7bb0-9e3a-4eb3-8da1-ceba683362c3",
                "section_id": "2bb711d5-12fa-4fbf-85ba-314e25299e26",
                "title": "Art'lı içecek 1",
                "description": null,
                "value_text": null,
                "media_url": "https://laonuwjnjkaawsreynuk.supabase.co/storage/v1/object/public/whatsapp_media/landing-cms-a4duj344ymg_1775165819057.png",
                "icon": null,
                "extra": {},
                "is_active": true,
                "sort_order": 0
            },
            {
                "id": "aa5ab7e4-ac37-4381-8737-7c16ebacb54d",
                "section_id": "2bb711d5-12fa-4fbf-85ba-314e25299e26",
                "title": "Art'lı içecek 2",
                "description": null,
                "value_text": null,
                "media_url": "https://laonuwjnjkaawsreynuk.supabase.co/storage/v1/object/public/whatsapp_media/landing-cms-aatabu422z_1775165826849.png",
                "icon": null,
                "extra": {},
                "is_active": true,
                "sort_order": 10
            },
            {
                "id": "e52ceeaf-08c5-45fb-97ee-a94933209b59",
                "section_id": "2bb711d5-12fa-4fbf-85ba-314e25299e26",
                "title": "Art'lı içecek 3",
                "description": null,
                "value_text": null,
                "media_url": "https://laonuwjnjkaawsreynuk.supabase.co/storage/v1/object/public/whatsapp_media/landing-cms-rpr16qz5j8_1775165839073.png",
                "icon": null,
                "extra": {},
                "is_active": true,
                "sort_order": 20
            },
            {
                "id": "aef7d402-2b9b-41c2-94d5-452969509383",
                "section_id": "2bb711d5-12fa-4fbf-85ba-314e25299e26",
                "title": "Art'lı içecek 4",
                "description": null,
                "value_text": null,
                "media_url": "https://laonuwjnjkaawsreynuk.supabase.co/storage/v1/object/public/whatsapp_media/landing-cms-vfzdo2obljp_1775165843151.png",
                "icon": null,
                "extra": {},
                "is_active": true,
                "sort_order": 30
            },
            {
                "id": "f5a329fc-49b4-4a1d-af15-ecd21b522d35",
                "section_id": "2bb711d5-12fa-4fbf-85ba-314e25299e26",
                "title": "Yeni öğe",
                "description": null,
                "value_text": null,
                "media_url": "https://laonuwjnjkaawsreynuk.supabase.co/storage/v1/object/public/whatsapp_media/landing-cms-q0ixj7fb50f_1775165393574.png",
                "icon": null,
                "extra": {},
                "is_active": true,
                "sort_order": 40
            }
        ]
    }
];
