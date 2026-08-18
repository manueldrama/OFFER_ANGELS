import { supabase } from '../../lib/supabase/client';

// Template parametre eşleştirmesi: pozisyon (Meta'daki {{1}}, {{2}} sırası)
// + variable_key (cron resolver'da çağrı zamanı doldurulacak değer adı).
export interface TemplateParam {
    position: number;
    variable: string;  // 'customer_name' | 'phone_number' | 'offer_number' | 'offer_total' | 'days_left' | 'offer_url'
}

// Per-country template adı eşleştirmesi: { TR: 'foo_tr', DE: 'foo_de' }
export type TemplateNameOverrides = Record<string, string>;

// Süre bazlı hatırlatma penceresi (offer_links.valid_until'a göre relatif)
export interface ExpiryReminder {
    id: string;                                  // stabil uuid; sadece "Add"de üretilir
    label: string;                               // admin'in verdiği etiket ("1 gün öncesi" vb.)
    timing_type: 'before' | 'after';             // süre dolmadan önce mi, sonra mı
    hours_offset: number;                        // pozitif saat sayısı (24 = 24 saat)
    template_name: string;                       // Meta'da onaylı template adı
    template_language: string;                   // 'tr' | 'en' | 'de' ...
    template_params: TemplateParam[];            // {{1}}, {{2}} eşleşmesi
    template_name_overrides: TemplateNameOverrides;  // per-country override
    enabled: boolean;                            // tek pencere kapatılabilir
    position: number;                            // UI sıralama
}

export interface AutomationSettings {
    id: string;
    is_global_enabled: boolean;
    rule_offer_created_whatsapp_enabled: boolean;
    offer_template_header_image_url: string | null;
    offer_template_name: string;
    offer_template_language: string;
    offer_template_has_header_image: boolean;
    offer_template_has_url_button: boolean;
    offer_template_body_has_link: boolean;
    // Final teklif mesajında seçilen model adını {{2}} olarak göster (template'te değişken olmalı)
    offer_template_body_has_model: boolean;
    // Final teklif gönderildikten HEMEN SONRA gönderilen "Önemli Hatırlatma" (offer_limited)
    // şablonu. {{1}} = kampanya estimated_delivery. Sadece final gönderimde.
    offer_limited_enabled: boolean;
    offer_limited_template_name: string;
    offer_limited_template_language: string;
    // İlk model-seçim linki (müşteri henüz model seçmemiş) için AYRI şablon config'i.
    // offer_select_template_name boşsa kod offer_template_* davranışına fallback yapar.
    offer_select_template_name: string;
    offer_select_template_language: string;
    offer_select_template_header_image_url: string | null;
    offer_select_template_has_header_image: boolean;
    offer_select_template_has_url_button: boolean;
    offer_select_template_body_has_link: boolean;
    // Click-to-WhatsApp reklamından gelen müşteriye otomatik teklif linki (ayrı şablon)
    rule_ctwa_offer_link_enabled: boolean;
    ctwa_offer_template_name: string;
    ctwa_offer_template_language: string;
    ctwa_offer_template_header_image_url: string | null;
    ctwa_offer_template_has_header_image: boolean;
    ctwa_offer_template_has_url_button: boolean;
    ctwa_offer_template_body_has_link: boolean;
    rule_no_open_enabled: boolean;
    rule_no_open_delay_hours: number;
    // Yeni: 4 gecikmeli senaryo için template config + per-country overrides
    rule_no_open_template_name: string;
    rule_no_open_template_language: string;
    rule_no_open_template_params: TemplateParam[];
    rule_no_open_template_overrides: TemplateNameOverrides;
    rule_no_offer_enabled: boolean;
    rule_no_offer_delay_hours: number;
    rule_no_offer_template_name: string;
    rule_no_offer_template_language: string;
    rule_no_offer_template_params: TemplateParam[];
    rule_no_offer_template_overrides: TemplateNameOverrides;
    rule_no_payment_enabled: boolean;
    rule_no_payment_delay_hours: number;
    rule_no_payment_template_name: string;
    rule_no_payment_template_language: string;
    rule_no_payment_template_params: TemplateParam[];
    rule_no_payment_template_overrides: TemplateNameOverrides;
    rule_payment_abandoned_enabled: boolean;
    rule_payment_abandoned_delay_hours: number;
    rule_payment_abandoned_template_name: string;
    rule_payment_abandoned_template_language: string;
    rule_payment_abandoned_template_params: TemplateParam[];
    rule_payment_abandoned_template_overrides: TemplateNameOverrides;
    // "Sessiz Müşteri" senaryosu: WhatsApp'a hiç cevap yazmayanlara kişisel hitaplı takip
    rule_no_reply_enabled: boolean;
    rule_no_reply_delay_hours: number;
    rule_no_reply_template_name: string;                                 // cinsiyet biliniyorsa
    rule_no_reply_template_name_neutral: string;                         // cinsiyet bilinmiyorsa fallback
    rule_no_reply_template_language: string;
    rule_no_reply_template_params: TemplateParam[];                      // default: [first_name, salutation, offer_number]
    rule_no_reply_template_params_neutral: TemplateParam[];              // default: [offer_number] — neutral'da first_name yok
    rule_no_reply_template_overrides: TemplateNameOverrides;
    rule_no_reply_template_overrides_neutral: TemplateNameOverrides;
    rule_offer_created_template_overrides: TemplateNameOverrides;
    // Süre bazlı hatırlatmalar (offer_links.valid_until'a göre)
    expiry_reminders_enabled: boolean;
    expiry_reminders: ExpiryReminder[];
    working_hours_enabled: boolean;
    working_hours_start: string;
    working_hours_end: string;
    timezone: string;
    max_retries: number;
    retry_delay_minutes: number;
    updated_at: string;
}

