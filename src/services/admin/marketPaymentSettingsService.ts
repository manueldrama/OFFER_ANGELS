import { supabase } from '../../lib/supabase/client';
import type { MarketPaymentSettings, PaymentOption } from '../../types';
import {
    DEFAULT_PAYMENT_OPTIONS,
    DEFAULT_PAYMENT_OPTIONS_EN,
    DEFAULT_PAYMENT_OPTIONS_DE,
    DEFAULT_PAYMENT_OPTIONS_FR,
    DEFAULT_PAYMENT_OPTIONS_ES,
} from '../offerContext';

// In-memory cache so the customer flow doesn't re-query for every render.
let cache: Map<string, MarketPaymentSettings> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;
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

async function fetchAll(): Promise<MarketPaymentSettings[]> {
    const { data, error } = await supabase
        .from('market_payment_settings')
        .select('*')
        .eq('is_active', true);
    if (error) {
        console.warn('[MarketPaymentSettings] fetch failed (table may not exist yet):', error.message);
        return [];
    }
    return (data || []) as MarketPaymentSettings[];
}

async function ensureCache(): Promise<Map<string, MarketPaymentSettings>> {
    const fresh = cache && (Date.now() - cacheTimestamp) < CACHE_TTL_MS;
    if (fresh && cache) return cache;
    const rows = await fetchAll();
    cache = new Map(rows.map(r => [r.market_code, r]));
    cacheTimestamp = Date.now();
    return cache;
}

function clearCache() {
    cache = null;
    cacheTimestamp = 0;
}

export const MarketPaymentSettingsService = {
    /** Get all market payment settings (admin list). */
    async getAll(forceRefresh = false): Promise<MarketPaymentSettings[]> {
        if (forceRefresh) clearCache();
        const map = await ensureCache();
        return Array.from(map.values());
    },

    /** Get one market's settings by code. Returns null if no row exists. */
    async getByMarket(marketCode: string): Promise<MarketPaymentSettings | null> {
        const map = await ensureCache();
        return map.get(marketCode) || null;
    },

    /**
     * Customer-facing resolver. Always returns a usable MarketPaymentSettings:
     *   1. DB row for marketCode (if present)
     *   2. Synthesised fallback using language-localised defaults
     *
     * Use this on the customer side; admin code should call getByMarket and treat null as "not yet configured".
     */
    async getEffective(marketCode: string, language?: string): Promise<MarketPaymentSettings> {
        const row = await this.getByMarket(marketCode);
        if (row && row.payment_options && row.payment_options.length > 0) {
            return row;
        }
        // Fall back to language-localised defaults so the customer screen never breaks.
        const fallbackOptions = localizedDefaults(language);
        const now = new Date().toISOString();
        return {
            id: `default-${marketCode}`,
            market_code: marketCode,
            gateway: marketCode === 'TR' ? 'paytr' : 'stripe',
            payment_options: fallbackOptions,
            credit_card: { enabled: true },
            bank_transfer: { enabled: marketCode === 'TR', discount_percent: 5 },
            pre_payment: { enabled: marketCode === 'TR', deposit_percent: 20, price_lock_days: 14 },
            installment_3: { enabled: marketCode === 'TR', interest_rate: 9.25 },
            installment_6: { enabled: marketCode === 'TR', interest_rate: 16.37 },
            is_active: true,
            created_at: now,
            updated_at: now,
        };
    },

    /** Insert or update a market's settings. Used by admin PaymentSettings page. */
    async upsert(settings: Partial<MarketPaymentSettings> & { market_code: string }): Promise<MarketPaymentSettings | null> {
        const payload = {
            ...settings,
            updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
            .from('market_payment_settings')
            .upsert(payload, { onConflict: 'market_code' })
            .select()
            .single();
        if (error) {
            console.error('[MarketPaymentSettings] upsert failed:', error);
            return null;
        }
        clearCache();
        return data as MarketPaymentSettings;
    },

    clearCache,
};
