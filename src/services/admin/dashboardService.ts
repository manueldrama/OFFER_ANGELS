import { supabase } from '../../lib/supabase/client';

export interface DashboardMetrics {
    newLeadsToday: number;
    newLeadsTotal: number;
    offersGenerated: number;
    paymentsStarted: number;
    paymentsSuccess: number;
    totalRevenueTRY: number;
}

export const DashboardService = {
    async getMetrics(): Promise<DashboardMetrics> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Default return structure
        const metrics: DashboardMetrics = {
            newLeadsToday: 0,
            newLeadsTotal: 0,
            offersGenerated: 0,
            paymentsStarted: 0,
            paymentsSuccess: 0,
            totalRevenueTRY: 0,
        };

        try {
            // 1. Leads
            const { count: totalLeads } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true });

            const { count: todayLeads } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', today.toISOString());

            // 2. Offer Links Generated
            const { count: offerLinks } = await supabase
                .from('offer_links')
                .select('*', { count: 'exact', head: true });

            // 3. Payments
            const { data: payments } = await supabase
                .from('payment_transactions')
                .select('status, amount');

            metrics.newLeadsTotal = totalLeads || 0;
            metrics.newLeadsToday = todayLeads || 0;
            metrics.offersGenerated = offerLinks || 0;

            if (payments) {
                metrics.paymentsStarted = payments.length;
                payments.forEach(p => {
                    if (p.status === 'success') {
                        metrics.paymentsSuccess += 1;
                        metrics.totalRevenueTRY += Number(p.amount) || 0;
                    }
                });
            }

            return metrics;
        } catch (error) {
            console.error('[DashboardService] Error fetching metrics:', error);
            return metrics;
        }
    }
};
