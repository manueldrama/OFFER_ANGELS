import { supabase } from '../../lib/supabase/client';
import { ProductDetailSection, ProductDetailItem } from '../../types';

/**
 * Dual-write helper: upsert product content texts to the translations table.
 *
 * The public CustomerOffer page reads product texts via i18n (t('products:...'))
 * so it needs the translations table populated. We dual-write so admin can keep
 * editing the structured product_detail_sections/items rows AND the public
 * page renders instantly on language switch (cache hit in i18n memory).
 *
 * Fire-and-forget: failures here are logged but don't block the primary save.
 */
async function upsertProductTranslation(key: string, languageCode: string, value: string | null | undefined) {
    if (!value || !value.trim()) {
        // Empty value → delete the translation key so renderer falls back
        await supabase.from('translations').delete()
            .eq('namespace', 'products').eq('key', key).eq('language_code', languageCode)
            .then(({ error }) => { if (error) console.warn('[productContent] delete translation failed:', key, error.message); });
        return;
    }
    const { error } = await supabase.from('translations').upsert(
        { namespace: 'products', key, language_code: languageCode, value: value.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'namespace,key,language_code' }
    );
    if (error) console.warn('[productContent] upsert translation failed:', key, error.message);
}

async function syncSectionTranslations(section: ProductDetailSection) {
    const pid = String(section.product_id);
    const lang = section.language_code || 'tr';
    const stype = section.section_type;
    await Promise.all([
        upsertProductTranslation(`${pid}.${stype}.config.title`, lang, section.title),
        upsertProductTranslation(`${pid}.${stype}.config.eyebrow`, lang, (section as any).eyebrow),
    ]);
}

async function syncItemTranslations(item: ProductDetailItem & { section_type?: string; product_id?: string; language_code?: string }) {
    // Need section context to build the key. Look up section if not provided.
    let pid = item.product_id;
    let stype = item.section_type;
    let lang = item.language_code;
    if (!pid || !stype || !lang) {
        const { data: sec } = await supabase.from('product_detail_sections')
            .select('product_id, section_type, language_code')
            .eq('id', item.section_id)
            .single();
        if (!sec) return;
        pid = sec.product_id;
        stype = sec.section_type;
        lang = sec.language_code;
    }
    const prefix = `${pid}.${stype}.${item.id}`;
    await Promise.all([
        upsertProductTranslation(`${prefix}.title`, lang!, item.title),
        upsertProductTranslation(`${prefix}.description`, lang!, item.description),
        upsertProductTranslation(`${prefix}.value_text`, lang!, item.value_text),
        upsertProductTranslation(`${prefix}.sub_text`, lang!, (item as any).sub_text),
        upsertProductTranslation(`${prefix}.icon_value`, lang!, (item as any).icon_value),
    ]);
}

