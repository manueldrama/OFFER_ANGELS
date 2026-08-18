import { supabase } from '../lib/supabase/client';
import type { HrTaskNotification } from '../types/hrTasks';

// Personel görev bildirimleri (hr_task_notifications).
//
// Burada create* YOKTUR ve olmamalıdır: tabloya authenticated INSERT
// politikası verilmedi — bildirimleri DB fan-out trigger'ları ve cron
// (service-role) yazar. İstemci yalnız okur ve is_read işaretler; UPDATE
// trigger'ı da is_read dışındaki her değişikliği geri alır.

export const HrTaskNotificationsService = {
    async getUnreadCount(userId: string): Promise<number> {
        const { count, error } = await supabase
            .from('hr_task_notifications')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', userId)
            .eq('is_read', false);
        if (error) throw error;
        return count ?? 0;
    },

    async list(userId: string, limit = 20): Promise<HrTaskNotification[]> {
        const { data, error } = await supabase
            .from('hr_task_notifications')
            .select('*')
            .eq('recipient_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return (data ?? []) as HrTaskNotification[];
    },

    async markAsRead(id: string): Promise<void> {
        const { error } = await supabase
            .from('hr_task_notifications')
            .update({ is_read: true })
            .eq('id', id);
        if (error) throw error;
    },

    async markAllAsRead(userId: string): Promise<void> {
        const { error } = await supabase
            .from('hr_task_notifications')
            .update({ is_read: true })
            .eq('recipient_id', userId)
            .eq('is_read', false);
        if (error) throw error;
    },
};
