// CAFEPASTE Angels — AI translation writer for the Angels page CMS.
// Mirrors LandingVariantService.translateVariantToLanguage, with one key
// difference: Angels base copy is ENGLISH, so sourceLang='en' and Turkish is an
// ordinary translation target (config_i18n.tr / item_i18n.tr).
//
// Field selection is SECTION_META-driven (angelsSectionMeta.ts): only
// text/textarea fields whose key doesn't look like a URL are translated;
// icon / image / boolean fields are structurally excluded. Unknown/legacy keys
// fall back to the landing-variant skip heuristic.
//
// Admin-only module — import it dynamically so OpenAI never enters the public bundle.

import { supabase } from '../../lib/supabase/client';
import { AngelsPageContentService } from '../angels/angelsPageContentService';
import { ANGELS_DEFAULT_CONTENT } from '../../content/angelsDefaultContent';
import {
    SECTION_META,
    isTranslatableConfigField,
    type FieldDef,
} from '../../content/angelsSectionMeta';
import type { AngelsPageKey } from '../../types/angels';

const SKIP_FIELDS = new Set(['url', 'image', 'video', 'color', 'target', 'href', 'src', 'icon', 'logo', 'bg', 'background', 'gradient', 'link', 'anchor', 'media_type', 'type', 'variant', 'mode', 'layout', 'theme', 'size', 'align']);
const heuristicTranslatable = (field: string) =>
    !SKIP_FIELDS.has(field) && !field.includes('url') && !field.includes('image') &&
    !field.includes('video') && !field.includes('color') && !field.includes('_type') &&
    !field.endsWith('_id') && !field.startsWith('_');

function isTranslatableKey(key: string, metaFields: FieldDef[] | undefined): boolean {
    const def = metaFields?.find(f => f.key === key);
    if (def) return isTranslatableConfigField(def);
    return heuristicTranslatable(key);
}

const ITEM_TEXT_FIELDS = ['title', 'description', 'value_text'] as const;

// One translatable field, flattened for the admin translation grid
// (LanguageManager → Angels tab).
export interface AngelsTranslationEntry {
    pageKey: AngelsPageKey;
    sectionId: string;
    sectionType: string;
    sectionLabel: string;
    itemId?: string;
    itemIndex?: number;
    kind: 'cfg' | 'item' | 'extra';
    field: string;
    fieldLabel: string;
    /** Effective EN source value (code defaults merged with DB config). */
    source: string;
    /** lang → stored translation (missing key = untranslated). */
    translations: Record<string, string>;
}

