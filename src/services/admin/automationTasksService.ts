import { supabase } from '../../lib/supabase/client';
import { FollowUpTask } from '../../../api/services/automation/followUpTasksService';

export const AdminAutomationTasksService = {
    async listTasks(statusFilter: string = 'all', page: number = 1, limit: number = 20) {
        let query = supabase
            .from('follow_up_tasks')
            .select(`
                *,
                leads ( customer_name, phone_number, email )
            `, { count: 'exact' })
            .order('scheduled_at', { ascending: false });

        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        return {
            tasks: data as any[],
            total: count || 0
        };
    },

    async retryTask(taskId: string) {
        const { error } = await supabase
            .from('follow_up_tasks')
            .update({ status: 'pending', scheduled_at: new Date().toISOString() })
            .eq('id', taskId);
        if (error) throw error;
    },

    async cancelTask(taskId: string) {
        const { error } = await supabase
            .from('follow_up_tasks')
            .update({ status: 'cancelled' })
            .eq('id', taskId);
        if (error) throw error;
    }
};
