import { supabase } from '../../lib/supabase/client';
import { sanitizeSearchTerm } from '../../utils/searchFilter';

export interface CallbackRequest {
    id: string;
    offer_token: string;
    lead_id: string | null;
    offer_code: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    company_name: string | null;
    channel: 'phone' | 'whatsapp' | 'email';
    requested_date: string | null;
    requested_time: string | null;
    status: 'new' | 'contacted' | 'scheduled' | 'done' | 'cancelled';
    assigned_user_id: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
    // Kurumsal iletişim talepleri (landing /iletisim formu) için ek alanlar.
    // 20260627_corporate_contact_requests.sql ile eklendi; teklif-içi destek
    // satırlarında (request_type='offer_support') null olurlar.
    request_type: 'offer_support' | 'corporate';
    topic: 'sales' | 'corporate' | null;
    business_type: string | null;
    country_code: string | null;
    city: string | null;
    email: string | null;
    message: string | null;
}

export interface CallbackNote {
    id: string;
    request_id: string;
    note_text: string;
    created_by: string | null;
    created_at: string;
}

export const SalesSupportService = {
    async listRequests(params: {
        status?: string;
        channel?: string;
        requestType?: string;
        search?: string;
        page?: number;
        limit?: number;
        leadIds?: string[]; // filter to only these lead IDs (for sales role)
    }) {
        let query = supabase
            .from('sales_callback_requests')
            .select('*', { count: 'exact' });

        if (params.leadIds) {
            if (params.leadIds.length === 0) {
                return { requests: [], count: 0 };
            }
            query = query.in('lead_id', params.leadIds);
        }
        if (params.status) {
            query = query.eq('status', params.status);
        }
        if (params.channel) {
            query = query.eq('channel', params.channel);
        }
        if (params.requestType) {
            query = query.eq('request_type', params.requestType);
        }
        const sanitized = sanitizeSearchTerm(params.search);
        if (sanitized) {
            const s = `%${sanitized}%`;
            query = query.or(`customer_name.ilike.${s},customer_phone.ilike.${s},company_name.ilike.${s},offer_code.ilike.${s},email.ilike.${s}`);
        }

        const p = params.page || 1;
        const l = params.limit || 20;
        const from = (p - 1) * l;
        const to = from + l - 1;

        const { data, count, error } = await query
            .order('requested_date', { ascending: true })
            .order('requested_time', { ascending: true })
            .range(from, to);

        if (error) throw error;
        return { requests: (data || []) as CallbackRequest[], count: count || 0 };
    },

    async getRequest(id: string) {
        const { data: request, error } = await supabase
            .from('sales_callback_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        const { data: notes } = await supabase
            .from('sales_callback_notes')
            .select('*')
            .eq('request_id', id)
            .order('created_at', { ascending: true });

        return { request: request as CallbackRequest, notes: (notes || []) as CallbackNote[] };
    },

    async updateRequest(id: string, data: Partial<Pick<CallbackRequest, 'status' | 'assigned_user_id' | 'note'>>) {
        const { error } = await supabase
            .from('sales_callback_requests')
            .update(data)
            .eq('id', id);

        if (error) throw error;
    },

    async addNote(id: string, note_text: string, created_by?: string) {
        const { error } = await supabase
            .from('sales_callback_notes')
            .insert({
                request_id: id,
                note_text,
                created_by: created_by || null,
            });

        if (error) throw error;
    },

    async deleteRequest(id: string) {
        // Option 1: First delete related notes (if no cascade in DB)
        await supabase.from('sales_callback_notes').delete().eq('request_id', id);

        // Option 2: Delete the request itself
        const { error } = await supabase
            .from('sales_callback_requests')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async deleteRequests(ids: string[]) {
        if (!ids.length) return;

        // Delete related notes
        await supabase.from('sales_callback_notes').delete().in('request_id', ids);

        // Delete requests
        const { error } = await supabase
            .from('sales_callback_requests')
            .delete()
            .in('id', ids);

        if (error) throw error;
    },

    async getSupportAvailability(userId: string): Promise<Record<string, string[]>> {
        const defaultAvail: Record<string, string[]> = {
            monday: ['09:30','10:00','11:00','12:30','14:00','15:30','16:00','17:00'],
            tuesday: ['09:30','10:00','11:00','12:30','14:00','15:30','16:00','17:00'],
            wednesday: ['09:30','10:00','11:00','12:30','14:00','15:30','16:00','17:00'],
            thursday: ['09:30','10:00','11:00','12:30','14:00','15:30','16:00','17:00'],
            friday: ['09:30','10:00','11:00','12:30','14:00','15:30','16:00','17:00'],
            saturday: [],
            sunday: [],
        };
        const { data } = await supabase
            .from('user_support_availability')
            .select('availability')
            .eq('user_id', userId)
            .maybeSingle();
        return data?.availability || defaultAvail;
    },

    async updateSupportAvailability(userId: string, availability: Record<string, string[]>): Promise<void> {
        const sorted: Record<string, string[]> = {};
        for (const [day, slots] of Object.entries(availability)) {
            sorted[day] = [...slots].sort();
        }
        const { error } = await supabase
            .from('user_support_availability')
            .upsert({ user_id: userId, availability: sorted, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
    },

    async getSupportAvailabilityByAssignedUser(assignedUserId: string): Promise<Record<string, string[]>> {
        const defaultAvail: Record<string, string[]> = {
            monday: ['09:30','10:00','11:00','12:30','14:00','15:30','16:00','17:00'],
            tuesday: ['09:30','10:00','11:00','12:30','14:00','15:30','16:00','17:00'],
            wednesday: ['09:30','10:00','11:00','12:30','14:00','15:30','16:00','17:00'],
            thursday: ['09:30','10:00','11:00','12:30','14:00','15:30','16:00','17:00'],
            friday: ['09:30','10:00','11:00','12:30','14:00','15:30','16:00','17:00'],
            saturday: [],
            sunday: [],
        };
        const { data } = await supabase
            .from('user_support_availability')
            .select('availability')
            .eq('user_id', assignedUserId)
            .maybeSingle();
        return data?.availability || defaultAvail;
    }
};
