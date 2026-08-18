import { supabase } from '../lib/supabase/client';

export interface OfferImageSettings {
    id: string;
    country_code: string;
    company_logo_text: string;
    company_slogan: string;
    bank_info: {
        bankName: string;
        accountHolder: string;
        iban: string;
        description: string;
    };
    bottom_checklist: string[];
    footer_contact: string;
    footer_disclaimer: string;
    brand_color: string;
    marketing_title?: string;
    marketing_desc?: string;
    marketing_features?: {title: string, desc: string}[];
    labels?: Record<string, string>;
    hero_image?: string;
}

export const offerImageSettingsService = {
    async getSettings(countryCode: string = 'TR'): Promise<OfferImageSettings | null> {
        const { data, error } = await supabase
            .from('offer_image_settings')
            .select('*')
            .eq('country_code', countryCode.toUpperCase())
            .maybeSingle();

        if (error) {
            console.error(`Error fetching offer image settings for ${countryCode}:`, error);
            return null;
        }

        return data as OfferImageSettings | null;
    },

    async saveSettings(countryCode: string, settings: Partial<OfferImageSettings>): Promise<OfferImageSettings | null> {
        const upperCode = countryCode.toUpperCase();
        
        // Destructure to remove id and created_at so we don't accidentally try to modify primary keys or immutable fields during upsert
        const { id, created_at, updated_at, ...cleanSettings } = settings as any;

        const payload = {
            ...cleanSettings,
            country_code: upperCode,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('offer_image_settings')
            .upsert(payload, { onConflict: 'country_code' })
            .select()
            .single();

        if (error) {
            console.error('Error saving offer image settings:', error);
            throw error;
        }
        
        return data as OfferImageSettings;
    }
};
