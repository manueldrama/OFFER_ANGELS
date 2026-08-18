// CAFEPASTE Angels — editable page content data layer.
// Client-side Supabase access, mirroring landingVariantService.ts (no backend API;
// RLS policies in 20260716_angels_page_content.sql handle auth).
//
// Fallback contract: getPageSections() returns null when the page has no rows or
// the query fails — useAngelsContent() then renders ANGELS_DEFAULT_CONTENT instead.

import { supabase } from '../../lib/supabase/client';
import { ANGELS_DEFAULT_CONTENT } from '../../content/angelsDefaultContent';
import type {
    AngelsPageKey,
    AngelsPageSection,
    AngelsPageItem,
    ResolvedAngelsSection,
    ResolvedAngelsItem,
} from '../../types/angels';

function sortByOrder<T extends { sort_order: number }>(rows: T[]): T[] {
    return rows.slice().sort((a, b) => a.sort_order - b.sort_order);
}

export const AngelsPageContentService = {
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC
    // ═══════════════════════════════════════════════════════════════════════

    /** All sections (incl. inactive) of one page with their items. null = no rows / error. */
    async getPageSections(pageKey: AngelsPageKey): Promise<AngelsPageSection[] | null> {
        const { data, error } = await supabase
            .from('angels_page_sections')
            .select('*, items:angels_page_items(*)')
            .eq('page_key', pageKey)
            .order('sort_order', { ascending: true });
        if (error) {
            console.error('[angels] page content load failed', error);
            return null;
        }
        if (!data || data.length === 0) return null;
        return data as AngelsPageSection[];
    },

    /** DB rows → render shape: drop inactive, sort sections + items. */
    resolvePublicSections(sections: AngelsPageSection[]): ResolvedAngelsSection[] {
        return sortByOrder(sections.filter(s => s.is_active)).map(s => ({
            id: s.id,
            section_type: s.section_type,
            sort_order: s.sort_order,
            config: s.config ?? {},
            config_i18n: s.config_i18n ?? {},
            items: sortByOrder((s.items ?? []).filter(i => i.is_active)).map(toResolvedItem),
        }));
    },

    /** Code defaults → the same render shape (used when the DB has no rows). */
    resolveDefaultSections(pageKey: AngelsPageKey): ResolvedAngelsSection[] {
        return sortByOrder(ANGELS_DEFAULT_CONTENT[pageKey] ?? []).map(s => ({
            id: null,
            section_type: s.section_type,
            sort_order: s.sort_order,
            config: s.config,
            items: (s.items ?? []).map(i => ({
                id: null,
                title: i.title ?? null,
                description: i.description ?? null,
                value_text: i.value_text ?? null,
                media_url: i.media_url ?? null,
                icon: i.icon ?? null,
                extra: i.extra ?? {},
            })),
        }));
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════════════

    async updateSection(
        id: string,
        updates: Partial<Pick<AngelsPageSection, 'is_active' | 'sort_order' | 'config'>>,
    ): Promise<void> {
        const { error } = await supabase
            .from('angels_page_sections')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    /** Persist a drag-drop order: sort_order = index * 10 (landing variant pattern). */
    async reorderSections(orderedIds: string[]): Promise<void> {
        for (let i = 0; i < orderedIds.length; i++) {
            const { error } = await supabase
                .from('angels_page_sections')
                .update({ sort_order: i * 10 })
                .eq('id', orderedIds[i]);
            if (error) throw error;
        }
    },

    async addItem(
        sectionId: string,
        item: Partial<Omit<AngelsPageItem, 'id' | 'section_id' | 'created_at'>>,
    ): Promise<AngelsPageItem> {
        const { data, error } = await supabase
            .from('angels_page_items')
            .insert({ section_id: sectionId, ...item })
            .select()
            .single();
        if (error) throw error;
        return data as AngelsPageItem;
    },

    async updateItem(
        id: string,
        updates: Partial<Omit<AngelsPageItem, 'id' | 'section_id' | 'created_at'>>,
    ): Promise<void> {
        const { error } = await supabase.from('angels_page_items').update(updates).eq('id', id);
        if (error) throw error;
    },

    async removeItem(id: string): Promise<void> {
        const { error } = await supabase.from('angels_page_items').delete().eq('id', id);
        if (error) throw error;
    },

    async reorderItems(orderedIds: string[]): Promise<void> {
        for (let i = 0; i < orderedIds.length; i++) {
            const { error } = await supabase
                .from('angels_page_items')
                .update({ sort_order: i * 10 })
                .eq('id', orderedIds[i]);
            if (error) throw error;
        }
    },

    /**
     * Idempotent seed: upsert every default section of the page
     * (ON CONFLICT (page_key, section_type) DO NOTHING) and insert items only
     * for sections that were just created — re-running never duplicates or
     * overwrites admin edits.
     */
    async seedPageDefaults(pageKey: AngelsPageKey): Promise<void> {
        const defaults = ANGELS_DEFAULT_CONTENT[pageKey] ?? [];
        if (defaults.length === 0) return;

        const { data: existing, error: exErr } = await supabase
            .from('angels_page_sections')
            .select('section_type')
            .eq('page_key', pageKey);
        if (exErr) throw exErr;
        const existingTypes = new Set((existing ?? []).map(r => r.section_type as string));

        for (const def of defaults) {
            if (existingTypes.has(def.section_type)) continue;
            const { data: section, error: secErr } = await supabase
                .from('angels_page_sections')
                .insert({
                    page_key: pageKey,
                    section_type: def.section_type,
                    sort_order: def.sort_order,
                    config: def.config,
                })
                .select()
                .single();
            if (secErr) throw secErr;

            const items = def.items ?? [];
            if (items.length > 0) {
                const { error: itemErr } = await supabase.from('angels_page_items').insert(
                    items.map((item, idx) => ({
                        section_id: (section as AngelsPageSection).id,
                        title: item.title ?? null,
                        description: item.description ?? null,
                        value_text: item.value_text ?? null,
                        media_url: item.media_url ?? null,
                        icon: item.icon ?? null,
                        extra: item.extra ?? {},
                        sort_order: idx * 10,
                    })),
                );
                if (itemErr) throw itemErr;
            }
        }
    },
};

function toResolvedItem(item: AngelsPageItem): ResolvedAngelsItem {
    return {
        id: item.id,
        title: item.title,
        description: item.description,
        value_text: item.value_text,
        media_url: item.media_url,
        icon: item.icon,
        extra: item.extra ?? {},
        item_i18n: item.item_i18n ?? {},
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Render-time localization (mirrors landingPagePublicService.resolveConfig).
// Angels base content is EN — unlike the rest of the site, TR is an ordinary
// translation target stored under config_i18n.tr / item_i18n.tr.
// Fallback per field: *_i18n[lang][field] → base field (EN).
// ═══════════════════════════════════════════════════════════════════════════

function hasEntries(map: Record<string, any> | undefined | null): map is Record<string, any> {
    return !!map && typeof map === 'object' && Object.keys(map).length > 0;
}

function localizeAngelsItem(item: ResolvedAngelsItem, lang: string): ResolvedAngelsItem {
    const tr = item.item_i18n?.[lang];
    if (!hasEntries(tr)) return item;
    return {
        ...item,
        // Only text fields — media_url/icon are never translated (nor written by the AI writer).
        title: typeof tr.title === 'string' && tr.title ? tr.title : item.title,
        description: typeof tr.description === 'string' && tr.description ? tr.description : item.description,
        value_text: typeof tr.value_text === 'string' && tr.value_text ? tr.value_text : item.value_text,
        extra: hasEntries(tr.extra) ? { ...item.extra, ...tr.extra } : item.extra,
    };
}

/** Localized view of a resolved section; returns the section untouched for EN or when no translation exists. */
export function localizeAngelsSection(section: ResolvedAngelsSection, lang: string): ResolvedAngelsSection {
    if (lang === 'en') return section;
    const cfg = section.config_i18n?.[lang];
    const cfgLocalized = hasEntries(cfg);
    const items = section.items.map(i => localizeAngelsItem(i, lang));
    const itemsChanged = items.some((i, idx) => i !== section.items[idx]);
    if (!cfgLocalized && !itemsChanged) return section;
    return {
        ...section,
        config: cfgLocalized ? { ...section.config, ...cfg } : section.config,
        items,
    };
}
