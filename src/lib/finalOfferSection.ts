import type { ProductDetailSection, ProductDetailItem } from '../types';

/**
 * PDP section'ından, final teklif context'i için override'lı bir kopya üretir.
 * Tek doğruluk noktası: hem FinalOfferHero hem SectionRenderer bu helper'ı kullanır.
 *
 * Override hiyerarşisi (her alan için):
 *   final_offer_<field> > PDP <field>
 *
 * Item-level:
 *   - hidden_on_final_offer === true ise item filtrelenir
 *   - final_offer_overrides içindeki alanlar üst düzeye merge edilir (title/value_text/description/icon_value)
 */
export function applyFinalOfferOverrides(section: ProductDetailSection): ProductDetailSection {
    const title = section.final_offer_title || section.title;
    const eyebrow = section.final_offer_eyebrow || section.eyebrow;
    const sub_text = section.final_offer_subtitle || section.sub_text;

    const items = (section.items || [])
        .filter((it: ProductDetailItem) => !it.hidden_on_final_offer)
        .map((it: ProductDetailItem) => {
            const ov = it.final_offer_overrides;
            if (!ov) return it;
            return {
                ...it,
                title: ov.title || it.title,
                value_text: ov.value_text || it.value_text,
                description: ov.description || it.description,
                icon_value: ov.icon_value || it.icon_value,
            };
        });

    return {
        ...section,
        title,
        eyebrow,
        sub_text,
        items,
    };
}
