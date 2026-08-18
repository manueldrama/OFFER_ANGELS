import { supabase } from '../../../lib/supabase/client';
import type { ContractType, HrContract } from '../../../types/hr';
import { hrAudit } from './hrAudit';

// Personel/aday sözleşmeleri — gönderim, takip, karşı imza.
//
// HUKUKİ KAPSAM: Kişinin tarayıcıdan verdiği onay NİTELİKLİ ELEKTRONİK İMZA
// DEĞİLDİR; kimin ne zaman hangi IP'den hangi dosya sürümünü onayladığını
// gösteren bir delil kaydıdır. İş sözleşmesi gibi kritik belgelerde ıslak
// imzalı nüshanın da geri toplanması önerilir (imza yöntemi: wet_signed_upload).
//
// İmza sonrası dosya/özet değişimini DB trigger'ı reddeder
// (hr_contract_signed_immutable) — delil değerinin tek güvencesi odur.

function toHex(digest: ArrayBuffer): string {
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Dosyanın SHA-256 özeti — "hangi metin onaylandı" sorusunun cevabı. */
async function sha256Hex(file: File): Promise<string> {
    return toHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
}

/**
 * Sistem içi metnin özeti. Dosyalı sözleşmedeki content_sha256 ile aynı role
 * sahiptir: imzalanan metnin sonradan değiştirilmediğinin delili.
 */
async function sha256Text(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text);
    return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

export const HrContractService = {
    async listContracts(owner: { employeeId?: string; candidateId?: string }): Promise<HrContract[]> {
        let query = supabase.from('hr_contracts').select('*').order('created_at', { ascending: false });
        if (owner.employeeId) query = query.eq('employee_id', owner.employeeId);
        else if (owner.candidateId) query = query.eq('candidate_id', owner.candidateId);
        else return [];
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as HrContract[];
    },

    /**
     * Sözleşmeyi yükler ve doğrudan 'sent' durumunda oluşturur — kişi
     * onboarding bağlantısından görebilir hale gelir.
     */
    async sendContract(params: {
        employeeId?: string;
        candidateId?: string;
        title: string;
        contractType: ContractType;
        file: File;
        description?: string | null;
        validFrom?: string | null;
        validTo?: string | null;
    }): Promise<HrContract> {
        const { employeeId, candidateId, file } = params;
        const ownerId = employeeId || candidateId;
        if (!ownerId) throw new Error('Sözleşme bir personele veya adaya bağlanmalıdır.');

        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
        const scope = employeeId ? 'employee' : 'candidate';
        const path = `${scope}/${ownerId}/contracts/${crypto.randomUUID()}.${ext}`;

        const hash = await sha256Hex(file);

        const { error: upErr } = await supabase.storage
            .from('hr-documents')
            .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw upErr;

        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_contracts')
            .insert({
                employee_id: employeeId ?? null,
                candidate_id: candidateId ?? null,
                title: params.title.trim(),
                contract_type: params.contractType,
                description: params.description?.trim() || null,
                storage_path: path,
                file_name: file.name.slice(0, 160),
                mime_type: file.type || null,
                file_size: file.size,
                content_sha256: hash,
                status: 'sent',
                sent_at: new Date().toISOString(),
                valid_from: params.validFrom || null,
                valid_to: params.validTo || null,
                created_by: user?.id ?? null,
            })
            .select()
            .single();

        if (error) {
            await supabase.storage.from('hr-documents').remove([path]);
            throw error;
        }
        const contract = data as HrContract;
        await hrAudit('hr.contract.send', 'hr_contracts', contract.id, {
            title: contract.title, contract_type: contract.contract_type, sha256: hash,
        });
        return contract;
    },

    /**
     * Şablondan üretilen sözleşmeyi gönderir — dosya yok, metin kayıtta durur.
     *
     * `variables` SNAPSHOT'tır: imza anındaki maaş/unvan burada donar. Altı ay
     * sonra zam yapılsa bile imzalanan belge değişmez, çünkü metin canlı
     * veriden yeniden üretilmez.
     *
     * Dosya yükleme yolu (sendContract) KALDIRILMADI; iki yol yan yana yaşar.
     */
    async sendFromTemplate(params: {
        employeeId?: string;
        candidateId?: string;
        title: string;
        contractType: ContractType;
        bodyHtml: string;
        variables?: Record<string, string> | null;
        templateId?: string | null;
        description?: string | null;
        validFrom?: string | null;
        validTo?: string | null;
    }): Promise<HrContract> {
        const ownerId = params.employeeId || params.candidateId;
        if (!ownerId) throw new Error('Sözleşme bir personele veya adaya bağlanmalıdır.');

        const bodyHtml = params.bodyHtml?.trim();
        if (!bodyHtml || !bodyHtml.replace(/<[^>]*>/g, '').trim()) {
            throw new Error('Sözleşme metni boş olamaz.');
        }

        const hash = await sha256Text(bodyHtml);
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('hr_contracts')
            .insert({
                employee_id: params.employeeId ?? null,
                candidate_id: params.candidateId ?? null,
                title: params.title.trim(),
                contract_type: params.contractType,
                description: params.description?.trim() || null,
                storage_path: null,
                // file_name NOT NULL — sistem içi metinde de anlamlı bir ad durmalı;
                // indirilen PDF'in adı da buradan türer.
                file_name: `${params.title.trim().slice(0, 120) || 'sozlesme'}.pdf`,
                mime_type: 'text/html',
                file_size: new TextEncoder().encode(bodyHtml).length,
                content_sha256: hash,
                body_html: bodyHtml,
                variables: params.variables ?? null,
                template_id: params.templateId ?? null,
                generation_source: 'template',
                status: 'sent',
                sent_at: new Date().toISOString(),
                valid_from: params.validFrom || null,
                valid_to: params.validTo || null,
                created_by: user?.id ?? null,
            })
            .select()
            .single();
        if (error) throw error;

        const contract = data as HrContract;
        await hrAudit('hr.contract.send', 'hr_contracts', contract.id, {
            title: contract.title,
            contract_type: contract.contract_type,
            sha256: hash,
            source: 'template',
            template_id: params.templateId ?? null,
        });
        return contract;
    },

    /** 10 dakikalık görüntüleme adresi. `signed` true ise ıslak imzalı nüsha açılır. */
    async getContractUrl(contract: HrContract, signed = false): Promise<string> {
        const path = signed ? contract.signed_storage_path : contract.storage_path;
        if (!path) throw new Error('Dosya bulunamadı.');
        const { data, error } = await supabase.storage.from('hr-documents').createSignedUrl(path, 600);
        if (error || !data?.signedUrl) throw error || new Error('Bağlantı üretilemedi.');
        return data.signedUrl;
    },

    /**
     * İK, yüklenen ıslak imzalı nüshayı reddeder (okunaksız, eksik sayfa, imzasız).
     * Sözleşme 'sent'e döner ve kişi aynı bağlantıdan yeniden yükleyebilir.
     *
     * Metin ve özet DEĞİŞMEZ — yalnızca imza delili geçersiz kılınır. DB trigger'ı
     * alanların TAMAMEN temizlenmesini şart koşar (yarım kalmış "imzalı ama
     * imzacısı yok" kaydı oluşamaz).
     */
    async rejectSignedCopy(contract: HrContract, reason?: string): Promise<void> {
        const oldPath = contract.signed_storage_path;
        const { error } = await supabase
            .from('hr_contracts')
            .update({
                status: 'sent',
                signed_at: null,
                signed_full_name: null,
                signed_ip: null,
                signed_user_agent: null,
                signature_method: null,
                signed_storage_path: null,
                signed_file_name: null,
                notes: reason?.trim()
                    ? `${contract.notes ? contract.notes + '\n' : ''}İmzalı nüsha reddedildi: ${reason.trim()}`
                    : contract.notes,
            })
            .eq('id', contract.id);
        if (error) throw error;
        if (oldPath) await supabase.storage.from('hr-documents').remove([oldPath]);
        // İmza delilini geçersiz kılmak ciddi bir işlem; izi kalmalı.
        await hrAudit('hr.contract.reject_signed', 'hr_contracts', contract.id, {
            reason: reason?.trim() || null,
        });
    },

    /** Şirket tarafının onayı — süreci kapatır. */
    async countersign(id: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('hr_contracts')
            .update({
                status: 'countersigned',
                countersigned_at: new Date().toISOString(),
                countersigned_by: user?.id ?? null,
            })
            .eq('id', id);
        if (error) throw error;
        await hrAudit('hr.contract.countersign', 'hr_contracts', id);
    },

    async cancelContract(id: string): Promise<void> {
        const { error } = await supabase.from('hr_contracts').update({ status: 'cancelled' }).eq('id', id);
        if (error) throw error;
    },

    /**
     * Silme. İmzalanmış sözleşmelerde ÇAĞIRILMAMALIDIR — özlük dosyasının
     * delil zinciri kopar; onun yerine 'cancelled' kullanılır. UI bunu engeller.
     */
    async deleteContract(contract: HrContract): Promise<void> {
        const { error } = await supabase.from('hr_contracts').delete().eq('id', contract.id);
        if (error) throw error;
        const paths = [contract.storage_path, contract.signed_storage_path].filter(Boolean) as string[];
        if (paths.length) await supabase.storage.from('hr-documents').remove(paths);
    },
};
