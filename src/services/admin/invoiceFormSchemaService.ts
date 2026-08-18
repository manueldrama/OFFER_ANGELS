// Per-country invoice form schemas: admin CRUD + public read (used by CustomerOffer).
//
// A "field" describes one input on the invoice form. The customer form maps
// known field.key values directly onto customer_reservations columns; anything
// unknown falls into customer_reservations.invoice_extra JSON.

import { supabase } from '../../lib/supabase/client';

export type InvoiceFieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'number';
export type InvoiceFieldWidth = 'full' | 'half' | 'third';
export type InvoiceFieldValidation = 'tc_kimlik' | 'tax_no_tr' | 'vat_id' | 'email' | 'phone';

export interface InvoiceFormField {
    key: string;
    label: string;
    label_i18n?: string;
    type: InvoiceFieldType;
    required: boolean;
    placeholder?: string;
    validation?: InvoiceFieldValidation | string;
    width?: InvoiceFieldWidth;
    order: number;
    options?: { value: string; label: string }[];
}

export interface CountryInvoiceFormSchema {
    country_code: string;
    individual_fields: InvoiceFormField[];
    corporate_fields: InvoiceFormField[];
    delivery_fields?: InvoiceFormField[] | null;
    updated_at?: string;
}

const cache = new Map<string, CountryInvoiceFormSchema>();
let allLoaded = false;

// Hardcoded fallback used when the DB row is missing OR the request fails
// (RLS misconfig, migration not applied, network error). Mirrors the seed for
// TR and a sensible global default, so the customer form is never empty.
const HARDCODED_FALLBACKS: Record<string, CountryInvoiceFormSchema> = {
    TR: {
        country_code: 'TR',
        individual_fields: [
            { key: 'invoice_name', label: 'Ad Soyad', type: 'text', required: true, placeholder: 'Adınız soyadınız', width: 'full', order: 10 },
            { key: 'invoice_identity_number', label: 'TC Kimlik No', type: 'text', required: true, placeholder: '11 haneli TC kimlik no', validation: 'tc_kimlik', width: 'full', order: 15 },
            { key: 'invoice_email', label: 'E-posta', type: 'email', required: true, placeholder: 'E-posta adresi', width: 'half', order: 20 },
            { key: 'invoice_phone', label: 'Telefon', type: 'tel', required: true, placeholder: '+90...', width: 'half', order: 30 },
            { key: 'invoice_address', label: 'Adres', type: 'textarea', required: true, placeholder: 'Açık adres', width: 'full', order: 40 },
            { key: 'invoice_city', label: 'İl', type: 'text', required: true, placeholder: 'İl', width: 'third', order: 50 },
            { key: 'invoice_district', label: 'İlçe', type: 'text', required: true, placeholder: 'İlçe', width: 'third', order: 55 },
            { key: 'invoice_postal_code', label: 'Posta Kodu', type: 'text', required: false, placeholder: '34000', width: 'third', order: 60 },
        ],
        corporate_fields: [
            { key: 'invoice_name', label: 'Firma Ünvanı', type: 'text', required: true, placeholder: 'Firma ünvanı', width: 'full', order: 10 },
            { key: 'invoice_tax_office', label: 'Vergi Dairesi', type: 'text', required: true, placeholder: 'Vergi dairesi', width: 'half', order: 12 },
            { key: 'invoice_tax_number', label: 'Vergi No', type: 'text', required: true, placeholder: '10 haneli vergi no', validation: 'tax_no_tr', width: 'half', order: 14 },
            { key: 'invoice_email', label: 'E-posta', type: 'email', required: true, width: 'half', order: 20 },
            { key: 'invoice_phone', label: 'Telefon', type: 'tel', required: true, width: 'half', order: 30 },
            { key: 'invoice_address', label: 'Adres', type: 'textarea', required: true, placeholder: 'Açık adres', width: 'full', order: 40 },
            { key: 'invoice_city', label: 'İl', type: 'text', required: true, width: 'third', order: 50 },
            { key: 'invoice_district', label: 'İlçe', type: 'text', required: true, width: 'third', order: 55 },
            { key: 'invoice_postal_code', label: 'Posta Kodu', type: 'text', required: false, placeholder: '34000', width: 'third', order: 60 },
        ],
    },
    '*': {
        country_code: '*',
        individual_fields: [
            { key: 'invoice_name', label: 'Full Name', type: 'text', required: true, width: 'full', order: 10 },
            { key: 'invoice_email', label: 'Email', type: 'email', required: true, width: 'half', order: 20 },
            { key: 'invoice_phone', label: 'Phone', type: 'tel', required: true, width: 'half', order: 30 },
            { key: 'invoice_address', label: 'Address', type: 'textarea', required: true, width: 'full', order: 40 },
            { key: 'invoice_city', label: 'City', type: 'text', required: true, width: 'half', order: 50 },
            { key: 'invoice_postal_code', label: 'Postal Code', type: 'text', required: false, width: 'half', order: 60 },
        ],
        corporate_fields: [
            { key: 'invoice_name', label: 'Company Name', type: 'text', required: true, width: 'full', order: 10 },
            { key: 'invoice_tax_number', label: 'VAT / Tax ID', type: 'text', required: true, validation: 'vat_id', width: 'full', order: 15 },
            { key: 'invoice_email', label: 'Email', type: 'email', required: true, width: 'half', order: 20 },
            { key: 'invoice_phone', label: 'Phone', type: 'tel', required: true, width: 'half', order: 30 },
            { key: 'invoice_address', label: 'Address', type: 'textarea', required: true, width: 'full', order: 40 },
            { key: 'invoice_city', label: 'City', type: 'text', required: true, width: 'half', order: 50 },
            { key: 'invoice_postal_code', label: 'Postal Code', type: 'text', required: false, width: 'half', order: 60 },
        ],
    },
};

