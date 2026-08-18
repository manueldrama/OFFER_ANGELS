import React from 'react';
import { X, FileText, ExternalLink, Package, Clock } from 'lucide-react';
import { describeRemaining } from '../../../lib/offerExpiry';
import { productColor } from './ProductPills';
import type { WinBackOfferItem } from '../../../services/admin/winbackService';

export interface OfferPreviewData {
    customerName: string;
    companyName?: string | null;
    offerNumber?: string | null;
    offerToken: string | null;
    offerValidUntil?: string | null;
    offerIsActive?: boolean;
    items: WinBackOfferItem[];
    /** KDV dahil toplam (generated_offers.total). */
    total: number | null;
}

interface OfferPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    data: OfferPreviewData | null;
}

const tl = (n: number) => `₺${Math.round(n).toLocaleString('tr-TR')}`;

/**
 * Geri Kazanım kartından açılan salt-okunur teklif önizleme popup'ı.
 * Hangi ürünler, hangi birim/liste fiyatı ve KDV dahil toplam teklif edilmiş gösterir;
 * "Teklifi Aç" ile müşteri teklif sayfasını (/offer/:token) yeni sekmede açar.
 */
export const OfferPreviewDialog: React.FC<OfferPreviewDialogProps> = ({ isOpen, onClose, data }) => {
    if (!isOpen || !data) return null;

    const { customerName, companyName, offerNumber, offerToken, offerValidUntil, offerIsActive, items, total } = data;
    const remaining = describeRemaining(offerValidUntil ?? null);
    const remainingTone = {
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        red: 'bg-red-50 text-red-700 border-red-200',
        slate: 'bg-slate-50 text-slate-600 border-slate-200',
    }[remaining.tone];

    // KDV hariç ara toplam — kalemlerden; total varsa KDV dahil onu baz al.
    const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const offerUrl = offerToken ? `/offer/${offerToken}` : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h2 className="flex items-center gap-2.5 text-lg font-bold text-slate-800">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                            <FileText className="h-4 w-4 text-indigo-600" />
                        </div>
                        Teklif Detayı
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    {/* Müşteri + teklif no + geçerlilik */}
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">
                                {customerName}
                                {companyName && <span className="font-normal text-slate-400"> · {companyName}</span>}
                            </div>
                            <div className="mt-0.5 font-mono text-xs text-slate-500">
                                {offerNumber || offerToken || '—'}
                            </div>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${remainingTone}`}>
                            <Clock className="h-3 w-3" />
                            {offerIsActive === false ? 'Pasif' : remaining.label}
                        </span>
                    </div>

                    {/* Kalemler */}
                    {items.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                            <Package className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                            Bu teklifin kalem dökümü bulunamadı.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-lg border border-slate-100">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        <th className="px-3 py-2 text-left">Ürün</th>
                                        <th className="px-3 py-2 text-center">Adet</th>
                                        <th className="px-3 py-2 text-right">Birim</th>
                                        <th className="px-3 py-2 text-right">Tutar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((it, i) => {
                                        const c = productColor(it.name);
                                        return (
                                            <tr key={`${it.name}-${i}`}>
                                                <td className="px-3 py-2.5">
                                                    <span
                                                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-bold"
                                                        style={{ color: c.text, background: c.bg }}
                                                    >
                                                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.text }} />
                                                        {it.name}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center font-medium text-slate-600">×{it.quantity}</td>
                                                <td className="px-3 py-2.5 text-right">
                                                    {it.listPrice && (
                                                        <span className="mr-1.5 text-[11px] text-slate-400 line-through">{tl(it.listPrice)}</span>
                                                    )}
                                                    <span className="font-semibold text-slate-700">{tl(it.price)}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-slate-900">{tl(it.price * it.quantity)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Toplam */}
                    {(total != null || items.length > 0) && (
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                            {items.length > 0 && (
                                <div className="flex items-center justify-between text-[12px] text-indigo-700">
                                    <span>Ara toplam (KDV hariç)</span>
                                    <span className="font-semibold">{tl(subtotal)}</span>
                                </div>
                            )}
                            <div className="mt-1 flex items-center justify-between">
                                <span className="text-sm font-bold text-indigo-900">Toplam (KDV dahil)</span>
                                <span className="text-lg font-black text-indigo-900">
                                    {tl(total != null ? total : subtotal * 1.2)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        Kapat
                    </button>
                    {offerUrl && (
                        <a
                            href={offerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Teklifi Aç
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};
