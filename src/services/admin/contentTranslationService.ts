import { AiTranslationService } from './aiTranslationService';
import { AdminProductContentService } from './productContentService';
import { ProductDetailSection, ProductDetailItem } from '../../types';

export const ContentTranslationService = {
    /**
     * Translates a product localized object from Turkish to target languages.
     * Useful for filling the UI state before saving.
     */
    async translateProductData(
        trData: { name: string; short_description?: string; description?: string; feature_list?: string[]; badge_text?: string; compare_specs?: { label: string; value: string }[]; use_case_tags?: { label: string; active: boolean }[] },
        targetLangs: string[]
    ): Promise<Record<string, any>> {
        const results: Record<string, any> = {};

        // Flatten for translation
        const itemsToTranslate: { key: string; value: string }[] = [
            { key: 'name', value: trData.name },
            { key: 'short_description', value: trData.short_description || '' },
            { key: 'description', value: trData.description || '' },
            { key: 'badge_text', value: trData.badge_text || '' },
        ];

        // Add features
        (trData.feature_list || []).forEach((feat, i) => {
            itemsToTranslate.push({ key: `feature_${i}`, value: feat });
        });

        // Add compare-specs (label + value for each row)
        (trData.compare_specs || []).forEach((spec, i) => {
            if (spec?.label) itemsToTranslate.push({ key: `cs_${i}_label`, value: spec.label });
            if (spec?.value) itemsToTranslate.push({ key: `cs_${i}_value`, value: spec.value });
        });

        // Add use-case tags (yalnizca label cevrilir; active flag'i korunur)
        (trData.use_case_tags || []).forEach((tag, i) => {
            if (tag?.label) itemsToTranslate.push({ key: `uct_${i}`, value: tag.label });
        });

        // Filtrele: Boş olanları çevirme
        const validItems = itemsToTranslate.filter(i => i.value.trim() !== '');

        const translated = await AiTranslationService.translateBatch(validItems, targetLangs);

        for (const lang of targetLangs) {
            const langData: any = { language_code: lang, feature_list: [], compare_specs: [], use_case_tags: [] };
            const langItems = translated.filter(t => t.language === lang);

            // Compare-specs için TR'deki sıra ve label/value alanlarını koru
            const csCount = (trData.compare_specs || []).length;
            for (let i = 0; i < csCount; i++) {
                langData.compare_specs[i] = {
                    label: (trData.compare_specs || [])[i]?.label || '',
                    value: (trData.compare_specs || [])[i]?.value || '',
                };
            }

            // Use-case tags için TR sırasını + active flag'ini koru (label cevrilecek)
            const uctCount = (trData.use_case_tags || []).length;
            for (let i = 0; i < uctCount; i++) {
                langData.use_case_tags[i] = {
                    label: (trData.use_case_tags || [])[i]?.label || '',
                    active: (trData.use_case_tags || [])[i]?.active ?? false,
                };
            }

            langItems.forEach(item => {
                if (item.key.startsWith('feature_')) {
                    const idx = parseInt(item.key.split('_')[1]);
                    langData.feature_list[idx] = item.value;
                } else if (item.key.startsWith('cs_')) {
                    // cs_<index>_label veya cs_<index>_value
                    const parts = item.key.split('_');
                    const idx = parseInt(parts[1]);
                    const field = parts[2]; // 'label' veya 'value'
                    if (!langData.compare_specs[idx]) langData.compare_specs[idx] = { label: '', value: '' };
                    if (field === 'label' || field === 'value') {
                        langData.compare_specs[idx][field] = item.value;
                    }
                } else if (item.key.startsWith('uct_')) {
                    const idx = parseInt(item.key.split('_')[1]);
                    if (!langData.use_case_tags[idx]) langData.use_case_tags[idx] = { label: '', active: false };
                    langData.use_case_tags[idx].label = item.value;
                } else {
                    langData[item.key] = item.value;
                }
            });

            results[lang] = langData;
        }

        return results;
    },

    async translateArticleData(
        trData: { title: string; content_md: string },
        targetLangs: string[]
    ): Promise<Record<string, any>> {
        const results: Record<string, any> = {};
        const items = [
            { key: 'title', value: trData.title },
            { key: 'content_md', value: trData.content_md }
        ];

        const translated = await AiTranslationService.translateBatch(items, targetLangs);

        for (const lang of targetLangs) {
            const langItems = translated.filter(t => t.language === lang);
            results[lang] = {
                title: langItems.find(i => i.key === 'title')?.value || trData.title,
                content_md: langItems.find(i => i.key === 'content_md')?.value || trData.content_md,
                language_code: lang
            };
        }
        return results;
    },

    /**
     * Syncs and translates all Page Designer blocks from one language to others.
     * Uses a clean-slate approach for target languages to ensure perfect parity.
     */
    async syncDesignerSections(
        productId: string,
        sourceLang: string,
        targetLangs: string[],
        onProgress?: (lang: string, step: string) => void,
        onChunkItems?: (items: import('./languageService').LiveTranslationItem[]) => void,
        productName?: string
    ) {
        const sourceSections = await AdminProductContentService.getProductContent(productId, sourceLang);
        if (sourceSections.length === 0) return;

        for (const lang of targetLangs) {
            onProgress?.(lang, 'translating');

            // 1. Prepare ALL items to translate for this language at once
            const batchStrings: { key: string, value: string }[] = [];

            // Fields that should NOT be translated (URLs, colors, technical values)
            const skipField = (f: string) => f.includes('url') || f.includes('image') || f.includes('video') || f.includes('color') || f.includes('_id') || f === 'icon' || f === 'icon_name' || f === 'href' || f === 'src' || f === 'bg' || f === 'gradient';

            sourceSections.forEach((sec, sIdx) => {
                if (sec.title) batchStrings.push({ key: `s_${sIdx}_title`, value: sec.title });
                if (sec.eyebrow) batchStrings.push({ key: `s_${sIdx}_eyebrow`, value: sec.eyebrow });
                if (sec.sub_text) batchStrings.push({ key: `s_${sIdx}_sub_text`, value: sec.sub_text });

                sec.items?.forEach((item, iIdx) => {
                    if (item.title) batchStrings.push({ key: `s_${sIdx}_i_${iIdx}_title`, value: item.title });
                    if (item.description) batchStrings.push({ key: `s_${sIdx}_i_${iIdx}_desc`, value: item.description });
                    if (item.value_text) batchStrings.push({ key: `s_${sIdx}_i_${iIdx}_val`, value: item.value_text });
                    if (item.sub_text) batchStrings.push({ key: `s_${sIdx}_i_${iIdx}_sub`, value: item.sub_text });
                    if (item.icon_value) batchStrings.push({ key: `s_${sIdx}_i_${iIdx}_icval`, value: item.icon_value });

                    // Translate ALL string extra fields dynamically
                    const extra = item.extra || {};
                    for (const [field, val] of Object.entries(extra)) {
                        if (typeof val === 'string' && val.trim() && !skipField(field)) {
                            batchStrings.push({ key: `s_${sIdx}_i_${iIdx}_ex_${field}`, value: val });
                        } else if (Array.isArray(val)) {
                            (val as unknown[]).forEach((arrItem: unknown, arrIdx: number) => {
                                if (typeof arrItem === 'string' && arrItem.trim()) {
                                    batchStrings.push({ key: `s_${sIdx}_i_${iIdx}_ex_${field}_${arrIdx}`, value: arrItem as string });
                                }
                            });
                        }
                    }
                });
            });

            // 2. Try to translate — if it fails, still copy blocks with original text
            let translatedBatch: { key: string; language: string; value: string }[] = [];
            try {
                if (batchStrings.length > 0) {
                    translatedBatch = await AiTranslationService.translateBatch(batchStrings, [lang]);
                }
            } catch (e) {
                console.warn(`[syncDesigner] AI translation failed for ${lang}, copying without translation:`, e);
            }

            const findT = (key: string, fallback: string | null) =>
                translatedBatch.find(t => t.key === key)?.value || fallback;

            onProgress?.(lang, 'copying');

            // 3. Clean up existing content in target language to avoid duplicates/ghost sections
            const targetExisting = await AdminProductContentService.getProductContent(productId, lang);
            for (const oldSec of targetExisting) {
                await AdminProductContentService.deleteSection(oldSec.id);
            }

            // 4. Recreate sections and items
            for (let sIdx = 0; sIdx < sourceSections.length; sIdx++) {
                const srcSec = sourceSections[sIdx];

                const newSec = await AdminProductContentService.createSection({
                    product_id: productId,
                    language_code: lang,
                    section_type: srcSec.section_type,
                    title: findT(`s_${sIdx}_title`, srcSec.title),
                    eyebrow: findT(`s_${sIdx}_eyebrow`, srcSec.eyebrow),
                    sub_text: findT(`s_${sIdx}_sub_text`, srcSec.sub_text),
                    is_active: srcSec.is_active,
                    show_on_desktop: srcSec.show_on_desktop,
                    show_on_mobile: srcSec.show_on_mobile,
                    sort_order: srcSec.sort_order
                });

                if (srcSec.items && srcSec.items.length > 0) {
                    for (let iIdx = 0; iIdx < srcSec.items.length; iIdx++) {
                        const srcItem = srcSec.items[iIdx];

                        // Translate extra fields dynamically
                        const translatedExtra = { ...(srcItem.extra || {}) };
                        for (const [field, val] of Object.entries(translatedExtra)) {
                            if (typeof val === 'string' && val.trim() && !skipField(field)) {
                                translatedExtra[field] = findT(`s_${sIdx}_i_${iIdx}_ex_${field}`, val);
                            } else if (Array.isArray(val)) {
                                translatedExtra[field] = (val as unknown[]).map((arrItem: unknown, arrIdx: number) => {
                                    if (typeof arrItem === 'string' && arrItem.trim()) {
                                        return findT(`s_${sIdx}_i_${iIdx}_ex_${field}_${arrIdx}`, arrItem as string);
                                    }
                                    return arrItem;
                                });
                            }
                        }

                        const newItem = await AdminProductContentService.createItem({
                            section_id: newSec.id,
                            title: findT(`s_${sIdx}_i_${iIdx}_title`, srcItem.title),
                            description: findT(`s_${sIdx}_i_${iIdx}_desc`, srcItem.description),
                            value_text: findT(`s_${sIdx}_i_${iIdx}_val`, srcItem.value_text),
                            sub_text: findT(`s_${sIdx}_i_${iIdx}_sub`, srcItem.sub_text),
                            icon_value: findT(`s_${sIdx}_i_${iIdx}_icval`, srcItem.icon_value),
                            media_url: srcItem.media_url,
                            icon: srcItem.icon,
                            icon_name: srcItem.icon_name,
                            extra: translatedExtra,
                            is_active: srcItem.is_active,
                            sort_order: srcItem.sort_order
                        });

                        // Emit live items for this product item
                        if (onChunkItems) {
                            const ns = `block:${productName || productId}#${srcSec.section_type}`;
                            const out: import('./languageService').LiveTranslationItem[] = [];
                            const pushItem = (field: string, src: string | null | undefined, dst: string | null | undefined, key: string, isExtra = false) => {
                                if (!src || typeof src !== 'string' || !src.trim()) return;
                                out.push({
                                    id: `block-item:${(newItem as any)?.id || ''}:${isExtra ? 'extra.' + field : field}`,
                                    kind: 'block-item',
                                    ref_id: (newItem as any)?.id || '',
                                    field,
                                    is_extra: isExtra,
                                    namespace: ns,
                                    key: isExtra ? `extra.${field}` : field,
                                    language_code: lang,
                                    source_value: src,
                                    value: (dst as string) || (src as string),
                                    ai_translated: !!translatedBatch.find(t => t.key === key),
                                });
                            };
                            pushItem('title', srcItem.title, findT(`s_${sIdx}_i_${iIdx}_title`, srcItem.title), `s_${sIdx}_i_${iIdx}_title`);
                            pushItem('description', srcItem.description, findT(`s_${sIdx}_i_${iIdx}_desc`, srcItem.description), `s_${sIdx}_i_${iIdx}_desc`);
                            pushItem('value_text', srcItem.value_text, findT(`s_${sIdx}_i_${iIdx}_val`, srcItem.value_text), `s_${sIdx}_i_${iIdx}_val`);
                            pushItem('sub_text', srcItem.sub_text, findT(`s_${sIdx}_i_${iIdx}_sub`, srcItem.sub_text), `s_${sIdx}_i_${iIdx}_sub`);
                            for (const [field, val] of Object.entries(srcItem.extra || {})) {
                                if (typeof val === 'string' && val.trim() && !skipField(field)) {
                                    pushItem(field, val, findT(`s_${sIdx}_i_${iIdx}_ex_${field}`, val), `s_${sIdx}_i_${iIdx}_ex_${field}`, true);
                                }
                            }
                            if (out.length > 0) onChunkItems(out);
                        }
                    }
                }

                // Emit section-level live items (title/eyebrow/sub_text)
                if (onChunkItems) {
                    const ns = `block:${productName || productId}#${srcSec.section_type}`;
                    const out: import('./languageService').LiveTranslationItem[] = [];
                    const pushSec = (field: string, src: string | null | undefined, dst: string | null | undefined, key: string) => {
                        if (!src || typeof src !== 'string' || !src.trim()) return;
                        out.push({
                            id: `block-sec:${newSec.id}:${field}`,
                            kind: 'block-sec',
                            ref_id: newSec.id,
                            field,
                            namespace: ns,
                            key: field,
                            language_code: lang,
                            source_value: src,
                            value: (dst as string) || (src as string),
                            ai_translated: !!translatedBatch.find(t => t.key === key),
                        });
                    };
                    pushSec('title', srcSec.title, findT(`s_${sIdx}_title`, srcSec.title), `s_${sIdx}_title`);
                    pushSec('eyebrow', srcSec.eyebrow, findT(`s_${sIdx}_eyebrow`, srcSec.eyebrow), `s_${sIdx}_eyebrow`);
                    pushSec('sub_text', srcSec.sub_text, findT(`s_${sIdx}_sub_text`, srcSec.sub_text), `s_${sIdx}_sub_text`);
                    if (out.length > 0) onChunkItems(out);
                }
            }

            onProgress?.(lang, 'done');
        }
    },

    /**
     * Syncs ONLY MISSING Page Designer blocks from source to target languages.
     * If a product already has sections in the target language, it is skipped entirely.
     */
    async syncMissingDesignerSections(
        productId: string,
        sourceLang: string,
        targetLangs: string[],
        onProgress?: (lang: string, step: string) => void,
        onChunkItems?: (items: import('./languageService').LiveTranslationItem[]) => void,
        productName?: string
    ) {
        const sourceSections = await AdminProductContentService.getProductContent(productId, sourceLang);
        if (sourceSections.length === 0) return;

        for (const lang of targetLangs) {
            // Check if target language already has content
            const existing = await AdminProductContentService.getProductContent(productId, lang);
            if (existing.length > 0) {
                onProgress?.(lang, 'skipped');
                continue;
            }

            // No content exists — do full sync (reuse syncDesignerSections logic)
            await this.syncDesignerSections(productId, sourceLang, [lang], onProgress, onChunkItems, productName);
        }
    }
};
