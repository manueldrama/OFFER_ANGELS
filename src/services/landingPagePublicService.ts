import { supabase } from '../lib/supabase/client';
import { LandingPageSection, LandingPageItem } from '../types';

export interface LandingData {
    sections: LandingPageSection[];
    campaignName: string | null;
    cheapestPrice: number | null;
}

/**
 * Resolve the effective config for a section given a target language.
 * Priority: config_i18n[lang] → config_i18n['tr'] → config (raw)
 */
function resolveConfig(section: LandingPageSection, lang: string): Record<string, any> {
    const i18n = section.config_i18n;
    if (i18n && typeof i18n === 'object') {
        if (i18n[lang] && Object.keys(i18n[lang]).length > 0) return { ...section.config, ...i18n[lang] };
        if (lang !== 'tr' && i18n['tr'] && Object.keys(i18n['tr']).length > 0) return { ...section.config, ...i18n['tr'] };
    }
    return section.config;
}

/**
 * Resolve item fields for a given language from item_i18n.
 * Merges translated fields on top of the base item.
 */
function resolveItem(item: LandingPageItem, lang: string): LandingPageItem {
    const i18n = item.item_i18n;
    if (!i18n || typeof i18n !== 'object') return item;

    const translated = i18n[lang] || (lang !== 'tr' ? i18n['tr'] : null);
    if (!translated || Object.keys(translated).length === 0) return item;

    return {
        ...item,
        title: translated.title ?? item.title,
        description: translated.description ?? item.description,
        value_text: translated.value_text ?? item.value_text,
        extra: { ...item.extra, ...translated.extra },
    };
}

export const LandingPagePublicService = {

    async getLandingData(language?: string, currency?: string): Promise<LandingData> {
        const lang = language || 'tr';
        const currencyCode = (currency || 'TRY').toUpperCase();

        // Strategy: önce aktif landing variant (yeni sistem) — admin LandingVariants
        // sayfası buraya yazıyor. Hiç aktif variant yoksa eski landing_page_*
        // tablolarına fallback (geriye dönük uyum / migration öncesi senaryo).
        let sectionsData: any[] | null = null;
        let usingVariant = false;
        try {
            const { data: variants } = await supabase
                .from('landing_variants')
                .select('id, sections:landing_variant_sections(*, items:landing_variant_items(*))')
                .eq('is_active', true)
                .contains('applicable_languages', [lang])
                .order('weight', { ascending: false })
                .limit(1);
            const variant = variants?.[0] as { sections?: any[] } | undefined;
            if (variant?.sections && variant.sections.length > 0) {
                sectionsData = variant.sections;
                usingVariant = true;
            }
        } catch {
            // Variant tabloları yoksa veya hata varsa eski yola düş
        }

        let sectionsRes: { data: any[] | null } = { data: null };
        if (!usingVariant) {
            sectionsRes = await supabase
                .from('landing_page_sections')
                .select('*, items:landing_page_items(*)')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
        }

        const [campaignRes, priceRes] = await Promise.all([
            supabase
                .from('campaigns')
                .select('id, name')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single(),
            supabase
                .from('pricing_rules')
                .select('amount, product:products!inner(product_type)')
                .eq('is_active', true)
                .eq('price_type', 'full_price')
                .eq('currency_code', currencyCode)
                .eq('products.product_type', 'machine')
                .order('amount', { ascending: true })
                .limit(1)
                .maybeSingle(),
        ]);

        // Resolve campaign name in active language from translations table
        let resolvedCampaignName: string | null = campaignRes.data?.name ?? null;
        if (campaignRes.data?.id && lang !== 'tr') {
            const { data: tData } = await supabase
                .from('translations')
                .select('value')
                .eq('namespace', 'campaigns')
                .eq('key', `campaign:${campaignRes.data.id}:name`)
                .eq('language_code', lang)
                .maybeSingle();
            if (tData?.value && tData.value.trim()) {
                resolvedCampaignName = tData.value;
            }
        }

        let sections = (sectionsData ?? sectionsRes.data ?? []) as LandingPageSection[];

        // Variant tablosunda language_code per-row yok (config_i18n ile multi-lang),
        // bu yüzden variant kullanılıyorsa hep new approach çalıştır.
        const hasI18n = usingVariant || sections.some(s => s.config_i18n && Object.keys(s.config_i18n).length > 0);

        if (hasI18n) {
            // ── NEW APPROACH: config_i18n ──
            // Keep only one section per type (prefer ones without language_code or with 'tr')
            const typeMap = new Map<string, LandingPageSection>();
            for (const s of sections) {
                const existing = typeMap.get(s.section_type);
                if (!existing) {
                    typeMap.set(s.section_type, s);
                } else {
                    // Prefer the one with config_i18n data
                    const hasMore = (s.config_i18n && Object.keys(s.config_i18n).length > 0);
                    const existingHas = (existing.config_i18n && Object.keys(existing.config_i18n).length > 0);
                    if (hasMore && !existingHas) typeMap.set(s.section_type, s);
                }
            }

            sections = Array.from(typeMap.values())
                .filter(s => {
                    // Check per-language visibility: config_i18n[lang]._active
                    if (lang !== 'tr' && s.config_i18n?.[lang]) {
                        return s.config_i18n[lang]._active !== false;
                    }
                    return true; // TR uses is_active (already filtered by query)
                })
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(s => ({
                    ...s,
                    config: resolveConfig(s, lang),
                    items: s.items?.map(item => resolveItem(item, lang)),
                }));

        } else {
            // ── OLD APPROACH: per-language rows (backwards compat) ──
            // Check per-language _active flag on TR master sections
            const disabledTypes = new Set<string>();
            if (lang !== 'tr') {
                for (const s of sections) {
                    if ((s.language_code === 'tr' || !s.language_code) && s.config_i18n?.[lang]?._active === false) {
                        disabledTypes.add(s.section_type);
                    }
                }
            }

            if (lang !== 'tr' && sections.length > 0) {
                const langSections = sections.filter(s => s.language_code === lang && !disabledTypes.has(s.section_type));
                const trSections = sections.filter(s => (s.language_code === 'tr' || !s.language_code) && !disabledTypes.has(s.section_type));

                if (langSections.length > 0) {
                    const coveredTypes = new Set(langSections.map(s => s.section_type));
                    sections = [
                        ...langSections,
                        ...trSections.filter(s => !coveredTypes.has(s.section_type)),
                    ].sort((a, b) => a.sort_order - b.sort_order);
                } else {
                    sections = trSections.sort((a, b) => a.sort_order - b.sort_order);
                }
            } else if (lang === 'tr') {
                // For TR, filter out non-TR rows
                const trOnly = sections.filter(s => s.language_code === 'tr' || !s.language_code);
                if (trOnly.length > 0) sections = trOnly;
            }
        }

        // Filter & sort items
        sections.forEach(section => {
            if (section.items) {
                section.items = section.items
                    .filter((item: LandingPageItem) => item.is_active)
                    .sort((a: LandingPageItem, b: LandingPageItem) => a.sort_order - b.sort_order);
            }
        });

        return {
            sections,
            campaignName: resolvedCampaignName,
            cheapestPrice: priceRes.data?.amount ? parseFloat(priceRes.data.amount) : null,
        };
    },

    /** @deprecated use getLandingData */
    async getActiveSections(): Promise<LandingPageSection[]> {
        const { sections } = await this.getLandingData();
        return sections;
    },

    clearCache() {
        // no-op
    },
};
