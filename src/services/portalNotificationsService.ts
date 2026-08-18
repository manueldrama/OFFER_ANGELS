import { supabase } from '../lib/supabase/client';

export interface PortalNotification {
    id: string;
    lead_id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'service' | 'order';
    is_read: boolean;
    link: string | null;
    created_at: string;
}

export const PortalNotificationsService = {
    async listNotifications(leadId: string, limit = 20): Promise<PortalNotification[]> {
        const { data, error } = await supabase
            .from('portal_notifications')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data ?? []) as PortalNotification[];
    },

    async getUnreadCount(leadId: string): Promise<number> {
        const { count, error } = await supabase
            .from('portal_notifications')
            .select('*', { count: 'exact', head: true })
            .eq('lead_id', leadId)
            .eq('is_read', false);

        if (error) throw error;
        return count ?? 0;
    },

    async markAsRead(id: string): Promise<void> {
        const { error } = await supabase
            .from('portal_notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (error) throw error;
    },

    async createNotification(leadId: string, notification: {
        title: string;
        message: string;
        type: PortalNotification['type'];
        link?: string;
    }): Promise<PortalNotification> {
        const { data, error } = await supabase
            .from('portal_notifications')
            .insert([{
                lead_id: leadId,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                link: notification.link || null,
                is_read: false,
            }])
            .select()
            .single();

        if (error) throw error;
        return data as PortalNotification;
    },

    async createBulkNotifications(leadIds: string[], notification: {
        title: string;
        message: string;
        type: PortalNotification['type'];
        link?: string;
    }): Promise<void> {
        const rows = leadIds.map(leadId => ({
            lead_id: leadId,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            link: notification.link || null,
            is_read: false,
        }));

        const { error } = await supabase
            .from('portal_notifications')
            .insert(rows);

        if (error) throw error;
    },

    async markAllAsRead(leadId: string): Promise<void> {
        const { error } = await supabase
            .from('portal_notifications')
            .update({ is_read: true })
            .eq('lead_id', leadId)
            .eq('is_read', false);

        if (error) throw error;
    },
};
