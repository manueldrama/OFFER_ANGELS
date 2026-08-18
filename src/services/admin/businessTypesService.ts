import { supabase } from '../../lib/supabase/client';
import { AdminTranslationService } from './translationService';

/**
 * İşletme tipi sözlüğü — admin-yönetilen, çok dilli (slug + i18n).
 *
 * Tablo yalnızca slug + sıra + durum tutar. Müşteriye/admin'e gösterilen etiket
 * çeviri sisteminden gelir: t('common:businessTypes.'+slug).
 *
 * Liste yönetimi `leadTagsService` desenini, çeviri yazımı
 * `AdminTranslationService.bulkUpsert` deseni yeniden kullanır.
 */

export interface BusinessType {
    id: string;
    slug: string;
    is_active: boolean;
    is_default: boolean;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

/** İşletme tipi etiketlerinin yaşadığı çeviri namespace/anahtarı. */
export const BUSINESS_TYPE_NS = 'common';
export const businessTypeKey = (slug: string) => `businessTypes.${slug}`;
export const businessTypeI18nKey = (slug: string) => `${BUSINESS_TYPE_NS}:${businessTypeKey(slug)}`;

/**
 * TR etiketten URL-güvenli, stabil bir slug üretir.
 * Örn: "Düğün Organizasyonu" → "dugun-organizasyonu"
 */
export function slugifyBusinessType(label: string): string {
    const map: Record<string, string> = {
        ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
        Ç: 'c', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ş: 's', Ü: 'u',
    };
    return label
        .trim()
        .split('')
        .map(ch => map[ch] ?? ch)
        .join('')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'tip';
}

export const businessTypesService = {
    /** Müşteri/form tarafı — yalnızca aktif tipler, sıralı. */
    async listActive(): Promise<BusinessType[]> {
        const { data, error } = await supabase
            .from('business_types')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as BusinessType[];
    },

    /** Admin tarafı — pasifler dahil tüm tipler. */
    async listAll(): Promise<BusinessType[]> {
        const { data, error } = await supabase
            .from('business_types')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as BusinessType[];
    },

    /**
     * Yeni işletme tipi ekler. slug verilmezse TR etiketten üretilir.
     * Satır oluşturulduktan sonra TR etiketi çeviri tablosuna yazılır;
     * diğer diller admin'deki "AI ile çevir" akışıyla doldurulur.
     */
    async create(payload: { trLabel: string; slug?: string }): Promise<BusinessType> {
        const trLabel = payload.trLabel.trim();
        const slug = (payload.slug?.trim() || slugifyBusinessType(trLabel));
        const auth = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('business_types')
            .insert({
                slug,
                is_active: true,
                is_default: false,
                sort_order: 100,
                created_by: auth.data.user?.id ?? null,
            })
            .select()
            .single();
        if (error) throw error;

        // Etiketi çeviri sistemine yaz (TR). Diğer diller AI ile çevrilir.
        await AdminTranslationService.bulkUpsert([
            { namespace: BUSINESS_TYPE_NS, key: businessTypeKey(slug), language_code: 'tr', value: trLabel },
        ]);

        return data as BusinessType;
    },

    /** TR etiketi güncelle — yalnızca çeviri tablosunu yazar (slug değişmez). */
    async updateLabel(slug: string, trLabel: string): Promise<void> {
        await AdminTranslationService.bulkUpsert([
            { namespace: BUSINESS_TYPE_NS, key: businessTypeKey(slug), language_code: 'tr', value: trLabel.trim() },
        ]);
    },

    async setActive(id: string, is_active: boolean): Promise<BusinessType> {
        const { data, error } = await supabase
            .from('business_types')
            .update({ is_active, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as BusinessType;
    },

    /** Varsayılan (sistem) tipler silinemez. */
    async remove(id: string): Promise<void> {
        const { data: row, error: readErr } = await supabase
            .from('business_types')
            .select('is_default')
            .eq('id', id)
            .single();
        if (readErr) throw readErr;
        if (row?.is_default) {
            throw new Error('Varsayılan işletme tipleri silinemez. Bunun yerine pasifleştirebilirsiniz.');
        }
        const { error } = await supabase.from('business_types').delete().eq('id', id);
        if (error) throw error;
    },

    /** Sürükle-bırak sonrası yeni sıralamayı kaydet. */
    async reorder(orderedIds: string[]): Promise<void> {
        for (let i = 0; i < orderedIds.length; i++) {
            const { error } = await supabase
                .from('business_types')
                .update({ sort_order: (i + 1) * 10, updated_at: new Date().toISOString() })
                .eq('id', orderedIds[i]);
            if (error) throw error;
        }
    },
};
