import { supabase } from '../../lib/supabase/client';
import { fetchInChunks } from '../../lib/supabase/paginate';

export interface LeadReminder {
    id: string;
    lead_id: string;
    remind_at: string;
    note: string | null;
    is_done: boolean;
    done_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

/** Global hatırlatma merkezi için lead bilgisiyle zenginleştirilmiş hatırlatma. */
export interface ReminderWithLead extends LeadReminder {
    lead: {
        id: string;
        customer_name: string | null;
        phone_number: string | null;
        assigned_to: string | null;
        status: string | null;
    } | null;
}

export const leadRemindersService = {
    async listForLead(leadId: string): Promise<LeadReminder[]> {
        const { data, error } = await supabase
            .from('lead_reminders')
            .select('*')
            .eq('lead_id', leadId)
            .order('remind_at', { ascending: true });
        if (error) throw error;
        return (data || []) as LeadReminder[];
    },

    /** Bulk: only OPEN (not done) reminders for many leads, used in sidebar to show badges. */
    async listOpenForLeads(leadIds: string[]): Promise<Record<string, LeadReminder[]>> {
        if (leadIds.length === 0) return {};
        const data = await fetchInChunks<LeadReminder>(
            leadIds,
            (chunk, from, to) => supabase
                .from('lead_reminders')
                .select('*')
                .in('lead_id', chunk)
                .eq('is_done', false)
                .order('remind_at', { ascending: true })
                .range(from, to),
        );
        const map: Record<string, LeadReminder[]> = {};
        data.forEach(r => {
            if (!map[r.lead_id]) map[r.lead_id] = [];
            map[r.lead_id].push(r);
        });
        return map;
    },

    async create(payload: { lead_id: string; remind_at: string; note?: string }): Promise<LeadReminder> {
        const auth = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('lead_reminders')
            .insert({
                lead_id: payload.lead_id,
                remind_at: payload.remind_at,
                note: payload.note ?? null,
                created_by: auth.data.user?.id ?? null,
            })
            .select()
            .single();
        if (error) throw error;
        return data as LeadReminder;
    },

    /**
     * Tüm AÇIK hatırlatmaları lead bilgisiyle döndürür (global takip merkezi).
     * sales_admin yalnız kendine atanmış lead'lerin hatırlatmalarını görür;
     * super_admin tümünü görür.
     */
    async listAllOpen(opts: { currentUserId: string | null; isSales: boolean }): Promise<ReminderWithLead[]> {
        let query = supabase
            .from('lead_reminders')
            .select('*, lead:leads(id, customer_name, phone_number, assigned_to, status)')
            .eq('is_done', false)
            .order('remind_at', { ascending: true });

        // sales_admin kapsamı: kendisine ATANMIŞ lead'lerin hatırlatmaları VEYA
        // kendi OLUŞTURDUĞU hatırlatmalar. İkinci koşul olmadan, temsilcinin henüz
        // kendisine atanmamış bir lead için kurduğu takip kendi zilinde görünmüyordu.
        if (opts.isSales) {
            if (!opts.currentUserId) return [];
            const { data: assigned } = await supabase
                .from('leads')
                .select('id')
                .eq('assigned_to', opts.currentUserId);
            const leadIds = (assigned || []).map((l: any) => l.id).filter(Boolean);
            query = leadIds.length > 0
                ? query.or(`lead_id.in.(${leadIds.join(',')}),created_by.eq.${opts.currentUserId}`)
                : query.eq('created_by', opts.currentUserId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as ReminderWithLead[];
    },

    /** "Ertele" — hatırlatma zamanını ileri/geri al. */
    async reschedule(id: string, remindAtIso: string): Promise<void> {
        const { error } = await supabase
            .from('lead_reminders')
            .update({ remind_at: remindAtIso, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    async markDone(id: string): Promise<void> {
        const { error } = await supabase
            .from('lead_reminders')
            .update({ is_done: true, done_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    /**
     * Bir lead'in TÜM açık hatırlatmalarını kapatır. Arama Asistanı'nda kişiye
     * ulaşılınca / kazanılınca / kaybedilince bekleyen takipler otomatik temizlenir.
     */
    async markDoneForLead(leadId: string): Promise<void> {
        const { error } = await supabase
            .from('lead_reminders')
            .update({ is_done: true, done_at: new Date().toISOString() })
            .eq('lead_id', leadId)
            .eq('is_done', false);
        if (error) throw error;
    },

    async remove(id: string): Promise<void> {
        const { error } = await supabase.from('lead_reminders').delete().eq('id', id);
        if (error) throw error;
    },
};
