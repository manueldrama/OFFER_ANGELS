import { supabase } from '../lib/supabase/client';

export interface RoiSettings {
    currency_code: string;
    threshold_x: number;
    effect_percent: number;
    /** Müşteri tarafındaki "Ortalama İçecek Fiyatı" slider'ı için min */
    slider_min: number;
    slider_max: number;
    slider_step: number;
    slider_default: number;
}

export interface RoiGlobalSettings {
    is_enabled: boolean;
}

const DEFAULT_SETTINGS_VALUES = {
    threshold_x: 120, // drinks
    effect_percent: 40, // 40%
    slider_min: 1,
    slider_max: 50,
    slider_step: 1,
    slider_default: 5,
};

const DEFAULT_GLOBAL: RoiGlobalSettings = { is_enabled: true };

export const RoiService = {
    /**
     * Belirli bir para biriminin ROI ayarlarını getir.
     * DB'de o currency yoksa TRY satırına düşer; o da yoksa hardcoded default.
     */
    async fetchSettings(currencyCode: string = 'TRY'): Promise<RoiSettings> {
        try {
            const { data, error } = await supabase
                .from('roi_settings')
                .select('currency_code, threshold_x, effect_percent, slider_min, slider_max, slider_step, slider_default')
                .eq('currency_code', currencyCode)
                .maybeSingle();

            if (error) {
                console.warn(`[RoiService] Could not fetch settings for ${currencyCode}, using defaults.`, error);
                return { currency_code: currencyCode, ...DEFAULT_SETTINGS_VALUES };
            }
            if (data) return data;

            // Currency yok → TRY fallback
            if (currencyCode !== 'TRY') {
                const { data: fallback } = await supabase
                    .from('roi_settings')
                    .select('currency_code, threshold_x, effect_percent, slider_min, slider_max, slider_step, slider_default')
                    .eq('currency_code', 'TRY')
                    .maybeSingle();
                if (fallback) return { ...fallback, currency_code: currencyCode };
            }

            return { currency_code: currencyCode, ...DEFAULT_SETTINGS_VALUES };
        } catch (err) {
            console.error('[RoiService] Exception fetching settings:', err);
            return { currency_code: currencyCode, ...DEFAULT_SETTINGS_VALUES };
        }
    },

    /** Tüm currency'lerin ROI ayarlarını listele (admin sayfası için). */
    async fetchAllSettings(): Promise<RoiSettings[]> {
        try {
            const { data, error } = await supabase
                .from('roi_settings')
                .select('currency_code, threshold_x, effect_percent, slider_min, slider_max, slider_step, slider_default')
                .order('currency_code', { ascending: true });

            if (error || !data) return [];
            return data;
        } catch (err) {
            console.error('[RoiService] Exception listing settings:', err);
            return [];
        }
    },

    /** Bir currency'nin ROI ayarlarını upsert et. */
    async upsertSettings(currencyCode: string, patch: Partial<Omit<RoiSettings, 'currency_code'>>): Promise<{ success: boolean; error?: string }> {
        try {
            // Mevcut satır var mı?
            const { data: existing } = await supabase
                .from('roi_settings')
                .select('currency_code')
                .eq('currency_code', currencyCode)
                .maybeSingle();

            if (existing) {
                const { error } = await supabase
                    .from('roi_settings')
                    .update(patch)
                    .eq('currency_code', currencyCode);
                if (error) throw error;
            } else {
                // is_enabled NOT NULL constraint için default true gönderiyoruz —
                // aktiflik artık roi_global_settings'tan okunuyor, bu kolon vestigial.
                const { error } = await supabase
                    .from('roi_settings')
                    .insert({
                        currency_code: currencyCode,
                        threshold_x: patch.threshold_x ?? DEFAULT_SETTINGS_VALUES.threshold_x,
                        effect_percent: patch.effect_percent ?? DEFAULT_SETTINGS_VALUES.effect_percent,
                        slider_min: patch.slider_min ?? DEFAULT_SETTINGS_VALUES.slider_min,
                        slider_max: patch.slider_max ?? DEFAULT_SETTINGS_VALUES.slider_max,
                        slider_step: patch.slider_step ?? DEFAULT_SETTINGS_VALUES.slider_step,
                        slider_default: patch.slider_default ?? DEFAULT_SETTINGS_VALUES.slider_default,
                        is_enabled: true,
                    });
                if (error) throw error;
            }
            return { success: true };
        } catch (err: any) {
            console.error('[RoiService] Error upserting settings:', err);
            return { success: false, error: err.message };
        }
    },

    /** Global ROI toggle (tüm pazarlarda hesaplayıcıyı aç/kapat). */
    async fetchGlobal(): Promise<RoiGlobalSettings> {
        try {
            const { data, error } = await supabase
                .from('roi_global_settings')
                .select('is_enabled')
                .eq('id', 1)
                .maybeSingle();
            if (error || !data) return DEFAULT_GLOBAL;
            return data;
        } catch (err) {
            console.error('[RoiService] Exception fetching global:', err);
            return DEFAULT_GLOBAL;
        }
    },

    async updateGlobal(patch: Partial<RoiGlobalSettings>): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('roi_global_settings')
                .update(patch)
                .eq('id', 1);
            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            console.error('[RoiService] Error updating global:', err);
            return { success: false, error: err.message };
        }
    },

    resolveRecommendedModel(dailyDrinks: number, settings: RoiSettings): { recommendedModel: 'PRO' | 'LITE', threshold_x: number } {
        if (dailyDrinks > settings.threshold_x) {
            return { recommendedModel: 'PRO', threshold_x: settings.threshold_x };
        }
        return { recommendedModel: 'LITE', threshold_x: settings.threshold_x };
    },

    calculateMonthlyRevenueIncrease(dailyDrinks: number, avgPrice: number, settings: RoiSettings): number {
        // formula: D * P * (effect_percent / 100) * 30
        return dailyDrinks * avgPrice * (settings.effect_percent / 100) * 30;
    }
};
