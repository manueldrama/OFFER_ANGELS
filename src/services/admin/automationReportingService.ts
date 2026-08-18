import { supabase } from '../../lib/supabase/client';

export interface AutomationStats {
    rule_type: string;
    total: number;
    pending: number;
    sent: number;
    failed: number;
    skipped: number;
    successRate: number;
}

export const AutomationReportingService = {
    async getTaskMetrics(startDate?: Date, endDate?: Date): Promise<AutomationStats[]> {
        let query = supabase.from('follow_up_tasks').select('rule_type, status');

        if (startDate) query = query.gte('created_at', startDate.toISOString());
        if (endDate) query = query.lte('created_at', endDate.toISOString());

        const { data, error } = await query;
        if (error) throw error;

        const map = new Map<string, AutomationStats>();

        data.forEach(task => {
            if (!map.has(task.rule_type)) {
                map.set(task.rule_type, { rule_type: task.rule_type, total: 0, pending: 0, sent: 0, failed: 0, skipped: 0, successRate: 0 });
            }
            const stats = map.get(task.rule_type)!;
            stats.total++;

            if (task.status === 'pending' || task.status === 'processing') stats.pending++;
            else if (task.status === 'sent') stats.sent++;
            else if (task.status === 'failed') stats.failed++;
            else if (task.status === 'skipped' || task.status === 'cancelled') stats.skipped++;

            map.set(task.rule_type, stats);
        });

        const results = Array.from(map.values()).map(r => {
            const resolvable = r.sent + r.failed;
            return {
                ...r,
                rule_type: this.formatRuleName(r.rule_type),
                successRate: resolvable > 0 ? Math.round((r.sent / resolvable) * 100) : 0
            };
        });

        return results.sort((a, b) => b.total - a.total);
    },

    formatRuleName(raw: string) {
        switch (raw) {
            case 'no_open': return 'Açılmayan Linkler';
            case 'no_offer': return 'Teklif Seçilmeyenler';
            case 'no_payment': return 'Ödeme Başlatılmayanlar';
            case 'payment_abandoned': return 'Yarım Kalan Ödemeler';
            default: return raw;
        }
    }
};
