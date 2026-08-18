// Compact site footer used by SEO content pages. The landing page's
// FooterSection is a 100dvh snap section that doesn't make sense outside
// the landing flow; this is the trimmed-down version: logo on top, three
// links in the middle, copyright at the bottom. Uses landing tokens (P)
// so colors / typography stay consistent.

import { P } from '../landing/primitives';
import { useLegalFooterLinks } from '../../hooks/useLegalFooterLinks';

interface SiteFooterProps {
    homeHref: string;
    /** Explicit link list. Verilmezse `lang` üzerinden varsayılan yasal link
     *  seti üretilir (yalnızca Türkçe yasal sayfalar). Link satırını tamamen
     *  gizlemek için boş dizi geçin. */
    links?: Array<{ label: string; href: string }>;
    /** Aktif dil kodu. Yasal linkler yalnızca 'tr' için üretilir — sayfaların
     *  içeriği Türkçe ve Türk tüketici mevzuatına özgü. */
    lang?: string;
    /** Footer copyright label, e.g. "CAFEPASTE". */
    brandLabel: string;
}

export function SiteFooter({ homeHref, links, lang, brandLabel }: SiteFooterProps) {
    // Hook koşulsuz çağrılmalı; sonucu aşağıda yalnızca `lang` verildiğinde ve
    // `links` ile override edilmediğinde kullanıyoruz.
    const legal = useLegalFooterLinks(lang);
    // Gizlilik ve İletişim linkleri KALDIRILDI (operatör kararı 2026-08-18):
    // etiketleri koda sabit Türkçe yazılmıştı ve dil ne olursa olsun Türkçe
    // basılıyordu; slug da her dilde '/gizlilik' kalıyordu. Yerine her pazara
    // özel lokalize link seti kurulacak. O gelene kadar bu iki link hiçbir
    // dilde render edilmiyor — Türkçe dahil.
    //
    // Sayfalar duruyor, yalnız footer kısayolu yok: /:lang/gizlilik (7 dilli)
    // ve /:lang/<iletisim-slug> rotaları App.tsx'te aynen çalışıyor.
    //
    // Geriye kalan `legal` seti (mesafeli satış, ön bilgilendirme, iade,
    // teslimat) yalnızca Türkçede ve admin toggle'ı açıkken görünür —
    // /admin/settings/general üzerinden koda dokunmadan kapatılabilir.
    const resolved = links ?? (lang ? legal : []);
    return (
        <footer
            className="border-t mt-12"
            style={{ background: P.secondary, borderColor: P.border }}
        >
            <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-10 flex flex-col items-center gap-6">
                <a href={homeHref} aria-label="CAFEPASTE" className="inline-block">
                    <img
                        src="/logo.svg"
                        alt="CAFEPASTE"
                        className="h-6 w-auto object-contain"
                    />
                </a>

                {resolved.length > 0 && (
                    <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
                        {resolved.map((l) => (
                            <a
                                key={l.label}
                                href={l.href}
                                className="text-sm font-semibold transition-colors"
                                style={{ color: P.muted }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = P.fg; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = P.muted; }}
                            >
                                {l.label}
                            </a>
                        ))}
                    </nav>
                )}

                <p className="text-xs" style={{ color: P.lightMuted }}>
                    © {new Date().getFullYear()} {brandLabel}
                </p>
            </div>
        </footer>
    );
}
