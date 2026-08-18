import { supabase } from '../../lib/supabase/client';
import type { TemplateParam, TemplateNameOverrides } from './automationSettingsService';

// Tüm desteklenen tetikleyici event tipleri
export type TriggerEvent =
    | 'link_opened'
    | 'product_selected'
    | 'payment_started'
    | 'payment_completed'
    | 'offer_created'
    | 'reservation_created'
    | 'reservation_paid'
    | 'reservation_shipped'
    | 'reservation_delivered'
    | 'reservation_cancelled'
    | 'support_request_created'
    | 'offer_expired';

// Admin'in eklediği özel otomasyon kuralı.
export interface AutomationRule {
    id: string;
    name: string;
    description: string | null;
    is_enabled: boolean;

    trigger_event: TriggerEvent;
    trigger_negate: boolean;  // true: event YOKSA fire, false: event VARSA fire
    delay_hours: number;

    template_name: string;
    template_language: string;
    template_params: TemplateParam[];
    template_name_overrides?: TemplateNameOverrides;  // YENİ: per-country template adı

    has_header_image?: boolean;
    header_image_url?: string | null;
    has_url_button?: boolean;
    url_button_path?: string | null;

    audience_filter?: Record<string, any> | null;

    created_at: string;
    updated_at: string;
}

export type AutomationRuleDraft = Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'>;

export const AdminAutomationRulesService = {
    async list(): Promise<AutomationRule[]> {
        const { data, error } = await supabase
            .from('automation_rules')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as AutomationRule[];
    },

    async create(rule: AutomationRuleDraft): Promise<AutomationRule> {
        const { data, error } = await supabase
            .from('automation_rules')
            .insert(rule)
            .select()
            .single();
        if (error) throw error;
        return data as AutomationRule;
    },

    async update(id: string, updates: Partial<AutomationRuleDraft>): Promise<AutomationRule> {
        const { data, error } = await supabase
            .from('automation_rules')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as AutomationRule;
    },

    async toggle(id: string, isEnabled: boolean): Promise<void> {
        const { error } = await supabase
            .from('automation_rules')
            .update({ is_enabled: isEnabled })
            .eq('id', id);
        if (error) throw error;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('automation_rules')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
};

// Tetikleyici event seçenekleri (UI dropdown)
// Her event sistemde gerçekten lead_events'e yazılan/sorgulanan bir eylemdir.
export const TRIGGER_EVENT_OPTIONS: Array<{ value: TriggerEvent; label: string; defaultNegate: boolean; group: string }> = [
    // Funnel (müşteri akışı)
    { value: 'link_opened',        label: 'Link açıldı',              defaultNegate: true,  group: 'Müşteri Akışı' },
    { value: 'product_selected',   label: 'Ürün seçildi',             defaultNegate: true,  group: 'Müşteri Akışı' },
    { value: 'offer_created',      label: 'Teklif oluşturuldu',       defaultNegate: false, group: 'Müşteri Akışı' },
    { value: 'payment_started',    label: 'Ödeme başlatıldı',         defaultNegate: false, group: 'Müşteri Akışı' },
    { value: 'payment_completed',  label: 'Ödeme tamamlandı',         defaultNegate: false, group: 'Müşteri Akışı' },
    // Rezervasyon yaşam döngüsü
    { value: 'reservation_created',   label: 'Rezervasyon oluştu (kapora)', defaultNegate: false, group: 'Sipariş' },
    { value: 'reservation_paid',      label: 'Tam ödeme tamamlandı',         defaultNegate: false, group: 'Sipariş' },
    { value: 'reservation_shipped',   label: 'Kargoya verildi',              defaultNegate: false, group: 'Sipariş' },
    { value: 'reservation_delivered', label: 'Teslim edildi',                defaultNegate: false, group: 'Sipariş' },
    { value: 'reservation_cancelled', label: 'Sipariş iptal edildi',         defaultNegate: false, group: 'Sipariş' },
    // Destek
    { value: 'support_request_created', label: 'Destek talebi açıldı',       defaultNegate: false, group: 'Destek' },
    // Zaman-bazlı
    { value: 'offer_expired',          label: 'Teklif süresi doldu',         defaultNegate: false, group: 'Zaman' },
];
