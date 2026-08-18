import { supabase } from '../../lib/supabase/client';
import { OfferExperience } from '../../types';
import { AdminAuditService } from './auditService';

export const adminOfferExperienceService = {
    async getGlobalExperience(languageCode: string = 'tr'): Promise<OfferExperience | null> {
        const { data, error } = await supabase
            .from('offer_experiences')
            .select('*')
            .is('campaign_id', null)
            .eq('language_code', languageCode)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('getGlobalExperience error:', error);
            throw error;
        }

        return data as OfferExperience | null;
    },

    async getCampaignExperience(campaignId: string, languageCode: string = 'tr'): Promise<OfferExperience | null> {
        const { data, error } = await supabase
            .from('offer_experiences')
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('language_code', languageCode)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('getCampaignExperience error:', error);
            throw error;
        }

        return data as OfferExperience | null;
    },

    async saveExperience(experience: OfferExperience, userId: string): Promise<OfferExperience> {
        const isUpdate = !!experience.id;

        const { data, error } = await supabase
            .from('offer_experiences')
            .upsert(experience, { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            console.error('saveExperience error:', error);
            throw error;
        }

        // Audit Logging
        const actionType = isUpdate ? 'offer_experience_updated' : 'offer_experience_created';
        const entityId = data.campaign_id ? `campaign_${data.campaign_id}` : 'global_default';

        await AdminAuditService.logAction({
            user_id: userId,
            action_type: actionType,
            entity_type: 'offer_experiences',
            entity_id: entityId,
            new_values: data
        });

        return data as OfferExperience;
    },

    async resetCampaignExperience(campaignId: string, languageCode: string = 'tr', userId: string): Promise<void> {
        const { data: existing, error: fetchErr } = await supabase
            .from('offer_experiences')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('language_code', languageCode)
            .single();

        if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;

        if (existing) {
            const { error } = await supabase
                .from('offer_experiences')
                .delete()
                .eq('id', existing.id);

            if (error) throw error;

            await AdminAuditService.logAction({
                user_id: userId,
                action_type: 'offer_experience_reset',
                entity_type: 'offer_experiences',
                entity_id: `campaign_${campaignId}`,
                old_values: { deleted_id: existing.id }
            });
        }
    }
};
