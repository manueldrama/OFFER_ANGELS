import { supabase } from '../../../lib/supabase/client';
import type {
    CandidateStatus, HrCandidate, HrCandidateEvent, HrCandidatePortal, HrDocument,
    HrDocumentType, HrOnboardingInvite, HrSalaryBand,
} from '../../../types/hr';
import { hrAudit } from './hrAudit';

// İşe alım hattı, özlük evrakları ve onboarding davetleri.
//
// GÜVENLİK: Yetki kararını RLS verir (hr_is_manager()). Aday/davet tabloları
// yalnızca İK yöneticisine açıktır; evraklarda çalışan kendi satırını görebilir.
//
// Storage: adminler bucket'a doğrudan erişir (hr_documents_bucket_* politikaları).
// Oturumsuz aday ise Worker üzerinden yükler — o yol functions/api/hr/router.ts'te.

async function authHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function postAdmin<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any).error || 'İşlem tamamlanamadı.');
    return json as T;
}

export const HrRecruitmentService = {
    // ── Aday kariyer portalı ─────────────────────────────────────────────────
    //
    // Link KALICIDIR ve aday kaydı açılır açılmaz veritabanı trigger'ı ile
    // doğar (20260824a). Bu yüzden "oluştur" ucu YOKTUR — yalnız okunur ve
    // gerektiğinde yenilenir.

    /** Adayın aktif portal satırı. Yoksa null (backfill kaçırmış demektir). */
    async getPortal(candidateId: string): Promise<HrCandidatePortal | null> {
        const { data, error } = await supabase
            .from('hr_candidate_portals')
            .select('id,candidate_id,slug,code,is_active,opened_at,last_seen_at,view_count,notified_at,created_at')
            .eq('candidate_id', candidateId)
            .eq('is_active', true)
            .maybeSingle();
        if (error) throw error;
        return (data as HrCandidatePortal) ?? null;
    },

    /**
     * Yeni kod üretir; ESKİ LİNK ANINDA ÖLÜR.
     *
     * Kod üreteci veritabanında yaşadığı için yenileme de orada yaşar: istemci
     * `update ... set code = ...` yapabilseydi kodu istemci SEÇEBİLİRDİ.
     * Fonksiyon security definer + hr_is_manager() kapılıdır.
     */
    async regeneratePortal(candidateId: string): Promise<string> {
        const { data, error } = await supabase
            .rpc('hr_regenerate_candidate_portal', { p_candidate_id: candidateId });
        if (error) throw error;
        await hrAudit('hr.candidate.portal_regenerate', 'hr_candidate_portals', candidateId);
        return data as string;
    },

    /** Adaya portal linkini WhatsApp ile gönderir (Worker; şablon + hijyen kapısı). */
    async notifyPortal(candidateId: string): Promise<void> {
        await postAdmin('/api/hr/career/notify', { candidate_id: candidateId });
    },

    // ── Adaylar ──────────────────────────────────────────────────────────────
    async listCandidates(): Promise<HrCandidate[]> {
        const { data, error } = await supabase
            .from('hr_candidates')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as HrCandidate[];
    },

    /**
     * Tekil aday — detay sayfası yalnız :id ile açılır.
     *
     * maybeSingle(): İK yetkisi olmayan kullanıcıya RLS satırı hiç döndürmez.
     * single() bunu hataya çevirirdi; biz "bulunamadı" ekranı göstermek
     * istiyoruz, kırmızı hata değil.
     */
    async getCandidate(id: string): Promise<HrCandidate | null> {
        const { data, error } = await supabase
            .from('hr_candidates')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return (data as HrCandidate) ?? null;
    },

    async createCandidate(payload: Partial<HrCandidate> & { full_name: string }): Promise<HrCandidate> {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_candidates')
            .insert({ ...payload, created_by: user?.id ?? null })
            .select()
            .single();
        if (error) throw error;
        return data as HrCandidate;
    },

    /**
     * Adaya uyan maaş bandı (20260830a).
     *
     * Eşleşme kuralı SQL'de: en özgül satır kazanır (unvan > departman > ülke).
     * Aynı kuralı burada tekrar yazsaydık, teklif onayına karar veren trigger
     * ile ekranda gösterilen bant ayrışabilirdi.
     */
    async salaryBandFor(params: {
        country: string; department: string | null; title: string | null; currency: string;
    }): Promise<HrSalaryBand | null> {
        const { data, error } = await supabase.rpc('hr_salary_band_for', {
            p_country: params.country,
            p_department: params.department,
            p_title: params.title,
            p_currency: params.currency,
        });
        if (error) return null;
        const row = Array.isArray(data) ? data[0] : data;
        return row?.id ? (row as HrSalaryBand) : null;
    },

    async updateCandidate(id: string, payload: Partial<HrCandidate>): Promise<HrCandidate> {
        const { data, error } = await supabase
            .from('hr_candidates')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as HrCandidate;
    },

    /** Durum geçişi. Geçmiş kaydını DB trigger'ı yazar — burada elle log tutulmaz. */
    async setCandidateStatus(id: string, status: CandidateStatus, reason?: string): Promise<void> {
        const payload: Partial<HrCandidate> = { status };
        if (status === 'rejected' && reason) payload.rejected_reason = reason;
        const { error } = await supabase.from('hr_candidates').update(payload).eq('id', id);
        if (error) throw error;
    },

    async deleteCandidate(id: string): Promise<void> {
        const { error } = await supabase.from('hr_candidates').delete().eq('id', id);
        if (error) throw error;
    },

    async listCandidateEvents(candidateId: string): Promise<HrCandidateEvent[]> {
        const { data, error } = await supabase
            .from('hr_candidate_events')
            .select('*')
            .eq('candidate_id', candidateId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as HrCandidateEvent[];
    },

    async addCandidateNote(candidateId: string, note: string, scheduledAt?: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('hr_candidate_events').insert({
            candidate_id: candidateId,
            event_type: scheduledAt ? 'interview' : 'note',
            note,
            scheduled_at: scheduledAt || null,
            created_by: user?.id ?? null,
        });
        if (error) throw error;
    },

    // ── Evrak türü kataloğu ──────────────────────────────────────────────────
    async listDocumentTypes(): Promise<HrDocumentType[]> {
        const { data, error } = await supabase
            .from('hr_document_types')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as HrDocumentType[];
    },

    // ── Evraklar ─────────────────────────────────────────────────────────────
    async listDocuments(owner: { employeeId?: string; candidateId?: string }): Promise<HrDocument[]> {
        let query = supabase.from('hr_documents').select('*').order('created_at', { ascending: false });
        if (owner.employeeId) query = query.eq('employee_id', owner.employeeId);
        else if (owner.candidateId) query = query.eq('candidate_id', owner.candidateId);
        else return [];
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as HrDocument[];
    },

    /**
     * Admin yüklemesi — doğrudan Storage'a. Dosya yolu burada üretilir;
     * kullanıcıdan gelen ad yol olarak KULLANILMAZ.
     */
    async uploadDocument(params: {
        employeeId?: string;
        candidateId?: string;
        docType: string;
        file: File;
        expiresAt?: string | null;
        issuedAt?: string | null;
    }): Promise<HrDocument> {
        const { employeeId, candidateId, docType, file } = params;
        const ownerId = employeeId || candidateId;
        if (!ownerId) throw new Error('Belge bir personele veya adaya bağlanmalıdır.');

        const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
        const safeType = docType.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'document';
        const scope = employeeId ? 'employee' : 'candidate';
        const path = `${scope}/${ownerId}/${safeType}/${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage
            .from('hr-documents')
            .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw upErr;

        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_documents')
            .insert({
                employee_id: employeeId ?? null,
                candidate_id: candidateId ?? null,
                doc_type: docType,
                storage_path: path,
                file_name: file.name.slice(0, 160),
                mime_type: file.type || null,
                file_size: file.size,
                issued_at: params.issuedAt || null,
                expires_at: params.expiresAt || null,
                // Admin'in kendi yüklediği belge incelenmiş sayılır.
                status: 'approved',
                reviewed_by: user?.id ?? null,
                reviewed_at: new Date().toISOString(),
                uploaded_via: 'admin',
                uploaded_by: user?.id ?? null,
            })
            .select()
            .single();

        if (error) {
            // DB satırı yazılamazsa dosyayı öksüz bırakma.
            await supabase.storage.from('hr-documents').remove([path]);
            throw error;
        }
        return data as HrDocument;
    },

    async reviewDocument(id: string, status: 'approved' | 'rejected', note?: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('hr_documents')
            .update({
                status,
                review_note: note || null,
                reviewed_by: user?.id ?? null,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', id);
        if (error) throw error;
    },

    async deleteDocument(doc: HrDocument): Promise<void> {
        const { error } = await supabase.from('hr_documents').delete().eq('id', doc.id);
        if (error) throw error;
        await supabase.storage.from('hr-documents').remove([doc.storage_path]);
        await hrAudit('hr.document.delete', 'hr_documents', doc.id, {
            doc_type: doc.doc_type, file_name: doc.file_name,
        });
    },

    /**
     * Görüntüleme adresi — 10 dakika geçerli. Public URL asla üretilmez,
     * bu yüzden link paylaşılsa bile kısa sürede ölür.
     */
    /**
     * Birden çok adayın vesikalığı — TEK sorgu + TEK imzalama çağrısı.
     *
     * Liste 24 aday gösterirken aday başına ayrı istek atmak 48 çağrı demekti.
     * Burada belgeler tek sorguda çekilir, imzalı adresler `createSignedUrls`
     * (çoğul) ile toplu üretilir.
     *
     * DENETİM KAYDI YAZILMAZ — bilinçli: bu bir "özlük evrakını açtı" olayı
     * değil, listede avatar gösterimi. getDocumentUrl() kaydı yazmaya devam
     * eder; listede her kaydırmada KVKK günlüğünü şişirmek, gerçek erişim
     * kayıtlarını kullanılamaz hâle getirirdi.
     */
    async photoUrlsFor(candidateIds: string[]): Promise<Map<string, string>> {
        const out = new Map<string, string>();
        if (candidateIds.length === 0) return out;

        const docs: HrDocument[] = [];
        // PostgREST .in() 150'den fazla kimlikte sessizce boş dönebiliyor.
        for (let i = 0; i < candidateIds.length; i += 150) {
            const { data } = await supabase
                .from('hr_documents')
                .select('candidate_id, storage_path')
                .eq('doc_type', 'photo')
                .in('candidate_id', candidateIds.slice(i, i + 150));
            docs.push(...((data || []) as HrDocument[]));
        }
        if (docs.length === 0) return out;

        const paths = docs.map(d => d.storage_path);
        const { data: signed } = await supabase.storage
            .from('hr-documents')
            .createSignedUrls(paths, 600);

        const byPath = new Map<string, string>();
        for (const row of signed || []) {
            if (row.path && row.signedUrl) byPath.set(row.path, row.signedUrl);
        }
        for (const d of docs) {
            const url = byPath.get(d.storage_path);
            if (url && d.candidate_id) out.set(d.candidate_id, url);
        }
        return out;
    },

    async getDocumentUrl(doc: HrDocument): Promise<string> {
        const { data, error } = await supabase.storage
            .from('hr-documents')
            .createSignedUrl(doc.storage_path, 600);
        if (error || !data?.signedUrl) throw error || new Error('Bağlantı üretilemedi.');
        // KVKK izi: özlük evrakına kimin baktığı kayda geçer.
        await hrAudit('hr.document.view', 'hr_documents', doc.id, {
            doc_type: doc.doc_type,
            employee_id: doc.employee_id,
            candidate_id: doc.candidate_id,
        });
        return data.signedUrl;
    },

    // ── Onboarding davetleri ────────────────────────────────────────────────
    async listInvites(owner: { employeeId?: string; candidateId?: string }): Promise<HrOnboardingInvite[]> {
        let query = supabase.from('hr_onboarding_invites').select('*').order('created_at', { ascending: false });
        if (owner.employeeId) query = query.eq('employee_id', owner.employeeId);
        else if (owner.candidateId) query = query.eq('candidate_id', owner.candidateId);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as HrOnboardingInvite[];
    },

    /**
     * Yeni davet linki üretir. Token yalnızca BU yanıtta açık gelir; veritabanında
     * hash'i saklanır. Link kaybolursa gösterilemez, yenisi üretilir.
     */
    async createInvite(payload: {
        candidate_id?: string;
        employee_id?: string;
        email?: string | null;
        full_name?: string | null;
        work_country?: string;
        /** Portalın açılacağı dil. Boşsa Worker ülkenin işvereninden türetir. */
        language_code?: string;
        ttl_days?: number;
    }): Promise<{ link: string; expires_at: string; invite_id: string }> {
        const res = await postAdmin<{ link: string; expires_at: string; invite_id: string }>(
            '/api/hr/invites', payload);
        // Link üretimi izlenebilir olmalı: bu bağlantı evrak yükleme yetkisi verir.
        // Token'ın KENDİSİ loglanmaz — denetim kaydı ikinci bir sızıntı yüzeyi olmamalı.
        await hrAudit('hr.invite.create', 'hr_onboarding_invites', res.invite_id, {
            candidate_id: payload.candidate_id ?? null,
            employee_id: payload.employee_id ?? null,
        });
        return res;
    },

    async cancelInvite(id: string): Promise<void> {
        const { error } = await supabase
            .from('hr_onboarding_invites')
            .update({ status: 'cancelled' })
            .eq('id', id);
        if (error) throw error;
    },

    /**
     * Adayın onboarding formunda girdiği bilgileri personel kaydına işler.
     * INVARIANT: Bu işlem YALNIZCA buradan, İK onayıyla yapılır — aday
     * hr_employees'e doğrudan yazamaz (bkz. 20260818b migration notu A).
     */
    async applyInviteToEmployee(invite: HrOnboardingInvite, employeeId: string): Promise<void> {
        const p = invite.personal_data || {};
        const patch: Record<string, unknown> = {};
        if (p.phone) patch.phone = p.phone;
        if (p.personal_email) patch.personal_email = p.personal_email;
        if (p.iban) patch.iban = p.iban;
        if (p.national_id) patch.national_id = p.national_id;

        if (Object.keys(patch).length > 0) {
            const { error } = await supabase.from('hr_employees').update(patch).eq('employee_id', employeeId);
            if (error) throw error;
        }

        const { error: invErr } = await supabase
            .from('hr_onboarding_invites')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', invite.id);
        if (invErr) throw invErr;
    },
};
