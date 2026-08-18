// İş ilanları — 20260831a_hr_job_postings.sql
//
// OKUMA İKİ KİTLEYE HİZMET EDER:
//   • İK paneli: taslak dâhil her şeyi görür (hr_is_manager politikası)
//   • Aday / ziyaretçi: yalnız yayındaki ilanı görür (anon politikası)
// İki ayrı servis yazılmaz; RLS kimin ne göreceğine zaten karar veriyor.

import { supabase } from '../../../lib/supabase/client';
import type {
    HrJobPosting, JobPostingContent, JobPostingStatus,
} from '../../../types/hr';
import { hrAudit } from './hrAudit';

/**
 * İlan içeriğini istenen dilde çözer.
 *
 * YEDEK ZİNCİRİ: istenen dil → ilanın varsayılan dili → 'en' → 'tr' → ilk
 * dolu dil. Adayın boş bir sayfa görmesindense başka dilde görmesi yeğdir;
 * hangi dilin gösterildiği çağıran tarafa döner ki arayüz bunu söyleyebilsin.
 */
export function resolveJobContent(
    posting: Pick<HrJobPosting, 'content' | 'default_language'>,
    language: string,
): { content: JobPostingContent | null; language: string } {
    const map = posting.content || {};
    const chain = [language, posting.default_language, 'en', 'tr'];
    for (const lang of chain) {
        const c = lang ? map[lang] : undefined;
        if (c?.title?.trim()) return { content: c, language: lang };
    }
    for (const [lang, c] of Object.entries(map)) {
        if (c?.title?.trim()) return { content: c, language: lang };
    }
    return { content: null, language };
}

/** İçeriği olan diller — arayüzdeki dil sekmelerinde işaret için. */
export function filledLanguages(posting: Pick<HrJobPosting, 'content'>): string[] {
    return Object.entries(posting.content || {})
        .filter(([, c]) => c?.title?.trim())
        .map(([lang]) => lang);
}

export const HrJobPostingService = {
    async list(): Promise<HrJobPosting[]> {
        const { data, error } = await supabase
            .from('hr_job_postings')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as HrJobPosting[];
    },

    /** Aday seçimi ve portal için: yalnız yayındakiler. */
    async listPublished(): Promise<HrJobPosting[]> {
        const { data, error } = await supabase
            .from('hr_job_postings')
            .select('*')
            .eq('status', 'published')
            .order('published_at', { ascending: false });
        if (error) return [];
        return (data || []) as HrJobPosting[];
    },

    async getBySlug(slug: string): Promise<HrJobPosting | null> {
        const { data, error } = await supabase
            .from('hr_job_postings')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();
        if (error) return null;
        return (data as HrJobPosting) ?? null;
    },

    async get(id: string): Promise<HrJobPosting | null> {
        const { data, error } = await supabase
            .from('hr_job_postings')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return (data as HrJobPosting) ?? null;
    },

    async create(payload: Partial<HrJobPosting> & { slug: string }): Promise<HrJobPosting> {
        const { data, error } = await supabase
            .from('hr_job_postings')
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        await hrAudit('hr.job.create', 'hr_job_postings', data.id);
        return data as HrJobPosting;
    },

    async update(id: string, payload: Partial<HrJobPosting>): Promise<HrJobPosting> {
        const { data, error } = await supabase
            .from('hr_job_postings')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        await hrAudit('hr.job.update', 'hr_job_postings', id);
        return data as HrJobPosting;
    },

    async setStatus(id: string, status: JobPostingStatus): Promise<HrJobPosting> {
        // published_at / closed_at damgalarını TRIGGER atar; buradan yazılmaz.
        return this.update(id, { status });
    },

    async remove(id: string): Promise<void> {
        const { error } = await supabase.from('hr_job_postings').delete().eq('id', id);
        if (error) throw error;
        await hrAudit('hr.job.delete', 'hr_job_postings', id);
    },
};
