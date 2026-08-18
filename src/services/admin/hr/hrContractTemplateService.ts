import { supabase } from '../../../lib/supabase/client';
import type { ContractType, EngagementType, HrContractTemplate } from '../../../types/hr';
import { hrAudit } from './hrAudit';

// Sözleşme şablonları — metin kütüphanesi.
//
// AKTİFLEŞTİRME BİR HUKUKİ KARARDIR:
// Şablon is_active=false doğar. AI çıktısı taslaktır; 4857 sayılı İş Kanunu'na
// tabi bir metin hukukçu incelemesi ister. Aktifleştirme ayrı ve izlenen bir
// eylemdir (hrAudit) — "kim ne zaman bu metni gönderilebilir ilan etti"
// sorusunun cevabı kayıtta durur.

export const HrContractTemplateService = {
    async list(opts?: {
        contractType?: ContractType;
        activeOnly?: boolean;
        /** Kişinin ülkesi. Bu ülkeye ait + ülke-bağımsız (null) şablonlar döner. */
        countryCode?: string | null;
        /** Kişinin istihdam şekli. Bu şekle ait + şekil-bağımsız (null) şablonlar döner. */
        engagementType?: EngagementType | null;
    }): Promise<HrContractTemplate[]> {
        let q = supabase
            .from('hr_contract_templates')
            .select('*')
            .order('updated_at', { ascending: false });

        if (opts?.contractType) q = q.eq('contract_type', opts.contractType);
        if (opts?.activeOnly) q = q.eq('is_active', true);

        // null = "tüm ülkeler/şekiller". Mevcut şablonların hepsi null olduğu
        // için filtre uygulanınca kaybolmazlar — geriye dönük uyum böyle korunur.
        if (opts?.countryCode) {
            q = q.or(`country_code.is.null,country_code.eq.${opts.countryCode}`);
        }
        if (opts?.engagementType) {
            q = q.or(`engagement_type.is.null,engagement_type.eq.${opts.engagementType}`);
        }

        const { data, error } = await q;
        if (error) throw error;
        return (data || []) as HrContractTemplate[];
    },

    async get(id: string): Promise<HrContractTemplate | null> {
        const { data, error } = await supabase
            .from('hr_contract_templates').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return (data as HrContractTemplate) ?? null;
    },

    async create(params: {
        name: string;
        contractType: ContractType;
        languageCode?: string;
        countryCode?: string | null;
        engagementType?: EngagementType | null;
        bodyHtml?: string | null;
        sourceSample?: string | null;
        notes?: string | null;
    }): Promise<HrContractTemplate> {
        const name = params.name.trim();
        if (!name) throw new Error('Şablon adı zorunludur.');

        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_contract_templates')
            .insert({
                name,
                contract_type: params.contractType,
                language_code: params.languageCode || 'tr',
                // null = tüm ülkelerde / her iki istihdam şeklinde geçerli
                country_code: params.countryCode ?? null,
                engagement_type: params.engagementType ?? null,
                body_html: params.bodyHtml ?? null,
                // is_active kasten gönderilmiyor — DB varsayılanı false kalsın.
                source_sample: params.sourceSample ?? null,
                notes: params.notes?.trim() || null,
                created_by: user?.id ?? null,
            })
            .select()
            .single();
        if (error) throw error;

        const tpl = data as HrContractTemplate;
        await hrAudit('hr.contract_template.create', 'hr_contract_templates', tpl.id, {
            name: tpl.name, contract_type: tpl.contract_type,
        });
        return tpl;
    },

    /**
     * İçerik güncelleme. is_active BİLEREK kabul edilmez — aktifleştirme
     * setActive() üzerinden, ayrı ve denetlenen bir eylemdir. Aksi hâlde
     * sıradan bir "kaydet" tıklaması metni yayına alabilirdi.
     */
    async update(id: string, patch: {
        name?: string;
        contractType?: ContractType;
        languageCode?: string;
        countryCode?: string | null;
        engagementType?: EngagementType | null;
        bodyHtml?: string | null;
        sourceSample?: string | null;
        notes?: string | null;
    }): Promise<HrContractTemplate> {
        const row: Record<string, unknown> = {};
        if (patch.countryCode !== undefined) row.country_code = patch.countryCode;
        if (patch.engagementType !== undefined) row.engagement_type = patch.engagementType;
        if (patch.name !== undefined) {
            const n = patch.name.trim();
            if (!n) throw new Error('Şablon adı boş bırakılamaz.');
            row.name = n;
        }
        if (patch.contractType !== undefined) row.contract_type = patch.contractType;
        if (patch.languageCode !== undefined) row.language_code = patch.languageCode;
        if (patch.bodyHtml !== undefined) row.body_html = patch.bodyHtml;
        if (patch.sourceSample !== undefined) row.source_sample = patch.sourceSample;
        if (patch.notes !== undefined) row.notes = patch.notes?.trim() || null;

        if (Object.keys(row).length === 0) {
            const current = await this.get(id);
            if (!current) throw new Error('Şablon bulunamadı.');
            return current;
        }

        const { data, error } = await supabase
            .from('hr_contract_templates').update(row).eq('id', id).select().single();
        if (error) throw error;
        return data as HrContractTemplate;
    },

    /**
     * Yayına alma / geri çekme.
     *
     * Metni olmayan şablon aktifleştirilemez: aktif ama boş bir şablon,
     * gönderim listesinde görünüp seçildiğinde bomboş sözleşme üretirdi.
     */
    async setActive(id: string, isActive: boolean): Promise<void> {
        if (isActive) {
            const tpl = await this.get(id);
            if (!tpl) throw new Error('Şablon bulunamadı.');
            if (!tpl.body_html || !tpl.body_html.replace(/<[^>]*>/g, '').trim()) {
                throw new Error('Boş şablon aktifleştirilemez. Önce sözleşme metnini yazın.');
            }
        }

        const { error } = await supabase
            .from('hr_contract_templates').update({ is_active: isActive }).eq('id', id);
        if (error) throw error;

        await hrAudit(
            isActive ? 'hr.contract_template.activate' : 'hr.contract_template.deactivate',
            'hr_contract_templates', id,
        );
    },

    async duplicate(id: string): Promise<HrContractTemplate> {
        const src = await this.get(id);
        if (!src) throw new Error('Şablon bulunamadı.');
        return this.create({
            name: `${src.name} (kopya)`,
            contractType: src.contract_type,
            languageCode: src.language_code,
            countryCode: src.country_code,
            engagementType: src.engagement_type,
            bodyHtml: src.body_html,
            sourceSample: src.source_sample,
            notes: src.notes,
        });
    },

    async remove(id: string): Promise<void> {
        // hr_contracts.template_id ON DELETE SET NULL — gönderilmiş sözleşmeler
        // etkilenmez, metinleri kendi body_html'lerinde durur.
        const { error } = await supabase.from('hr_contract_templates').delete().eq('id', id);
        if (error) throw error;
        await hrAudit('hr.contract_template.delete', 'hr_contract_templates', id);
    },
};
