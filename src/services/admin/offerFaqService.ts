import { supabase } from '../../lib/supabase/client';
import type { OfferFaq } from '../../types';

/**
 * Final teklif altındaki ülke + dil bazlı SSS verisi.
 *
 * Müşteri tarafı çözümleme (listForCustomer):
 *   1. (country_code = X AND language_code = L AND is_published) — ülke override
 *   2. boşsa (country_code IS NULL AND language_code = L) — global varsayılan
 *
 * Admin tarafı (listForAdmin) yayın durumuna bakmaksızın tüm satırları döner.
 *
 * Kısa TTL cache — admin değişiklikleri müşteri sayfasına hızlı ulaşsın
 * (countryPaymentSettingsService.ts deseni).
 */

let cache: OfferFaq[] | null = null;
const CACHE_TTL_MS = 60 * 1000;
let cacheTimestamp = 0;

function clearCache() {
    cache = null;
    cacheTimestamp = 0;
}

async function fetchAllPublished(): Promise<OfferFaq[]> {
    const fresh = cache && Date.now() - cacheTimestamp < CACHE_TTL_MS;
    if (fresh && cache) return cache;
    const { data, error } = await supabase
        .from('offer_faqs')
        .select('*')
        .eq('is_published', true)
        .order('sort_order');
    if (error) {
        console.warn('[OfferFaq] fetch failed (table may not exist yet):', error.message);
        return [];
    }
    cache = (data || []) as OfferFaq[];
    cacheTimestamp = Date.now();
    return cache;
}

function normLang(language?: string | null): string {
    return (language || 'tr').split('-')[0].toLowerCase();
}

export const OfferFaqService = {
    /**
     * Müşteri-facing resolver. country override varsa onu, yoksa global seti döner.
     * Hiç yoksa boş dizi → bileşen kendini gizler.
     */
    async listForCustomer(countryCode?: string | null, language?: string | null): Promise<OfferFaq[]> {
        const lang = normLang(language);
        const upper = countryCode ? countryCode.toUpperCase() : null;
        const all = await fetchAllPublished();
        const byLang = all.filter(f => normLang(f.language_code) === lang);

        if (upper) {
            const override = byLang
                .filter(f => (f.country_code || '').toUpperCase() === upper)
                .sort((a, b) => a.sort_order - b.sort_order);
            if (override.length > 0) return override;
        }
        return byLang
            .filter(f => !f.country_code)
            .sort((a, b) => a.sort_order - b.sort_order);
    },

    /** Admin liste — seçili ülke (null = global) + dil için, yayın durumu dahil. */
    async listForAdmin(countryCode: string | null, language: string): Promise<OfferFaq[]> {
        const lang = normLang(language);
        let query = supabase
            .from('offer_faqs')
            .select('*')
            .eq('language_code', lang)
            .order('sort_order');
        query = countryCode
            ? query.eq('country_code', countryCode.toUpperCase())
            : query.is('country_code', null);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as OfferFaq[];
    },

    async create(faq: Omit<OfferFaq, 'id' | 'created_at' | 'updated_at'>): Promise<OfferFaq> {
        const payload = {
            ...faq,
            country_code: faq.country_code ? faq.country_code.toUpperCase() : null,
            language_code: normLang(faq.language_code),
        };
        const { data, error } = await supabase
            .from('offer_faqs')
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        clearCache();
        return data as OfferFaq;
    },

    async update(id: string, updates: Partial<OfferFaq>): Promise<void> {
        const patch: Partial<OfferFaq> = { ...updates, updated_at: new Date().toISOString() };
        if (patch.country_code) patch.country_code = patch.country_code.toUpperCase();
        if (patch.language_code) patch.language_code = normLang(patch.language_code);
        const { error } = await supabase
            .from('offer_faqs')
            .update(patch)
            .eq('id', id);
        if (error) throw error;
        clearCache();
    },

    async remove(id: string): Promise<void> {
        const { error } = await supabase
            .from('offer_faqs')
            .delete()
            .eq('id', id);
        if (error) throw error;
        clearCache();
    },

    clearCache,
};