export const AdminProductContentService = {
    /**
     * Retrieves all product detail sections and their items for a specific product and language.
     * Guaranteed to return items ordered by their sort_order.
     */
    async getProductContent(productId: string, languageCode: string = 'tr'): Promise<ProductDetailSection[]> {
        const { data, error } = await supabase
            .from('product_detail_sections')
            .select('*, items:product_detail_items(*)')
            .eq('product_id', productId)
            .eq('language_code', languageCode)
            .order('sort_order', { ascending: true });

        if (error) throw error;

        // Items must also be sorted
        data?.forEach(section => {
            if (section.items) {
                section.items.sort((a, b) => a.sort_order - b.sort_order);
            }
        });

        return data as ProductDetailSection[];
    },

    /**
     * Check how complete the product profile is based on configured sections
     */
    async getProductCompleteness(productId: string, languageCode: string = 'tr'): Promise<{
        hasHero: boolean;
        hasAudience: boolean;
        hasFeatures: boolean;
        hasFaq: boolean;
        hasSpecs: boolean;
        hasGallery: boolean;
    }> {
        const { data, error } = await supabase
            .from('product_detail_sections')
            .select('section_type')
            .eq('product_id', productId)
            .eq('language_code', languageCode)
            .eq('is_active', true);

        if (error || !data) {
            return {
                hasHero: false,
                hasAudience: false,
                hasFeatures: false,
                hasFaq: false,
                hasSpecs: false,
                hasGallery: false
            };
        }

        const types = data.map(d => d.section_type);
        return {
            hasHero: types.includes('hero'),
            hasAudience: types.includes('audience'),
            hasFeatures: types.includes('features'),
            hasFaq: types.includes('faq'),
            hasSpecs: types.includes('specs'),
            hasGallery: types.includes('image_gallery') || types.includes('video_gallery')
        };
    },

    // --- SECTIONS ---

    async createSection(section: Partial<ProductDetailSection>): Promise<ProductDetailSection> {
        const { data, error } = await supabase
            .from('product_detail_sections')
            .insert([section])
            .select()
            .single();
        if (error) throw error;
        // Dual-write texts to translations table (fire-and-forget)
        syncSectionTranslations(data as ProductDetailSection).catch(() => {});
        return data as ProductDetailSection;
    },

    async updateSection(id: string, updates: Partial<ProductDetailSection>): Promise<ProductDetailSection> {
        const { data, error } = await supabase
            .from('product_detail_sections')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error && error.message?.includes('column') && error.message?.includes('schema cache')) {
            const safe = { ...updates };
            delete (safe as any).hide_header_desktop;
            delete (safe as any).hide_header_mobile;
            delete (safe as any).bg_color_mobile;
            delete (safe as any).bg_color_desktop;
            delete (safe as any).show_on_final_offer;
            delete (safe as any).show_on_final_offer_mobile;
            delete (safe as any).show_on_final_offer_desktop;
            delete (safe as any).final_offer_title;
            delete (safe as any).final_offer_eyebrow;
            delete (safe as any).final_offer_subtitle;
            const { data: d2, error: e2 } = await supabase
                .from('product_detail_sections')
                .update(safe)
                .eq('id', id)
                .select()
                .single();
            if (e2) throw e2;
            syncSectionTranslations(d2 as ProductDetailSection).catch(() => {});
            return d2 as ProductDetailSection;
        }
        if (error) throw error;
        syncSectionTranslations(data as ProductDetailSection).catch(() => {});
        return data as ProductDetailSection;
    },

    async reorderSections(orderedIds: string[]): Promise<void> {
        for (let i = 0; i < orderedIds.length; i++) {
            const { error } = await supabase
                .from('product_detail_sections')
                .update({ sort_order: i * 10 })
                .eq('id', orderedIds[i]);
            if (error) throw error;
        }
    },

    async deleteSection(id: string): Promise<void> {
        const { error } = await supabase.from('product_detail_sections').delete().eq('id', id);
        if (error) throw error;
    },

    // --- ITEMS ---

    async createItem(item: Partial<ProductDetailItem>): Promise<ProductDetailItem> {
        const { data, error } = await supabase
            .from('product_detail_items')
            .insert([{ ...item, is_active: true }])
            .select()
            .single();
        if (error && error.message?.includes('column') && error.message?.includes('schema cache')) {
            const safe = { ...item, is_active: true };
            delete (safe as any).icon_name;
            delete (safe as any).extra;
            const { data: d2, error: e2 } = await supabase
                .from('product_detail_items')
                .insert([safe])
                .select()
                .single();
            if (e2) throw e2;
            syncItemTranslations(d2 as ProductDetailItem).catch(() => {});
            return d2 as ProductDetailItem;
        }
        if (error) throw error;
        syncItemTranslations(data as ProductDetailItem).catch(() => {});
        return data as ProductDetailItem;
    },

    async updateItem(id: string, updates: Partial<ProductDetailItem>): Promise<ProductDetailItem> {
        const { data, error } = await supabase
            .from('product_detail_items')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error && error.message?.includes('column') && error.message?.includes('schema cache')) {
            // Column not yet in DB — strip unknown fields and retry
            const safe = { ...updates };
            delete (safe as any).icon_name;
            delete (safe as any).extra;
            delete (safe as any).hidden_on_final_offer;
            delete (safe as any).final_offer_overrides;
            const { data: d2, error: e2 } = await supabase
                .from('product_detail_items')
                .update(safe)
                .eq('id', id)
                .select()
                .single();
            if (e2) throw e2;
            syncItemTranslations(d2 as ProductDetailItem).catch(() => {});
            return d2 as ProductDetailItem;
        }
        if (error) throw error;
        syncItemTranslations(data as ProductDetailItem).catch(() => {});
        return data as ProductDetailItem;
    },

    async deleteItem(id: string): Promise<void> {
        const { error } = await supabase.from('product_detail_items').delete().eq('id', id);
        if (error) throw error;
    }
};
