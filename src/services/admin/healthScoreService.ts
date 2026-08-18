import { supabase } from '../../lib/supabase/client';

export const HealthScoreService = {
    async computeAllScores(): Promise<void> {
        const { data: leads, error } = await supabase
            .from('leads')
            .select('id')
            .eq('customer_type', 'customer');

        if (error) throw error;

        for (const lead of leads || []) {
            try {
                const score = await this.computeScore(lead.id);
                await supabase.from('customer_health_scores').upsert({
                    lead_id: lead.id,
                    score,
                    computed_at: new Date().toISOString(),
                }, { onConflict: 'lead_id' });
            } catch (err) {
                console.error(`[HealthScore] Failed for lead ${lead.id}:`, err);
            }
        }
    },

    async computeScore(leadId: string): Promise<number> {
        const [portalRes, ticketsRes, subsRes, ordersRes, onboardingRes, paymentsRes] = await Promise.all([
            supabase.from('customer_portals').select('id, last_accessed_at').eq('lead_id', leadId).maybeSingle(),
            supabase.from('service_requests').select('id, status, priority').eq('lead_id', leadId),
            supabase.from('cartridge_subscriptions').select('status').eq('lead_id', leadId),
            supabase.from('consumable_orders').select('created_at').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1),
            supabase.from('onboarding_checklists').select('completed').eq('lead_id', leadId),
            supabase.from('payment_transactions').select('status').eq('lead_id', leadId),
        ]);

        let score = 0;
        const now = Date.now();

        // Portal activity (20%)
        const portal = portalRes.data;
        if (portal) {
            if (portal.last_accessed_at) {
                const daysSince = (now - new Date(portal.last_accessed_at).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince <= 30) score += 20;
                else if (daysSince <= 60) score += 10;
            }
        }

        // Service satisfaction (25%)
        const tickets = ticketsRes.data || [];
        const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
        const hasEscalated = tickets.some(t => t.priority === 'urgent' || t.priority === 'escalated');
        if (hasEscalated) {
            score += 0;
        } else if (openTickets.length === 0) {
            score += 25;
        } else if (openTickets.length === 1) {
            score += 15;
        } else {
            score += 5;
        }

        // Consumable engagement (25%)
        const hasActiveSub = (subsRes.data || []).some(s => s.status === 'active');
        if (hasActiveSub) {
            score += 25;
        } else {
            const lastOrder = ordersRes.data?.[0];
            if (lastOrder?.created_at) {
                const daysSince = (now - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince <= 90) score += 15;
            }
        }

        // Onboarding completion (15%)
        const steps = onboardingRes.data || [];
        if (steps.length > 0) {
            const completed = steps.filter(s => s.completed).length;
            score += Math.round((completed / steps.length) * 15);
        }

        // Payment health (15%)
        const payments = paymentsRes.data || [];
        if (payments.length > 0) {
            const hasFailed = payments.some(p => p.status === 'failed');
            score += hasFailed ? 5 : 15;
        }

        return Math.min(100, Math.max(0, score));
    }
};
