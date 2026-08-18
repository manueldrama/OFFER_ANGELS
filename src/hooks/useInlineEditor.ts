import { useState, useCallback, useRef, useEffect } from 'react';
import { LandingPageSection } from '../types';
import { LandingPageCmsService } from '../services/admin/landingPageCmsService';
import { LandingPagePublicService } from '../services/landingPagePublicService';
import { useIsAdmin } from './useIsAdmin';
import { isEditModeRequested } from './editModeFlag';

interface PendingChange {
    sectionId: string;
    sectionType: string;
    fieldKey: string;
    value: any;
    isItem?: boolean;
    itemIndex?: number;
    itemId?: string;
    nested?: boolean;
    // Hangi dilde düzenlendiği — kayıt sırasında bu dile yazılır. Eskiden yoktu;
    // tüm bekleyen değişiklikler kaydet-anındaki aktif dile yazıldığı için bir
    // dilde yapılan düzenleme TR base config'e sızıp tüm dilleri bozabiliyordu.
    lang: string;
}

// Medya/URL/ikon/renk gibi alanlar dilden bağımsızdır: her dilde aynı görseli
// göstermeleri için her zaman BAZ config'e gider (config_i18n[lang]'e DEĞİL).
// Modül seviyesinde — hem canlı önizleme (updateField) hem kalıcı kayıt
// (saveAllChanges) aynı kuralı kullansın diye.
const isLangAgnostic = (key: string) =>
    /url|image|video|color|icon|logo|bg$|background|gradient|src|href|target|_type$|^type$|^media_type$|^variant$|^mode$|^layout$|^theme$|^size$|^align$/i.test(key);

