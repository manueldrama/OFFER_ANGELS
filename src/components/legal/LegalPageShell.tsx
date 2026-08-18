// Yasal sayfaların ortak kabuğu — Gizlilik Politikası, Mesafeli Satış
// Sözleşmesi, Ön Bilgilendirme Formu, İade Koşulları ve Teslimat Şartları
// hepsi bunu kullanır.
//
// Neden i18next ve SiteHeader/SiteFooter kullanılmıyor:
//   Bu sayfalar üçüncü taraf denetimlerinde (PayTR site onayı, Meta App Review)
//   açılıyor ve i18n provider'ı ya da Supabase çeviri backend'i yüklenmeden de
//   eksiksiz render etmeleri gerekiyor. Sabit, bağımsız ve deterministik
//   olmaları bilinçli bir tercih — PrivacyPolicy.tsx bu deseni zaten
//   kullanıyordu, buraya çıkarıldı ki dört kez kopyalanmasın.

import React from 'react';
import { Link } from 'react-router-dom';

export interface LegalSection {
    title: string;
    body: React.ReactNode;
}

interface LegalPageShellProps {
    /** H1 başlığı. */
    title: string;
    /** ISO tarih (YYYY-AA-GG) — header'ın sağında "Güncellendi" olarak görünür. */
    updatedAt: string;
    /** Başlığın altındaki tek satırlık özet. */
    intro?: string;
    /** Ana sayfa linki — dil önekli sayfalarda `/tr`, öneksizde `/`. */
    homeHref?: string;
    homeLabel?: string;
    updatedAtLabel?: string;
    /** Numaralı bölümler. Serbest içerik için `children` kullanılır. */
    sections?: LegalSection[];
    children?: React.ReactNode;
    /** Alt barın sağ tarafı — ör. dil seçici. */
    footerRight?: React.ReactNode;
    /** <title> ve meta description. Verilmezse başlık dokunulmaz (PrivacyPolicy
     *  gibi mevcut sayfaların davranışı korunur). */
    metaTitle?: string;
    metaDescription?: string;
}

/** Bölüm gövdelerinde ve sözleşme HTML'inde kullanılan ortak tipografi.
 *  Sözleşme metinleri admin tarafından HTML olarak yazıldığı için liste ve
 *  paragraf stilleri burada merkezi olarak veriliyor. */
export const LEGAL_PROSE_CLASS =
    'text-sm text-slate-700 leading-relaxed space-y-3 ' +
    '[&_p]:mb-3 [&_strong]:text-slate-900 ' +
    '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-sm ' +
    '[&_table]:w-full [&_table]:text-sm [&_td]:py-1 [&_td]:pr-4 [&_td]:align-top';

export default function LegalPageShell({
    title,
    updatedAt,
    intro,
    homeHref = '/',
    homeLabel = '← Ana sayfaya dön',
    updatedAtLabel = 'Güncellendi',
    sections,
    children,
    footerRight,
    metaTitle,
    metaDescription,
}: LegalPageShellProps) {
    // SEOHead/Helmet yerine imperatif: bu sayfalar provider ağacının dışında da
    // çalışabilmeli. CorporateContact.tsx da aynı yaklaşımı kullanıyor.
    React.useEffect(() => {
        if (metaTitle) document.title = metaTitle;
        if (metaDescription) {
            let meta = document.querySelector('meta[name="description"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('name', 'description');
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', metaDescription);
        }
    }, [metaTitle, metaDescription]);

    return (
        <div className="min-h-screen bg-white">
            <header className="border-b border-slate-200 bg-white">
                <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
                    <Link to={homeHref} className="flex items-center gap-2">
                        <img src="/logo.svg" alt="CAFEPASTE" className="h-6" />
                    </Link>
                    <span className="text-xs text-slate-400">{updatedAtLabel}: {updatedAt}</span>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
                {intro && <p className="text-sm text-slate-500 mb-10">{intro}</p>}

                {sections?.map((s, i) => (
                    <section key={i} className="mb-8">
                        <h2 className="text-lg font-semibold text-slate-900 mb-2">{s.title}</h2>
                        <div className={LEGAL_PROSE_CLASS}>{s.body}</div>
                    </section>
                ))}

                {children}

                <div className="mt-12 pt-6 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
                    <Link to={homeHref} className="text-sm text-blue-600 hover:underline">{homeLabel}</Link>
                    {footerRight}
                </div>
            </main>
        </div>
    );
}
