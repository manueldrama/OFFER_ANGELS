// Satıcı künyesi — yasal sayfalarda ve kurumsal iletişim sayfasında gösterilir.
//
// Mesafeli satış mevzuatı satıcının unvan, adres, telefon, e-posta ve MERSIS
// bilgilerinin tüketiciye açıkça sunulmasını istiyor; ödeme kuruluşları da site
// onayında aynı bilgileri arıyor. Değerler src/lib/companyIdentity.ts'ten gelir,
// boş alanlar (henüz alınmamış MERSIS gibi) otomatik olarak gizlenir.

import { COMPANY, renderIdentityRows } from '../../lib/companyIdentity';

interface CompanyIdentityBlockProps {
    /** Blok başlığı. Sayfa içi bağlama göre değişebilir. */
    heading?: string;
    className?: string;
}

export default function CompanyIdentityBlock({
    heading = 'Satıcı Bilgileri',
    className = '',
}: CompanyIdentityBlockProps) {
    const rows = renderIdentityRows();

    return (
        <div className={`rounded-lg border border-slate-200 bg-slate-50 p-5 ${className}`}>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">{heading}</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-sm">
                {rows.map((r) => (
                    <div key={r.label} className="contents">
                        <dt className="text-slate-500">{r.label}</dt>
                        <dd className="text-slate-800 break-words">
                            {r.label === 'E-posta' ? (
                                <a href={`mailto:${r.value}`} className="text-blue-600 underline">{r.value}</a>
                            ) : r.label === 'Telefon' ? (
                                <a href={`tel:${r.value.replace(/\s/g, '')}`} className="text-blue-600 underline">{r.value}</a>
                            ) : r.label === 'Web Sitesi' ? (
                                <a href={r.value} className="text-blue-600 underline">{r.value}</a>
                            ) : (
                                r.value
                            )}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="mt-3 text-xs text-slate-500">
                {COMPANY.brandName}, {COMPANY.legalName} tarafından işletilen bir markadır.
            </p>
        </div>
    );
}