export const AngelsTranslationService = {
    /**
     * Translate one Angels page's CMS content into targetLang and persist it
     * into angels_page_sections.config_i18n / angels_page_items.item_i18n.
     * Returns the number of translated strings saved. targetLang 'en' is a no-op.
     */
    async translateAngelsPageToLanguage(
        pageKey: AngelsPageKey,
        targetLang: string,
        options?: { onlyMissing?: boolean; onProgress?: (step: string) => void },
    ): Promise<number> {
        const lang = targetLang.split('-')[0];
        if (lang === 'en') return 0;
        const onlyMissing = options?.onlyMissing ?? false;
        const onProgress = options?.onProgress;

        const { AiTranslationService } = await import('./aiTranslationService');

        onProgress?.('İçerik yükleniyor...');
        let sections = await AngelsPageContentService.getPageSections(pageKey);
        if (sections === null) {
            // Page never seeded — translations need DB rows to live on. Seeding is
            // idempotent and changes nothing publicly (rows == code defaults).
            await AngelsPageContentService.seedPageDefaults(pageKey);
            sections = await AngelsPageContentService.getPageSections(pageKey);
        }
        if (!sections || sections.length === 0) return 0;

        const defaultsByType = new Map(
            (ANGELS_DEFAULT_CONTENT[pageKey] ?? []).map(d => [d.section_type, d]),
        );

        // ── Collect translatable strings ──
        onProgress?.('Çeviriler hazırlanıyor...');
        const batch: { key: string; value: string }[] = [];
        const has = (v: any) => typeof v === 'string' && v.trim();

        sections.forEach((sec, sIdx) => {
            const meta = SECTION_META[pageKey]?.[sec.section_type];
            // Effective source config: code defaults self-heal keys missing from
            // rows seeded before newer copy was added (runtime merge makes the
            // translated field win even when base DB config lacks it).
            const cfg = { ...(defaultsByType.get(sec.section_type)?.config ?? {}), ...(sec.config ?? {}) };
            const existingCfg = (sec.config_i18n ?? {})[lang] ?? {};
            for (const [field, val] of Object.entries(cfg)) {
                if (!has(val) || !isTranslatableKey(field, meta?.fields)) continue;
                if (onlyMissing && has(existingCfg[field])) continue;
                batch.push({ key: `s${sIdx}_cfg_${field}`, value: val as string });
            }
            (sec.items ?? []).forEach((item, iIdx) => {
                const existingItem = (item.item_i18n ?? {})[lang] ?? {};
                for (const field of ITEM_TEXT_FIELDS) {
                    const val = item[field];
                    if (!has(val) || !isTranslatableKey(field, meta?.itemFields)) continue;
                    if (onlyMissing && has(existingItem[field])) continue;
                    batch.push({ key: `s${sIdx}_i${iIdx}_${field}`, value: val as string });
                }
                const existingExtra = (existingItem.extra ?? {}) as Record<string, any>;
                for (const [field, val] of Object.entries(item.extra ?? {})) {
                    if (!has(val) || !heuristicTranslatable(field)) continue;
                    if (onlyMissing && has(existingExtra[field])) continue;
                    batch.push({ key: `s${sIdx}_i${iIdx}_extra_${field}`, value: val as string });
                }
            });
        });

        if (batch.length === 0) return 0;

        // ── AI translate (source language: English) ──
        onProgress?.(`${batch.length} metin çevriliyor...`);
        const translatedMap = new Map<string, string>();
        try {
            const results = await AiTranslationService.translateBatch(batch, [lang], 'en');
            results.forEach(r => { if (r.value?.trim()) translatedMap.set(r.key, r.value); });
        } catch (e) {
            console.error('[AngelsTranslation] AI translation failed:', e);
        }
        const tStrict = (key: string): string | null => {
            const v = translatedMap.get(key);
            return v && v.trim() ? v : null;
        };

        // ── Persist — only fields the AI actually returned ──
        onProgress?.('Çeviriler kaydediliyor...');
        let saved = 0;

        for (let sIdx = 0; sIdx < sections.length; sIdx++) {
            const sec = sections[sIdx];

            const translatedConfig: Record<string, any> = {};
            for (const key of translatedMap.keys()) {
                const prefix = `s${sIdx}_cfg_`;
                if (key.startsWith(prefix)) {
                    const v = tStrict(key);
                    if (v) translatedConfig[key.slice(prefix.length)] = v;
                }
            }
            if (Object.keys(translatedConfig).length > 0) {
                const existing = (sec.config_i18n ?? {})[lang] ?? {};
                const newConfigI18n = {
                    ...(sec.config_i18n ?? {}),
                    [lang]: { ...existing, ...translatedConfig },
                };
                const { error } = await supabase
                    .from('angels_page_sections')
                    .update({ config_i18n: newConfigI18n, updated_at: new Date().toISOString() })
                    .eq('id', sec.id);
                if (error) throw error;
                saved += Object.keys(translatedConfig).length;
            }

            const items = sec.items ?? [];
            for (let iIdx = 0; iIdx < items.length; iIdx++) {
                const item = items[iIdx];
                const itemTranslated: Record<string, any> = {};
                for (const field of ITEM_TEXT_FIELDS) {
                    const v = tStrict(`s${sIdx}_i${iIdx}_${field}`);
                    if (v) itemTranslated[field] = v;
                }
                const translatedExtra: Record<string, any> = {};
                for (const key of translatedMap.keys()) {
                    const prefix = `s${sIdx}_i${iIdx}_extra_`;
                    if (key.startsWith(prefix)) {
                        const v = tStrict(key);
                        if (v) translatedExtra[key.slice(prefix.length)] = v;
                    }
                }
                if (Object.keys(translatedExtra).length > 0) itemTranslated.extra = translatedExtra;
                if (Object.keys(itemTranslated).length === 0) continue;

                const existing = (item.item_i18n ?? {})[lang] ?? {};
                const merged = { ...existing, ...itemTranslated };
                if (itemTranslated.extra) merged.extra = { ...(existing.extra ?? {}), ...itemTranslated.extra };
                const newItemI18n = { ...(item.item_i18n ?? {}), [lang]: merged };
                const { error } = await supabase
                    .from('angels_page_items')
                    .update({ item_i18n: newItemI18n })
                    .eq('id', item.id);
                if (error) throw error;
                saved += Object.keys(itemTranslated).length;
            }
        }

        console.log(`[AngelsTranslation] ${pageKey} → ${lang}: ${batch.length} sent, ${saved} saved`);
        return saved;
    },

    /**
     * Flatten one page's translatable fields for the admin grid.
     * Returns null when the page has never been seeded (no DB rows to edit yet;
     * translateAngelsPageToLanguage auto-seeds on first run).
     */
    async listPageTranslationEntries(pageKey: AngelsPageKey): Promise<AngelsTranslationEntry[] | null> {
        const sections = await AngelsPageContentService.getPageSections(pageKey);
        if (sections === null) return null;

        const defaultsByType = new Map(
            (ANGELS_DEFAULT_CONTENT[pageKey] ?? []).map(d => [d.section_type, d]),
        );
        const has = (v: any) => typeof v === 'string' && v.trim();
        const entries: AngelsTranslationEntry[] = [];

        for (const sec of sections) {
            const meta = SECTION_META[pageKey]?.[sec.section_type];
            const sectionLabel = meta?.label ?? sec.section_type;
            const cfg = { ...(defaultsByType.get(sec.section_type)?.config ?? {}), ...(sec.config ?? {}) };
            const cfgI18n = (sec.config_i18n ?? {}) as Record<string, Record<string, any>>;

            for (const [field, val] of Object.entries(cfg)) {
                if (!has(val) || !isTranslatableKey(field, meta?.fields)) continue;
                const translations: Record<string, string> = {};
                for (const [lang, map] of Object.entries(cfgI18n)) {
                    if (has(map?.[field])) translations[lang] = map[field];
                }
                entries.push({
                    pageKey,
                    sectionId: sec.id,
                    sectionType: sec.section_type,
                    sectionLabel,
                    kind: 'cfg',
                    field,
                    fieldLabel: meta?.fields?.find(f => f.key === field)?.label ?? field,
                    source: val as string,
                    translations,
                });
            }

            (sec.items ?? []).forEach((item, itemIndex) => {
                const itemI18n = (item.item_i18n ?? {}) as Record<string, Record<string, any>>;
                for (const field of ITEM_TEXT_FIELDS) {
                    const val = item[field];
                    if (!has(val) || !isTranslatableKey(field, meta?.itemFields)) continue;
                    const translations: Record<string, string> = {};
                    for (const [lang, map] of Object.entries(itemI18n)) {
                        if (has(map?.[field])) translations[lang] = map[field];
                    }
                    entries.push({
                        pageKey,
                        sectionId: sec.id,
                        sectionType: sec.section_type,
                        sectionLabel,
                        itemId: item.id,
                        itemIndex,
                        kind: 'item',
                        field,
                        fieldLabel: meta?.itemFields?.find(f => f.key === field)?.label ?? field,
                        source: val as string,
                        translations,
                    });
                }
                for (const [field, val] of Object.entries(item.extra ?? {})) {
                    if (!has(val) || !heuristicTranslatable(field)) continue;
                    const translations: Record<string, string> = {};
                    for (const [lang, map] of Object.entries(itemI18n)) {
                        if (has(map?.extra?.[field])) translations[lang] = map.extra[field];
                    }
                    entries.push({
                        pageKey,
                        sectionId: sec.id,
                        sectionType: sec.section_type,
                        sectionLabel,
                        itemId: item.id,
                        itemIndex,
                        kind: 'extra',
                        field,
                        fieldLabel: field,
                        source: val as string,
                        translations,
                    });
                }
            });
        }
        return entries;
    },

    /**
     * Save (or clear, when value is blank) a single field's translation.
     * Reads the row fresh before merging so a concurrent page translate
     * can't be clobbered with stale i18n maps.
     */
    async saveFieldTranslation(entry: AngelsTranslationEntry, targetLang: string, value: string): Promise<void> {
        const lang = targetLang.split('-')[0];
        if (lang === 'en') throw new Error('EN taban dildir; çeviri olarak yazılamaz.');
        const trimmed = value.trim();

        if (entry.kind === 'cfg') {
            const { data, error } = await supabase
                .from('angels_page_sections')
                .select('config_i18n')
                .eq('id', entry.sectionId)
                .single();
            if (error) throw error;
            const i18n = { ...((data?.config_i18n ?? {}) as Record<string, Record<string, any>>) };
            const langMap = { ...(i18n[lang] ?? {}) };
            if (trimmed) langMap[entry.field] = trimmed;
            else delete langMap[entry.field];
            if (Object.keys(langMap).length > 0) i18n[lang] = langMap;
            else delete i18n[lang];
            const { error: upErr } = await supabase
                .from('angels_page_sections')
                .update({ config_i18n: i18n, updated_at: new Date().toISOString() })
                .eq('id', entry.sectionId);
            if (upErr) throw upErr;
            return;
        }

        if (!entry.itemId) throw new Error('Item kaydı bulunamadı.');
        const { data, error } = await supabase
            .from('angels_page_items')
            .select('item_i18n')
            .eq('id', entry.itemId)
            .single();
        if (error) throw error;
        const i18n = { ...((data?.item_i18n ?? {}) as Record<string, Record<string, any>>) };
        const langMap = { ...(i18n[lang] ?? {}) };
        if (entry.kind === 'extra') {
            const extra = { ...(langMap.extra ?? {}) };
            if (trimmed) extra[entry.field] = trimmed;
            else delete extra[entry.field];
            if (Object.keys(extra).length > 0) langMap.extra = extra;
            else delete langMap.extra;
        } else {
            if (trimmed) langMap[entry.field] = trimmed;
            else delete langMap[entry.field];
        }
        if (Object.keys(langMap).length > 0) i18n[lang] = langMap;
        else delete i18n[lang];
        const { error: upErr } = await supabase
            .from('angels_page_items')
            .update({ item_i18n: i18n })
            .eq('id', entry.itemId);
        if (upErr) throw upErr;
    },

    /** Does this page have any stored translation for the language? (UI overwrite prompt) */
    async hasTranslations(pageKey: AngelsPageKey, targetLang: string): Promise<boolean> {
        const lang = targetLang.split('-')[0];
        const sections = await AngelsPageContentService.getPageSections(pageKey);
        if (!sections) return false;
        return sections.some(s =>
            Object.keys((s.config_i18n ?? {})[lang] ?? {}).length > 0 ||
            (s.items ?? []).some(i => Object.keys((i.item_i18n ?? {})[lang] ?? {}).length > 0),
        );
    },
};
