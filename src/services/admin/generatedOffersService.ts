import { supabase } from '../../lib/supabase/client';

export interface GeneratedOffer {
    id: string;
    offer_token: string;
    offer_number: string;
    customer_name: string;
    company_name: string;
    total: number;
    items: any[];
    created_at: string;
    selected_reservation?: string;
}

export const AdminGeneratedOffersService = {
    /**
     * List all finalized (generated) offers for a specific token
     */
    async listByToken(token: string): Promise<GeneratedOffer[]> {
        const { data, error } = await supabase
            .from('generated_offers')
            .select('*')
            .eq('offer_token', token)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[AdminGeneratedOffersService] listByToken error:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Get a specific generated offer by its ID
     */
    async getById(id: string): Promise<GeneratedOffer> {
        const { data, error } = await supabase
            .from('generated_offers')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('[AdminGeneratedOffersService] getById error:', error);
            throw error;
        }

        return data;
    },

    async deleteOne(id: string): Promise<void> {
        const { error } = await supabase
            .from('generated_offers')
            .delete()
            .eq('id', id);
        if (error) {
            console.error('[AdminGeneratedOffersService] deleteOne error:', error);
            throw error;
        }
    },

    async deleteByToken(token: string): Promise<void> {
        const { error } = await supabase
            .from('generated_offers')
            .delete()
            .eq('offer_token', token);
        if (error) {
            console.error('[AdminGeneratedOffersService] deleteByToken error:', error);
            throw error;
        }
    }
};
