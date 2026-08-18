import { supabase } from '../../lib/supabase/client';
import { AdminAuditService } from './auditService';

export interface OfferExperienceLayout {
    id?: string;
    campaign_id: string | null;
    language_code: string;
    blocks: any[];
    content: Record<string, string>;
    /** Mobil gorunum icin bagimsiz blok id siralamasi. Bos ise [...left, ...right] fallback. */
    mobile_order?: string[];
    version?: number;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
}

/** Resolve target -> campaign_id (null = global). */
function resolveCampaignId(target: string): string | null {
    return target === 'global' ? null : target;
}

export const offerExperienceLayoutsService = {
    async getLayout(target: string, languageCode: string): Promise<OfferExperienceLayout | null> {
        const campaignId = resolveCampaignId(target);
        let query = supabase
            .from('offer_experience_layouts')
            .select('*')
            .eq('language_code', languageCode);

        query = campaignId === null
            ? query.is('campaign_id', null)
            : query.eq('campaign_id', campaignId);

        const { data, error } = await query.maybeSingle();
        if (error && error.code !== 'PGRST116') {
            console.error('getLayout error:', error);
            throw error;
        }
        return (data as OfferExperienceLayout) ?? null;
    },

    async saveLayout(
        layout: OfferExperienceLayout,
        userId: string,
    ): Promise<OfferExperienceLayout> {
        const isUpdate = !!layout.id;

        const payload = {
            ...(layout.id ? { id: layout.id } : {}),
            campaign_id: layout.campaign_id,
            language_code: layout.language_code,
            blocks: layout.blocks,
            content: layout.content,
            mobile_order: layout.mobile_order ?? [],
            version: (layout.version ?? 1),
            updated_by: userId,
        };

        // Manual upsert: migration (20260507) partial unique index'ler (WHERE clauseli)
        // yaratmis. Supabase .upsert({ onConflict: 'col,col' }) standart ON CONFLICT
        // SQL'i uretir ama PG partial unique index'i inferred predicate eslesmedikce
        // kullanmaz -> 42P10 hatasi. Burada once SELECT'le mevcut satiri bulup
        // varsa UPDATE yoksa INSERT ediyoruz. Schema dokunulmuyor; partial unique
        // index'ler race condition'a karsi koruma saglamaya devam ediyor.
        let existingId = layout.id;
        if (!existingId) {
            let lookup = supabase
                .from('offer_experience_layouts')
                .select('id')
                .eq('language_code', layout.language_code);
            lookup = layout.campaign_id === null
                ? lookup.is('campaign_id', null)
                : lookup.eq('campaign_id', layout.campaign_id);
            const { data: found, error: lookupErr } = await lookup.maybeSingle();
            if (lookupErr && lookupErr.code !== 'PGRST116') {
                console.error('saveLayout lookup error:', lookupErr);
                throw lookupErr;
            }
            existingId = found?.id;
        }

        let data: any, error: any;
        if (existingId) {
            const { id: _omit, ...updates } = payload as any;
            ({ data, error } = await supabase
                .from('offer_experience_layouts')
                .update(updates).eq('id', existingId).select().single());
        } else {
            ({ data, error } = await supabase
                .from('offer_experience_layouts')
                .insert(payload).select().single());
        }

        if (error) {
            console.error('saveLayout error:', error);
            throw error;
        }

        const saved = data as OfferExperienceLayout;
        const entityId = saved.campaign_id
            ? `campaign_${saved.campaign_id}_${saved.language_code}`
            : `global_${saved.language_code}`;

        await AdminAuditService.logAction({
            user_id: userId,
            action_type: isUpdate ? 'offer_experience_layout_updated' : 'offer_experience_layout_created',
            entity_type: 'offer_experience_layouts',
            entity_id: entityId,
            new_values: { blocks: saved.blocks, content_keys: Object.keys(saved.content || {}).length },
        });

        return saved;
    },

    async resetLayout(target: string, languageCode: string, userId: string): Promise<void> {
        const campaignId = resolveCampaignId(target);
        if (campaignId === null) {
            throw new Error('Global layout sıfırlanamaz.');
        }

        const { data: existing, error: fetchErr } = await supabase
            .from('offer_experience_layouts')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('language_code', languageCode)
            .maybeSingle();

        if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
        if (!existing) return;

        const { error } = await supabase
            .from('offer_experience_layouts')
            .delete()
            .eq('id', existing.id);

        if (error) throw error;

        await AdminAuditService.logAction({
            user_id: userId,
            action_type: 'offer_experience_layout_reset',
            entity_type: 'offer_experience_layouts',
            entity_id: `campaign_${campaignId}_${languageCode}`,
            old_values: { deleted_id: existing.id },
        });
    },
};
