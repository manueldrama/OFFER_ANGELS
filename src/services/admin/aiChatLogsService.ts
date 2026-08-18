import { supabase } from '../../lib/supabase/client';
import { sanitizeSearchTerm } from '../../utils/searchFilter';

export interface AiChatSession {
    id: string;
    lead_id: string;
    session_id: string;
    messages_json: { role: string; content: string }[];
    created_at: string;
    leads?: { company_name: string; contact_person: string } | null;
}

export const AiChatLogsService = {
    async listSessions(filters?: { leadId?: string; search?: string; page?: number; limit?: number }) {
        const { leadId, search, page = 1, limit = 20 } = filters || {};
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('ai_chat_logs')
            .select('id, lead_id, session_id, messages_json, created_at, leads(company_name, contact_person)', { count: 'exact' });

        if (leadId) {
            query = query.eq('lead_id', leadId);
        }
        const s = sanitizeSearchTerm(search);
        if (s) {
            query = query.or(`leads.company_name.ilike.%${s}%,leads.contact_person.ilike.%${s}%`);
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[AiChatLogsService] Error listing sessions:', error);
            throw error;
        }

        return {
            sessions: (data || []) as unknown as AiChatSession[],
            count: count || 0,
        };
    },

    async getSession(id: string) {
        const { data, error } = await supabase
            .from('ai_chat_logs')
            .select('id, lead_id, session_id, messages_json, created_at, leads(company_name, contact_person)')
            .eq('id', id)
            .single();

        if (error) {
            console.error('[AiChatLogsService] Error fetching session:', error);
            throw error;
        }

        return data as unknown as AiChatSession;
    },

    async deleteSession(id: string) {
        const { error } = await supabase
            .from('ai_chat_logs')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[AiChatLogsService] Error deleting session:', error);
            throw error;
        }
    },
};
