import { supabase } from '../../lib/supabase/client';
import { CartridgeSubscription } from '../../types';

export const SubscriptionService = {
    async listSubscriptions(filters?: { status?: string; search?: string }) {
        let query = supabase
            .from('cartridge_subscriptions')
            .select('*, lead:leads(customer_name, company_name, phone_number), device:customer_devices(product_model, serial_number)')
            .order('created_at', { ascending: false });

        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.search) {
            // Search via lead name - would need a more complex approach, filter client-side for now
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async updateStatus(id: string, status: 'active' | 'paused' | 'cancelled') {
        const { error } = await supabase
            .from('cartridge_subscriptions')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    async getUpcomingDeliveries(daysAhead: number = 7) {
        const threshold = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('cartridge_subscriptions')
            .select('*, lead:leads(customer_name, company_name, phone_number), device:customer_devices(product_model, serial_number)')
            .eq('status', 'active')
            .lt('next_delivery_at', threshold)
            .order('next_delivery_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async getStats() {
        const { data, error } = await supabase
            .from('cartridge_subscriptions')
            .select('status, quantity, interval_days');
        if (error) throw error;

        const active = (data || []).filter(s => s.status === 'active');
        const paused = (data || []).filter(s => s.status === 'paused');
        const cancelled = (data || []).filter(s => s.status === 'cancelled');

        return {
            activeCount: active.length,
            pausedCount: paused.length,
            cancelledCount: cancelled.length,
            totalCount: (data || []).length
        };
    }
};