export function useInlineEditor(sections: LandingPageSection[], lang: string, variantId?: string | null) {
    const { isAdmin, isLoading: authLoading } = useIsAdmin();
    const hasEditParam = isEditModeRequested();
    // Gate edit mode behind admin auth: ?edit=true is only honored for admin users.
    // Persisted across navigations via sessionStorage.
    const [editMode, setEditMode] = useState(hasEditParam && isAdmin);

    useEffect(() => {
        if (authLoading) return;
        setEditMode(isEditModeRequested() && isAdmin);
    }, [authLoading, isAdmin]);
    const [activeLang, setActiveLang] = useState(lang);
    const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
    const pendingRef = useRef<PendingChange[]>([]);
    const localSectionsRef = useRef<LandingPageSection[]>(sections);
    const [saving, setSaving] = useState(false);
    const [localSections, setLocalSections] = useState<LandingPageSection[]>(sections);

    // Sync when sections update from parent
    useEffect(() => {
        if (!saving) setLocalSections(sections);
    }, [sections, saving]);

    // Keep refs in sync
    useEffect(() => { pendingRef.current = pendingChanges; }, [pendingChanges]);
    useEffect(() => { localSectionsRef.current = localSections; }, [localSections]);

    const getSection = useCallback((type: string) => localSections.find(s => s.section_type === type), [localSections]);

    const updateField = useCallback((sectionType: string, fieldKey: string, value: any) => {
        const section = localSections.find(s => s.section_type === sectionType);
        if (!section) return;
        const lang = activeLang;

        // Update locally for instant feedback — yazılacak katman, kalıcı kayıtla
        // BİREBİR aynı olmalı: TR ya da dilden-bağımsız alan → baz config; diğer
        // diller → config_i18n[lang]. Böylece EN düzenlemesi TR base'i kirletmez
        // ve önizleme gerçekte kaydedilecek değeri gösterir.
        setLocalSections(prev => prev.map(s => {
            if (s.section_type !== sectionType) return s;
            if (lang === 'tr' || isLangAgnostic(fieldKey)) {
                return { ...s, config: { ...s.config, [fieldKey]: value } };
            }
            const i18n = { ...(s.config_i18n || {}) };
            i18n[lang] = { ...(i18n[lang] || {}), [fieldKey]: value };
            return { ...s, config_i18n: i18n };
        }));

        // Track pending change — section + field + LANG ile anahtarlanır ki farklı
        // dillerde yapılan düzenlemeler birbirinin üstüne yazmasın.
        setPendingChanges(prev => {
            const existing = prev.findIndex(c => c.sectionType === sectionType && c.fieldKey === fieldKey && c.lang === lang && !c.isItem);
            const change: PendingChange = { sectionId: section.id, sectionType, fieldKey, value, lang };
            if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = change;
                return updated;
            }
            return [...prev, change];
        });
    }, [localSections, activeLang]);

    const updateItemField = useCallback((sectionType: string, itemIndex: number, fieldKey: string, value: any, nested?: boolean) => {
        const section = localSections.find(s => s.section_type === sectionType);
        if (!section?.items?.[itemIndex]) return;
        const item = section.items[itemIndex];
        const lang = activeLang;

        // Update locally — config ile aynı katman kuralı: TR / dilden-bağımsız alan
        // baz item alanına; diğer diller item_i18n[lang]'e. Baz item asla başka
        // dilin metniyle kirlenmesin.
        setLocalSections(prev => prev.map(s => {
            if (s.section_type !== sectionType) return s;
            const items = [...(s.items || [])];
            const it = items[itemIndex];
            if (lang === 'tr' || isLangAgnostic(fieldKey)) {
                if (nested) {
                    items[itemIndex] = { ...it, extra: { ...it.extra, [fieldKey]: value } };
                } else {
                    items[itemIndex] = { ...it, [fieldKey]: value };
                }
            } else {
                const i18n = { ...((it.item_i18n as Record<string, any>) || {}) };
                const cur = { ...(i18n[lang] || {}) };
                if (nested) {
                    cur.extra = { ...(cur.extra || {}), [fieldKey]: value };
                } else {
                    cur[fieldKey] = value;
                }
                i18n[lang] = cur;
                items[itemIndex] = { ...it, item_i18n: i18n };
            }
            return { ...s, items };
        }));

        setPendingChanges(prev => {
            const existing = prev.findIndex(c => c.sectionType === sectionType && c.isItem && c.itemIndex === itemIndex && c.fieldKey === fieldKey && c.lang === lang);
            const change: PendingChange = { sectionId: section.id, sectionType, fieldKey, value, isItem: true, itemIndex, itemId: item.id, nested, lang };
            if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = change;
                return updated;
            }
            return [...prev, change];
        });
    }, [localSections, activeLang]);

    const saveAllChanges = useCallback(async (): Promise<boolean> => {
        // Wait for any pending blur handlers to complete
        await new Promise(r => setTimeout(r, 300));

        // Read from refs to get latest state after blur delay
        const changes = pendingRef.current;
        const sections = localSectionsRef.current;

        if (changes.length === 0) {
            console.log('[InlineEditor] No changes to save');
            return true;
        }
        setSaving(true);
        console.log('[InlineEditor] Saving', changes.length, 'changes for lang:', activeLang);
        try {
            // Group changes by section+lang and item+lang. Dil ARTIK anahtara dahil:
            // her grup KENDİ diline yazılır, kaydet-anındaki aktif dile değil. Eski
            // davranışta tek bir global activeLang kullanıldığı için, EN'de yapılan
            // bir düzenleme TR aktifken kaydedilince TR base config'e sızıp tüm
            // dilleri bozuyordu.
            const sectionChanges = new Map<string, { lang: string; sectionId: string; fields: Record<string, any> }>();
            const itemChanges = new Map<string, { lang: string; itemId: string; fields: Record<string, any> }>();

            for (const c of changes) {
                const lang = c.lang || activeLang; // geriye-dönük güvenlik (lang etiketsiz eski değişiklik)
                if (c.isItem && c.itemId) {
                    const key = `${c.itemId}__${lang}`;
                    const entry = itemChanges.get(key) || { lang, itemId: c.itemId, fields: {} };
                    if (c.nested) {
                        const section = sections.find(s => s.id === c.sectionId);
                        const item = section?.items?.find(i => i.id === c.itemId);
                        entry.fields.extra = { ...(item?.extra || {}), ...entry.fields.extra, [c.fieldKey]: c.value };
                    } else {
                        entry.fields[c.fieldKey] = c.value;
                    }
                    itemChanges.set(key, entry);
                } else {
                    const key = `${c.sectionId}__${lang}`;
                    const entry = sectionChanges.get(key) || { lang, sectionId: c.sectionId, fields: {} };
                    entry.fields[c.fieldKey] = c.value;
                    sectionChanges.set(key, entry);
                }
            }

            const { LandingVariantService } = await import('../services/admin/landingVariantService');
            const isVariantMode = !!variantId;

            const splitFields = (fields: Record<string, any>) => {
                const baseFields: Record<string, any> = {};
                const langFields: Record<string, any> = {};
                for (const [k, v] of Object.entries(fields)) {
                    if (isLangAgnostic(k)) baseFields[k] = v;
                    else langFields[k] = v;
                }
                return { baseFields, langFields };
            };

            // Save section config changes — her grup kendi diline (lang) yazılır
            for (const { lang, sectionId, fields } of sectionChanges.values()) {
                const section = sections.find(s => s.id === sectionId);
                if (!section) continue;

                if (isVariantMode) {
                    if (lang === 'tr') {
                        const updatedConfig = { ...section.config, ...fields };
                        await LandingVariantService.updateSection(sectionId, { config: updatedConfig });
                    } else {
                        const { baseFields, langFields } = splitFields(fields);
                        const { supabase } = await import('../lib/supabase/client');
                        // Lang-agnostic fields go to base config (visible in all languages)
                        if (Object.keys(baseFields).length > 0) {
                            const updatedConfig = { ...section.config, ...baseFields };
                            await LandingVariantService.updateSection(sectionId, { config: updatedConfig });
                        }
                        // Translatable fields go to config_i18n[lang]
                        if (Object.keys(langFields).length > 0) {
                            const newI18n = { ...(section.config_i18n || {}), [lang]: { ...(section.config_i18n?.[lang] || {}), ...langFields } };
                            await supabase.from('landing_variant_sections').update({ config_i18n: newI18n }).eq('id', sectionId);
                        }
                    }
                } else {
                    if (lang === 'tr') {
                        const newConfig = { ...section.config, ...fields };
                        await LandingPageCmsService.updateSection(sectionId, { config: newConfig });
                    } else {
                        const { baseFields, langFields } = splitFields(fields);
                        if (Object.keys(baseFields).length > 0) {
                            await LandingPageCmsService.updateSection(sectionId, { config: { ...section.config, ...baseFields } });
                        }
                        if (Object.keys(langFields).length > 0) {
                            const langConfig = { ...(section.config_i18n?.[lang] || {}), ...langFields };
                            await LandingPageCmsService.saveLanguageConfig(sectionId, lang, langConfig);
                        }
                    }
                }
            }

            // Save item changes — split lang-agnostic fields (media_url, icon) from translatable fields
            for (const { lang, itemId, fields } of itemChanges.values()) {
                if (isVariantMode) {
                    if (lang === 'tr') {
                        await LandingVariantService.updateItem(itemId, fields);
                    } else {
                        const { baseFields, langFields } = splitFields(fields);
                        // Strip lang-agnostic keys from extra too
                        if (langFields.extra) {
                            const e = langFields.extra as Record<string, any>;
                            const baseExtra: Record<string, any> = {};
                            const langExtra: Record<string, any> = {};
                            for (const [k, v] of Object.entries(e)) {
                                if (isLangAgnostic(k)) baseExtra[k] = v; else langExtra[k] = v;
                            }
                            if (Object.keys(baseExtra).length > 0) baseFields.extra = baseExtra;
                            if (Object.keys(langExtra).length > 0) langFields.extra = langExtra; else delete langFields.extra;
                        }
                        // Lang-agnostic → base item
                        if (Object.keys(baseFields).length > 0) {
                            await LandingVariantService.updateItem(itemId, baseFields);
                        }
                        // Translatable → item_i18n[lang]
                        if (Object.keys(langFields).length > 0) {
                            const { supabase } = await import('../lib/supabase/client');
                            const { data: current } = await supabase.from('landing_variant_items').select('item_i18n').eq('id', itemId).single();
                            const existingI18n = (current?.item_i18n || {}) as Record<string, any>;
                            const existingForLang = existingI18n[lang] || {};
                            const mergedForLang = { ...existingForLang };
                            for (const [k, v] of Object.entries(langFields)) {
                                if (k === 'extra') {
                                    mergedForLang.extra = { ...(existingForLang.extra || {}), ...(v as Record<string, any>) };
                                } else {
                                    mergedForLang[k] = v;
                                }
                            }
                            const newI18n = { ...existingI18n, [lang]: mergedForLang };
                            await supabase.from('landing_variant_items').update({ item_i18n: newI18n }).eq('id', itemId);
                        }
                    }
                } else {
                    if (lang === 'tr') {
                        await LandingPageCmsService.updateItem(itemId, fields);
                    } else {
                        const { baseFields, langFields } = splitFields(fields);
                        if (langFields.extra) {
                            const e = langFields.extra as Record<string, any>;
                            const baseExtra: Record<string, any> = {};
                            const langExtra: Record<string, any> = {};
                            for (const [k, v] of Object.entries(e)) {
                                if (isLangAgnostic(k)) baseExtra[k] = v; else langExtra[k] = v;
                            }
                            if (Object.keys(baseExtra).length > 0) baseFields.extra = baseExtra;
                            if (Object.keys(langExtra).length > 0) langFields.extra = langExtra; else delete langFields.extra;
                        }
                        if (Object.keys(baseFields).length > 0) {
                            await LandingPageCmsService.updateItem(itemId, baseFields);
                        }
                        if (Object.keys(langFields).length > 0) {
                            const item = sections.flatMap(s => s.items || []).find(i => i.id === itemId);
                            const existing = item?.item_i18n?.[lang] || {};
                            const merged: Record<string, any> = { ...existing };
                            for (const [k, v] of Object.entries(langFields)) {
                                if (k === 'extra') {
                                    merged.extra = { ...(existing.extra || {}), ...(v as Record<string, any>) };
                                } else {
                                    merged[k] = v;
                                }
                            }
                            await LandingPageCmsService.saveItemLanguageData(itemId, lang, merged);
                        }
                    }
                }
            }

            LandingPagePublicService.clearCache();
            // Clear localStorage cache so fresh data is loaded
            try {
                Object.keys(localStorage).forEach(k => {
                    if (k.startsWith('cafepaste_landing_data_') || k.startsWith('cafepaste_variant')) {
                        localStorage.removeItem(k);
                    }
                });
            } catch { /* ignore */ }
            setPendingChanges([]);
            // Wait a moment for DB to propagate, then reload
            await new Promise(r => setTimeout(r, 500));
            window.location.reload();
            return true;
        } catch (err) {
            console.error('[InlineEditor] Save failed:', err);
            return false;
        } finally {
            setSaving(false);
        }
    }, [pendingChanges, localSections, activeLang]);

    const discardChanges = useCallback(() => {
        setPendingChanges([]);
        setLocalSections(sections);
    }, [sections]);

    const moveSection = useCallback(async (sectionType: string, direction: 'up' | 'down') => {
        const idx = localSections.findIndex(s => s.section_type === sectionType);
        if (idx < 0) return;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= localSections.length) return;

        const reordered = [...localSections];
        [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
        setLocalSections(reordered);

        try {
            await LandingPageCmsService.reorderSections(reordered.map(s => s.id));
            LandingPagePublicService.clearCache();
        } catch {
            setLocalSections(sections);
        }
    }, [localSections, sections]);

    const toggleSectionVisibility = useCallback(async (sectionType: string) => {
        const section = localSections.find(s => s.section_type === sectionType);
        if (!section) return;

        setLocalSections(prev => prev.map(s => s.section_type === sectionType ? { ...s, is_active: !s.is_active } : s));

        try {
            await LandingPageCmsService.updateSection(section.id, { is_active: !section.is_active });
            LandingPagePublicService.clearCache();
        } catch {
            setLocalSections(sections);
        }
    }, [localSections, sections]);

    // ─── STRUCTURAL EDITS ─────────────────────────────────────────────

    const addSection = useCallback(async (sectionType: string) => {
        try {
            const maxOrder = localSections.reduce((m, s) => Math.max(m, s.sort_order || 0), 0);
            const newSortOrder = maxOrder + 10;

            if (variantId) {
                const { LandingVariantService } = await import('../services/admin/landingVariantService');
                const sec = await LandingVariantService.addSection(variantId, sectionType, {});
                setLocalSections(prev => [...prev, { ...sec, items: [], is_active: true, sort_order: newSortOrder } as any]);
            } else {
                const sec = await LandingPageCmsService.createSection({
                    section_type: sectionType,
                    title: null,
                    is_active: true,
                    sort_order: newSortOrder,
                    config: {},
                    language_code: 'tr',
                });
                setLocalSections(prev => [...prev, { ...sec, items: [] } as any]);
            }
            LandingPagePublicService.clearCache();
        } catch (e) {
            console.error('[InlineEditor] addSection failed:', e);
        }
    }, [localSections, variantId]);

    const removeSection = useCallback(async (sectionId: string, hard = false) => {
        const section = localSections.find(s => s.id === sectionId);
        if (!section) return;

        if (hard) {
            // Hard delete (used rarely; soft delete is default)
            setLocalSections(prev => prev.filter(s => s.id !== sectionId));
            try {
                if (variantId) {
                    const { LandingVariantService } = await import('../services/admin/landingVariantService');
                    await LandingVariantService.removeSection(sectionId);
                } else {
                    await LandingPageCmsService.deleteSection(sectionId);
                }
                LandingPagePublicService.clearCache();
            } catch {
                setLocalSections(sections);
            }
            return;
        }

        // Soft delete: is_active = false
        setLocalSections(prev => prev.map(s => s.id === sectionId ? { ...s, is_active: false } : s));
        try {
            if (variantId) {
                const { LandingVariantService } = await import('../services/admin/landingVariantService');
                await LandingVariantService.updateSection(sectionId, { is_active: false });
            } else {
                await LandingPageCmsService.updateSection(sectionId, { is_active: false });
            }
            LandingPagePublicService.clearCache();
        } catch {
            setLocalSections(sections);
        }
    }, [localSections, sections, variantId]);

    const addItem = useCallback(async (sectionId: string) => {
        const section = localSections.find(s => s.id === sectionId);
        if (!section) return;
        const maxOrder = (section.items || []).reduce((m, i) => Math.max(m, i.sort_order || 0), 0);

        try {
            let newItem: any;
            if (variantId) {
                const { LandingVariantService } = await import('../services/admin/landingVariantService');
                newItem = await LandingVariantService.addItem(sectionId, {
                    title: 'Yeni öğe',
                    is_active: true,
                    sort_order: maxOrder + 10,
                });
            } else {
                newItem = await LandingPageCmsService.createItem({
                    section_id: sectionId,
                    title: 'Yeni öğe',
                    is_active: true,
                    sort_order: maxOrder + 10,
                });
            }
            setLocalSections(prev => prev.map(s =>
                s.id === sectionId ? { ...s, items: [...(s.items || []), newItem] } : s
            ));
            LandingPagePublicService.clearCache();
        } catch (e) {
            console.error('[InlineEditor] addItem failed:', e);
        }
    }, [localSections, variantId]);

    const removeItem = useCallback(async (itemId: string) => {
        const previousSections = localSections;
        setLocalSections(prev => prev.map(s => ({
            ...s,
            items: (s.items || []).filter(i => i.id !== itemId),
        })));
        try {
            if (variantId) {
                const { LandingVariantService } = await import('../services/admin/landingVariantService');
                await LandingVariantService.removeItem(itemId);
            } else {
                await LandingPageCmsService.deleteItem(itemId);
            }
            LandingPagePublicService.clearCache();
        } catch {
            setLocalSections(previousSections);
        }
    }, [localSections, variantId]);

    const duplicateItem = useCallback(async (itemId: string) => {
        const section = localSections.find(s => (s.items || []).some(i => i.id === itemId));
        if (!section) return;
        const item = (section.items || []).find(i => i.id === itemId);
        if (!item) return;
        const maxOrder = (section.items || []).reduce((m, i) => Math.max(m, i.sort_order || 0), 0);

        try {
            let newItem: any;
            const payload = {
                title: item.title,
                description: item.description,
                value_text: item.value_text,
                media_url: item.media_url,
                icon: item.icon,
                extra: item.extra,
                is_active: true,
                sort_order: maxOrder + 10,
            };
            if (variantId) {
                const { LandingVariantService } = await import('../services/admin/landingVariantService');
                newItem = await LandingVariantService.addItem(section.id, payload);
            } else {
                newItem = await LandingPageCmsService.createItem({
                    section_id: section.id,
                    ...payload,
                });
            }
            setLocalSections(prev => prev.map(s =>
                s.id === section.id ? { ...s, items: [...(s.items || []), newItem] } : s
            ));
            LandingPagePublicService.clearCache();
        } catch (e) {
            console.error('[InlineEditor] duplicateItem failed:', e);
        }
    }, [localSections, variantId]);

    const translateSection = useCallback(async (sectionId: string, targetLang: string) => {
        const section = localSections.find(s => s.id === sectionId);
        if (!section) return;

        const { AiTranslationService } = await import('../services/admin/aiTranslationService');

        const SKIP = new Set(['url', 'image', 'video', 'color', 'target', 'href', 'src', 'icon', 'logo', 'bg', 'background', 'gradient', 'link', 'anchor']);
        const ok = (f: string) => !SKIP.has(f) && !f.includes('url') && !f.includes('image') && !f.includes('video') && !f.includes('color') && !f.includes('_id') && !f.startsWith('_');

        // Collect strings from this section
        const batch: { key: string; value: string }[] = [];
        for (const [field, val] of Object.entries(section.config || {})) {
            if (typeof val === 'string' && val.trim() && ok(field)) batch.push({ key: `cfg_${field}`, value: val });
        }
        (section.items || []).forEach((item, iIdx) => {
            if (item.title) batch.push({ key: `i${iIdx}_title`, value: item.title });
            if (item.description) batch.push({ key: `i${iIdx}_desc`, value: item.description });
            if (item.value_text) batch.push({ key: `i${iIdx}_val`, value: item.value_text });
            for (const [field, val] of Object.entries(item.extra || {})) {
                if (typeof val === 'string' && val.trim() && ok(field)) batch.push({ key: `i${iIdx}_extra_${field}`, value: val });
            }
        });

        if (batch.length === 0) return;

        // AI translate
        const results = await AiTranslationService.translateBatch(batch, [targetLang]);
        const map = new Map(results.filter(r => r.value?.trim()).map(r => [r.key, r.value]));
        const t = (key: string, fb: string | null) => map.get(key) || fb;

        // Build translated config
        const translatedConfig: Record<string, any> = {};
        for (const [field, val] of Object.entries(section.config || {})) {
            translatedConfig[field] = (typeof val === 'string' && val.trim() && ok(field)) ? t(`cfg_${field}`, val) : val;
        }
        await LandingPageCmsService.saveLanguageConfig(sectionId, targetLang, translatedConfig);

        // Translate items
        for (let iIdx = 0; iIdx < (section.items || []).length; iIdx++) {
            const item = section.items![iIdx];
            const extra: Record<string, any> = {};
            for (const [field, val] of Object.entries(item.extra || {})) {
                extra[field] = (typeof val === 'string' && val.trim() && ok(field)) ? t(`i${iIdx}_extra_${field}`, val) : val;
            }
            await LandingPageCmsService.saveItemLanguageData(item.id, targetLang, {
                title: t(`i${iIdx}_title`, item.title),
                description: t(`i${iIdx}_desc`, item.description),
                value_text: t(`i${iIdx}_val`, item.value_text),
                extra,
            });
        }

        LandingPagePublicService.clearCache();
        // Reload to show translated content
        window.location.reload();
    }, [localSections]);

    return {
        editMode,
        setEditMode,
        activeLang,
        setActiveLang,
        pendingChanges,
        saving,
        localSections,
        getSection,
        updateField,
        updateItemField,
        saveAllChanges,
        discardChanges,
        moveSection,
        toggleSectionVisibility,
        translateSection,
        addSection,
        removeSection,
        addItem,
        removeItem,
        duplicateItem,
        hasChanges: pendingChanges.length > 0,
    };
}
