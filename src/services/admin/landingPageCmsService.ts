import { supabase } from '../../lib/supabase/client';
import { LandingPageSection, LandingPageItem } from '../../types';
import { compressImageToWebp, formatBytes } from '../../utils/imageCompress';

export const LandingPageCmsService = {

    // ─── SECTIONS ────────────────────────────────────────────────

    async listSections(lang?: string): Promise<LandingPageSection[]> {
        let query = supabase
            .from('landing_page_sections')
            .select('*, items:landing_page_items(*)')
            .order('sort_order', { ascending: true });
        if (lang) query = query.eq('language_code', lang);
        const { data, error } = await query;

        if (error) throw error;

        data?.forEach(section => {
            if (section.items) {
                section.items.sort((a: LandingPageItem, b: LandingPageItem) => a.sort_order - b.sort_order);
            }
        });

        return data as LandingPageSection[];
    },

    async getSection(id: string): Promise<LandingPageSection> {
        const { data, error } = await supabase
            .from('landing_page_sections')
            .select('*, items:landing_page_items(*)')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (data?.items) {
            data.items.sort((a: LandingPageItem, b: LandingPageItem) => a.sort_order - b.sort_order);
        }

        return data as LandingPageSection;
    },

    async createSection(section: Partial<LandingPageSection>): Promise<LandingPageSection> {
        const { data, error } = await supabase
            .from('landing_page_sections')
            .insert([section])
            .select()
            .single();
        if (error) throw error;
        return data as LandingPageSection;
    },

    async updateSection(id: string, updates: Partial<LandingPageSection>): Promise<LandingPageSection> {
        const { data, error } = await supabase
            .from('landing_page_sections')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as LandingPageSection;
    },

    async deleteSection(id: string): Promise<void> {
        const { error } = await supabase.from('landing_page_sections').delete().eq('id', id);
        if (error) throw error;
    },

    async reorderSections(orderedIds: string[]): Promise<void> {
        const updates = orderedIds.map((id, index) => ({
            id,
            sort_order: index * 10,
            updated_at: new Date().toISOString(),
        }));

        for (const u of updates) {
            const { error } = await supabase
                .from('landing_page_sections')
                .update({ sort_order: u.sort_order, updated_at: u.updated_at })
                .eq('id', u.id);
            if (error) throw error;
        }
    },

    async deleteAllSections(): Promise<void> {
        const { error } = await supabase
            .from('landing_page_sections')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
    },

    // ─── ITEMS ───────────────────────────────────────────────────

    async createItem(item: Partial<LandingPageItem>): Promise<LandingPageItem> {
        const { data, error } = await supabase
            .from('landing_page_items')
            .insert([item])
            .select()
            .single();
        if (error) throw error;
        return data as LandingPageItem;
    },

    async updateItem(id: string, updates: Partial<LandingPageItem>): Promise<LandingPageItem> {
        const { data, error } = await supabase
            .from('landing_page_items')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as LandingPageItem;
    },

    async deleteItem(id: string): Promise<void> {
        const { error } = await supabase.from('landing_page_items').delete().eq('id', id);
        if (error) throw error;
    },

    async reorderItems(sectionId: string, orderedIds: string[]): Promise<void> {
        for (let i = 0; i < orderedIds.length; i++) {
            const { error } = await supabase
                .from('landing_page_items')
                .update({ sort_order: i * 10, updated_at: new Date().toISOString() })
                .eq('id', orderedIds[i]);
            if (error) throw error;
        }
    },

    // ─── LANGUAGE ──────────────────────────────────────────────

    async listSectionsForLanguage(lang: string): Promise<LandingPageSection[]> {
        const { data, error } = await supabase
            .from('landing_page_sections')
            .select('*, items:landing_page_items(*)')
            .eq('language_code', lang)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        data?.forEach(section => {
            if (section.items) {
                section.items.sort((a: LandingPageItem, b: LandingPageItem) => a.sort_order - b.sort_order);
            }
        });
        return data as LandingPageSection[];
    },

    async translateLandingToLanguage(
        targetLang: string,
        onProgress?: (step: string) => void
    ): Promise<number> {
        const { AiTranslationService } = await import('./aiTranslationService');

        onProgress?.('Türkçe içerik yükleniyor...');
        const trSections = await this.listSectionsForLanguage('tr');
        console.log(`[LandingCMS] TR sections found: ${trSections.length}`);
        if (trSections.length === 0) {
            console.warn('[LandingCMS] No TR sections found, skipping landing translation');
            return 0;
        }

        // Delete existing target language sections
        onProgress?.(`Mevcut ${targetLang.toUpperCase()} içerik temizleniyor...`);
        const existing = await this.listSectionsForLanguage(targetLang);
        console.log(`[LandingCMS] Existing ${targetLang} sections to delete: ${existing.length}`);
        for (const sec of existing) {
            await this.deleteSection(sec.id);
        }

        // Collect all translatable strings
        onProgress?.('Çeviriler hazırlanıyor...');
        const batch: { key: string; value: string }[] = [];

        // Fields that should NOT be translated (URLs, colors, technical values)
        const SKIP_CONFIG_FIELDS = new Set(['url', 'image', 'video', 'color', 'target', 'href', 'src', 'icon', 'logo', 'bg', 'background', 'gradient', 'link', 'anchor']);
        const shouldTranslateField = (field: string) => !SKIP_CONFIG_FIELDS.has(field) && !field.includes('url') && !field.includes('image') && !field.includes('video') && !field.includes('color') && !field.includes('_id') && !field.includes('target') && !field.includes('href') && !field.includes('link') && !field.includes('anchor');

        trSections.forEach((sec, sIdx) => {
            if (sec.title) batch.push({ key: `s${sIdx}_title`, value: sec.title });
            const cfg = sec.config || {};

            // Dynamically translate ALL string config fields
            for (const [field, val] of Object.entries(cfg)) {
                if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                    batch.push({ key: `s${sIdx}_cfg_${field}`, value: val });
                } else if (Array.isArray(val)) {
                    val.forEach((arrItem: unknown, arrIdx: number) => {
                        if (typeof arrItem === 'string' && arrItem.trim()) {
                            batch.push({ key: `s${sIdx}_cfg_${field}_${arrIdx}`, value: arrItem });
                        }
                    });
                }
            }

            (sec.items || []).forEach((item, iIdx) => {
                if (item.title) batch.push({ key: `s${sIdx}_i${iIdx}_title`, value: item.title });
                if (item.description) batch.push({ key: `s${sIdx}_i${iIdx}_desc`, value: item.description });
                if (item.value_text) batch.push({ key: `s${sIdx}_i${iIdx}_val`, value: item.value_text });
                const extra = item.extra || {};

                // Dynamically translate ALL string extra fields
                for (const [field, val] of Object.entries(extra)) {
                    if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                        batch.push({ key: `s${sIdx}_i${iIdx}_extra_${field}`, value: val });
                    } else if (Array.isArray(val)) {
                        (val as unknown[]).forEach((arrItem: unknown, arrIdx: number) => {
                            if (typeof arrItem === 'string' && arrItem.trim()) {
                                batch.push({ key: `s${sIdx}_i${iIdx}_extra_${field}_${arrIdx}`, value: arrItem as string });
                            }
                        });
                    }
                }
            });
        });

        // Translate with AI
        onProgress?.(`${batch.length} metin çevriliyor...`);
        let translatedMap = new Map<string, string>();
        try {
            console.log(`[LandingCMS] Sending ${batch.length} items to AI for ${targetLang}`);
            const results = await AiTranslationService.translateBatch(batch, [targetLang]);
            console.log(`[LandingCMS] AI returned ${results.length} translations`);
            results.forEach(r => {
                if (r.value && r.value.trim()) {
                    translatedMap.set(r.key, r.value);
                }
            });
            console.log(`[LandingCMS] translatedMap size: ${translatedMap.size}/${batch.length}`);
        } catch (e) {
            console.error('[LandingCMS] AI translation failed:', e);
        }

        const t = (key: string, fallback: string | null) => translatedMap.get(key) || fallback;

        // Create translated sections + items
        onProgress?.('Çevrilmiş bölümler oluşturuluyor...');
        let created = 0;

        for (let sIdx = 0; sIdx < trSections.length; sIdx++) {
            const src = trSections[sIdx];
            const cfg = { ...(src.config || {}) };

            // Apply translations to ALL string config fields dynamically
            for (const [field, val] of Object.entries(cfg)) {
                if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                    cfg[field] = t(`s${sIdx}_cfg_${field}`, val);
                } else if (Array.isArray(val)) {
                    cfg[field] = (val as unknown[]).map((arrItem: unknown, arrIdx: number) => {
                        if (typeof arrItem === 'string' && arrItem.trim()) {
                            return t(`s${sIdx}_cfg_${field}_${arrIdx}`, arrItem);
                        }
                        return arrItem;
                    });
                }
            }

            const newSec = await this.createSection({
                section_type: src.section_type,
                title: t(`s${sIdx}_title`, src.title),
                is_active: src.is_active,
                sort_order: src.sort_order,
                config: cfg,
                language_code: targetLang,
            });

            for (let iIdx = 0; iIdx < (src.items || []).length; iIdx++) {
                const item = src.items![iIdx];
                const extra = { ...(item.extra || {}) };

                // Apply translations to ALL string extra fields dynamically
                for (const [field, val] of Object.entries(extra)) {
                    if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                        extra[field] = t(`s${sIdx}_i${iIdx}_extra_${field}`, val);
                    } else if (Array.isArray(val)) {
                        extra[field] = (val as unknown[]).map((arrItem: unknown, arrIdx: number) => {
                            if (typeof arrItem === 'string' && arrItem.trim()) {
                                return t(`s${sIdx}_i${iIdx}_extra_${field}_${arrIdx}`, arrItem as string);
                            }
                            return arrItem;
                        });
                    }
                }

                await this.createItem({
                    section_id: newSec.id,
                    title: t(`s${sIdx}_i${iIdx}_title`, item.title),
                    description: t(`s${sIdx}_i${iIdx}_desc`, item.description),
                    value_text: t(`s${sIdx}_i${iIdx}_val`, item.value_text),
                    media_url: item.media_url,
                    icon: item.icon,
                    extra,
                    is_active: item.is_active,
                    sort_order: item.sort_order,
                });
            }
            created++;
        }

        onProgress?.('Tamamlandı!');
        return created;
    },

    // ─── CONFIG_I18N (inline multi-language) ───────────────────────

    /** Save a language-specific config for a section */
    async saveLanguageConfig(sectionId: string, lang: string, configData: Record<string, any>): Promise<void> {
        // First fetch current config_i18n
        const { data: current, error: fetchErr } = await supabase
            .from('landing_page_sections')
            .select('config_i18n')
            .eq('id', sectionId)
            .single();
        if (fetchErr) throw fetchErr;

        const updated = { ...(current?.config_i18n || {}), [lang]: configData };
        const { error } = await supabase
            .from('landing_page_sections')
            .update({ config_i18n: updated, updated_at: new Date().toISOString() })
            .eq('id', sectionId);
        if (error) throw error;
    },

    /** Save a language-specific data for an item */
    async saveItemLanguageData(itemId: string, lang: string, data: Record<string, any>): Promise<void> {
        const { data: current, error: fetchErr } = await supabase
            .from('landing_page_items')
            .select('item_i18n')
            .eq('id', itemId)
            .single();
        if (fetchErr) throw fetchErr;

        const updated = { ...(current?.item_i18n || {}), [lang]: data };
        const { error } = await supabase
            .from('landing_page_items')
            .update({ item_i18n: updated, updated_at: new Date().toISOString() })
            .eq('id', itemId);
        if (error) throw error;
    },

    /** Translate all sections to a target language and save into config_i18n.
     *  Pass `sectionFilter` to translate only a subset (e.g. a single section). */
    async translateAllToI18n(
        targetLang: string,
        onProgress?: (step: string) => void,
        onChunkItems?: (items: import('./languageService').LiveTranslationItem[]) => void,
        sectionFilter?: (sec: LandingPageSection) => boolean
    ): Promise<number> {
        const { AiTranslationService } = await import('./aiTranslationService');

        onProgress?.('Turkce icerik yukleniyor...');

        // Get master sections (TR or ones without language_code)
        const allSections = await this.listSections();
        let masterSections = allSections.filter(s => !s.language_code || s.language_code === 'tr');
        if (sectionFilter) masterSections = masterSections.filter(sectionFilter);
        if (masterSections.length === 0) return 0;

        // Clean up old per-language rows for this target (prevents conflicts with config_i18n approach)
        const oldLangSections = allSections.filter(s => s.language_code === targetLang);
        for (const sec of oldLangSections) {
            await this.deleteSection(sec.id);
        }

        // Fields that should NOT be translated
        const SKIP_CONFIG_FIELDS = new Set(['url', 'image', 'video', 'color', 'target', 'href', 'src', 'icon', 'logo', 'bg', 'background', 'gradient', 'link', 'anchor']);
        const shouldTranslateField = (field: string) => !SKIP_CONFIG_FIELDS.has(field) && !field.includes('url') && !field.includes('image') && !field.includes('video') && !field.includes('color') && !field.includes('_id') && !field.includes('target') && !field.includes('href') && !field.includes('link') && !field.includes('anchor');

        // Collect all translatable strings
        onProgress?.('Ceviriler hazirlaniyor...');
        const batch: { key: string; value: string }[] = [];

        masterSections.forEach((sec, sIdx) => {
            const cfg = sec.config || {};
            for (const [field, val] of Object.entries(cfg)) {
                if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                    batch.push({ key: `s${sIdx}_cfg_${field}`, value: val });
                } else if (Array.isArray(val)) {
                    val.forEach((arrItem: unknown, arrIdx: number) => {
                        if (typeof arrItem === 'string' && (arrItem as string).trim()) {
                            batch.push({ key: `s${sIdx}_cfg_${field}_${arrIdx}`, value: arrItem as string });
                        }
                    });
                }
            }

            (sec.items || []).forEach((item, iIdx) => {
                if (item.title) batch.push({ key: `s${sIdx}_i${iIdx}_title`, value: item.title });
                if (item.description) batch.push({ key: `s${sIdx}_i${iIdx}_desc`, value: item.description });
                if (item.value_text) batch.push({ key: `s${sIdx}_i${iIdx}_val`, value: item.value_text });
                const extra = item.extra || {};
                for (const [field, val] of Object.entries(extra)) {
                    if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                        batch.push({ key: `s${sIdx}_i${iIdx}_extra_${field}`, value: val });
                    } else if (Array.isArray(val)) {
                        (val as unknown[]).forEach((arrItem: unknown, arrIdx: number) => {
                            if (typeof arrItem === 'string' && arrItem.trim()) {
                                batch.push({ key: `s${sIdx}_i${iIdx}_extra_${field}_${arrIdx}`, value: arrItem as string });
                            }
                        });
                    }
                }
            });
        });

        if (batch.length === 0) return 0;

        // Translate with AI
        onProgress?.(`${batch.length} metin cevriliyor...`);
        const translatedMap = new Map<string, string>();
        try {
            const results = await AiTranslationService.translateBatch(batch, [targetLang]);
            results.forEach(r => {
                if (r.value?.trim()) translatedMap.set(r.key, r.value);
            });
        } catch (e) {
            console.error('[LandingCMS] AI translation failed:', e);
        }

        // Returns translation if AI provided one (not falling back to TR source) — null otherwise
        const tStrict = (key: string): string | null => {
            const v = translatedMap.get(key);
            return v && v.trim() ? v : null;
        };

        // Save translated configs into config_i18n[targetLang]
        onProgress?.('Ceviriler kaydediliyor...');
        let saved = 0;

        for (let sIdx = 0; sIdx < masterSections.length; sIdx++) {
            const sec = masterSections[sIdx];
            const translatedConfig: Record<string, any> = {};

            // Build translated config — ONLY include fields AI actually translated.
            // Missing fields are absent in config_i18n[lang], so reader falls back to TR source
            // and admin panel can clearly show them as "missing translation".
            for (const [field, val] of Object.entries(sec.config || {})) {
                if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                    const translated = tStrict(`s${sIdx}_cfg_${field}`);
                    if (translated) translatedConfig[field] = translated;
                } else if (Array.isArray(val)) {
                    const arr = (val as unknown[]).map((arrItem: unknown, arrIdx: number) => {
                        if (typeof arrItem === 'string' && (arrItem as string).trim()) {
                            return tStrict(`s${sIdx}_cfg_${field}_${arrIdx}`) || arrItem;
                        }
                        return arrItem;
                    });
                    // Only persist array if at least one item was actually translated
                    const anyTranslated = (val as unknown[]).some((arrItem: unknown, arrIdx: number) =>
                        typeof arrItem === 'string' && (arrItem as string).trim() && !!tStrict(`s${sIdx}_cfg_${field}_${arrIdx}`)
                    );
                    if (anyTranslated) translatedConfig[field] = arr;
                }
                // Note: non-string/non-array values (numbers, booleans, urls) intentionally NOT copied
                // — reader merges base config + config_i18n[lang], so missing keys fall back automatically.
            }

            // Only persist if at least one field was actually translated
            if (Object.keys(translatedConfig).length > 0) {
                await this.saveLanguageConfig(sec.id, targetLang, translatedConfig);
            }

            // Emit live items for config fields
            if (onChunkItems) {
                const cfgItems: import('./languageService').LiveTranslationItem[] = [];
                for (const [field, val] of Object.entries(sec.config || {})) {
                    if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                        cfgItems.push({
                            id: `landing-cfg:${sec.id}:${field}`,
                            kind: 'landing-cfg',
                            ref_id: sec.id,
                            field,
                            namespace: `landing:${sec.section_type}`,
                            key: field,
                            language_code: targetLang,
                            source_value: val,
                            value: translatedConfig[field] || val,
                            ai_translated: translatedMap.has(`s${sIdx}_cfg_${field}`),
                        });
                    }
                }
                if (cfgItems.length > 0) onChunkItems(cfgItems);
            }

            // Save translated items into item_i18n[targetLang] — only fields AI actually translated
            for (let iIdx = 0; iIdx < (sec.items || []).length; iIdx++) {
                const item = sec.items![iIdx];
                const translatedExtra: Record<string, any> = {};
                for (const [field, val] of Object.entries(item.extra || {})) {
                    if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                        const v = tStrict(`s${sIdx}_i${iIdx}_extra_${field}`);
                        if (v) translatedExtra[field] = v;
                    } else if (Array.isArray(val)) {
                        const anyTranslated = (val as unknown[]).some((arrItem: unknown, arrIdx: number) =>
                            typeof arrItem === 'string' && arrItem.trim() && !!tStrict(`s${sIdx}_i${iIdx}_extra_${field}_${arrIdx}`)
                        );
                        if (anyTranslated) {
                            translatedExtra[field] = (val as unknown[]).map((arrItem: unknown, arrIdx: number) => {
                                if (typeof arrItem === 'string' && arrItem.trim()) {
                                    return tStrict(`s${sIdx}_i${iIdx}_extra_${field}_${arrIdx}`) || arrItem;
                                }
                                return arrItem;
                            });
                        }
                    }
                }

                const itemTranslated: Record<string, any> = {};
                const titleT = tStrict(`s${sIdx}_i${iIdx}_title`);
                const descT = tStrict(`s${sIdx}_i${iIdx}_desc`);
                const valT = tStrict(`s${sIdx}_i${iIdx}_val`);
                if (titleT) itemTranslated.title = titleT;
                if (descT) itemTranslated.description = descT;
                if (valT) itemTranslated.value_text = valT;
                if (Object.keys(translatedExtra).length > 0) itemTranslated.extra = translatedExtra;

                // Only save if there's something new
                if (Object.keys(itemTranslated).length > 0) {
                    await this.saveItemLanguageData(item.id, targetLang, itemTranslated);
                }

                // Emit live items for this item's translatable fields
                if (onChunkItems) {
                    const itItems: import('./languageService').LiveTranslationItem[] = [];
                    const push = (field: string, src: string | null | undefined, dst: string | null | undefined, key: string, isExtra = false) => {
                        if (!src || typeof src !== 'string' || !src.trim()) return;
                        itItems.push({
                            id: `landing-item:${item.id}:${isExtra ? 'extra.' + field : field}`,
                            kind: 'landing-item',
                            ref_id: item.id,
                            field,
                            is_extra: isExtra,
                            namespace: `landing:${sec.section_type}#${iIdx + 1}`,
                            key: isExtra ? `extra.${field}` : field,
                            language_code: targetLang,
                            source_value: src,
                            value: dst || src,
                            ai_translated: translatedMap.has(key),
                        });
                    };
                    push('title', item.title, itemTranslated.title, `s${sIdx}_i${iIdx}_title`);
                    push('description', item.description, itemTranslated.description, `s${sIdx}_i${iIdx}_desc`);
                    push('value_text', item.value_text, itemTranslated.value_text, `s${sIdx}_i${iIdx}_val`);
                    for (const [field, val] of Object.entries(item.extra || {})) {
                        if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                            push(field, val, translatedExtra[field], `s${sIdx}_i${iIdx}_extra_${field}`, true);
                        }
                    }
                    if (itItems.length > 0) onChunkItems(itItems);
                }
            }
            saved++;
        }

        onProgress?.('Tamamlandi!');
        return saved;
    },

    /** Translate only MISSING landing fields to a target language (config_i18n approach).
     *  Does NOT overwrite existing translations. */
    async translateMissingToI18n(
        targetLang: string,
        onProgress?: (step: string) => void,
        onChunkItems?: (items: import('./languageService').LiveTranslationItem[]) => void
    ): Promise<number> {
        const { AiTranslationService } = await import('./aiTranslationService');

        onProgress?.('Turkce icerik yukleniyor...');
        const allSections = await this.listSections();
        const masterSections = allSections.filter(s => !s.language_code || s.language_code === 'tr');
        if (masterSections.length === 0) return 0;

        const SKIP_CONFIG_FIELDS = new Set(['url', 'image', 'video', 'color', 'target', 'href', 'src', 'icon', 'logo', 'bg', 'background', 'gradient', 'link', 'anchor']);
        const shouldTranslateField = (field: string) => !SKIP_CONFIG_FIELDS.has(field) && !field.includes('url') && !field.includes('image') && !field.includes('video') && !field.includes('color') && !field.includes('_id') && !field.includes('target') && !field.includes('href') && !field.includes('link') && !field.includes('anchor');

        // Collect only MISSING translatable strings
        onProgress?.('Eksik ceviriler belirleniyor...');
        const batch: { key: string; value: string }[] = [];

        masterSections.forEach((sec, sIdx) => {
            const existingCfg = sec.config_i18n?.[targetLang] || {};
            const cfg = sec.config || {};

            for (const [field, val] of Object.entries(cfg)) {
                if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                    if (!existingCfg[field]) {
                        batch.push({ key: `s${sIdx}_cfg_${field}`, value: val });
                    }
                } else if (Array.isArray(val)) {
                    val.forEach((arrItem: unknown, arrIdx: number) => {
                        if (typeof arrItem === 'string' && (arrItem as string).trim()) {
                            const existingArr = existingCfg[field];
                            if (!Array.isArray(existingArr) || !existingArr[arrIdx]) {
                                batch.push({ key: `s${sIdx}_cfg_${field}_${arrIdx}`, value: arrItem as string });
                            }
                        }
                    });
                }
            }

            (sec.items || []).forEach((item, iIdx) => {
                const existingItem = item.item_i18n?.[targetLang] || {};
                if (item.title && !existingItem.title) batch.push({ key: `s${sIdx}_i${iIdx}_title`, value: item.title });
                if (item.description && !existingItem.description) batch.push({ key: `s${sIdx}_i${iIdx}_desc`, value: item.description });
                if (item.value_text && !existingItem.value_text) batch.push({ key: `s${sIdx}_i${iIdx}_val`, value: item.value_text });

                const extra = item.extra || {};
                const existingExtra = existingItem.extra || {};
                for (const [field, val] of Object.entries(extra)) {
                    if (typeof val === 'string' && val.trim() && shouldTranslateField(field) && !existingExtra[field]) {
                        batch.push({ key: `s${sIdx}_i${iIdx}_extra_${field}`, value: val });
                    } else if (Array.isArray(val)) {
                        (val as unknown[]).forEach((arrItem: unknown, arrIdx: number) => {
                            if (typeof arrItem === 'string' && arrItem.trim()) {
                                const existingArr = existingExtra[field];
                                if (!Array.isArray(existingArr) || !existingArr[arrIdx]) {
                                    batch.push({ key: `s${sIdx}_i${iIdx}_extra_${field}_${arrIdx}`, value: arrItem as string });
                                }
                            }
                        });
                    }
                }
            });
        });

        if (batch.length === 0) {
            onProgress?.('Eksik ceviri yok!');
            return masterSections.length;
        }

        // Translate missing items
        onProgress?.(`${batch.length} eksik metin cevriliyor...`);
        const translatedMap = new Map<string, string>();
        try {
            const results = await AiTranslationService.translateBatch(batch, [targetLang]);
            results.forEach(r => {
                if (r.value?.trim()) translatedMap.set(r.key, r.value);
            });
        } catch (e) {
            console.error('[LandingCMS] AI translation failed:', e);
        }

        const t = (key: string, fallback: string | null) => translatedMap.get(key) || fallback;

        // Merge translations into existing config_i18n (don't overwrite)
        onProgress?.('Ceviriler kaydediliyor...');
        let saved = 0;

        for (let sIdx = 0; sIdx < masterSections.length; sIdx++) {
            const sec = masterSections[sIdx];
            const existingCfg = { ...(sec.config_i18n?.[targetLang] || {}) };
            const cfg = sec.config || {};

            let hasNewConfig = false;
            for (const [field, val] of Object.entries(cfg)) {
                if (typeof val === 'string' && val.trim() && shouldTranslateField(field) && !existingCfg[field]) {
                    const translated = t(`s${sIdx}_cfg_${field}`, null);
                    if (translated) { existingCfg[field] = translated; hasNewConfig = true; }
                } else if (Array.isArray(val)) {
                    // Build translated array; only persist if at least one item changed
                    const arr = (existingCfg[field] && Array.isArray(existingCfg[field]))
                        ? [...existingCfg[field]]
                        : [];
                    let arrChanged = false;
                    (val as unknown[]).forEach((arrItem: unknown, arrIdx: number) => {
                        if (typeof arrItem === 'string' && (arrItem as string).trim() && !arr[arrIdx]) {
                            const translated = t(`s${sIdx}_cfg_${field}_${arrIdx}`, null);
                            if (translated) { arr[arrIdx] = translated; arrChanged = true; }
                        }
                    });
                    if (arrChanged) {
                        existingCfg[field] = arr;
                        hasNewConfig = true;
                    }
                }
            }
            // NOTE: Do NOT copy untranslated TR fields into config_i18n — reader (resolveConfig)
            // already falls back to base config for missing fields, and copying TR values would
            // make admin panel show fake "translated" rows.

            if (hasNewConfig) {
                await this.saveLanguageConfig(sec.id, targetLang, existingCfg);
            }

            // Emit live items for the (possibly merged) config
            if (onChunkItems) {
                const cfgItems: import('./languageService').LiveTranslationItem[] = [];
                for (const [field, val] of Object.entries(cfg)) {
                    if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                        cfgItems.push({
                            id: `landing-cfg:${sec.id}:${field}`,
                            kind: 'landing-cfg',
                            ref_id: sec.id,
                            field,
                            namespace: `landing:${sec.section_type}`,
                            key: field,
                            language_code: targetLang,
                            source_value: val,
                            value: existingCfg[field] || val,
                            ai_translated: translatedMap.has(`s${sIdx}_cfg_${field}`),
                        });
                    }
                }
                if (cfgItems.length > 0) onChunkItems(cfgItems);
            }

            // Items
            for (let iIdx = 0; iIdx < (sec.items || []).length; iIdx++) {
                const item = sec.items![iIdx];
                const existingItem = { ...(item.item_i18n?.[targetLang] || {}) };
                let hasNewItem = false;

                if (item.title && !existingItem.title) {
                    const v = t(`s${sIdx}_i${iIdx}_title`, null);
                    if (v) { existingItem.title = v; hasNewItem = true; }
                }
                if (item.description && !existingItem.description) {
                    const v = t(`s${sIdx}_i${iIdx}_desc`, null);
                    if (v) { existingItem.description = v; hasNewItem = true; }
                }
                if (item.value_text && !existingItem.value_text) {
                    const v = t(`s${sIdx}_i${iIdx}_val`, null);
                    if (v) { existingItem.value_text = v; hasNewItem = true; }
                }

                const extra = item.extra || {};
                const existingExtra = { ...(existingItem.extra || {}) };
                for (const [field, val] of Object.entries(extra)) {
                    if (typeof val === 'string' && val.trim() && shouldTranslateField(field) && !existingExtra[field]) {
                        const v = t(`s${sIdx}_i${iIdx}_extra_${field}`, null);
                        if (v) { existingExtra[field] = v; hasNewItem = true; }
                    } else if (Array.isArray(val)) {
                        if (!existingExtra[field]) existingExtra[field] = [...val];
                        (val as unknown[]).forEach((arrItem: unknown, arrIdx: number) => {
                            if (typeof arrItem === 'string' && arrItem.trim() && !existingExtra[field][arrIdx]) {
                                const v = t(`s${sIdx}_i${iIdx}_extra_${field}_${arrIdx}`, null);
                                if (v) { existingExtra[field][arrIdx] = v; hasNewItem = true; }
                            }
                        });
                    }
                }
                if (hasNewItem) {
                    existingItem.extra = existingExtra;
                    await this.saveItemLanguageData(item.id, targetLang, existingItem);
                }

                // Emit live items for this item
                if (onChunkItems) {
                    const itItems: import('./languageService').LiveTranslationItem[] = [];
                    const push = (field: string, src: string | null | undefined, dst: string | null | undefined, key: string, isExtra = false) => {
                        if (!src || typeof src !== 'string' || !src.trim()) return;
                        itItems.push({
                            id: `landing-item:${item.id}:${isExtra ? 'extra.' + field : field}`,
                            kind: 'landing-item',
                            ref_id: item.id,
                            field,
                            is_extra: isExtra,
                            namespace: `landing:${sec.section_type}#${iIdx + 1}`,
                            key: isExtra ? `extra.${field}` : field,
                            language_code: targetLang,
                            source_value: src,
                            value: (dst as string) || (src as string),
                            ai_translated: translatedMap.has(key),
                        });
                    };
                    push('title', item.title, existingItem.title, `s${sIdx}_i${iIdx}_title`);
                    push('description', item.description, existingItem.description, `s${sIdx}_i${iIdx}_desc`);
                    push('value_text', item.value_text, existingItem.value_text, `s${sIdx}_i${iIdx}_val`);
                    for (const [field, val] of Object.entries(item.extra || {})) {
                        if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                            push(field, val, existingExtra[field], `s${sIdx}_i${iIdx}_extra_${field}`, true);
                        }
                    }
                    if (itItems.length > 0) onChunkItems(itItems);
                }
            }
            saved++;
        }

        onProgress?.('Tamamlandi!');
        return saved;
    },

    // ─── PER-SECTION COPY (no AI, raw passthrough) ────────────────

    /**
     * Copy ONE landing section's content from source language to target language as-is.
     * No AI translation — useful when you want the same wording (e.g. brand names,
     * proper nouns) in another language slot, or want to seed a translation manually later.
     * Writes to config_i18n[targetLang] / item_i18n[targetLang] and mirrors variants.
     */
    async copySectionToLanguage(
        sectionId: string,
        sourceLang: string,
        targetLang: string
    ): Promise<{ copiedConfigFields: number; copiedItems: number }> {
        if (sourceLang === targetLang) return { copiedConfigFields: 0, copiedItems: 0 };

        const sec = await this.getSection(sectionId);
        if (!sec) throw new Error('Bolum bulunamadi.');

        const SKIP_CONFIG_FIELDS = new Set(['url', 'image', 'video', 'color', 'target', 'href', 'src', 'icon', 'logo', 'bg', 'background', 'gradient', 'link', 'anchor']);
        const isCopyableField = (field: string) =>
            !SKIP_CONFIG_FIELDS.has(field) &&
            !field.includes('url') && !field.includes('image') && !field.includes('video') &&
            !field.includes('color') && !field.includes('_id') && !field.startsWith('_');

        // Resolve source config (TR master OR config_i18n[sourceLang] merged over base)
        const baseConfig: Record<string, any> = sec.config || {};
        const sourceConfig: Record<string, any> = sourceLang === 'tr'
            ? baseConfig
            : { ...baseConfig, ...(sec.config_i18n?.[sourceLang] || {}) };

        // Build copied config (only translatable text-like fields)
        const copiedConfig: Record<string, any> = {};
        for (const [field, val] of Object.entries(sourceConfig)) {
            if (typeof val === 'string' && val.trim() && isCopyableField(field)) {
                copiedConfig[field] = val;
            } else if (Array.isArray(val) && val.some(v => typeof v === 'string' && v.trim())) {
                copiedConfig[field] = val;
            }
        }

        let copiedConfigFields = 0;
        if (Object.keys(copiedConfig).length > 0) {
            const existing = (sec.config_i18n?.[targetLang] || {}) as Record<string, any>;
            await this.saveLanguageConfig(sectionId, targetLang, { ...existing, ...copiedConfig });
            await this.mirrorVariantSectionConfig(sec.section_type, targetLang, copiedConfig);
            copiedConfigFields = Object.keys(copiedConfig).length;
        }

        // Items
        const items: LandingPageItem[] = sec.items || [];
        let copiedItems = 0;
        for (const item of items) {
            const sourceItem = sourceLang === 'tr'
                ? { title: item.title, description: item.description, value_text: item.value_text, extra: item.extra || {} }
                : {
                    title: item.item_i18n?.[sourceLang]?.title ?? item.title,
                    description: item.item_i18n?.[sourceLang]?.description ?? item.description,
                    value_text: item.item_i18n?.[sourceLang]?.value_text ?? item.value_text,
                    extra: { ...(item.extra || {}), ...(item.item_i18n?.[sourceLang]?.extra || {}) },
                };

            const itemPayload: Record<string, any> = {};
            if (sourceItem.title) itemPayload.title = sourceItem.title;
            if (sourceItem.description) itemPayload.description = sourceItem.description;
            if (sourceItem.value_text) itemPayload.value_text = sourceItem.value_text;

            const copiedExtra: Record<string, any> = {};
            for (const [field, val] of Object.entries(sourceItem.extra || {})) {
                if (typeof val === 'string' && val.trim() && isCopyableField(field)) {
                    copiedExtra[field] = val;
                } else if (Array.isArray(val) && val.some(v => typeof v === 'string' && v.trim())) {
                    copiedExtra[field] = val;
                }
            }
            if (Object.keys(copiedExtra).length > 0) itemPayload.extra = copiedExtra;

            if (Object.keys(itemPayload).length === 0) continue;

            const existing = (item.item_i18n?.[targetLang] || {}) as Record<string, any>;
            const merged = {
                ...existing,
                ...itemPayload,
                extra: { ...(existing.extra || {}), ...(itemPayload.extra || {}) },
            };
            await this.saveItemLanguageData(item.id, targetLang, merged);
            await this.mirrorVariantItemFields(sec.section_type, item.sort_order, targetLang, itemPayload);
            copiedItems++;
        }

        // Drop client caches
        try {
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith('cafepaste_landing_data_') || k.startsWith('cafepaste_variant')) {
                    localStorage.removeItem(k);
                }
            });
        } catch { /* ignore */ }

        return { copiedConfigFields, copiedItems };
    },

    // ─── PER-SECTION TRANSLATE (source-language aware) ────────────

    /**
     * Translate ONE landing section from a source language into a target language.
     * Source can be the master TR (`config` / item base fields) or any non-TR
     * (`config_i18n[sourceLang]` / `item_i18n[sourceLang]`).
     * Result is written into `config_i18n[targetLang]` and `item_i18n[targetLang]`,
     * and mirrored into matching variant rows so the public site picks it up
     * even when an A/B variant is active.
     */
    async translateSectionToLanguage(
        sectionId: string,
        sourceLang: string,
        targetLang: string,
        onProgress?: (step: string) => void
    ): Promise<{ savedConfigFields: number; savedItems: number }> {
        if (sourceLang === targetLang) return { savedConfigFields: 0, savedItems: 0 };
        const { AiTranslationService } = await import('./aiTranslationService');

        onProgress?.('Bolum yukleniyor...');
        const sec = await this.getSection(sectionId);
        if (!sec) throw new Error('Bolum bulunamadi.');

        const SKIP_CONFIG_FIELDS = new Set(['url', 'image', 'video', 'color', 'target', 'href', 'src', 'icon', 'logo', 'bg', 'background', 'gradient', 'link', 'anchor']);
        const shouldTranslateField = (field: string) =>
            !SKIP_CONFIG_FIELDS.has(field) &&
            !field.includes('url') && !field.includes('image') && !field.includes('video') &&
            !field.includes('color') && !field.includes('_id') && !field.startsWith('_');

        // Resolve effective source values for config (TR master OR config_i18n[sourceLang])
        const baseConfig: Record<string, any> = sec.config || {};
        const sourceConfig: Record<string, any> = sourceLang === 'tr'
            ? baseConfig
            : { ...baseConfig, ...(sec.config_i18n?.[sourceLang] || {}) };

        // Build batch
        onProgress?.('Ceviriler hazirlaniyor...');
        const batch: { key: string; value: string }[] = [];

        for (const [field, val] of Object.entries(sourceConfig)) {
            if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                batch.push({ key: `cfg_${field}`, value: val });
            } else if (Array.isArray(val)) {
                val.forEach((arrItem: unknown, arrIdx: number) => {
                    if (typeof arrItem === 'string' && (arrItem as string).trim()) {
                        batch.push({ key: `cfg_${field}_${arrIdx}`, value: arrItem as string });
                    }
                });
            }
        }

        const items: LandingPageItem[] = sec.items || [];
        items.forEach((item: LandingPageItem, iIdx: number) => {
            const sourceItem = sourceLang === 'tr'
                ? { title: item.title, description: item.description, value_text: item.value_text, extra: item.extra || {} }
                : {
                    title: item.item_i18n?.[sourceLang]?.title ?? item.title,
                    description: item.item_i18n?.[sourceLang]?.description ?? item.description,
                    value_text: item.item_i18n?.[sourceLang]?.value_text ?? item.value_text,
                    extra: { ...(item.extra || {}), ...(item.item_i18n?.[sourceLang]?.extra || {}) },
                };

            if (sourceItem.title) batch.push({ key: `i${iIdx}_title`, value: sourceItem.title });
            if (sourceItem.description) batch.push({ key: `i${iIdx}_desc`, value: sourceItem.description });
            if (sourceItem.value_text) batch.push({ key: `i${iIdx}_val`, value: sourceItem.value_text });
            for (const [field, val] of Object.entries(sourceItem.extra || {})) {
                if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                    batch.push({ key: `i${iIdx}_extra_${field}`, value: val });
                } else if (Array.isArray(val)) {
                    (val as unknown[]).forEach((arrItem: unknown, arrIdx: number) => {
                        if (typeof arrItem === 'string' && arrItem.trim()) {
                            batch.push({ key: `i${iIdx}_extra_${field}_${arrIdx}`, value: arrItem as string });
                        }
                    });
                }
            }
        });

        if (batch.length === 0) {
            onProgress?.('Cevrilecek metin yok.');
            return { savedConfigFields: 0, savedItems: 0 };
        }

        // AI translate
        onProgress?.(`${batch.length} metin AI ile cevriliyor...`);
        const map = new Map<string, string>();
        try {
            const results = await AiTranslationService.translateBatch(batch, [targetLang]);
            results.forEach(r => { if (r.value?.trim()) map.set(r.key, r.value); });
        } catch (e) {
            console.error('[LandingCMS] translateSectionToLanguage AI failed:', e);
            throw e;
        }

        const t = (key: string): string | null => {
            const v = map.get(key);
            return v && v.trim() ? v : null;
        };

        // Build & save translated config
        onProgress?.('Ceviriler kaydediliyor...');
        const translatedConfig: Record<string, any> = {};
        for (const [field, val] of Object.entries(sourceConfig)) {
            if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                const v = t(`cfg_${field}`);
                if (v) translatedConfig[field] = v;
            } else if (Array.isArray(val)) {
                const anyT = (val as unknown[]).some((arrItem: unknown, arrIdx: number) =>
                    typeof arrItem === 'string' && (arrItem as string).trim() && !!t(`cfg_${field}_${arrIdx}`)
                );
                if (anyT) {
                    translatedConfig[field] = (val as unknown[]).map((arrItem: unknown, arrIdx: number) => {
                        if (typeof arrItem === 'string' && (arrItem as string).trim()) {
                            return t(`cfg_${field}_${arrIdx}`) || arrItem;
                        }
                        return arrItem;
                    });
                }
            }
        }

        let savedConfigFields = 0;
        if (Object.keys(translatedConfig).length > 0) {
            // Merge over any existing config_i18n[targetLang] so unrelated keys are kept
            const existing = (sec.config_i18n?.[targetLang] || {}) as Record<string, any>;
            const merged = { ...existing, ...translatedConfig };
            await this.saveLanguageConfig(sectionId, targetLang, merged);
            await this.mirrorVariantSectionConfig(sec.section_type, targetLang, translatedConfig);
            savedConfigFields = Object.keys(translatedConfig).length;
        }

        // Items
        let savedItems = 0;
        for (let iIdx = 0; iIdx < items.length; iIdx++) {
            const item = items[iIdx];
            const itemTranslated: Record<string, any> = {};
            const titleT = t(`i${iIdx}_title`);
            const descT = t(`i${iIdx}_desc`);
            const valT = t(`i${iIdx}_val`);
            if (titleT) itemTranslated.title = titleT;
            if (descT) itemTranslated.description = descT;
            if (valT) itemTranslated.value_text = valT;

            const translatedExtra: Record<string, any> = {};
            for (const [field, val] of Object.entries(item.extra || {})) {
                if (typeof val === 'string' && val.trim() && shouldTranslateField(field)) {
                    const v = t(`i${iIdx}_extra_${field}`);
                    if (v) translatedExtra[field] = v;
                } else if (Array.isArray(val)) {
                    const anyT = (val as unknown[]).some((arrItem: unknown, arrIdx: number) =>
                        typeof arrItem === 'string' && arrItem.trim() && !!t(`i${iIdx}_extra_${field}_${arrIdx}`)
                    );
                    if (anyT) {
                        translatedExtra[field] = (val as unknown[]).map((arrItem: unknown, arrIdx: number) => {
                            if (typeof arrItem === 'string' && arrItem.trim()) {
                                return t(`i${iIdx}_extra_${field}_${arrIdx}`) || arrItem;
                            }
                            return arrItem;
                        });
                    }
                }
            }
            if (Object.keys(translatedExtra).length > 0) itemTranslated.extra = translatedExtra;

            if (Object.keys(itemTranslated).length === 0) continue;

            const existing = (item.item_i18n?.[targetLang] || {}) as Record<string, any>;
            const merged = {
                ...existing,
                ...itemTranslated,
                extra: { ...(existing.extra || {}), ...(itemTranslated.extra || {}) },
            };
            await this.saveItemLanguageData(item.id, targetLang, merged);
            await this.mirrorVariantItemFields(sec.section_type, item.sort_order, targetLang, itemTranslated);
            savedItems++;
        }

        // Drop client caches so the public site picks up the new translations
        try {
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith('cafepaste_landing_data_') || k.startsWith('cafepaste_variant')) {
                    localStorage.removeItem(k);
                }
            });
        } catch { /* ignore */ }

        onProgress?.('Tamamlandi!');
        return { savedConfigFields, savedItems };
    },

    /** Mirror config_i18n[lang] additions onto every landing_variant_sections row of the same section_type */
    async mirrorVariantSectionConfig(sectionType: string, lang: string, addedFields: Record<string, any>): Promise<void> {
        if (!sectionType || Object.keys(addedFields).length === 0) return;
        const { data: variantSecs } = await supabase
            .from('landing_variant_sections')
            .select('id, config_i18n')
            .eq('section_type', sectionType);
        if (!variantSecs || variantSecs.length === 0) return;
        for (const vs of variantSecs) {
            const i18n = (vs.config_i18n || {}) as Record<string, any>;
            const langCfg = { ...(i18n[lang] || {}), ...addedFields };
            await supabase
                .from('landing_variant_sections')
                .update({ config_i18n: { ...i18n, [lang]: langCfg } })
                .eq('id', vs.id);
        }
    },

    /** Mirror item_i18n[lang] additions onto variant items at the same section_type + sort_order */
    async mirrorVariantItemFields(sectionType: string, sortOrder: number, lang: string, addedFields: Record<string, any>): Promise<void> {
        if (!sectionType || Object.keys(addedFields).length === 0) return;
        const { data: variantSecs } = await supabase
            .from('landing_variant_sections')
            .select('id')
            .eq('section_type', sectionType);
        if (!variantSecs || variantSecs.length === 0) return;
        const sectionIds = variantSecs.map((v: any) => v.id);
        const { data: variantItems } = await supabase
            .from('landing_variant_items')
            .select('id, item_i18n')
            .in('variant_section_id', sectionIds)
            .eq('sort_order', sortOrder);
        if (!variantItems || variantItems.length === 0) return;
        for (const vi of variantItems) {
            const i18n = (vi.item_i18n || {}) as Record<string, any>;
            const cur = (i18n[lang] || {}) as Record<string, any>;
            const merged: Record<string, any> = { ...cur, ...addedFields };
            if (addedFields.extra) {
                merged.extra = { ...(cur.extra || {}), ...addedFields.extra };
            }
            await supabase
                .from('landing_variant_items')
                .update({ item_i18n: { ...i18n, [lang]: merged } })
                .eq('id', vi.id);
        }
    },

    // ─── DEFAULTS ────────────────────────────────────────────────

    async saveCurrentAsDefaults(sections: LandingPageSection[]): Promise<void> {
        const { error } = await supabase
            .from('app_settings')
            .upsert({ key: 'landing_page_defaults', value: JSON.stringify(sections), updated_at: new Date().toISOString() });
        if (error) throw error;
    },

    async getSavedDefaults(): Promise<LandingPageSection[] | null> {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'landing_page_defaults')
            .single();
        if (!data?.value) return null;
        try {
            return JSON.parse(data.value) as LandingPageSection[];
        } catch {
            return null;
        }
    },

    // ─── IMAGE UPLOAD ────────────────────────────────────────────

    async uploadImage(file: File): Promise<string> {
        // image/* MIME ise WebP'ye transcode + max 1920px. SVG/GIF/video burada
        // değil; dokunulmadan geçer. Bir hero görseli daha önce 5006KB PNG
        // olarak gitmişti — bir daha olmaması için pipeline'ın girişinde
        // sıkıştırma zorunlu hale getirildi.
        const isImage = file.type.toLowerCase().startsWith('image/');
        let uploadBlob: Blob = file;
        let ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        let contentType = file.type;

        if (isImage) {
            try {
                const r = await compressImageToWebp(file);
                if (r.format === 'webp') {
                    uploadBlob = r.blob;
                    ext = 'webp';
                    contentType = 'image/webp';
                    // eslint-disable-next-line no-console
                    console.log(
                        `[LandingCMS] image compressed: ${formatBytes(r.originalBytes)} → ${formatBytes(r.compressedBytes)} (${r.width}×${r.height} webp)`
                    );
                }
            } catch (err) {
                // Sıkıştırma fail olursa orijinali yüklemekten geri durma —
                // admin upload'ı bloklamak için bir sebep değil.
                console.warn('[LandingCMS] compress skipped, uploading original:', err);
            }
        }

        const fileName = `landing-cms-${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${ext}`;

        const { error } = await supabase.storage
            .from('whatsapp_media')
            .upload(fileName, uploadBlob, {
                contentType,
                cacheControl: '3600',
                upsert: true,
            });

        if (error) {
            console.error('[LandingCMS] Image upload error:', error.message, error);
            throw error;
        }

        const { data } = supabase.storage
            .from('whatsapp_media')
            .getPublicUrl(fileName);

        return data.publicUrl;
    },

    /** List previously-uploaded landing CMS media (images + videos) for the gallery picker */
    async listLandingMedia(): Promise<{ name: string; url: string; created_at: string; kind: 'image' | 'video' }[]> {
        const { data, error } = await supabase.storage
            .from('whatsapp_media')
            .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
        if (error) {
            console.error('[LandingCMS] listLandingMedia error:', error.message);
            return [];
        }
        const IMG_EXT = /\.(jpg|jpeg|png|webp|gif|svg)$/i;
        const VID_EXT = /\.(mp4|webm|mov)$/i;
        return (data || [])
            .filter(f => f.name?.startsWith('landing-cms-') && (IMG_EXT.test(f.name) || VID_EXT.test(f.name)))
            .map(f => {
                const { data: u } = supabase.storage.from('whatsapp_media').getPublicUrl(f.name);
                return {
                    name: f.name,
                    url: u.publicUrl,
                    created_at: f.created_at || '',
                    kind: VID_EXT.test(f.name) ? 'video' as const : 'image' as const,
                };
            });
    },
};
