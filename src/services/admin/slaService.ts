import { supabase } from '../../lib/supabase/client';
import { SlaDefinition } from '../../types';

export const SlaService = {
    async listDefinitions() {
        const { data, error } = await supabase
            .from('sla_definitions')
            .select('*')
            .order('request_type')
            .order('priority');
        if (error) throw error;
        return (data || []) as SlaDefinition[];
    },

    async updateDefinition(id: string, updates: Partial<SlaDefinition>) {
        const { error } = await supabase
            .from('sla_definitions')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    async getBreachedRequests() {
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('service_requests')
            .select('*, lead:leads(customer_name, company_name), device:customer_devices(product_model, serial_number)')
            .not('status', 'in', '("resolved","closed")')
            .lt('sla_resolution_due_at', now)
            .order('sla_resolution_due_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async getAtRiskRequests(hoursThreshold: number = 4) {
        const threshold = new Date(Date.now() + hoursThreshold * 60 * 60 * 1000).toISOString();
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('service_requests')
            .select('*, lead:leads(customer_name, company_name), device:customer_devices(product_model, serial_number)')
            .not('status', 'in', '("resolved","closed")')
            .gt('sla_resolution_due_at', now)
            .lt('sla_resolution_due_at', threshold)
            .order('sla_resolution_due_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async getSlaStats() {
        // Get all resolved requests with SLA data
        const { data, error } = await supabase
            .from('service_requests')
            .select('sla_response_due_at, sla_resolution_due_at, first_responded_at, resolved_at, created_at, priority, is_vip_priority')
            .in('status', ['resolved', 'closed'])
            .not('sla_resolution_due_at', 'is', null);

        if (error) throw error;
        if (!data || data.length === 0) return { responseCompliance: 0, resolutionCompliance: 0, avgResolutionHours: 0, total: 0 };

        let responseOnTime = 0;
        let resolutionOnTime = 0;
        let totalResolutionMs = 0;

        for (const r of data) {
            if (r.first_responded_at && r.sla_response_due_at) {
                if (new Date(r.first_responded_at) <= new Date(r.sla_response_due_at)) responseOnTime++;
            }
            if (r.resolved_at && r.sla_resolution_due_at) {
                if (new Date(r.resolved_at) <= new Date(r.sla_resolution_due_at)) resolutionOnTime++;
            }
            if (r.resolved_at && r.created_at) {
                totalResolutionMs += new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime();
            }
        }

        return {
            responseCompliance: Math.round((responseOnTime / data.length) * 100),
            resolutionCompliance: Math.round((resolutionOnTime / data.length) * 100),
            avgResolutionHours: Math.round(totalResolutionMs / data.length / (1000 * 60 * 60)),
            total: data.length
        };
    }
};
