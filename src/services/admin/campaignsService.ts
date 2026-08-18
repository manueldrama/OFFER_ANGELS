import { supabase } from '../../lib/supabase/client';

export interface Campaign {
    id: string;
    name: string;
    batch_number: string;
    capacity_percentage: number;
    estimated_delivery: string;
    valid_until: string | null;
    discount_rate: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // V2 fields
    campaign_description?: string;
    campaign_start_date?: string;
    max_offer_validity_days?: number;
    deposit_percentage?: number;
    deposit_lock_duration_days?: number;
    deposit_extension_days?: number;
    reissued_offer_validity_hours?: number;
    total_launch_quota?: number;
    used_quota?: number;
    auto_close_when_quota_full?: boolean;
    offer_cannot_exceed_campaign_end?: boolean;
    expired_offers_require_manual_reapproval?: boolean;
    auto_reserve_price_and_stock_after_deposit?: boolean;
    offer_flow_type?: 'auto' | 'approval_required' | 'manual_only';
    /** Market this campaign targets by default (TR/EU/GB/US/SA/AE). Null → resolve from language. */
    market_code?: string | null;
    /** Optional ISO country code targeted by this campaign (e.g. 'IT'). Used for finer pricing resolution. */
    country_code?: string | null;
}

// Saf fonksiyon supabase'siz src/lib/offerExpiry.ts'de — backend ve worker
// tarafları da güvenle import edebilsin diye. Burada backward-compat için
// re-export ediliyor (offerLinksService gibi mevcut tüketiciler bozulmasın).
export { computeOfferExpiry } from '../../lib/offerExpiry';

export const AdminCampaignsService = {
    async listCampaigns() {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[AdminCampaignsService]', error);
            throw error;
        }
        return data as Campaign[];
    },

    async createCampaign(payload: Partial<Campaign>) {
        const { data, error } = await supabase
            .from('campaigns')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        // Log audit
        const auth = await supabase.auth.getUser();
        if (auth.data.user) {
            await supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'CREATE',
                entity_type: 'CAMPAIGN',
                entity_id: data.id,
                new_values: payload
            });
        }

        return data as Campaign;
    },

    async updateCampaign(id: string, updates: Partial<Campaign>) {
        const { data, error } = await supabase
            .from('campaigns')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Log audit
        const auth = await supabase.auth.getUser();
        if (auth.data.user) {
            await supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'UPDATE',
                entity_type: 'CAMPAIGN',
                entity_id: id,
                new_values: updates
            });
        }

        return data as Campaign;
    },

    async toggleStatus(id: string, is_active: boolean) {
        return this.updateCampaign(id, { is_active });
    }
};
