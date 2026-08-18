// Validators for country-specific invoice form fields.
// Schema field.validation references a key here (e.g. "tc_kimlik").

export type InvoiceFieldValidator = (value: string) => string | null;

// TC Kimlik No — Mernis algorithm.
//   - 11 digits, first digit cannot be 0
//   - digit 10 = ((d1+d3+d5+d7+d9) * 7 - (d2+d4+d6+d8)) mod 10
//   - digit 11 = (sum of first 10 digits) mod 10
export function validateTcKimlik(value: string): string | null {
    const v = (value ?? '').trim();
    if (!/^\d{11}$/.test(v)) return 'TC Kimlik No 11 haneli olmalıdır.';
    if (v[0] === '0') return 'TC Kimlik No 0 ile başlayamaz.';
    const d = v.split('').map(Number);
    const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
    const evenSum = d[1] + d[3] + d[5] + d[7];
    const d10 = (oddSum * 7 - evenSum) % 10;
    if (((d10 + 10) % 10) !== d[9]) return 'Geçersiz TC Kimlik No.';
    const sum10 = d.slice(0, 10).reduce((a, b) => a + b, 0);
    if ((sum10 % 10) !== d[10]) return 'Geçersiz TC Kimlik No.';
    return null;
}

// Turkish corporate tax number — 10 digits, official checksum.
export function validateTaxNoTr(value: string): string | null {
    const v = (value ?? '').trim();
    if (!/^\d{10}$/.test(v)) return 'Vergi No 10 haneli olmalıdır.';
    return null;
}

// Generic VAT ID — relaxed: 2-letter country prefix optional, alphanumeric, 8-14 chars.
export function validateVatId(value: string): string | null {
    const v = (value ?? '').trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9]{8,15}$/.test(v)) return 'Invalid VAT ID format.';
    return null;
}

export function validateEmail(value: string): string | null {
    const v = (value ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Invalid email.';
    return null;
}

export function validatePhone(value: string): string | null {
    const v = (value ?? '').trim();
    if (!/^[+\d\s().-]{7,}$/.test(v)) return 'Invalid phone.';
    return null;
}

export const INVOICE_VALIDATORS: Record<string, InvoiceFieldValidator> = {
    tc_kimlik: validateTcKimlik,
    tax_no_tr: validateTaxNoTr,
    vat_id: validateVatId,
    email: validateEmail,
    phone: validatePhone,
};

export function runFieldValidator(name: string | undefined, value: string): string | null {
    if (!name) return null;
    const fn = INVOICE_VALIDATORS[name];
    return fn ? fn(value) : null;
}
