import { supabase } from '../../lib/supabase/client';
import { sanitizeSearchTerm } from '../../utils/searchFilter';
import type { ChatbotSubscriber, ChatbotFlowRun, ChatbotFlowRunStep } from '../../types/chatbot';

export const ChatbotSubscriberService = {
    async listSubscribers(filters?: { channel?: string; search?: string; tag?: string }) {
        let query = supabase
            .from('chatbot_subscribers')
            .select('*')
            .order('last_interaction_at', { ascending: false });

        if (filters?.channel && filters.channel !== 'all') {
            query = query.eq('channel', filters.channel);
        }
        const s = sanitizeSearchTerm(filters?.search);
        if (s) {
            query = query.or(`display_name.ilike.%${s}%,platform_user_id.ilike.%${s}%`);
        }
        if (filters?.tag) {
            query = query.contains('tags', [filters.tag]);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as ChatbotSubscriber[];
    },

    async getSubscriber(id: string) {
        const { data, error } = await supabase
            .from('chatbot_subscribers')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as ChatbotSubscriber;
    },

    async updateSubscriber(id: string, updates: Partial<ChatbotSubscriber>) {
        const { data, error } = await supabase
            .from('chatbot_subscribers')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as ChatbotSubscriber;
    },

    async getSubscriberRuns(subscriberId: string) {
        const { data, error } = await supabase
            .from('chatbot_flow_runs')
            .select('*, flow:chatbot_flows(id, name, channel)')
            .eq('subscriber_id', subscriberId)
            .order('started_at', { ascending: false })
            .limit(50);
        if (error) throw error;
        return data as ChatbotFlowRun[];
    },

    async listRuns(filters?: { flowId?: string; status?: string }) {
        let query = supabase
            .from('chatbot_flow_runs')
            .select('*, flow:chatbot_flows(id, name, channel), subscriber:chatbot_subscribers(id, display_name, channel, platform_user_id)')
            .order('started_at', { ascending: false })
            .limit(100);

        if (filters?.flowId) {
            query = query.eq('flow_id', filters.flowId);
        }
        if (filters?.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as ChatbotFlowRun[];
    },

    async getRunSteps(runId: string) {
        const { data, error } = await supabase
            .from('chatbot_flow_run_steps')
            .select('*')
            .eq('run_id', runId)
            .order('executed_at', { ascending: true });
        if (error) throw error;
        return data as ChatbotFlowRunStep[];
    },
};
