import { supabase } from '../../lib/supabase/client';

export interface GoogleSheetConnector {
    id: string;
    name: string;
    sheet_url: string;
    tab_name: string;
    header_row: number;
    data_start_row: number;
    poll_interval_seconds: number;
    is_enabled: boolean;
    last_sync_at: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
}

export interface GoogleSheetConfig {
    connector_id: string;
    mapping_json: Record<string, any>;
    rules_json: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface GoogleSheetSyncLog {
    id: string;
    connector_id: string;
    run_at: string;
    rows_scanned: number;
    rows_processed: number;
    leads_upserted: number;
    links_generated: number;
    whatsapp_sent: number;
    failures_json: any[];
    status: 'success' | 'failed' | 'partial';
    error_text: string | null;
    created_at: string;
}

export const GoogleSheetsService = {
    // Connectors
    async listConnectors() {
        const { data, error } = await supabase
            .from('google_sheet_connectors')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as GoogleSheetConnector[];
    },

    async getConnector(id: string) {
        const { data, error } = await supabase
            .from('google_sheet_connectors')
            .select('*, configs:google_sheet_connector_configs(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as (GoogleSheetConnector & { configs: GoogleSheetConfig });
    },

    async createConnector(payload: Partial<GoogleSheetConnector>) {
        const { data, error } = await supabase
            .from('google_sheet_connectors')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        // Initialize empty config
        await supabase.from('google_sheet_connector_configs').insert({
            connector_id: data.id,
            mapping_json: {},
            rules_json: {
                auto_upsert: true,
                auto_offer_link: false,
                auto_whatsapp: false,
                whatsapp_template: 'initial_offer',
                cooldown_hours: 24,
                dedupe_by: 'phone_normalized'
            }
        });

        return data as GoogleSheetConnector;
    },

    async updateConnector(id: string, payload: Partial<GoogleSheetConnector>) {
        const { data, error } = await supabase
            .from('google_sheet_connectors')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as GoogleSheetConnector;
    },

    async deleteConnector(id: string) {
        const { error } = await supabase
            .from('google_sheet_connectors')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Configs
    async updateConfig(connectorId: string, payload: Partial<GoogleSheetConfig>) {
        const { data, error } = await supabase
            .from('google_sheet_connector_configs')
            .update(payload)
            .eq('connector_id', connectorId)
            .select()
            .single();

        if (error) throw error;
        return data as GoogleSheetConfig;
    },

    // Sync Logs
    async listSyncLogs(connectorId: string, limit = 10) {
        const { data, error } = await supabase
            .from('google_sheet_sync_logs')
            .select('*')
            .eq('connector_id', connectorId)
            .order('run_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data as GoogleSheetSyncLog[];
    }
};
