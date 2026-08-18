import { supabase } from '../../lib/supabase/client';
import { AiTranslationService } from './aiTranslationService';
import { LanguageService } from './languageService';

type CampaignSyncFields = {
    name?: string | null;
    estimated_delivery?: string | null;
};

export const CampaignTranslationService = {
    /**
     * Bir kampanyanın name ve estimated_delivery alanlarını TARGET_LANGUAGES'a çevirir
     * ve translations tablosuna upsert eder. TR (kaynak) da fallback için yazılır.
     * Hata olursa logla ama caller'a fırlat — caller .catch() ile yutmalı.
     */
    async syncCampaign(campaignId: string, source: CampaignSyncFields): Promise<void> {
        console.log('[CampaignTranslate] syncCampaign start', { campaignId, source });
        if (!campaignId) {
            console.warn('[CampaignTranslate] aborted: no campaignId');
            return;
        }

        const items = [
            { key: `campaign:${campaignId}:name`, value: (source.name || '').trim() },
            { key: `campaign:${campaignId}:estimated_delivery`, value: (source.estimated_delivery || '').trim() },
        ].filter(i => i.value);

        console.log('[CampaignTranslate] items to translate', items);

        if (items.length === 0) {
            console.warn('[CampaignTranslate] aborted: no items');
            return;
        }

        // Aktif dilleri DB'den çek; TR kaynak olduğu için onu hariç tutalım
        let targetLanguages: string[] = [];
        try {
            const active = await LanguageService.getActive();
            targetLanguages = active.map(l => l.code).filter(c => c && c !== 'tr');
            console.log('[CampaignTranslate] active target languages', targetLanguages);
        } catch (err) {
            console.error('[CampaignTranslate] failed to load active languages, falling back', err);
            targetLanguages = ['en', 'de', 'fr', 'es'];
        }

        const allResults: { key: string; language: string; value: string }[] = [];

        // Her hedef dil için sırayla çevir (paralel atarsa OpenAI rate-limit'e takılabilir)
        for (const lang of targetLanguages) {
            try {
                console.log(`[CampaignTranslate] calling translateBatch for ${lang}...`);
                const out = await AiTranslationService.translateBatch(items, [lang]);
                console.log(`[CampaignTranslate] ${lang} got ${out.length} translations`, out);
                allResults.push(...out);
            } catch (err) {
                console.error(`[CampaignTranslate] ${lang} failed`, err);
            }
        }

        // Kaynak dil (TR) — fallback için ekle
        for (const item of items) {
            allResults.push({ key: item.key, language: 'tr', value: item.value });
        }

        console.log('[CampaignTranslate] total rows to upsert', allResults.length, allResults);

        if (allResults.length === 0) return;

        const rows = allResults.map(r => ({
            namespace: 'campaigns',
            key: r.key,
            language_code: r.language,
            value: r.value,
            updated_at: new Date().toISOString(),
        }));

        const { error, data } = await supabase
            .from('translations')
            .upsert(rows, { onConflict: 'namespace,key,language_code' })
            .select();
        if (error) {
            console.error('[CampaignTranslate] upsert failed', error);
            throw error;
        }
        console.log('[CampaignTranslate] upsert success, rows written:', data?.length ?? '?');
    },
};
