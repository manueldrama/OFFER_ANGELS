import { supabase } from '../../lib/supabase/client';

export interface NotInterestedLead {
    id: string;
    customer_name: string | null;
    company_name: string | null;
    phone_number: string | null;
    business_type: string | null;
    not_interested_at: string | null;
    not_interested_source: string | null;
    created_at: string;
}

export const NotInterestedService = {
    /** "İlgilenmiyor" işaretli tüm leadler — en son işaretlenen üstte. */
    async list(): Promise<NotInterestedLead[]> {
        const { data, error } = await supabase
            .from('leads')
            .select('id, customer_name, company_name, phone_number, business_type, not_interested_at, not_interested_source, created_at')
            .eq('not_interested', true)
            .order('not_interested_at', { ascending: false, nullsFirst: false });
        if (error) { console.error('[NotInterestedService.list]', error); throw error; }
        return data || [];
    },

    /** Bir lead'i "ilgilenmiyor" işaretle → remarketing + otomasyondan düşer. */
    async mark(leadId: string, source: 'admin' | 'bot' = 'admin'): Promise<void> {
        const { error } = await supabase
            .from('leads')
            .update({
                not_interested: true,
                not_interested_at: new Date().toISOString(),
                not_interested_source: source,
                remarketing_opt_out: true,
            })
            .eq('id', leadId);
        if (error) { console.error('[NotInterestedService.mark]', error); throw error; }
    },

    /** İşareti kaldır → lead pipeline'a döner, remarketing tekrar açılır. */
    async restore(leadId: string): Promise<void> {
        const { error } = await supabase
            .from('leads')
            .update({
                not_interested: false,
                not_interested_at: null,
                not_interested_source: null,
                remarketing_opt_out: false,
            })
            .eq('id', leadId);
        if (error) { console.error('[NotInterestedService.restore]', error); throw error; }
    },

    async restoreMany(leadIds: string[]): Promise<void> {
        if (!leadIds.length) return;
        const { error } = await supabase
            .from('leads')
            .update({ not_interested: false, not_interested_at: null, not_interested_source: null, remarketing_opt_out: false })
            .in('id', leadIds);
        if (error) { console.error('[NotInterestedService.restoreMany]', error); throw error; }
    },

    /** Kalıcı sil (tekli/toplu). Lead'e bağlı alt kayıtlar DB FK kuralına göre silinir. */
    async remove(leadIds: string[]): Promise<void> {
        if (!leadIds.length) return;
        const { error } = await supabase.from('leads').delete().in('id', leadIds);
        if (error) { console.error('[NotInterestedService.remove]', error); throw error; }
    },
};
