// Footer'daki yasal sayfa linklerini (mesafeli satış, ön bilgilendirme, iade,
// teslimat) tek yerden çözer.
//
// İki koşulu birlikte uygular:
//   1. Dil — sayfalar yalnızca Türkçe yazıldı ve Türk tüketici mevzuatına özgü,
//      bu yüzden legalFooterLinks() Türkçe dışında zaten boş dizi döner.
//   2. Admin toggle — /admin/settings/general altındaki tek anahtar
//      (app_settings.legal_footer_links_enabled) tüm siteyi birden aç/kapatır.
//
// Neden hook: linkler landing, SEO sayfaları, blog ve kurumsal sayfaların
// footer'larında ayrı ayrı render ediliyor. Toggle'ı her çağrı noktasında
// tekrar okumak yerine burada birleştiriliyor; useAppSettings zaten modül
// düzeyinde önbelleklenmiş global bir singleton, ek ağ isteği doğurmaz.
//
// Hata durumunda AÇIK kalır: useAppSettings okuma başarısız olursa
// varsayılanlara döner ve varsayılan 'true'. Bu linkler ödeme kuruluşu site
// onayının gereği, bir ağ hatası yüzünden kaybolmamalı.

import { useAppSettings } from './useAppSettings';
import { legalFooterLinks } from '../lib/seoConfig';

export function useLegalFooterLinks(lang: string | null | undefined): Array<{ label: string; href: string }> {
    const { settings } = useAppSettings();
    if (settings.legal_footer_links_enabled === 'false') return [];
    return legalFooterLinks(lang);
}
