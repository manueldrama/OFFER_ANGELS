import { supabase } from '../../../lib/supabase/client';
import type {
    EvaluationRecommendation, HrCandidateEvaluation,
} from '../../../types/hr';

// Aday değerlendirmeleri — değerlendirici başına bir satır.
//
// Aynı kişi ikinci kez puanlarsa yeni satır AÇILMAZ, kendi satırı güncellenir
// (DB'de unique(candidate_id, evaluator_id)). Aksi hâlde bir kişi farkında
// olmadan ortalamayı birkaç kez etkilerdi.
//
// hr_candidates.rating bu tablodan TRİGGER ile türetilir — burada elle
// güncellenmez, iki kaynak birbirinden sapardı.

export const HrEvaluationService = {
    async list(candidateId: string): Promise<HrCandidateEvaluation[]> {
        const { data, error } = await supabase
            .from('hr_candidate_evaluations')
            .select('*, sales_users:evaluator_id(full_name)')
            .eq('candidate_id', candidateId)
            .order('updated_at', { ascending: false });
        if (error) throw error;

        return (data || []).map((row: any) => ({
            ...row,
            evaluator_name: row.sales_users?.full_name ?? null,
        })) as HrCandidateEvaluation[];
    },

    /** Oturumdaki kullanıcının bu adaya verdiği puan (varsa). */
    async mine(candidateId: string): Promise<HrCandidateEvaluation | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return null;
        const { data, error } = await supabase
            .from('hr_candidate_evaluations')
            .select('*')
            .eq('candidate_id', candidateId)
            .eq('evaluator_id', user.id)
            .maybeSingle();
        if (error) throw error;
        return (data as HrCandidateEvaluation) ?? null;
    },

    async save(params: {
        candidateId: string;
        criteria: Record<string, number>;
        overall: number;
        recommendation?: EvaluationRecommendation | null;
        comment?: string | null;
    }): Promise<HrCandidateEvaluation> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error('Oturum bulunamadı.');
        if (!(params.overall >= 1 && params.overall <= 5)) {
            throw new Error('Genel puan 1-5 arasında olmalıdır.');
        }

        const { data, error } = await supabase
            .from('hr_candidate_evaluations')
            .upsert({
                candidate_id: params.candidateId,
                evaluator_id: user.id,
                criteria: params.criteria,
                overall: params.overall,
                recommendation: params.recommendation ?? null,
                comment: params.comment?.trim() || null,
            }, { onConflict: 'candidate_id,evaluator_id' })
            .select()
            .single();
        if (error) throw error;
        return data as HrCandidateEvaluation;
    },

    async remove(id: string): Promise<void> {
        const { error } = await supabase.from('hr_candidate_evaluations').delete().eq('id', id);
        if (error) throw error;
    },
};
