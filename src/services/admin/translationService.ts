import { supabase } from '../../lib/supabase/client';
import { sanitizeSearchTerm } from '../../utils/searchFilter';

export interface Translation {
  id: string;
  namespace: string;
  key: string;
  language_code: string;
  value: string;
  updated_at: string;
}

export interface TranslationFilters {
  namespace?: string;
  language_code?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const AdminTranslationService = {
  async list(filters: TranslationFilters = {}): Promise<{ translations: Translation[]; count: number }> {
    const { namespace, language_code, search, page = 1, limit = 50 } = filters;
    let query = supabase
      .from('translations')
      .select('*', { count: 'exact' })
      .order('namespace')
      .order('key')
      .range((page - 1) * limit, page * limit - 1);

    if (namespace) query = query.eq('namespace', namespace);
    if (language_code) query = query.eq('language_code', language_code);
    const s = sanitizeSearchTerm(search);
    if (s) query = query.or(`key.ilike.%${s}%,value.ilike.%${s}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    return { translations: (data || []) as Translation[], count: count || 0 };
  },

  async update(id: string, value: string): Promise<Translation> {
    const { data, error } = await supabase
      .from('translations')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Translation;
  },

  async bulkUpsert(rows: { namespace: string; key: string; language_code: string; value: string }[]): Promise<void> {
    const { error } = await supabase
      .from('translations')
      .upsert(rows, { onConflict: 'namespace,key,language_code' });
    if (error) throw error;
  },

  async deleteByKey(namespace: string, key: string): Promise<void> {
    const { error } = await supabase
      .from('translations')
      .delete()
      .eq('namespace', namespace)
      .eq('key', key);
    if (error) throw error;
  },

  async getDistinctKeys(namespace?: string): Promise<string[]> {
    let query = supabase
      .from('translations')
      .select('key')
      .eq('language_code', 'tr');
    if (namespace) query = query.eq('namespace', namespace);
    query = query.order('key');

    const { data, error } = await query;
    if (error) throw error;
    return [...new Set((data || []).map(r => r.key))];
  },

  async getMissingKeysCount(): Promise<number> {
    // This is a rough estimate: keys in 'tr' that don't have matches in all other languages.
    // For simplicity, we'll just check for keys that have 'tr' but are missing in ANY of the others.
    const { data: trKeys } = await supabase.from('translations').select('namespace,key').eq('language_code', 'tr');
    if (!trKeys) return 0;

    const { data: allTranslations } = await supabase.from('translations').select('namespace,key,language_code');
    if (!allTranslations) return 0;

    // We'll return the number of strings that need translation
    // (Total TR keys * (Other languages count) - Existing other translations)
    return 0; // Simplified for now, the actual logic will be in translateMissingKeys
  },

  // Helper to find what actually needs translation
  async findMissingEntries() {
    const { data: trKeys } = await supabase.from('translations').select('*').eq('language_code', 'tr');
    if (!trKeys) return [];

    const { data: others } = await supabase.from('translations').select('*').neq('language_code', 'tr');
    const existingMap = new Set((others || []).map(o => `${o.namespace}|${o.key}|${o.language_code}`));

    const { getSupportedLanguages } = await import('../../i18n');
    const targetLangs = getSupportedLanguages().filter(l => l !== 'tr');
    const missing: { namespace: string; key: string; value: string; lang: string }[] = [];

    for (const tr of trKeys) {
      for (const lang of targetLangs) {
        if (!existingMap.has(`${tr.namespace}|${tr.key}|${lang}`)) {
          missing.push({ namespace: tr.namespace, key: tr.key, value: tr.value, lang });
        }
      }
    }
    return missing;
  },

  async translateMissingKeys(onProgress?: (msg: string) => void): Promise<number> {
    const { LanguageService } = await import('./languageService');
    const { getSupportedLanguages } = await import('../../i18n');

    const targetLangs = getSupportedLanguages().filter(l => l !== 'tr');
    if (targetLangs.length === 0) return 0;

    let totalSaved = 0;

    for (const lang of targetLangs) {
      onProgress?.(`${lang.toUpperCase()} dili çevriliyor...`);
      const count = await LanguageService.translateAllForLanguage(
        lang,
        (done, total) => onProgress?.(`${lang.toUpperCase()}: ${done}/${total} tamamlandı...`)
      );
      totalSaved += count;
    }

    onProgress?.(`Tamamlandı! ${totalSaved} çeviri oluşturuldu.`);
    return totalSaved;
  }
};