// Variable kataloğu — admin UI'da dropdown'da gözükür, cron resolver çağrı zamanı doldurur.
export const TEMPLATE_VARIABLES: Array<{ value: string; label: string; example: string }> = [
    { value: 'customer_name', label: 'Müşteri Adı', example: 'Ahmet Yılmaz' },
    { value: 'customer_salutation', label: 'Müşteri Adı + Bey/Hanım', example: 'Ahmet Bey' },
    { value: 'first_name', label: 'Müşteri İlk Adı', example: 'Ahmet' },
    { value: 'salutation', label: 'Bey / Hanım', example: 'Bey' },
    { value: 'phone_number', label: 'Telefon', example: '+905551234567' },
    { value: 'offer_number', label: 'Sipariş Kodu', example: 'CFP-2605-5201-335' },
    { value: 'offer_total', label: 'Teklif Tutarı', example: '₺228.000' },
    { value: 'days_left', label: 'Kalan Gün', example: '4' },
    { value: 'offer_url', label: 'Teklif Linki', example: 'https://cafepaste.com/offer/XYZ' },
];

export const AdminAutomationSettingsService = {
    // 1) Get Settings
    async getSettings(): Promise<AutomationSettings> {
        const { data, error } = await supabase
            .from('automation_settings')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[AdminAutomationSettingsService] Error fetching settings:', error);
            throw error;
        }

        // Return default object if no row exists yet to prevent blank page crashes
        if (!data) {
            return {
                id: 'default',
                is_global_enabled: false,
                rule_offer_created_whatsapp_enabled: false,
                offer_template_header_image_url: null,
                offer_template_name: 'offer_link3',
                offer_template_language: 'tr',
                offer_template_has_header_image: true,
                offer_template_has_url_button: true,
                offer_template_body_has_link: true,
                offer_template_body_has_model: false,
                offer_limited_enabled: false,
                offer_limited_template_name: 'offer_limited',
                offer_limited_template_language: 'tr',
                offer_select_template_name: '',
                offer_select_template_language: 'tr',
                offer_select_template_header_image_url: null,
                offer_select_template_has_header_image: true,
                offer_select_template_has_url_button: true,
                offer_select_template_body_has_link: false,
                rule_ctwa_offer_link_enabled: false,
                ctwa_offer_template_name: '',
                ctwa_offer_template_language: 'tr',
                ctwa_offer_template_header_image_url: null,
                ctwa_offer_template_has_header_image: true,
                ctwa_offer_template_has_url_button: true,
                ctwa_offer_template_body_has_link: false,
                rule_no_open_enabled: false,
                rule_no_open_delay_hours: 24,
                rule_no_open_template_name: 'followup_no_open',
                rule_no_open_template_language: 'tr',
                rule_no_open_template_params: [{ position: 1, variable: 'customer_name' }],
                rule_no_open_template_overrides: {},
                rule_no_offer_enabled: false,
                rule_no_offer_delay_hours: 24,
                rule_no_offer_template_name: 'followup_no_offer',
                rule_no_offer_template_language: 'tr',
                rule_no_offer_template_params: [{ position: 1, variable: 'customer_name' }],
                rule_no_offer_template_overrides: {},
                rule_no_payment_enabled: false,
                rule_no_payment_delay_hours: 24,
                rule_no_payment_template_name: 'followup_no_payment',
                rule_no_payment_template_language: 'tr',
                rule_no_payment_template_params: [{ position: 1, variable: 'customer_name' }],
                rule_no_payment_template_overrides: {},
                rule_payment_abandoned_enabled: false,
                rule_payment_abandoned_delay_hours: 2,
                rule_payment_abandoned_template_name: 'followup_payment_abandoned',
                rule_payment_abandoned_template_language: 'tr',
                rule_payment_abandoned_template_params: [{ position: 1, variable: 'customer_name' }],
                rule_payment_abandoned_template_overrides: {},
                rule_no_reply_enabled: false,
                rule_no_reply_delay_hours: 24,
                rule_no_reply_template_name: 'followup_no_reply',
                rule_no_reply_template_name_neutral: 'followup_no_reply_neutral',
                rule_no_reply_template_language: 'tr',
                rule_no_reply_template_params: [
                    { position: 1, variable: 'first_name' },
                    { position: 2, variable: 'salutation' },
                    { position: 3, variable: 'offer_number' },
                ],
                rule_no_reply_template_params_neutral: [
                    { position: 1, variable: 'offer_number' },
                ],
                rule_no_reply_template_overrides: {},
                rule_no_reply_template_overrides_neutral: {},
                rule_offer_created_template_overrides: {},
                expiry_reminders_enabled: false,
                expiry_reminders: [],
                working_hours_enabled: true,
                working_hours_start: '09:00',
                working_hours_end: '20:00',
                timezone: 'Europe/Istanbul',
                max_retries: 3,
                retry_delay_minutes: 60,
                updated_at: new Date().toISOString()
            } as AutomationSettings;
        }

        return data as AutomationSettings;
    },

    // 2) Update Settings
    async updateSettings(settingsId: string, updates: Partial<AutomationSettings>) {
        if (settingsId === 'default') {
            // First time save, insert instead of update
            const { id, updated_at, ...insertData } = updates as AutomationSettings;
            const { error, data } = await supabase
                .from('automation_settings')
                .insert([insertData])
                .select()
                .single();
            if (error) throw error;
            return data;
        }

        const { error, data } = await supabase
            .from('automation_settings')
            .update(updates)
            .eq('id', settingsId)
            .select()
            .single();

        if (error) {
            console.error('[AdminAutomationSettingsService] Error updating settings:', error);
            throw error;
        }

        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
            await supabase.from('audit_logs').insert({
                user_id: authData.user.id,
                action_type: 'UPDATE',
                entity_type: 'AUTOMATION_SETTINGS',
                entity_id: settingsId,
                new_values: updates
            });
        }

        return data as AutomationSettings;
    }
};
