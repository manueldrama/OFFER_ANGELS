import { supabase } from '../../../lib/supabase/client';
import type {
    HrInterviewAnswer, HrInterviewInvite, HrInterviewQuestion,
    HrInterviewReview, HrInterviewTemplate,
} from '../../../types/hr';
import { hrAudit } from './hrAudit';

// Online video mülakatı — şablonlar, davetler, cevaplar, değerlendirmeler.
//
// GÜVENLİK: Yetki kararını RLS verir (hr_is_manager()). Şablon/soru CRUD'u
// doğrudan supabase üzerinden gider. Davet üretimi ve medya imzalama Worker'da
// yaşar: token üretimi ve service-role Storage erişimi tarayıcıda olmamalı.

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

export const HrInterviewService = {
    // ── Şablonlar ────────────────────────────────────────────────────────────
    async listTemplates(): Promise<HrInterviewTemplate[]> {
        const { data, error } = await supabase
            .from('hr_interview_templates')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as HrInterviewTemplate[];
    },

    /** Ülkeye uygun AKTİF şablonlar. country_code null = tüm ülkeler. */
    async activeTemplatesForCountry(country: string): Promise<HrInterviewTemplate[]> {
        const { data, error } = await supabase
            .from('hr_interview_templates')
            .select('*')
            .eq('is_active', true)
            .or(`country_code.is.null,country_code.eq.${(country || 'TR').toUpperCase()}`)
            .order('name');
        if (error) throw error;
        return (data || []) as HrInterviewTemplate[];
    },

    async createTemplate(payload: Partial<HrInterviewTemplate> & { name: string }): Promise<HrInterviewTemplate> {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_interview_templates')
            // is_active gönderilmez: şablon PASİF doğar (DB varsayılanı).
            .insert({ ...payload, created_by: user?.id ?? null })
            .select()
            .single();
        if (error) throw error;
        return data as HrInterviewTemplate;
    },

    async updateTemplate(id: string, payload: Partial<HrInterviewTemplate>): Promise<HrInterviewTemplate> {
        const { data, error } = await supabase
            .from('hr_interview_templates')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as HrInterviewTemplate;
    },

    async deleteTemplate(id: string): Promise<void> {
        const { error } = await supabase.from('hr_interview_templates').delete().eq('id', id);
        if (error) throw error;
    },

    // ── Sorular ──────────────────────────────────────────────────────────────
    async listQuestions(templateId: string): Promise<HrInterviewQuestion[]> {
        const { data, error } = await supabase
            .from('hr_interview_questions')
            .select('*')
            .eq('template_id', templateId)
            .order('sort_order');
        if (error) throw error;
        return (data || []) as HrInterviewQuestion[];
    },

    async createQuestion(payload: Partial<HrInterviewQuestion> & { template_id: string; prompt: Record<string, string> }): Promise<HrInterviewQuestion> {
        const { data, error } = await supabase
            .from('hr_interview_questions')
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        return data as HrInterviewQuestion;
    },

    async updateQuestion(id: string, payload: Partial<HrInterviewQuestion>): Promise<HrInterviewQuestion> {
        const { data, error } = await supabase
            .from('hr_interview_questions')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as HrInterviewQuestion;
    },

    async deleteQuestion(id: string): Promise<void> {
        const { error } = await supabase.from('hr_interview_questions').delete().eq('id', id);
        if (error) throw error;
    },

    /** Sıra değişimi tek toplu güncelleme — indeks unique değil, geçici değer gerekmez. */
    async reorderQuestions(rows: { id: string; sort_order: number }[]): Promise<void> {
        for (const row of rows) {
            const { error } = await supabase
                .from('hr_interview_questions')
                .update({ sort_order: row.sort_order })
                .eq('id', row.id);
            if (error) throw error;
        }
    },

    // ── Davetler ─────────────────────────────────────────────────────────────
    /**
     * Tek davet — tam sayfa inceleme ekranı için.
     *
     * listInvites(candidateId) ile çekip filtrelemek de mümkündü ama tek satır
     * göstermek için adayın TÜM davetlerini indirmek gereksiz. maybeSingle:
     * silinmiş/başkasına ait bir id ile gelen link hata değil "bulunamadı"
     * olmalı — sayfa boş durum gösterir, çökmez.
     */
    async getInvite(id: string): Promise<HrInterviewInvite | null> {
        const { data, error } = await supabase
            .from('hr_interview_invites')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return (data as HrInterviewInvite) ?? null;
    },

    async listInvites(candidateId: string): Promise<HrInterviewInvite[]> {
        const { data, error } = await supabase
            .from('hr_interview_invites')
            .select('*')
            .eq('candidate_id', candidateId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as HrInterviewInvite[];
    },

    /**
     * Aday listesi için: aday başına EN YENİ mülakat daveti.
     *
     * Aday listesinde mülakatın nerede olduğunu göstermek için gerekiyor;
     * eskiden bu bilgi yalnızca aday detayına inince görülüyordu.
     *
     * NEDEN `.in(candidateIds)` DEĞİL: 150'den fazla kimlikle yapılan `.in()`
     * çağrısı PostgREST'te sessizce boş dönebiliyor ve liste "hiç mülakat yok"
     * gibi görünürdü. Bunun yerine hafif bir sütun kümesi tek seferde çekilip
     * istemcide eşleniyor — aday havuzu büyüdüğünde bile tek sorgu.
     *
     * Sıralama created_at desc olduğu için Map'e İLK giren en yenidir.
     */
    async latestInvitesByCandidate(): Promise<Map<string, HrInterviewInvite>> {
        const { data, error } = await supabase
            .from('hr_interview_invites')
            .select('id, candidate_id, status, expires_at, submitted_at, avg_score, created_at')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });
        if (error) throw error;

        const map = new Map<string, HrInterviewInvite>();
        for (const row of (data || []) as HrInterviewInvite[]) {
            if (row.candidate_id && !map.has(row.candidate_id)) map.set(row.candidate_id, row);
        }
        return map;
    },

    /**
     * Davet üretir. Token YALNIZ burada, TEK KEZ döner — DB'de hash'i durur.
     * Denetim kaydına token YAZILMAZ.
     */
    async createInvite(payload: {
        candidate_id: string;
        template_id: string;
        language_code?: string;
        work_country?: string;
        full_name?: string | null;
        email?: string | null;
        ttl_days?: number;
    }): Promise<{ invite_id: string; link: string; expires_at: string; question_count: number }> {
        const res = await postAdmin<{ invite_id: string; link: string; expires_at: string; question_count: number }>(
            '/api/hr/interview/invites', payload,
        );
        await hrAudit('hr.interview.invite', 'hr_interview_invites', res.invite_id, {
            candidate_id: payload.candidate_id,
            template_id: payload.template_id,
            language_code: payload.language_code ?? null,
        });
        return res;
    },

    async cancelInvite(id: string): Promise<void> {
        const { error } = await supabase
            .from('hr_interview_invites')
            .update({ status: 'cancelled' })
            .eq('id', id);
        if (error) throw error;
    },

    /**
     * Mülakat süresini YERİNDE uzatır.
     *
     * NEDEN GEREKLİ: Önceden süresi dolan davette yapılacak tek şey yeni davet
     * üretmekti — bu yeni bir token, yeni bir link ve soruların yeniden
     * dondurulması demek. Adayın verdiği cevaplar eski davete bağlı olduğu için
     * bu, İK'nın "biraz daha süre ver" isteğine fazlasıyla ağır bir karşılık.
     * (Aynı yetenek satış tarafında `offerLinksService.extendOfferExpiry` olarak
     * zaten var; desen oradan alındı.)
     *
     * DURUM GERİ ALINIR: yalnız `expires_at` güncellenseydi satır 'expired'
     * kalır ve `resolveInterviewByPortal` süreye bakmadan ÖNCE durumu görüp
     * 410 dönmeye devam ederdi — süre uzar ama link yine açılmazdı.
     * `opened_at` doluysa aday linki daha önce açmıştır → 'opened',
     * açmamışsa → 'sent'.
     *
     * Worker ucu GEREKMEZ: hr_interview_invites RLS'i hr_is_manager() ile
     * kilitli, yazma yetkisi zaten yalnız İK yöneticisinde.
     */
    async extendInvite(id: string, newExpiresAt: string): Promise<void> {
        const { data: existing, error: fetchErr } = await supabase
            .from('hr_interview_invites')
            .select('id, candidate_id, status, expires_at, opened_at')
            .eq('id', id)
            .single();
        if (fetchErr) throw fetchErr;

        const patch: Record<string, unknown> = { expires_at: newExpiresAt };
        if (existing.status === 'expired') {
            patch.status = existing.opened_at ? 'opened' : 'sent';
        }

        const { error } = await supabase
            .from('hr_interview_invites')
            .update(patch)
            .eq('id', id);
        if (error) throw error;

        // Aday geçmişine okunabilir kayıt — İK aday kartını açtığında ne olduğunu
        // görsün. Sessizce başarısız olur; not yazılamadı diye uzatma geri alınmaz.
        await supabase.from('hr_candidate_events').insert({
            candidate_id: existing.candidate_id,
            event_type: 'interview',
            note: `Mülakat süresi uzatıldı: ${new Date(newExpiresAt).toLocaleDateString('tr-TR')}`,
        }).then(undefined, () => { /* yok say */ });

        await hrAudit('hr.interview.extend', 'hr_interview_invites', id, {
            candidate_id: existing.candidate_id,
            old_expires_at: existing.expires_at,
            new_expires_at: newExpiresAt,
            old_status: existing.status,
        });
    },

    // ── Cevaplar ─────────────────────────────────────────────────────────────
    async listAnswers(inviteId: string): Promise<HrInterviewAnswer[]> {
        const { data, error } = await supabase
            .from('hr_interview_answers')
            .select('*')
            .eq('invite_id', inviteId)
            .order('question_order');
        if (error) throw error;
        return (data || []) as HrInterviewAnswer[];
    },

    /** Kısa ömürlü (600 sn) izleme adresi + KVKK denetim izi. */
    async getAnswerUrl(answer: HrInterviewAnswer): Promise<{ url: string; mime_type: string | null }> {
        const res = await postAdmin<{ url: string; mime_type: string | null }>(
            '/api/hr/interview/media-sign', { answer_id: answer.id },
        );
        await hrAudit('hr.interview.view', 'hr_interview_answers', answer.id, {
            invite_id: answer.invite_id,
            question_order: answer.question_order,
        });
        return res;
    },

    /**
     * Soruya yeniden hak verir — TEK ÇEKİM kuralının tek istisnası.
     * attempt_no artar ve panelde görünür; sessiz bir sıfırlama değildir.
     */
    async reopenAnswer(answer: HrInterviewAnswer): Promise<void> {
        await postAdmin('/api/hr/interview/reopen', { answer_id: answer.id });
        await hrAudit('hr.interview.reopen', 'hr_interview_answers', answer.id, {
            invite_id: answer.invite_id,
            question_order: answer.question_order,
            previous_attempt: answer.attempt_no,
        });
    },

    /** Videoları şimdi siler. Puan, yorum ve transkript KALIR. */
    async purgeInvite(inviteId: string): Promise<{ removed: number }> {
        const res = await postAdmin<{ removed: number }>('/api/hr/interview/purge', { invite_id: inviteId });
        await hrAudit('hr.interview.purge', 'hr_interview_invites', inviteId, { removed: res.removed });
        return res;
    },

    // ── Değerlendirmeler ─────────────────────────────────────────────────────
    async listReviews(inviteId: string): Promise<HrInterviewReview[]> {
        const { data, error } = await supabase
            .from('hr_interview_reviews')
            .select('*, sales_users!hr_interview_reviews_reviewer_id_fkey(full_name)')
            .eq('invite_id', inviteId);
        if (error) throw error;
        return (data || []).map((r: any) => ({
            ...r,
            reviewer_name: r.sales_users?.full_name ?? null,
        })) as HrInterviewReview[];
    },

    async upsertReview(payload: {
        invite_id: string;
        scores: Record<string, number>;
        overall: number;
        recommendation: string | null;
        comment: string | null;
    }): Promise<HrInterviewReview> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error('Oturum bulunamadı.');

        const { data, error } = await supabase
            .from('hr_interview_reviews')
            .upsert({ ...payload, reviewer_id: user.id }, { onConflict: 'invite_id,reviewer_id' })
            .select()
            .single();
        if (error) throw error;
        return data as HrInterviewReview;
    },

    /**
     * Mülakat puanını ADAY değerlendirmesine taşır.
     *
     * NEDEN AYRI BİR EYLEM: hr_candidates.rating'in tek sahibi
     * hr_candidate_sync_rating() trigger'ıdır. Mülakat trigger'ı o kolona
     * yazsaydı iki yazar arasında sessiz sapma olurdu. Burada İK bilinçli
     * olarak "bu mülakat benim aday değerlendirmemdir" der ve kayıt normal
     * yoldan, mevcut trigger üzerinden geçer.
     */
    async promoteToCandidateEvaluation(payload: {
        candidate_id: string;
        overall: number;
        recommendation: string | null;
        comment: string | null;
    }): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error('Oturum bulunamadı.');

        const { error } = await supabase
            .from('hr_candidate_evaluations')
            .upsert({
                candidate_id: payload.candidate_id,
                evaluator_id: user.id,
                overall: payload.overall,
                recommendation: payload.recommendation,
                comment: payload.comment,
            }, { onConflict: 'candidate_id,evaluator_id' });
        if (error) throw error;
    },
};
