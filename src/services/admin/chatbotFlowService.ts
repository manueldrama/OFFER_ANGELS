import { supabase } from '../../lib/supabase/client';
import { sanitizeSearchTerm } from '../../utils/searchFilter';
import type { ChatbotFlow, ChatbotDashboardStats } from '../../types/chatbot';

export const ChatbotFlowService = {
    async listFlows(filters?: { channel?: string; isActive?: boolean; search?: string }) {
        let query = supabase
            .from('chatbot_flows')
            .select('*')
            .order('updated_at', { ascending: false });

        if (filters?.channel && filters.channel !== 'all') {
            query = query.or(`channel.eq.${filters.channel},channel.eq.all`);
        }
        if (filters?.isActive !== undefined) {
            query = query.eq('is_active', filters.isActive);
        }
        const s = sanitizeSearchTerm(filters?.search);
        if (s) {
            query = query.or(`name.ilike.%${s}%,description.ilike.%${s}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as ChatbotFlow[];
    },

    async getFlow(id: string) {
        const { data, error } = await supabase
            .from('chatbot_flows')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as ChatbotFlow;
    },

    async createFlow(payload: Partial<ChatbotFlow>) {
        const auth = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('chatbot_flows')
            .insert([{ ...payload, created_by: auth.data.user?.id }])
            .select()
            .single();
        if (error) throw error;
        return data as ChatbotFlow;
    },

    async updateFlow(id: string, updates: Partial<ChatbotFlow>) {
        const { data, error } = await supabase
            .from('chatbot_flows')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as ChatbotFlow;
    },

    async deleteFlow(id: string) {
        const { error } = await supabase.from('chatbot_flows').delete().eq('id', id);
        if (error) throw error;
    },

    async toggleFlow(id: string, isActive: boolean) {
        return this.updateFlow(id, { is_active: isActive } as any);
    },

    async duplicateFlow(id: string) {
        const flow = await this.getFlow(id);
        const { id: _, created_at, updated_at, stats_triggered, stats_completed, stats_failed, ...rest } = flow;
        return this.createFlow({
            ...rest,
            name: `${rest.name} (Kopya)`,
            is_active: false,
            stats_triggered: 0,
            stats_completed: 0,
            stats_failed: 0,
        } as any);
    },

    async getStats(): Promise<ChatbotDashboardStats> {
        const [flowsRes, subsRes, runsRes] = await Promise.all([
            supabase.from('chatbot_flows').select('is_active'),
            supabase.from('chatbot_subscribers').select('channel'),
            supabase.from('chatbot_flow_runs').select('status, started_at'),
        ]);

        const flows = flowsRes.data || [];
        const subs = subsRes.data || [];
        const runs = runsRes.data || [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayRuns = runs.filter(r => new Date(r.started_at) >= today);

        return {
            totalFlows: flows.length,
            activeFlows: flows.filter(f => f.is_active).length,
            totalSubscribers: subs.length,
            whatsappSubscribers: subs.filter(s => s.channel === 'whatsapp').length,
            instagramSubscribers: subs.filter(s => s.channel === 'instagram').length,
            runsToday: todayRuns.length,
            runsCompleted: runs.filter(r => r.status === 'completed').length,
            runsFailed: runs.filter(r => r.status === 'failed').length,
        };
    },
};
