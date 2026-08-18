import React from 'react';
import { Box } from 'lucide-react';

/** Model adı → renk paleti (referans list.css prod-* sınıfları). */
const PRODUCT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
    'CafePaste Pro': { text: '#4F3FE0', bg: '#F1EFFE', border: '#E0DBFB' },
    'CafePaste Max': { text: '#B8830C', bg: '#FAF2DC', border: '#F0E2BC' },
    'CafePaste Lite': { text: '#1B8FD4', bg: '#E8F4FC', border: '#D2E9F7' },
    'CafePaste Mini': { text: '#5C7088', bg: '#EEF1F5', border: '#E0E6ED' },
    'Bakım Paketi': { text: '#1F9D6B', bg: '#E7F6EE', border: '#D2EEE0' },
};
const FALLBACK = { text: '#5C7088', bg: '#EEF1F5', border: '#E0E6ED' };

/** Model adına göre renk paleti (eşleşme yoksa nötr fallback). Diğer bileşenler de kullanır. */
export function productColor(name: string) {
    return PRODUCT_COLORS[name] || FALLBACK;
}

/** Bir teklifin item dizisinden benzersiz model adlarını çıkarır (offer_snapshot / generated_offer ortak şekli).
 * type alanı varsa yalnız asıl ürün (type==='product') satırlarını alır; rezervasyon/ek kalemleri eler. */
export function extractProductNames(items: unknown): string[] {
    const arr = Array.isArray(items) ? items : [];
    const hasTyped = arr.some((it: any) => it && typeof it.type === 'string');
    const source = hasTyped ? arr.filter((it: any) => it?.type === 'product') : arr;
    const names = (source.length ? source : arr)
        .map((it: any) => it?.model || it?.product_name || it?.name || it?.title)
        .filter((n: unknown): n is string => typeof n === 'string' && n.trim().length > 0);
    return Array.from(new Set(names));
}

interface ProductPillsProps {
    products: string[];
}

/** "Teklif edilen modeller" pill satırı. Veri yoksa hiç render edilmez. */
export const ProductPills: React.FC<ProductPillsProps> = ({ products }) => {
    if (!products || products.length === 0) return null;
    return (
        <div className="mb-3.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <Box size={12} />
                Teklif edilen modeller
            </span>
            {products.map((p) => {
                const c = PRODUCT_COLORS[p] || FALLBACK;
                return (
                    <span
                        key={p}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-bold"
                        style={{ color: c.text, background: c.bg, borderColor: c.border }}
                    >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.text }} />
                        {p}
                    </span>
                );
            })}
        </div>
    );
};
