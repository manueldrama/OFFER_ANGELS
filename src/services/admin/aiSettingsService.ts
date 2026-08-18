import { supabase } from '../../lib/supabase/client';

export interface AiPersona {
    company_name: string;
    products: string;
    rules: string;
    faq: string;
    objections?: string;
    competitors?: string;
    pricing_guide?: string;
    success_stories?: string;
    escalation_rules?: string;
}

export interface WorkingHoursDay {
    active: boolean;
    start: string;
    end: string;
}

export interface WorkingHours {
    enabled: boolean;
    timezone: string;
    schedule: {
        mon: WorkingHoursDay;
        tue: WorkingHoursDay;
        wed: WorkingHoursDay;
        thu: WorkingHoursDay;
        fri: WorkingHoursDay;
        sat: WorkingHoursDay;
        sun: WorkingHoursDay;
    };
}

export interface AiSettings {
    id: number;
    scoring_enabled: boolean;
    summary_enabled: boolean;
    suggestions_enabled: boolean;
    insights_enabled: boolean;
    auto_reply_enabled: boolean;
    default_tone: string;
    max_tokens: number;
    scoring_weights: Record<string, number>;
    ai_persona: AiPersona;
    working_hours: WorkingHours;
}

export const adminAiSettingsService = {
    async getSettings(): Promise<AiSettings> {
        const { data, error } = await supabase.from('ai_settings').select('*').single();
        if (error) {
            console.error('[AI Settings]', error);
            throw error;
        }
        return data as AiSettings;
    },

    async updateSettings(updates: Partial<AiSettings>): Promise<AiSettings> {
        const { data, error } = await supabase
            .from('ai_settings')
            .update(updates)
            .eq('id', 1)
            .select()
            .single();

        if (error) {
            console.error('[AI Settings Update]', error);
            throw error;
        }

        // Ensure audit log triggers via the existing AdminAuditService if needed
        return data as AiSettings;
    }
};
