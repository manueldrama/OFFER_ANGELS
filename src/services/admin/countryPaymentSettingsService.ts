import { supabase } from '../../lib/supabase/client';
import type { CountryPaymentSettings, PaymentOption } from '../../types';
import { getCountryByCode, getCurrencyForCountry } from '../../utils/countries';
import {
    DEFAULT_PAYMENT_OPTIONS,
    DEFAULT_PAYMENT_OPTIONS_EN,
    DEFAULT_PAYMENT_OPTIONS_DE,
    DEFAULT_PAYMENT_OPTIONS_FR,
    DEFAULT_PAYMENT_OPTIONS_ES,
} from '../offerContext';

let cache: Map<string, CountryPaymentSettings> | null = null;
// Short TTL — admin changes (toggle/sort_order/credentials) need to reach
// customer pages quickly. 60s is a good balance between DB load and freshness.
const CACHE_TTL_MS = 60 * 1000;
let cacheTimestamp = 0;

function localizedDefaults(language?: string): PaymentOption[] {
    const code = (language || 'tr').split('-')[0];
    switch (code) {
        case 'en': return DEFAULT_PAYMENT_OPTIONS_EN as PaymentOption[];
        case 'de': return DEFAULT_PAYMENT_OPTIONS_DE as PaymentOption[];
        case 'fr': return DEFAULT_PAYMENT_OPTIONS_FR as PaymentOption[];
        case 'es': return DEFAULT_PAYMENT_OPTIONS_ES as PaymentOption[];
        default:   return DEFAULT_PAYMENT_OPTIONS as PaymentOption[];
    }
}

async function fetchAll(): Promise<CountryPaymentSettings[]> {
    const { data, error } = await supabase
        .from('country_payment_settings')
        .select('*')
        .eq('is_active', true);
    if (error) {
        console.warn('[CountryPaymentSettings] fetch failed (table may not exist yet):', error.message);
        return [];
    }
    return (data || []) as CountryPaymentSettings[];
}

async function ensureCache(): Promise<Map<string, CountryPaymentSettings>> {
    const fresh = cache && (Date.now() - cacheTimestamp) < CACHE_TTL_MS;
    if (fresh && cache) return cache;
    const rows = await fetchAll();
    cache = new Map(rows.map(r => [r.country_code, r]));
    cacheTimestamp = Date.now();
    return cache;
}

function clearCache() {
    cache = null;
    cacheTimestamp = 0;
}

export const CountryPaymentSettingsService = {
    /** Get all configured countries (admin list). */
    async getAll(forceRefresh = false): Promise<CountryPaymentSettings[]> {
        if (forceRefresh) clearCache();
        const map = await ensureCache();
        return Array.from(map.values());
    },

    /** Get one country's settings by ISO code. Returns null if no row exists. */
    async getByCountry(countryCode: string): Promise<CountryPaymentSettings | null> {
        const map = await ensureCache();
        return map.get(countryCode.toUpperCase()) || null;
    },

    /**
     * Customer-facing resolver. Always returns a usable CountryPaymentSettings:
     *   1. DB row for countryCode (if present) — per-method enabled flags are AUTHORITATIVE
     *   2. Synthesised fallback (only if no row at all) — localized defaults + countries.ts metadata
     *
     * NOTE: payment_options[] is deprecated. The source-of-truth for enable/disable is
     * the per-method JSONB columns (credit_card, bank_transfer, pre_payment, installment_3/6/12).
     * Previously this resolver required `row.payment_options.length > 0` to trust the row,
     * which caused admin toggles to be ignored — when upsert wrote only per-method columns
     * (not payment_options), the synthesized fallback (hardcoded enabled:true) was returned
     * and admin's disabled methods reappeared in the customer UI.
     */
    async getEffective(countryCode: string, language?: string): Promise<CountryPaymentSettings> {
        const upper = countryCode.toUpperCase();
        const row = await this.getByCountry(upper);
        if (row) {
            // Admin has configured this country — trust per-method enabled flags.
            return {
                ...row,
                payment_options: row.payment_options ?? [],
            };
        }
        // No row at all → synthesized fallback for first-time / never-configured country.
        const country = getCountryByCode(upper);
        const fallbackOptions = localizedDefaults(language);
        const now = new Date().toISOString();
        return {
            id: `default-${upper}`,
            country_code: upper,
            gateway: upper === 'TR' ? 'paytr' : 'stripe',
            payment_options: fallbackOptions,
            credit_card: { enabled: true, max_installments: 12, min_installment_amount: 500, sort_order: 1 } as any,
            bank_transfer: { enabled: upper === 'TR', discount_percent: 5, sort_order: 5 } as any,
            pre_payment: { enabled: upper === 'TR', deposit_percent: 20, price_lock_days: 14, sort_order: 0 } as any,
            installment_3: { enabled: upper === 'TR', interest_rate: 9.25, sort_order: 2 } as any,
            installment_6: { enabled: upper === 'TR', interest_rate: 16.37, sort_order: 3 } as any,
            installment_12: { enabled: upper === 'TR', interest_rate: 25, sort_order: 4 } as any,
            vat_rate: country?.vat_rate ?? null,
            min_order_amount: null,
            whatsapp_number: null,
            is_active: true,
            created_at: now,
            updated_at: now,
        };
    },

    /** Upsert one country's settings. */
    async upsert(settings: Partial<CountryPaymentSettings> & { country_code: string }): Promise<CountryPaymentSettings | null> {
        const payload = {
            ...settings,
            country_code: settings.country_code.toUpperCase(),
            updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
            .from('country_payment_settings')
            .upsert(payload, { onConflict: 'country_code' })
            .select()
            .single();
        if (error) {
            // ÖNEMLI: hatayı YUTMA — fırlat. Eskiden null dönüyordu, çağıran (admin
            // handleSave) bunu kontrol etmediği için kayıt başarısız olsa bile sahte
            // "Kaydedildi" gösteriyordu. Sonuç: admin'in kapattığı taksit DB'ye hiç
            // yazılmıyor, müşteri görseli eski satırı okuyordu. Artık gerçek hata görünür.
            console.error('[CountryPaymentSettings] upsert failed:', error);
            throw error;
        }
        clearCache();
        return data as CountryPaymentSettings;
    },

    clearCache,
};
