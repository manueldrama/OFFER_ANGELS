import { supabase } from '../../lib/supabase/client';

export interface Language {
  code: string;
  label: string;
  locale: string;
  flag_emoji: string;
  is_active: boolean;
  is_rtl: boolean;
  sort_order: number;
  created_at: string;
}

export type LiveItemKind = 'ui' | 'landing-cfg' | 'landing-item' | 'block-sec' | 'block-item';

export interface LiveTranslationItem {
  id: string;          // unique within the panel; UI=DB row id, others=synthetic ref
  kind: LiveItemKind;
  ref_id?: string;     // section_id / item_id for landing/block kinds
  field?: string;      // field key inside config / item / extra
  is_extra?: boolean;  // true if `field` lives under .extra
  namespace: string;   // for grouping/display
  key: string;         // human-readable key
  language_code: string;
  source_value: string;
  value: string;
  ai_translated: boolean;
}

// In-memory cache
let _cache: Language[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function invalidateCache() {
  _cache = null;
  _cacheTime = 0;
}

export const LanguageService = {
  async getAll(forceRefresh = false): Promise<Language[]> {
    if (!forceRefresh && _cache && Date.now() - _cacheTime < CACHE_TTL) {
      return _cache;
    }
    const { data, error } = await supabase
      .from('languages')
      .select('*')
      .order('sort_order');
    if (error) throw error;
    _cache = (data || []) as Language[];
    _cacheTime = Date.now();
    return _cache;
  },

  async getActive(forceRefresh = false): Promise<Language[]> {
    const all = await this.getAll(forceRefresh);
    return all.filter(l => l.is_active);
  },

  async add(lang: Omit<Language, 'created_at'>): Promise<Language> {
    const { data, error } = await supabase
      .from('languages')
      .insert(lang)
      .select()
      .single();
    if (error) throw error;
    invalidateCache();
    return data as Language;
  },

  async update(code: string, fields: Partial<Language>): Promise<Language> {
    const { data, error } = await supabase
      .from('languages')
      .update(fields)
      .eq('code', code)
      .select()
      .single();
    if (error) throw error;
    invalidateCache();
    return data as Language;
  },

  async remove(code: string): Promise<void> {
    if (code === 'tr') throw new Error('Türkçe dili silinemez.');
    await supabase.from('translations').delete().eq('language_code', code);
    const { error } = await supabase.from('languages').delete().eq('code', code);
    if (error) throw error;
    invalidateCache();
  },

  async reorder(orderedCodes: string[]): Promise<void> {
    const updates = orderedCodes.map((code, i) =>
      supabase.from('languages').update({ sort_order: i }).eq('code', code)
    );
    await Promise.all(updates);
    invalidateCache();
  },

  /**
   * Translate ALL TR keys into a target language using AI.
   * Deletes existing translations first, then creates fresh ones.
   */
  async translateAllForLanguage(
    targetCode: string,
    onProgress?: (done: number, total: number) => void,
    onChunkItems?: (items: LiveTranslationItem[]) => void
  ): Promise<number> {
    const { AiTranslationService } = await import('./aiTranslationService');

    // 1. Get ALL TR translations with pagination to avoid 1000 row limit
    let trKeysRaw: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('translations')
        .select('namespace,key,value')
        .eq('language_code', 'tr')
        .order('namespace')
        .order('key')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      trKeysRaw.push(...data);
      if (data.length < PAGE) break;
    }
    
    if (trKeysRaw.length === 0) return 0;

    // Dedupe by (namespace, key) — DB might have stray duplicates
    const seenSrc = new Set<string>();
    const trKeys = trKeysRaw.filter(r => {
      const k = `${r.namespace}::${r.key}`;
      if (seenSrc.has(k)) return false;
      seenSrc.add(k);
      return true;
    });

    console.log(`[LanguageService] Found ${trKeys.length} TR keys to translate to ${targetCode}`);

    // 2. KORUMA: Eskiden burada hedef dilin TUM cevirileri SILINIYORDU. AI
    // cevirisi ortada basarisiz olursa (API key yok/kota/ag hatasi ya da
    // kullanici sekmeyi kapatir) dil bos kaliyor ve her sey Turkce'ye dusuyordu.
    // Artik SILMIYORUZ — asagidaki upsert mevcut cevirilerin uzerine yazar,
    // dolayisiyla ceviriler hicbir zaman bos duruma dusmez (veri kaybi yok).

    // 3. Translate in chunks and save (upsert = overwrite, never wipes)
    const total = trKeys.length;
    let done = 0;
    let savedCount = 0;
    const CHUNK = 15; // Matches AI service chunk size

    for (let i = 0; i < trKeys.length; i += CHUNK) {
      const chunk = trKeys.slice(i, i + CHUNK);

      try {
        const translated = await AiTranslationService.translateBatch(
          chunk.map(c => ({ key: c.key, value: c.value })),
          [targetCode]
        );

        // Build lookup map
        const translatedMap = new Map<string, string>();
        for (const t of translated) {
          if (t.value && t.value.trim()) {
            translatedMap.set(t.key, t.value);
          }
        }

        // Build upsert rows — dedupe by (namespace, key) to avoid unique-constraint violations
        // when source TR rows happen to have duplicates
        const seen = new Set<string>();
        const upsertRows = chunk.map(original => ({
          namespace: original.namespace,
          key: original.key,
          language_code: targetCode,
          value: translatedMap.get(original.key) || original.value,
        })).filter(r => {
          const k = `${r.namespace}::${r.key}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        const { data: savedRows, error: upsertErr } = await supabase
          .from('translations')
          .upsert(upsertRows, { onConflict: 'namespace,key,language_code' })
          .select('id, namespace, key');

        if (upsertErr) {
          console.error(`[LanguageService] Upsert error:`, upsertErr);
        } else {
          savedCount += upsertRows.length;
          if (onChunkItems && savedRows) {
            const idMap = new Map<string, string>();
            for (const r of savedRows) idMap.set(`${r.namespace}::${r.key}`, r.id);
            const liveItems: LiveTranslationItem[] = chunk.map(c => ({
              id: idMap.get(`${c.namespace}::${c.key}`) || '',
              kind: 'ui' as const,
              namespace: c.namespace,
              key: c.key,
              language_code: targetCode,
              source_value: c.value,
              value: translatedMap.get(c.key) || c.value,
              ai_translated: translatedMap.has(c.key),
            }));
            onChunkItems(liveItems);
          }
        }

        console.log(`[LanguageService] Chunk ${Math.floor(i / CHUNK) + 1}: ${chunk.length} keys → ${translatedMap.size} AI translated, ${upsertRows.length} saved`);
      } catch (e: any) {
        console.error(`[LanguageService] Chunk error:`, e?.message || e);
      }

      done += chunk.length;
      onProgress?.(done, total);
    }

    // 4. Clear i18n cache so new translations take effect
    this.clearTranslationCache(targetCode);

    console.log(`[LanguageService] Done: ${savedCount}/${total} translations saved for ${targetCode}`);
    return savedCount;
  },

  /**
   * Translate only MISSING TR keys into a target language using AI.
   * Does NOT touch existing translations — only adds new ones.
   */
  async translateMissingForLanguage(
    targetCode: string,
    onProgress?: (done: number, total: number) => void,
    onChunkItems?: (items: LiveTranslationItem[]) => void
  ): Promise<number> {
    const { AiTranslationService } = await import('./aiTranslationService');

    // 1. Get ALL TR translations with pagination
    let trKeysRaw: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('translations')
        .select('namespace,key,value')
        .eq('language_code', 'tr')
        .order('namespace')
        .order('key')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      trKeysRaw.push(...data);
      if (data.length < PAGE) break;
    }

    if (trKeysRaw.length === 0) return 0;

    const seenSrc = new Set<string>();
    const trKeys = trKeysRaw.filter(r => {
      const k = `${r.namespace}::${r.key}`;
      if (seenSrc.has(k)) return false;
      seenSrc.add(k);
      return true;
    });

    // 2. Get existing translations for target language with pagination
    let existingKeys: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('translations')
        .select('namespace,key')
        .eq('language_code', targetCode)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      existingKeys.push(...data);
      if (data.length < PAGE) break;
    }

    // 3. Find missing keys
    const existingSet = new Set((existingKeys || []).map(e => `${e.namespace}::${e.key}`));
    const missingKeys = trKeys.filter(tr => !existingSet.has(`${tr.namespace}::${tr.key}`));

    console.log(`[LanguageService] ${targetCode}: ${missingKeys.length} missing keys out of ${trKeys.length} total`);

    if (missingKeys.length === 0) {
      onProgress?.(trKeys.length, trKeys.length);
      return 0;
    }

    // 4. Translate only missing keys in chunks
    const total = missingKeys.length;
    let done = 0;
    let savedCount = 0;
    const CHUNK = 15;

    for (let i = 0; i < missingKeys.length; i += CHUNK) {
      const chunk = missingKeys.slice(i, i + CHUNK);

      try {
        const translated = await AiTranslationService.translateBatch(
          chunk.map(c => ({ key: c.key, value: c.value })),
          [targetCode]
        );

        const translatedMap = new Map<string, string>();
        for (const t of translated) {
          if (t.value && t.value.trim()) {
            translatedMap.set(t.key, t.value);
          }
        }

        const seenM = new Set<string>();
        const upsertRows = chunk.map(original => ({
          namespace: original.namespace,
          key: original.key,
          language_code: targetCode,
          value: translatedMap.get(original.key) || original.value,
        })).filter(r => {
          const k = `${r.namespace}::${r.key}`;
          if (seenM.has(k)) return false;
          seenM.add(k);
          return true;
        });

        const { data: savedRows, error: upsertErr } = await supabase
          .from('translations')
          .upsert(upsertRows, { onConflict: 'namespace,key,language_code' })
          .select('id, namespace, key');

        if (!upsertErr) {
          savedCount += upsertRows.length;
          if (onChunkItems && savedRows) {
            const idMap = new Map<string, string>();
            for (const r of savedRows) idMap.set(`${r.namespace}::${r.key}`, r.id);
            const liveItems: LiveTranslationItem[] = chunk.map(c => ({
              id: idMap.get(`${c.namespace}::${c.key}`) || '',
              kind: 'ui' as const,
              namespace: c.namespace,
              key: c.key,
              language_code: targetCode,
              source_value: c.value,
              value: translatedMap.get(c.key) || c.value,
              ai_translated: translatedMap.has(c.key),
            }));
            onChunkItems(liveItems);
          }
        }
      } catch (e: any) {
        console.error(`[LanguageService] Missing chunk error:`, e?.message || e);
      }

      done += chunk.length;
      onProgress?.(done, total);
    }

    this.clearTranslationCache(targetCode);
    console.log(`[LanguageService] Missing done: ${savedCount}/${total} new translations for ${targetCode}`);
    return savedCount;
  },

  /**
   * Clear i18n frontend cache for a language so new translations load immediately.
   */
  clearTranslationCache(langCode?: string) {
    try {
      const prefix = 'cafepaste_translations_';
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          if (!langCode || key.includes(`${langCode}_`)) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      console.log(`[LanguageService] Cleared ${keysToRemove.length} cache entries`);
    } catch { /* ignore */ }
    // Bellek cache'ini de temizle (localStorage tek basina yetmiyor) + i18n'i
    // canli yeniden yukle ki edit ANINDA on sayfaya yansisin.
    (async () => {
      try {
        const { clearMemoryTranslationCache } = await import('../../i18n/supabaseBackend');
        clearMemoryTranslationCache(langCode);
      } catch { /* ignore */ }
      try {
        const i18n = (await import('../../i18n')).default;
        await i18n.reloadResources(langCode ? [langCode] : undefined);
      } catch { /* ignore */ }
    })();
  },

  /**
   * Get translation completion stats for each non-TR language.
   *
   * Doğru hesap: "TR'de bulunan key sayısı" (total) vs "o dilde **aynı key'lerden**
   * kaçı çevrilmiş" (translated). Sadece satır sayısı kıyaslamak yanıltıcı —
   * orphan key'ler (TR'den silinmiş ama diğer dilde kalmış) yüzdeyi 100'ün
   * üstüne çıkartabiliyordu.
   *
   * Set intersection üzerinden gerçek örtüşmeyi sayıyoruz. Supabase 1000 satır
   * limiti için sayfalı çekim yapıyoruz (translations tablosu genelde birkaç
   * binlik, namespace+key kolonları indeksli).
   */
  async getTranslationStats(): Promise<Record<string, { translated: number; total: number }>> {
    const PAGE_SIZE = 1000;

    // TR key set'ini sayfalı topla — namespace.key birleşimi unique key kabul edilir.
    const trKeys = new Set<string>();
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('translations')
        .select('namespace,key')
        .eq('language_code', 'tr')
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data) break;
      for (const row of data) {
        trKeys.add(`${(row as any).namespace}::${(row as any).key}`);
      }
      if (data.length < PAGE_SIZE) break;
    }

    const total = trKeys.size;
    if (total === 0) return {};

    // Get all active non-TR languages
    const activeLangs = (await this.getActive()).filter(l => l.code !== 'tr');
    const stats: Record<string, { translated: number; total: number }> = {};

    await Promise.all(
      activeLangs.map(async (lang) => {
        let translated = 0;
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error } = await supabase
            .from('translations')
            .select('namespace,key,value')
            .eq('language_code', lang.code)
            .range(from, from + PAGE_SIZE - 1);
          if (error || !data) break;
          for (const row of data) {
            const k = `${(row as any).namespace}::${(row as any).key}`;
            const val = (row as any).value;
            // Yalnızca TR'de de var olan ve boş olmayan değerleri "çevrilmiş" say.
            if (trKeys.has(k) && typeof val === 'string' && val.trim() !== '') {
              translated++;
            }
          }
          if (data.length < PAGE_SIZE) break;
        }
        stats[lang.code] = { translated, total };
      })
    );

    return stats;
  },

  invalidateCache,

  /**
   * Sync bundled i18n JSON keys into the translations table (TR only, missing keys).
   * Flattens nested objects into dot.notation keys. Uses ON CONFLICT DO NOTHING.
   * Returns the count of inserted rows. Call this whenever new keys are added to JSON
   * so the admin panel and AI translate flows can see them.
   */
  async syncBundledKeysToDb(): Promise<{ inserted: number; total: number }> {
    const namespaces: Record<string, any> = {
      common: (await import('../../i18n/locales/tr/common.json')).default,
      offer: (await import('../../i18n/locales/tr/offer.json')).default,
      payment: (await import('../../i18n/locales/tr/payment.json')).default,
      validation: (await import('../../i18n/locales/tr/validation.json')).default,
      influencer: (await import('../../i18n/locales/tr/influencer.json')).default,
      // Aday yüzeyleri. Buraya EKLENMEZSE anahtarlar translations tablosuna hiç
      // düşmez ve diğer 6 dil LanguageManager'dan doldurulamaz — sayfa yabancı
      // adaya Türkçe görünür.
      interview: (await import('../../i18n/locales/tr/interview.json')).default,
      // İşe alım portalı: bu satır BAŞTAN BERİ eksikti, bu yüzden onboarding
      // anahtarları hiçbir zaman çeviri tablosuna düşmedi.
      onboarding: (await import('../../i18n/locales/tr/onboarding.json')).default,
      // Aday kariyer portalı (/career/:handle).
      career: (await import('../../i18n/locales/tr/career.json')).default,
      contact: (await import('../../i18n/locales/tr/contact.json')).default,
      offerpdf: (await import('../../i18n/locales/tr/offer.json')).default, // actually offerpdf maps to offer in i18n
    };

    function flatten(obj: any, prefix = ''): { key: string; value: string }[] {
      const out: { key: string; value: string }[] = [];
      for (const [k, v] of Object.entries(obj || {})) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          out.push(...flatten(v, fullKey));
        } else if (typeof v === 'string') {
          out.push({ key: fullKey, value: v });
        }
      }
      return out;
    }

    const seenK = new Set<string>();
    const rows: { namespace: string; key: string; language_code: string; value: string }[] = [];
    for (const [ns, json] of Object.entries(namespaces)) {
      for (const { key, value } of flatten(json)) {
        const k = `${ns}::${key}`;
        if (seenK.has(k)) continue;
        seenK.add(k);
        rows.push({ namespace: ns, key, language_code: 'tr', value });
      }
    }

    if (rows.length === 0) return { inserted: 0, total: 0 };

    // Fetch existing TR rows (value dahil) — eksikleri eklemek + BOZUK kaynaklari
    // (deger == anahtar adi; eski saveMissing kirliligi) bundle'daki dogru
    // metinle duzeltmek icin.
    const existingValue = new Map<string, string>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('translations')
        .select('namespace, key, value')
        .eq('language_code', 'tr')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      data.forEach(r => existingValue.set(`${r.namespace}::${r.key}`, r.value));
      if (data.length < PAGE) break;
    }

    // Eksik (DB'de hic yok) VEYA bozuk (DB degeri anahtarin kendisi) satirlar.
    const toWrite = rows.filter(r => {
      const k = `${r.namespace}::${r.key}`;
      if (!existingValue.has(k)) return true;            // eksik → ekle
      const cur = existingValue.get(k);
      return cur === r.key || cur === k;                 // bozuk kaynak → bundle ile duzelt
    });
    if (toWrite.length === 0) return { inserted: 0, total: rows.length };

    // Upsert (overwrite): eksikleri ekler, bozuk kaynaklari bundle degeriyle
    // duzeltir. Saglam satirlar toWrite'a girmedigi icin admin TR edit'leri
    // korunur.
    const CHUNK = 200;
    let inserted = 0;
    for (let i = 0; i < toWrite.length; i += CHUNK) {
      const chunk = toWrite.slice(i, i + CHUNK);
      const { error } = await supabase
        .from('translations')
        .upsert(chunk, { onConflict: 'namespace,key,language_code' });
      if (error) throw error;
      inserted += chunk.length;
    }

    invalidateCache();
    return { inserted, total: rows.length };
  },
};
