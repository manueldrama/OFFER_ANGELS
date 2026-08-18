import { supabase } from '../../lib/supabase/client';

export interface AppSettings {
    timezone: string;
    date_format: string;
    time_format: string;
    language: string;
    /** Yasal sayfa linklerinin (mesafeli satış, ön bilgilendirme, iade, teslimat)
     *  sitenin footer'ında gösterilip gösterilmeyeceği. 'true' | 'false' — metin
     *  olarak saklanır, app_settings.value TEXT olduğu için (support_chat_enabled
     *  ile aynı desen).
     *
     *  Varsayılan 'true' ve okuma hatasında da 'true' kalır: bu linkler ödeme
     *  kuruluşu site onayının ve tüketici mevzuatının gereği, bir ağ hatası
     *  yüzünden kaybolmamalı. */
    legal_footer_links_enabled: string;
}

const SETTINGS_KEYS: (keyof AppSettings)[] = [
    'timezone', 'date_format', 'time_format', 'language', 'legal_footer_links_enabled',
];

const DEFAULTS: AppSettings = {
    timezone: 'Europe/Istanbul',
    date_format: 'dd.MM.yyyy',
    time_format: '24h',
    language: 'tr',
    legal_footer_links_enabled: 'true',
};

let cached: AppSettings | null = null;

export const AppSettingsService = {
    async get(): Promise<AppSettings> {
        if (cached) return cached;
        const { data, error } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', SETTINGS_KEYS);

        if (error || !data || data.length === 0) return { ...DEFAULTS };

        const result: AppSettings = { ...DEFAULTS };
        for (const row of data) {
            if (SETTINGS_KEYS.includes(row.key as keyof AppSettings)) {
                (result as any)[row.key] = row.value;
            }
        }
        cached = result;
        return cached;
    },

    async update(updates: Partial<AppSettings>): Promise<AppSettings> {
        const entries = Object.entries(updates).filter(
            ([k]) => SETTINGS_KEYS.includes(k as keyof AppSettings)
        );

        for (const [key, value] of entries) {
            const { error } = await supabase
                .from('app_settings')
                .upsert(
                    { key, value, updated_at: new Date().toISOString() },
                    { onConflict: 'key' }
                );
            if (error) throw error;
        }

        cached = null;
        return this.get();
    },

    clearCache() {
        cached = null;
    },
};
