import { supabase } from '../../lib/supabase/client';
import { LandingVariant, LandingVariantSection, LandingVariantItem, LandingPageSection } from '../../types';

export const LandingVariantService = {

    // ═══ VARIANTS CRUD ═══

    async getAll(): Promise<LandingVariant[]> {
        const { data, error } = await supabase
            .from('landing_variants')
            .select('*, sections:landing_variant_sections(*, items:landing_variant_items(*))')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as LandingVariant[]) ?? [];
    },

    async getActive(): Promise<LandingVariant[]> {
        const { data, error } = await supabase
            .from('landing_variants')
            .select('*, sections:landing_variant_sections(*, items:landing_variant_items(*))')
            .eq('is_active', true)
            .order('weight', { ascending: false });
        if (error) throw error;
        return (data as LandingVariant[]) ?? [];
    },

    /** Active variants whose applicable_languages contains the given language code */
    async getActiveForLanguage(lang: string): Promise<LandingVariant[]> {
        const { data, error } = await supabase
            .from('landing_variants')
            .select('*, sections:landing_variant_sections(*, items:landing_variant_items(*))')
            .eq('is_active', true)
            .contains('applicable_languages', [lang])
            .order('weight', { ascending: false });
        if (error) throw error;
        return (data as LandingVariant[]) ?? [];
    },

    async getById(id: string): Promise<LandingVariant | null> {
        const { data, error } = await supabase
            .from('landing_variants')
            .select('*, sections:landing_variant_sections(*, items:landing_variant_items(*))')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as LandingVariant;
    },

    async create(name: string, description?: string, applicableLanguages?: string[]): Promise<LandingVariant> {
        const payload: Record<string, any> = { name, description };
        if (applicableLanguages && applicableLanguages.length > 0) {
            payload.applicable_languages = applicableLanguages;
        }
        const { data, error } = await supabase
            .from('landing_variants')
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        return data as LandingVariant;
    },

    async update(id: string, updates: Partial<Pick<LandingVariant, 'name' | 'description' | 'is_active' | 'weight' | 'applicable_languages'>>) {
        const { error } = await supabase
            .from('landing_variants')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    async remove(id: string) {
        const { error } = await supabase.from('landing_variants').delete().eq('id', id);
        if (error) throw error;
    },

    // ═══ CLONE FROM CURRENT CMS ═══

    async cloneFromCms(name: string, currentSections: LandingPageSection[]): Promise<LandingVariant> {
        // Create variant
        const variant = await this.create(name, 'CMS\'den kopyalandı');

        // Clone each section (including config_i18n for multi-language)
        for (const section of currentSections) {
            const { data: vs, error: vsErr } = await supabase
                .from('landing_variant_sections')
                .insert({
                    variant_id: variant.id,
                    section_type: section.section_type,
                    is_active: section.is_active,
                    sort_order: section.sort_order,
                    config: section.config,
                    config_i18n: section.config_i18n || {},
                })
                .select()
                .single();
            if (vsErr) throw vsErr;

            // Clone items (including item_i18n)
            if (section.items && section.items.length > 0) {
                const items = section.items.map(item => ({
                    variant_section_id: vs.id,
                    title: item.title,
                    description: item.description,
                    value_text: item.value_text,
                    media_url: item.media_url,
                    icon: item.icon,
                    extra: item.extra,
                    item_i18n: (item as any).item_i18n || {},
                    is_active: item.is_active,
                    sort_order: item.sort_order,
                }));
                const { error: iErr } = await supabase.from('landing_variant_items').insert(items);
                if (iErr) throw iErr;
            }
        }

        return this.getById(variant.id) as Promise<LandingVariant>;
    },

    /** Translate all variant sections to a target language and save into config_i18n */
    async translateVariantToLanguage(
        variantId: string,
        targetLang: string,
        onProgressOrOptions?: ((step: string) => void) | { onProgress?: (step: string) => void; onlyMissing?: boolean },
        legacyOptions?: { onlyMissing?: boolean }
    ): Promise<number> {
        // Backwards-compatible param overload
        const onProgress: ((step: string) => void) | undefined =
            typeof onProgressOrOptions === 'function' ? onProgressOrOptions : onProgressOrOptions?.onProgress;
        const onlyMissing: boolean =
            (typeof onProgressOrOptions === 'object' && onProgressOrOptions?.onlyMissing) ||
            legacyOptions?.onlyMissing ||
            false;

        const { AiTranslationService } = await import('./aiTranslationService');

        onProgress?.('Varyant icerigi yukleniyor...');
        const variant = await this.getById(variantId);
        if (!variant?.sections || variant.sections.length === 0) return 0;

        const SKIP_FIELDS = new Set(['url', 'image', 'video', 'color', 'target', 'href', 'src', 'icon', 'logo', 'bg', 'background', 'gradient', 'link', 'anchor', 'media_type', 'type', 'variant', 'mode', 'layout', 'theme', 'size', 'align']);
        const shouldTranslate = (field: string) => !SKIP_FIELDS.has(field) && !field.includes('url') && !field.includes('image') && !field.includes('video') && !field.includes('color') && !field.includes('_type') && !field.endsWith('_id') && !field.startsWith('_');

        // Collect translatable strings
        onProgress?.('Ceviriler hazirlaniyor...');
        const batch: { key: string; value: string }[] = [];

        // Section types where value_text is a target/URL (not translatable copy)
        const NAV_TYPES = new Set(['header_nav', 'footer_nav']);

        variant.sections.forEach((sec, sIdx) => {
            const cfg = sec.config || {};
            const existingCfg = ((sec.config_i18n ?? {}) as Record<string, Record<string, any>>)[targetLang] ?? {};
            for (const [field, val] of Object.entries(cfg)) {
                if (typeof val === 'string' && val.trim() && shouldTranslate(field)) {
                    if (onlyMissing && existingCfg[field] && String(existingCfg[field]).trim()) continue;
                    batch.push({ key: `s${sIdx}_cfg_${field}`, value: val });
                }
            }
            const isNav = NAV_TYPES.has(sec.section_type);
            (sec.items || []).forEach((item, iIdx) => {
                const existingItem = ((item.item_i18n ?? {}) as Record<string, Record<string, any>>)[targetLang] ?? {};
                const existingExtra = (existingItem.extra ?? {}) as Record<string, any>;
                const has = (v: any) => typeof v === 'string' && v.trim();
                if (item.title && !(onlyMissing && has(existingItem.title))) batch.push({ key: `s${sIdx}_i${iIdx}_title`, value: item.title });
                if (item.description && !(onlyMissing && has(existingItem.description))) batch.push({ key: `s${sIdx}_i${iIdx}_desc`, value: item.description });
                // Nav items: value_text is a section id / URL — DO NOT translate
                if (item.value_text && !isNav && !(onlyMissing && has(existingItem.value_text))) batch.push({ key: `s${sIdx}_i${iIdx}_val`, value: item.value_text });
                for (const [field, val] of Object.entries(item.extra || {})) {
                    if (typeof val === 'string' && val.trim() && shouldTranslate(field)) {
                        if (onlyMissing && has(existingExtra[field])) continue;
                        batch.push({ key: `s${sIdx}_i${iIdx}_extra_${field}`, value: val });
                    }
                }
            });
        });

        if (batch.length === 0) return 0;

        // AI translate
        onProgress?.(`${batch.length} metin cevriliyor...`);
        const translatedMap = new Map<string, string>();
        try {
            const results = await AiTranslationService.translateBatch(batch, [targetLang]);
            results.forEach(r => { if (r.value?.trim()) translatedMap.set(r.key, r.value); });
        } catch (e) {
            console.error('[VariantService] AI translation failed:', e);
        }

        // Strict: only return AI translation if present and non-empty (no TR fallback)
        const tStrict = (key: string): string | null => {
            const v = translatedMap.get(key);
            return v && v.trim() ? v : null;
        };

        // Save translations into config_i18n / item_i18n — only fields AI actually translated
        onProgress?.('Ceviriler kaydediliyor...');
        let saved = 0;

        for (let sIdx = 0; sIdx < variant.sections.length; sIdx++) {
            const sec = variant.sections[sIdx];

            // Build translated config — only AI-translated fields go in
            const translatedConfig: Record<string, any> = {};
            for (const [field, val] of Object.entries(sec.config || {})) {
                if (typeof val === 'string' && val.trim() && shouldTranslate(field)) {
                    const v = tStrict(`s${sIdx}_cfg_${field}`);
                    if (v) translatedConfig[field] = v;
                }
                // Non-string / non-translatable fields: don't copy, reader merges from base config
            }

            // Save to config_i18n only if there's something
            if (Object.keys(translatedConfig).length > 0) {
                const newConfigI18n = { ...(sec.config_i18n || {}), [targetLang]: translatedConfig };
                await supabase.from('landing_variant_sections').update({ config_i18n: newConfigI18n }).eq('id', sec.id);
            }

            // Save item translations — only AI-translated fields
            for (let iIdx = 0; iIdx < (sec.items || []).length; iIdx++) {
                const item = sec.items![iIdx];
                const translatedExtra: Record<string, any> = {};
                for (const [field, val] of Object.entries(item.extra || {})) {
                    if (typeof val === 'string' && val.trim() && shouldTranslate(field)) {
                        const v = tStrict(`s${sIdx}_i${iIdx}_extra_${field}`);
                        if (v) translatedExtra[field] = v;
                    }
                }

                const itemTranslated: Record<string, any> = {};
                const titleT = tStrict(`s${sIdx}_i${iIdx}_title`);
                const descT = tStrict(`s${sIdx}_i${iIdx}_desc`);
                const valT = tStrict(`s${sIdx}_i${iIdx}_val`);
                if (titleT) itemTranslated.title = titleT;
                if (descT) itemTranslated.description = descT;
                // Nav items: never save translated value_text (would break section target)
                if (valT && !NAV_TYPES.has(sec.section_type)) itemTranslated.value_text = valT;
                if (Object.keys(translatedExtra).length > 0) itemTranslated.extra = translatedExtra;

                if (Object.keys(itemTranslated).length === 0) continue;

                const newItemI18n = {
                    ...(item.item_i18n || {}),
                    [targetLang]: itemTranslated,
                };
                await supabase.from('landing_variant_items').update({ item_i18n: newItemI18n }).eq('id', item.id);
            }
            saved++;
        }

        onProgress?.('Tamamlandi!');
        return saved;
    },

    // ═══ SECTION CRUD ═══

    async addSection(variantId: string, sectionType: string, config: Record<string, any> = {}) {
        const { data, error } = await supabase
            .from('landing_variant_sections')
            .insert({ variant_id: variantId, section_type: sectionType, config })
            .select()
            .single();
        if (error) throw error;
        return data as LandingVariantSection;
    },

    async updateSection(id: string, updates: Partial<Pick<LandingVariantSection, 'is_active' | 'sort_order' | 'config'>>) {
        const { error } = await supabase.from('landing_variant_sections').update(updates).eq('id', id);
        if (error) throw error;
    },

    async removeSection(id: string) {
        const { error } = await supabase.from('landing_variant_sections').delete().eq('id', id);
        if (error) throw error;
    },

    async reorderSections(orderedIds: string[]) {
        for (let i = 0; i < orderedIds.length; i++) {
            const { error } = await supabase
                .from('landing_variant_sections')
                .update({ sort_order: i * 10 })
                .eq('id', orderedIds[i]);
            if (error) throw error;
        }
    },

    // ═══ ITEM CRUD ═══

    async addItem(sectionId: string, item: Partial<LandingVariantItem>) {
        const { data, error } = await supabase
            .from('landing_variant_items')
            .insert({ variant_section_id: sectionId, ...item })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateItem(id: string, updates: Partial<LandingVariantItem>) {
        const { error } = await supabase.from('landing_variant_items').update(updates).eq('id', id);
        if (error) throw error;
    },

    async removeItem(id: string) {
        const { error } = await supabase.from('landing_variant_items').delete().eq('id', id);
        if (error) throw error;
    },

    async reorderItems(orderedIds: string[]) {
        for (let i = 0; i < orderedIds.length; i++) {
            const { error } = await supabase
                .from('landing_variant_items')
                .update({ sort_order: i * 10 })
                .eq('id', orderedIds[i]);
            if (error) throw error;
        }
    },

    // ═══ CONVERT VARIANT SECTIONS TO LANDING PAGE FORMAT ═══

    sectionsToLandingFormat(variant: LandingVariant, lang?: string): LandingPageSection[] {
        if (!variant.sections) return [];
        const l = lang || 'tr';
        return variant.sections
            .filter(s => s.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(s => {
                // Merge language-specific config on top of base config
                const langConfig = (l !== 'tr' && s.config_i18n?.[l] && Object.keys(s.config_i18n[l]).length > 0)
                    ? { ...s.config, ...s.config_i18n[l] }
                    : s.config;

                return {
                    id: s.id,
                    section_type: s.section_type,
                    title: null,
                    is_active: s.is_active,
                    sort_order: s.sort_order,
                    config: langConfig,
                    items: (s.items ?? [])
                        .filter(i => i.is_active)
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(i => {
                            const ti = (l !== 'tr' && i.item_i18n?.[l]) ? i.item_i18n[l] : null;
                            // Nav sections: value_text is a target/URL — never use language override
                            const isNav = s.section_type === 'header_nav' || s.section_type === 'footer_nav';
                            return {
                                id: i.id,
                                section_id: s.id,
                                title: ti?.title ?? i.title,
                                description: ti?.description ?? i.description,
                                value_text: isNav ? i.value_text : (ti?.value_text ?? i.value_text),
                                media_url: i.media_url,
                                icon: i.icon,
                                extra: ti?.extra ? { ...i.extra, ...ti.extra } : i.extra,
                                is_active: i.is_active,
                                sort_order: i.sort_order,
                            };
                        }),
                };
            });
    },

    // ═══ TRANSLATION HELPERS — per-section / per-field / missing report ═══

    _SKIP_FIELDS_TRANSLATE: new Set(['url', 'image', 'video', 'color', 'target', 'href', 'src', 'icon', 'logo', 'bg', 'background', 'gradient', 'link', 'anchor', 'media_type', 'type', 'variant', 'mode', 'layout', 'theme', 'size', 'align', 'object_pos']),
    _NAV_TYPES: new Set(['header_nav', 'footer_nav']),

    _shouldTranslateField(field: string): boolean {
        const SKIP = this._SKIP_FIELDS_TRANSLATE;
        return !SKIP.has(field)
            && !field.includes('url')
            && !field.includes('image')
            && !field.includes('video')
            && !field.includes('color')
            && !field.includes('_type')
            && !field.endsWith('_id')
            && !field.startsWith('_');
    },

    /**
     * Translate a single section to a target language.
     * options.onlyMissing: true → skip fields already populated in config_i18n[lang] / item_i18n[lang].
     */
    async translateSectionToLanguage(
        sectionId: string,
        targetLang: string,
        options?: { onlyMissing?: boolean; onProgress?: (step: string) => void }
    ): Promise<number> {
        const { AiTranslationService } = await import('./aiTranslationService');
        const onProgress = options?.onProgress;
        const onlyMissing = options?.onlyMissing ?? false;
        const shouldTranslate = (f: string) => this._shouldTranslateField(f);
        const isNavType = (t: string) => this._NAV_TYPES.has(t);

        onProgress?.('Bolum yukleniyor...');
        const { data: secData, error: secErr } = await supabase
            .from('landing_variant_sections')
            .select('*, items:landing_variant_items(*)')
            .eq('id', sectionId)
            .single();
        if (secErr || !secData) return 0;
        const sec = secData as LandingVariantSection;

        const batch: { key: string; value: string }[] = [];
        const existingCfg = ((sec.config_i18n ?? {}) as Record<string, Record<string, any>>)[targetLang] ?? {};
        const has = (v: any) => typeof v === 'string' && v.trim();

        for (const [field, val] of Object.entries(sec.config || {})) {
            if (typeof val === 'string' && val.trim() && shouldTranslate(field)) {
                if (onlyMissing && has(existingCfg[field])) continue;
                batch.push({ key: `cfg_${field}`, value: val });
            }
        }
        const isNav = isNavType(sec.section_type);
        (sec.items || []).forEach((item, iIdx) => {
            const existingItem = ((item.item_i18n ?? {}) as Record<string, Record<string, any>>)[targetLang] ?? {};
            const existingExtra = (existingItem.extra ?? {}) as Record<string, any>;
            if (item.title && !(onlyMissing && has(existingItem.title))) batch.push({ key: `i${iIdx}_title`, value: item.title });
            if (item.description && !(onlyMissing && has(existingItem.description))) batch.push({ key: `i${iIdx}_desc`, value: item.description });
            if (item.value_text && !isNav && !(onlyMissing && has(existingItem.value_text))) batch.push({ key: `i${iIdx}_val`, value: item.value_text });
            for (const [field, val] of Object.entries(item.extra || {})) {
                if (typeof val === 'string' && val.trim() && shouldTranslate(field)) {
                    if (onlyMissing && has(existingExtra[field])) continue;
                    batch.push({ key: `i${iIdx}_extra_${field}`, value: val });
                }
            }
        });

        if (batch.length === 0) {
            onProgress?.('Cevrilecek alan yok.');
            return 0;
        }

        onProgress?.(`${batch.length} alan cevriliyor...`);
        const translatedMap = new Map<string, string>();
        try {
            const results = await AiTranslationService.translateBatch(batch, [targetLang]);
            results.forEach(r => { if (r.value?.trim()) translatedMap.set(r.key, r.value); });
        } catch (e) {
            console.error('[VariantService] translateSection AI failed:', e);
        }
        const tStrict = (k: string): string | null => {
            const v = translatedMap.get(k);
            return v && v.trim() ? v : null;
        };

        onProgress?.('Kaydediliyor...');

        // Merge into config_i18n
        const translatedConfig: Record<string, any> = { ...(existingCfg) };
        for (const [field, val] of Object.entries(sec.config || {})) {
            if (typeof val === 'string' && val.trim() && shouldTranslate(field)) {
                const v = tStrict(`cfg_${field}`);
                if (v) translatedConfig[field] = v;
            }
        }
        if (Object.keys(translatedConfig).length > 0) {
            const newCfgI18n = { ...(sec.config_i18n || {}), [targetLang]: translatedConfig };
            await supabase.from('landing_variant_sections').update({ config_i18n: newCfgI18n }).eq('id', sec.id);
        }

        // Merge per-item
        for (let iIdx = 0; iIdx < (sec.items || []).length; iIdx++) {
            const item = sec.items![iIdx];
            const existingItem = ((item.item_i18n ?? {}) as Record<string, Record<string, any>>)[targetLang] ?? {};
            const existingExtra = (existingItem.extra ?? {}) as Record<string, any>;
            const translatedExtra: Record<string, any> = { ...existingExtra };
            for (const [field, val] of Object.entries(item.extra || {})) {
                if (typeof val === 'string' && val.trim() && shouldTranslate(field)) {
                    const v = tStrict(`i${iIdx}_extra_${field}`);
                    if (v) translatedExtra[field] = v;
                }
            }
            const itemTranslated: Record<string, any> = { ...existingItem };
            const titleT = tStrict(`i${iIdx}_title`);
            const descT = tStrict(`i${iIdx}_desc`);
            const valT = tStrict(`i${iIdx}_val`);
            if (titleT) itemTranslated.title = titleT;
            if (descT) itemTranslated.description = descT;
            if (valT && !isNav) itemTranslated.value_text = valT;
            if (Object.keys(translatedExtra).length > 0) itemTranslated.extra = translatedExtra;

            if (Object.keys(itemTranslated).length === 0) continue;
            const newItemI18n = { ...(item.item_i18n || {}), [targetLang]: itemTranslated };
            await supabase.from('landing_variant_items').update({ item_i18n: newItemI18n }).eq('id', item.id);
        }

        onProgress?.('Tamamlandi.');
        return batch.length;
    },

    /**
     * Compute missing translations per language for a variant.
     * Returns: { [lang]: { totalMissing, perSection: { sectionId: count } } }
     */
    computeMissingTranslations(
        sections: LandingVariantSection[],
        languages: string[]
    ): Record<string, { totalMissing: number; perSection: Record<string, number> }> {
        const shouldTranslate = (f: string) => this._shouldTranslateField(f);
        const isNavType = (t: string) => this._NAV_TYPES.has(t);
        const result: Record<string, { totalMissing: number; perSection: Record<string, number> }> = {};

        for (const lang of languages) {
            const perSection: Record<string, number> = {};
            let totalMissing = 0;
            for (const sec of sections) {
                if (!sec || !sec.id) continue;
                if (sec.is_active === false) continue;
                const langCfg = ((sec.config_i18n ?? {}) as Record<string, Record<string, any>>)[lang] ?? {};
                let count = 0;
                for (const [field, val] of Object.entries(sec.config || {})) {
                    if (typeof val === 'string' && val.trim() && shouldTranslate(field)) {
                        const cur = langCfg[field];
                        if (!cur || !String(cur).trim()) count++;
                    }
                }
                const isNav = isNavType(sec.section_type);
                for (const item of (sec.items || [])) {
                    if (item.is_active === false) continue;
                    const langItem = ((item.item_i18n ?? {}) as Record<string, Record<string, any>>)[lang] ?? {};
                    const langExtra = (langItem.extra ?? {}) as Record<string, any>;
                    if (item.title && (!langItem.title || !String(langItem.title).trim())) count++;
                    if (item.description && (!langItem.description || !String(langItem.description).trim())) count++;
                    if (item.value_text && !isNav && (!langItem.value_text || !String(langItem.value_text).trim())) count++;
                    for (const [field, val] of Object.entries(item.extra || {})) {
                        if (typeof val === 'string' && val.trim() && shouldTranslate(field)) {
                            if (!langExtra[field] || !String(langExtra[field]).trim()) count++;
                        }
                    }
                }
                if (count > 0) perSection[sec.id] = count;
                totalMissing += count;
            }
            result[lang] = { totalMissing, perSection };
        }
        return result;
    },

    /** Manual save: merge a partial config patch into config_i18n[targetLang]. */
    async updateSectionLanguageConfig(sectionId: string, targetLang: string, configPatch: Record<string, any>): Promise<void> {
        const { data, error } = await supabase
            .from('landing_variant_sections')
            .select('config_i18n')
            .eq('id', sectionId)
            .single();
        if (error) throw error;
        const existing = (data?.config_i18n ?? {}) as Record<string, Record<string, any>>;
        const existingLang = existing[targetLang] ?? {};
        const next = { ...existingLang };
        for (const [k, v] of Object.entries(configPatch)) {
            if (v === '' || v === null || v === undefined) {
                delete next[k];
            } else {
                next[k] = v;
            }
        }
        const newCfgI18n = { ...existing, [targetLang]: next };
        const { error: upErr } = await supabase
            .from('landing_variant_sections')
            .update({ config_i18n: newCfgI18n })
            .eq('id', sectionId);
        if (upErr) throw upErr;
    },

    /** Manual save: merge a partial item patch into item_i18n[targetLang]. */
    async updateItemLanguageData(
        itemId: string,
        targetLang: string,
        patch: { title?: string | null; description?: string | null; value_text?: string | null; extra?: Record<string, any> }
    ): Promise<void> {
        const { data, error } = await supabase
            .from('landing_variant_items')
            .select('item_i18n')
            .eq('id', itemId)
            .single();
        if (error) throw error;
        const existing = (data?.item_i18n ?? {}) as Record<string, Record<string, any>>;
        const existingLang = existing[targetLang] ?? {};
        const next: Record<string, any> = { ...existingLang };

        const clearOrSet = (k: string, v: string | null | undefined) => {
            if (v === '' || v === null || v === undefined) delete next[k];
            else next[k] = v;
        };
        if ('title' in patch) clearOrSet('title', patch.title ?? null);
        if ('description' in patch) clearOrSet('description', patch.description ?? null);
        if ('value_text' in patch) clearOrSet('value_text', patch.value_text ?? null);
        if (patch.extra) {
            const existingExtra = (existingLang.extra ?? {}) as Record<string, any>;
            const nextExtra = { ...existingExtra };
            for (const [k, v] of Object.entries(patch.extra)) {
                if (v === '' || v === null || v === undefined) delete nextExtra[k];
                else nextExtra[k] = v;
            }
            if (Object.keys(nextExtra).length === 0) delete next.extra;
            else next.extra = nextExtra;
        }

        const newItemI18n = { ...existing, [targetLang]: next };
        const { error: upErr } = await supabase
            .from('landing_variant_items')
            .update({ item_i18n: newItemI18n })
            .eq('id', itemId);
        if (upErr) throw upErr;
    },
};