function pickHardcoded(countryCode: string | null | undefined): CountryInvoiceFormSchema {
    const code = (countryCode || '').toUpperCase();
    return HARDCODED_FALLBACKS[code] || HARDCODED_FALLBACKS['*'];
}

function sortByOrder(arr: InvoiceFormField[]): InvoiceFormField[] {
    return [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function normalize(row: any): CountryInvoiceFormSchema {
    return {
        country_code: row.country_code,
        individual_fields: sortByOrder(row.individual_fields ?? []),
        corporate_fields: sortByOrder(row.corporate_fields ?? []),
        delivery_fields: row.delivery_fields ?? null,
        updated_at: row.updated_at,
    };
}

export const InvoiceFormSchemaService = {
    /** Admin: list all schemas (including '*' fallback). */
    async listAll(): Promise<CountryInvoiceFormSchema[]> {
        const { data, error } = await supabase
            .from('country_invoice_form_schemas')
            .select('*')
            .order('country_code');
        if (error) throw error;
        const rows = (data ?? []).map(normalize);
        rows.forEach(r => cache.set(r.country_code, r));
        allLoaded = true;
        return rows;
    },

    /**
     * Public: get the schema for a country with multi-level fallback:
     *   1) DB row for the country
     *   2) DB '*' row
     *   3) Hardcoded fallback (so the customer form never breaks even if the
     *      migration hasn't been applied or RLS blocks the read).
     * Always returns a usable schema — never null.
     */
    async getForCountry(countryCode: string | null | undefined): Promise<CountryInvoiceFormSchema> {
        const code = (countryCode || '').toUpperCase();
        if (code && cache.has(code)) return cache.get(code)!;

        const candidates = code ? [code, '*'] : ['*'];
        try {
            const { data, error } = await supabase
                .from('country_invoice_form_schemas')
                .select('*')
                .in('country_code', candidates);
            if (error) throw error;
            (data ?? []).forEach(r => cache.set(r.country_code, normalize(r)));
        } catch (e) {
            console.warn('[InvoiceFormSchema] fetch failed, using hardcoded fallback:', e);
        }
        return cache.get(code) ?? cache.get('*') ?? pickHardcoded(code);
    },

    /** Admin: upsert a schema. */
    async upsert(schema: CountryInvoiceFormSchema): Promise<CountryInvoiceFormSchema> {
        const payload = {
            country_code: schema.country_code.toUpperCase(),
            individual_fields: sortByOrder(schema.individual_fields),
            corporate_fields: sortByOrder(schema.corporate_fields),
            delivery_fields: schema.delivery_fields ?? null,
            updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
            .from('country_invoice_form_schemas')
            .upsert(payload, { onConflict: 'country_code' })
            .select()
            .single();
        if (error) throw error;
        const row = normalize(data);
        cache.set(row.country_code, row);
        return row;
    },

    /** Admin: delete a country-specific schema (cannot delete '*'). */
    async remove(countryCode: string): Promise<void> {
        const code = countryCode.toUpperCase();
        if (code === '*') throw new Error('Cannot delete the global fallback schema.');
        const { error } = await supabase
            .from('country_invoice_form_schemas')
            .delete()
            .eq('country_code', code);
        if (error) throw error;
        cache.delete(code);
    },

    clearCache() {
        cache.clear();
        allLoaded = false;
    },
};
