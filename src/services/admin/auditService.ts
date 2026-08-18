import { supabase } from '../../lib/supabase/client';

export interface AuditLog {
    id: string;
    user_id: string | null;
    action_type: string;
    entity_type: string;
    entity_id: string | null;
    old_value: any | null;
    new_value: any | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    sales_users?: {
        email: string;
        full_name: string;
    };
}

export const AdminAuditService = {
    async logAction(log: {
        user_id: string;
        action_type: string;
        entity_type: string;
        entity_id: string | null;
        old_values?: any;
        new_values?: any;
    }): Promise<void> {
        const { error } = await supabase.from('audit_logs').insert([{
            user_id: log.user_id,
            action_type: log.action_type,
            entity_type: log.entity_type,
            entity_id: log.entity_id,
            old_value: log.old_values,
            new_value: log.new_values,
        }]);
        if (error) console.error('Audit log failed', error);
    },

    // 1) List Logs
    async listLogs({
        action_type = 'all',
        entity_type = 'all',
        page = 1,
        limit = 20
    }: {
        action_type?: string;
        entity_type?: string;
        page?: number;
        limit?: number;
    }) {
        let query = supabase
            .from('audit_logs')
            .select(`
        *,
        sales_users!audit_logs_user_id_fkey (
          email,
          full_name
        )
      `, { count: 'exact' });

        if (action_type && action_type !== 'all') {
            query = query.eq('action_type', action_type);
        }

        if (entity_type && entity_type !== 'all') {
            query = query.eq('entity_type', entity_type);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[AdminAuditService]', error);
            throw error;
        }

        return { logs: data as unknown as AuditLog[], count: count || 0 };
    }
};
