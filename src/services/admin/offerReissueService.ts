import { supabase } from '../../lib/supabase/client';

export interface OfferReissueRequest {
    id: string;
    original_offer_id: string;
    campaign_id: string;
    lead_id: string;
    customer_name: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewed_by: string | null;
    reviewed_at: string | null;
    new_offer_id: string | null;
    validity_hours: number | null;
    request_type: 'reissue' | 'new_offer_approval';
    created_at: string;
    updated_at: string;
}

export const AdminOfferReissueService = {
    async listRequests(campaignId?: string) {
        let query = supabase
            .from('offer_reissue_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (campaignId) {
            query = query.eq('campaign_id', campaignId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as OfferReissueRequest[];
    },

    async listPendingRequests(campaignId?: string) {
        let query = supabase
            .from('offer_reissue_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (campaignId) {
            query = query.eq('campaign_id', campaignId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as OfferReissueRequest[];
    },

    async approveRequest(id: string, validityHours: number) {
        const auth = await supabase.auth.getUser();
        const userId = auth.data.user?.id;

        const { data, error } = await supabase
            .from('offer_reissue_requests')
            .update({
                status: 'approved',
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
                validity_hours: validityHours,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (userId) {
            await supabase.from('audit_logs').insert({
                user_id: userId,
                action_type: 'APPROVE',
                entity_type: 'OFFER_REISSUE',
                entity_id: id,
                new_values: { status: 'approved', validity_hours: validityHours }
            });
        }

        return data as OfferReissueRequest;
    },

    async rejectRequest(id: string, reason?: string) {
        const auth = await supabase.auth.getUser();
        const userId = auth.data.user?.id;

        const { data, error } = await supabase
            .from('offer_reissue_requests')
            .update({
                status: 'rejected',
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
                reason: reason || undefined,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (userId) {
            await supabase.from('audit_logs').insert({
                user_id: userId,
                action_type: 'REJECT',
                entity_type: 'OFFER_REISSUE',
                entity_id: id,
                new_values: { status: 'rejected' }
            });
        }

        return data as OfferReissueRequest;
    }
};
