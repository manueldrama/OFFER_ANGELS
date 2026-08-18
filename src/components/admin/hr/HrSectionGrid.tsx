import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { navGroups, isNavItemVisible, withBase, toCanonicalPath } from '../nav/navConfig';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { usePanelBase } from '../../../contexts/PanelBaseContext';
import { AuthContext } from '../../auth/AuthProvider';

// İK Genel Bakış'taki kısayol ızgarası.
//
// KARTLAR navConfig'TEN TÜRETİLİR. Elle ikinci bir liste yazılsaydı yeni bir
// İK sayfası eklendiğinde biri güncellenip diğeri unutulurdu; kullanıcı da
// menüde olan ama burada olmayan (ya da tersi) bir sayfayla karşılaşırdı.
//
// İzin filtresi de aynı sebeple ortak: isNavItemVisible sol menüyle bire bir
// aynı kuralı uygular, yoksa yetkisiz kullanıcı buradan tıklayıp hata alırdı.

/**
 * Kart altındaki tek satır açıklama.
 *
 * navConfig'e konmadı: orası menü yapısının kaynağı, UI metni değil. Anahtarı
 * olmayan sayfa açıklamasız görünür — eksik metin, kartın hiç çıkmamasından iyi.
 */
const HR_SECTION_HINTS: Record<string, string> = {
    '/admin/hr/employees': 'Kadro, çalışma düzeni ve ücret geçmişi',
    '/admin/hr/candidates': 'Aday havuzu, CV okuma, değerlendirme ve iş teklifi',
    '/admin/hr/attendance': 'Giriş-çıkış, mesai doluluğu ve devamsızlık',
    '/admin/hr/leaves': 'İzin talepleri ve onay',
    '/admin/hr/kpi': 'Aylık performans puanı ve prim hak edişi',
    '/admin/hr/commission': 'Satış primi kuralları ve hakediş',
    '/admin/hr/payroll': 'Aylık bordro dönemleri ve ödeme',
    '/admin/hr/contract-templates': 'Sözleşme ve iş teklifi şablonları',
    '/admin/hr/interviews': 'Online video mülakat soru setleri',
    '/admin/hr/settings': 'İşveren bilgileri, KPI eşikleri, resmi tatiller',
    '/admin/me': 'Kendi puantajınız, KPI\'nız ve belgeleriniz',
};

export default function HrSectionGrid() {
    const { pathname } = useLocation();
    const { canAccess } = usePermissions();
    const { role } = useContext(AuthContext);
    // Panel /team tabanında da açılıyor: eşleştirme kanonik yolla, link tabana
    // çevrilerek yapılır (sol menüyle aynı kural).
    const base = usePanelBase();
    const canonicalPath = toCanonicalPath(pathname);

    const group = navGroups.find(g => g.key === 'hr');
    if (!group) return null;

    // Genel Bakış'ın kendisi ızgarada tekrar edilmez — zaten o sayfadasınız.
    const items = group.items
        .filter(i => i.path !== '/admin/hr')
        .filter(i => isNavItemVisible(i, role, canAccess));

    if (items.length === 0) return null;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-6">
            {items.map(item => {
                const Icon = item.icon;
                const active = canonicalPath === item.path;

                const inner = (
                    <>
                        <Icon size={16} className={active ? 'text-slate-900' : 'text-slate-400'} />
                        <span className="block text-[13px] font-semibold text-slate-800 mt-2">
                            {item.label}
                        </span>
                        {HR_SECTION_HINTS[item.path] && (
                            <span className="block text-[11.5px] text-slate-400 mt-0.5 leading-snug">
                                {HR_SECTION_HINTS[item.path]}
                            </span>
                        )}
                    </>
                );

                // Bulunulan sayfa bağlantı değil — kendine tıklatmak kafa karıştırır.
                return active ? (
                    <div key={item.path}
                        className="rounded-xl border border-slate-300 bg-slate-50 p-3.5 cursor-default">
                        {inner}
                    </div>
                ) : (
                    <Link key={item.path} to={withBase(item.path, base)}
                        className="rounded-xl border border-slate-200 bg-white p-3.5 hover:border-slate-400 hover:bg-slate-50 transition-colors">
                        {inner}
                    </Link>
                );
            })}
        </div>
    );
}
