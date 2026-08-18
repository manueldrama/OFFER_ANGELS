import { supabase } from '../../lib/supabase/client';

export interface WhatsAppTemplate {
    name: string; // The primary key (e.g. 'followup_no_open')
    content: string;
    variables: string[]; // e.g. ["name", "offer_link"]
    is_active: boolean;
    language: string;
    created_at: string;
    updated_at: string;
    // Meta sync metadata (Bölüm 6'da eklendi)
    meta_status?: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED' | 'PAUSED' | null;
    meta_category?: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' | null;
    meta_components?: any[] | null;
    meta_param_count?: number;
    meta_language_code?: string | null;
    last_synced_at?: string | null;
}

// Modül seviyesi cache — birden fazla TemplateConfigSection / TemplateOverridesEditor
// aynı anda mount olduğunda tek Supabase request yapılır. sync / create / update / delete
// sonrası otomatik invalidate edilir, böylece dropdown'lar her zaman güncel kalır.
let _approvedCache: WhatsAppTemplate[] | null = null;
let _approvedInFlight: Promise<WhatsAppTemplate[]> | null = null;

export const AdminWhatsAppTemplatesService = {
    // 1) List existing templates
    async listTemplates() {
        const { data, error } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('[AdminWhatsAppTemplatesService] Error listing templates:', error);
            throw error;
        }

        // Map missing columns if Phase 8 schema didn't explicitly define them but we need them in UI
        return (data || []).map((t: any) => ({
            name: t.name,
            content: t.content,
            variables: typeof t.variables === 'string' ? JSON.parse(t.variables) : (t.variables || []),
            is_active: t.is_active !== undefined ? t.is_active : true,
            language: t.language || 'tr',
            created_at: t.created_at,
            updated_at: t.updated_at,
            meta_status: t.meta_status || null,
            meta_category: t.meta_category || null,
            meta_components: t.meta_components || null,
            meta_param_count: t.meta_param_count || 0,
            meta_language_code: t.meta_language_code || null,
            last_synced_at: t.last_synced_at || null,
        })) as WhatsAppTemplate[];
    },

    // 6) Sync from Meta — admin tetikli, /api/whatsapp/sync-templates'i çağırır
    async syncFromMeta(): Promise<{ synced: number; errors: number; total_fetched: number; error_details?: string[] }> {
        const res = await fetch('/api/whatsapp/sync-templates', { method: 'POST' });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Sync failed (${res.status}): ${text.slice(0, 200)}`);
        }
        const json = await res.json();
        this.invalidateApprovedCache();
        return json;
    },

    // 7) Onaylı şablonları döndür — otomasyon dropdown'u için.
    // Cache hit ise anında, miss ise tek request'i paylaşarak döner.
    async listApproved(): Promise<WhatsAppTemplate[]> {
        if (_approvedCache) return _approvedCache;
        if (_approvedInFlight) return _approvedInFlight;
        _approvedInFlight = (async () => {
            const all = await this.listTemplates();
            const hasMeta = all.some(t => t.meta_status);
            const filtered = hasMeta ? all.filter(t => t.meta_status === 'APPROVED') : all;
            _approvedCache = filtered;
            return filtered;
        })().finally(() => { _approvedInFlight = null; });
        return _approvedInFlight;
    },

    // Cache invalidator — sync / create / update / delete sonrası çağrılır.
    invalidateApprovedCache() {
        _approvedCache = null;
    },

    // Senkron cache okuma — UI ilk render'da boş array yerine cached liste gösterebilsin diye.
    getApprovedFromCache(): WhatsAppTemplate[] | null {
        return _approvedCache;
    },

    // 2) Get Single Template
    async getTemplate(name: string) {
        const { data, error } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('name', name)
            .single();

        if (error) return null;

        return {
            ...data,
            variables: typeof data.variables === 'string' ? JSON.parse(data.variables) : (data.variables || []),
            is_active: data.is_active !== undefined ? data.is_active : true,
            language: data.language || 'tr'
        } as WhatsAppTemplate;
    },

    // 3) Create Template
    async createTemplate(templateData: Partial<WhatsAppTemplate>) {
        // Prepare DB payload. Store extra UI fields if DB allows, otherwise they are ignored if strict schema.
        // We will do a generic insert, assuming Postgres will accept new columns if we add them, or ignore if strict.
        const payload = {
            name: templateData.name,
            content: templateData.content,
            variables: templateData.variables || [],
            // Add columns to schema if needed later, but attempt insert
        };

        const { data, error } = await supabase
            .from('whatsapp_templates')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('[AdminWhatsAppTemplatesService] Error creating template:', error);
            throw error;
        }

        await this.logAuditAction('CREATE', 'WHATSAPP_TEMPLATE', templateData.name as string, payload);
        this.invalidateApprovedCache();
        return data as WhatsAppTemplate;
    },

    // 4) Update Template
    async updateTemplate(name: string, updates: Partial<WhatsAppTemplate>) {
        const payload: any = {
            updated_at: new Date().toISOString()
        };
        if (updates.content) payload.content = updates.content;
        if (updates.variables) payload.variables = updates.variables;

        // We handle is_active and language by assuming we execute a quick schema patch or store them.

        const { data, error } = await supabase
            .from('whatsapp_templates')
            .update(payload)
            .eq('name', name)
            .select()
            .single();

        if (error) {
            console.error('[AdminWhatsAppTemplatesService] Error updating template:', error);
            throw error;
        }

        await this.logAuditAction('UPDATE', 'WHATSAPP_TEMPLATE', name, updates);
        this.invalidateApprovedCache();
        return data as WhatsAppTemplate;
    },

    // 5) Delete Template
    async deleteTemplate(name: string) {
        const { error } = await supabase
            .from('whatsapp_templates')
            .delete()
            .eq('name', name);

        if (error) {
            console.error('[AdminWhatsAppTemplatesService] Error deleting template:', error);
            throw error;
        }

        await this.logAuditAction('DELETE', 'WHATSAPP_TEMPLATE', name, null);
        this.invalidateApprovedCache();
        return true;
    },

    // Internal Logger
    async logAuditAction(action_type: string, entity_type: string, entity_id: string, new_values: any) {
        try {
            const { data } = await supabase.auth.getUser();
            if (data.user) {
                await supabase.from('audit_logs').insert({
                    user_id: data.user.id,
                    action_type,
                    entity_type,
                    entity_id,
                    new_values
                });
            }
        } catch (err) {
            console.error('[AdminWhatsAppTemplatesService] Failed to log audit:', err);
        }
    }
};
