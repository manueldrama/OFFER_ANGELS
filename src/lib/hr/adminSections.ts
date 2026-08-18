import { navGroups, toCanonicalPath, ADMIN_BASE } from '../../components/admin/nav/navConfig';

// Admin rotasından "bölüm" türetir — puantajın bölüm bazlı süre dağılımı için.
//
// NEDEN AYRI SABİT LİSTE YOK: Menü yapısı zaten CRM / Teklifler / Servis diye
// gruplanmış durumda (navConfig.navGroups[].key). Buradan türetince menüye yeni
// sayfa eklendiğinde eşleme kendiliğinden güncel kalır; ikinci bir liste tutmak
// er ya da geç menüden sapardı.
//
// KVKK NOTU: Dönen değer yalnızca GRUP anahtarıdır (crm, catalog, reports…).
// Hangi sayfada olduğu hiçbir yerde saklanmaz — ölçülülük sınırı budur.
//
// (lib → components yönünde import: navConfig salt veri ihraç ediyor, React'e
// bağımlı değil. Aynı bilgiyi ikinci kez tanımlamamak için bilinçli tercih.)

/** Eşleşme bulunamazsa kullanılan anahtar. */
export const UNKNOWN_SECTION = 'other';

interface SectionRoute {
    path: string;
    section: string;
}

/**
 * Rotalar uzunluğa göre sıralı tutulur: en uzun eşleşen yol kazanır.
 * Aksi hâlde "/admin" (Genel grubu) her şeyi yakalar ve tüm süre tek bölüme yazılırdı.
 */
const ROUTES: SectionRoute[] = navGroups
    .flatMap(group => group.items
        .filter(item => !item.external && item.path.startsWith('/admin'))
        .map(item => ({ path: item.path, section: group.key })))
    .sort((a, b) => b.path.length - a.path.length);

/** Bölüm anahtarı → okunabilir etiket (ekranlarda gösterim için). */
export const SECTION_LABELS: Record<string, string> = {
    ...Object.fromEntries(navGroups.map(g => [g.key, g.label ?? 'Genel'])),
    [UNKNOWN_SECTION]: 'Diğer',
};

/**
 * Verilen panel yolunun ait olduğu bölüm anahtarı.
 * Panel dışı yollarda null döner — puantaj yalnız panel içi süreyi sayar.
 *
 * İKİ TABAN DA SAYILIR (/admin ve /team).
 *   Panel iki adresten açılıyor; adres önce kanonik uzaya çevrilir. Bu çeviri
 *   OLMASAYDI, çalışan panelinde (/team/...) geçen her dakika bölümsüz
 *   yazılırdı: hata yok, uyarı yok, sadece "Bölüm Dağılımı" bir gün sessizce
 *   boşalırdı. En kötü hata türü budur.
 */
export function sectionForPath(pathname: string | null | undefined): string | null {
    if (!pathname) return null;
    const canonical = toCanonicalPath(pathname);
    if (!canonical.startsWith(ADMIN_BASE)) return null;

    for (const route of ROUTES) {
        if (canonical === route.path || canonical.startsWith(route.path + '/')) {
            return route.section;
        }
    }
    return UNKNOWN_SECTION;
}

export function sectionLabel(key: string): string {
    return SECTION_LABELS[key] ?? key;
}
