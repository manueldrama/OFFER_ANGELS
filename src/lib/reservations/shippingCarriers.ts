/**
 * Kargo firması listesi — TEK kaynak.
 *
 * DİKKAT: `value` alanları customer_reservations.shipping_company kolonunda
 * DÜZ METİN olarak saklanır. Mevcut kayıtların eşleşmeye devam etmesi için bu
 * değerler Orders.tsx'teki eski <option value>'larıyla birebir aynı kalmalıdır —
 * etiketi değiştirmek serbest, değeri değiştirmek veri bozar.
 */

export interface Carrier {
    /** DB'ye yazılan değer. Değiştirilemez. */
    value: string;
    /** Arayüzde görünen ad. */
    label: string;
}

export const SHIPPING_CARRIERS: readonly Carrier[] = [
    { value: 'Yurtiçi Kargo', label: 'Yurtiçi Kargo' },
    { value: 'Aras Kargo', label: 'Aras Kargo' },
    { value: 'MNG Kargo', label: 'MNG Kargo' },
    { value: 'Sürat Kargo', label: 'Sürat Kargo' },
    { value: 'UPS Kargo', label: 'UPS Kargo' },
    { value: 'DHL Ecommerce', label: 'DHL Ecommerce' },
    { value: 'Trendyol Express', label: 'Trendyol Express' },
    { value: 'PTT Kargo', label: 'PTT Kargo' },
    { value: 'Kurye', label: 'Özel Kurye/Araç' },
];

export const DEFAULT_CARRIER = 'Yurtiçi Kargo';

/** Kayıtlı değer listede yoksa ham değeri döndürür — eski veriyi gizlemez. */
export function carrierLabel(value?: string | null): string {
    const v = String(value || '');
    return SHIPPING_CARRIERS.find(c => c.value === v)?.label || v;
}
