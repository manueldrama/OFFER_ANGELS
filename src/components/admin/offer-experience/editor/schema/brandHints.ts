import type { EditorFieldId } from './fields';

export interface BrandHint {
    rule: string;
    severity: 'info' | 'warn';
}

const BRAND_HINTS: Partial<Record<EditorFieldId, BrandHint[]>> = {
    product_name: [
        { rule: "Marka 'Cafepaste Pro' olarak tek parça yazılır.", severity: 'warn' },
    ],
    countdown_label: [
        { rule: 'Aciliyet bandı tüm büyük harfle yazılmalı.', severity: 'info' },
    ],
    warn_title: [
        { rule: 'Kayıp odaklı yazın — kazanç değil. (Örn: "kaybolacak")', severity: 'info' },
    ],
    confirm_btn: [
        { rule: 'CTA bir eylem fiili ile başlamalı (Onayla, Rezerve et).', severity: 'info' },
    ],
    savings_label: [
        { rule: 'Tutar + para birimi formatı tutarlı kullanın (₺30.000).', severity: 'info' },
    ],
};

export function getBrandHints(fieldId: EditorFieldId, value: string): BrandHint[] {
    const hints = BRAND_HINTS[fieldId] ?? [];
    if (fieldId === 'product_name' && value && !/Cafepaste Pro/.test(value)) {
        return hints;
    }
    if (fieldId === 'countdown_label' && value && value !== value.toUpperCase()) {
        return hints;
    }
    return [];
}
