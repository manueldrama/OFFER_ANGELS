import { supabase } from '../../../lib/supabase/client';
import type { HrCompany } from '../../../types/hr';

// İşveren tüzel kişilikleri — ülke başına bir kayıt.
//
// Çalışanın işvereni hr_employees.work_country üzerinden çözülür; ayrı bir
// company_id bağı yoktur. Sözleşmedeki {{sirketUnvani}}, {{sirketAdresi}} ve
// {{sirketVergi}} bu tablodan gelir — 20260821a öncesi tek bir global ayardan
// geliyordu ve her ülkede aynı unvan yazılıyordu.

export const HrCompanyService = {
    async list(activeOnly = false): Promise<HrCompany[]> {
        let q = supabase.from('hr_companies').select('*').order('country_code');
        if (activeOnly) q = q.eq('is_active', true);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []) as HrCompany[];
    },

    /**
     * Ülkenin işvereni. Kayıt yoksa null döner — çağıran taraf yer tutucuyu
     * BOŞ bırakır ve "bu ülke için işveren tanımlı değil" uyarısı gösterir.
     * Başka bir ülkenin şirketine düşmek, sözleşmeye yanlış tüzel kişilik
     * yazmak demektir.
     */
    async forCountry(countryCode: string | null | undefined): Promise<HrCompany | null> {
        if (!countryCode) return null;
        const { data, error } = await supabase
            .from('hr_companies')
            .select('*')
            .eq('country_code', countryCode)
            .eq('is_active', true)
            .maybeSingle();
        if (error) throw error;
        return (data as HrCompany) ?? null;
    },

    async upsert(payload: {
        country_code: string;
        legal_name: string;
        address?: string | null;
        tax_info?: string | null;
        registration_no?: string | null;
        default_currency?: string | null;
        /** Ülkenin aylık bonus tavanı; kur = default_currency (20260901a). */
        max_monthly_bonus?: number | null;
        default_language?: string;
        is_active?: boolean;
        notes?: string | null;
    }): Promise<HrCompany> {
        const name = payload.legal_name.trim();
        if (!name) throw new Error('Şirket unvanı zorunludur.');

        const { data, error } = await supabase
            .from('hr_companies')
            .upsert({ ...payload, legal_name: name }, { onConflict: 'country_code' })
            .select()
            .single();
        if (error) throw error;
        return data as HrCompany;
    },

    async remove(id: string): Promise<void> {
        const { error } = await supabase.from('hr_companies').delete().eq('id', id);
        if (error) throw error;
    },
};
