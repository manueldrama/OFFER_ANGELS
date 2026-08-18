import React from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { CatalogProduct } from '../../../types';
import { ManualOfferItem } from '../../../services/admin/manualOfferService';

/**
 * Katalogdan sepet kuran ortak seçici — Manuel Teklif (ManualOfferModal) ve
 * Manuel Satış (ManualSaleModal) aynı listeyi kullanır.
 *
 * Veri yükleme parent'ta kalır: Manuel Teklif kampanya fiyat kurallarını,
 * Manuel Satış ise düz katalog fiyatını uygular. Ortaklaşan şey satır kurgusu,
 * adet/fiyat düzenlemesi ve ManualOfferItem'a dönüşümdür.
 */

export interface CartRow {
    productId: string;
    name: string;
    code?: string;
    type: 'product' | 'accessory';
    selected: boolean;
    quantity: number;
    /** Serbest metin — kullanıcı yazarken boş bırakabilsin diye string tutulur. */
    customPrice: string;
    defaultPrice: number;
    image?: string;
    description?: string;
}

/** Türkçe yerelleştirilmiş ürün adı; yoksa ürün koduna düşer. */
export function catalogProductName(p: CatalogProduct): string {
    const loc = p.localized?.find(l => l.language_code === 'tr');
    return loc?.name || p.product_code;
}

/**
 * Katalog ürünlerini seçilebilir sepet satırlarına çevirir.
 * priceFor verilmezse launch_price → list_price sırası uygulanır.
 */
export function buildCartRows(
    products: CatalogProduct[],
    priceFor?: (p: CatalogProduct) => number,
): CartRow[] {
    return products.map(p => {
        const loc = p.localized?.find(l => l.language_code === 'tr');
        const img = p.media?.find(m => m.media_type === 'image' && m.is_active);
        const defaultPrice = priceFor ? priceFor(p) : (p.launch_price || p.list_price || 0);
        return {
            productId: p.id,
            name: catalogProductName(p),
            code: p.product_code,
            type: p.product_type === 'machine' ? 'product' as const : 'accessory' as const,
            selected: false,
            quantity: 1,
            customPrice: String(defaultPrice),
            defaultPrice,
            image: img?.url || '',
            description: loc?.short_description || loc?.description || '',
        };
    });
}

/** Seçili satırları teklif/satış kalemlerine çevirir. */
export function cartRowsToItems(rows: CartRow[]): ManualOfferItem[] {
    return rows
        .filter(r => r.selected)
        .map(r => ({
            id: r.productId,
            name: r.name,
            type: r.type,
            price: parseFloat(r.customPrice || '0') || 0,
            quantity: r.quantity,
            description: r.description,
            image: r.image,
        }));
}

/** Ara toplam / KDV / toplam — tüm manuel akışlarda aynı formül. */
export function cartTotals(items: ManualOfferItem[], vatRate = 20) {
    const subtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    const vat = subtotal * (vatRate / 100);
    return { subtotal, vat, total: subtotal + vat };
}

interface ProductCartPickerProps {
    rows: CartRow[];
    onChange: (rows: CartRow[]) => void;
    /** Liste boşken gösterilecek metin. */
    emptyLabel?: string;
}

export const ProductCartPicker: React.FC<ProductCartPickerProps> = ({ rows, onChange, emptyLabel }) => {
    const patch = (index: number, next: Partial<CartRow>) => {
        onChange(rows.map((r, i) => (i === index ? { ...r, ...next } : r)));
    };

    if (!rows.length) {
        return (
            <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                {emptyLabel || 'Katalogda aktif ürün bulunamadı.'}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {rows.map((row, i) => (
                <div
                    key={row.productId}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${row.selected ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 hover:border-slate-200'}`}
                >
                    <button
                        type="button"
                        onClick={() => patch(i, { selected: !row.selected })}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${row.selected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}
                    >
                        {row.selected && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{row.name}</p>
                        <p className="text-[10px] text-slate-400">{row.code}</p>
                    </div>
                    {row.selected && (
                        <>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => patch(i, { quantity: Math.max(1, row.quantity - 1) })}
                                    className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-8 text-center text-sm font-medium">{row.quantity}</span>
                                <button
                                    type="button"
                                    onClick={() => patch(i, { quantity: row.quantity + 1 })}
                                    className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>
                            <input
                                type="number"
                                min="0"
                                value={row.customPrice}
                                onChange={e => patch(i, { customPrice: e.target.value })}
                                className="w-28 h-9 px-3 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};
