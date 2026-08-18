import { supabase } from '../../lib/supabase/client';

export interface PerformanceRow {
    name: string;
    leads: number;
    offers: number;
    paymentsStarted: number;
    paymentsSuccess: number;
    revenue: number;
    conversionRate: number; // Success / Leads
}

export const PerformanceReportingService = {
    // Aggregates data by Lead Source
    async getSourcePerformance(startDate?: Date, endDate?: Date): Promise<PerformanceRow[]> {
        return this.aggregateBy('source', startDate, endDate);
    },

    // A generic aggregator mapping lead properties to their funnel progression
    async aggregateBy(groupByField: string, startDate?: Date, endDate?: Date): Promise<PerformanceRow[]> {
        let query = supabase.from('leads').select(`
            id,
            ${groupByField !== 'product_model' ? groupByField : 'id'},
            offer_links ( token, payment_transactions ( status, amount ) ),
            customer_reservations ( status, total, payment_method ),
            customer_devices ( product_model )
        `);

        if (startDate) query = query.gte('created_at', startDate.toISOString());
        if (endDate) query = query.lte('created_at', endDate.toISOString());

        const { data, error } = await query;
        if (error) {
            console.error("Supabase aggregateBy error:", error);
            throw error;
        }

        const map = new Map<string, PerformanceRow>();

        data.forEach((lead: any) => {
            let key = 'Bilinmiyor / Diğer';

            if (groupByField === 'product_model') {
                if (lead.customer_devices && lead.customer_devices.length > 0) {
                    key = lead.customer_devices[0].product_model || 'Bilinmeyen Model';
                }
            } else {
                key = lead[groupByField] || 'Bilinmiyor / Diğer';
            }

            if (!map.has(key)) {
                map.set(key, { name: key, leads: 0, offers: 0, paymentsStarted: 0, paymentsSuccess: 0, revenue: 0, conversionRate: 0 });
            }

            const stats = map.get(key)!;
            stats.leads += 1;

            if (lead.offer_links && lead.offer_links.length > 0) {
                stats.offers += lead.offer_links.length;

                lead.offer_links.forEach((link: any) => {
                    if (link.payment_transactions && link.payment_transactions.length > 0) {
                        stats.paymentsStarted += link.payment_transactions.length;
                        link.payment_transactions.forEach((txn: any) => {
                            if (txn.status === 'success') {
                                stats.paymentsSuccess += 1;
                                stats.revenue += Number(txn.amount) || 0;
                            }
                        });
                    }
                });
            }

            // Include new customer_reservations in tracking
            if (lead.customer_reservations && lead.customer_reservations.length > 0) {
                stats.paymentsStarted += lead.customer_reservations.length;
                lead.customer_reservations.forEach((res: any) => {
                    if (['confirmed', 'paid', 'shipped', 'delivered'].includes(res.status)) {
                        stats.paymentsSuccess += 1;
                        stats.revenue += Number(res.total) || 0;
                    }
                });
            }
            map.set(key, stats);
        });

        // Compute conversions and sort
        const results = Array.from(map.values()).map(r => ({
            ...r,
            conversionRate: r.leads > 0 ? parseFloat(((r.paymentsSuccess / r.leads) * 100).toFixed(1)) : 0
        }));

        return results.sort((a, b) => b.leads - a.leads);
    }
};
