import { supabase } from '../../../lib/supabase/client';
import type { ExtractedCv } from '../../../lib/hr/cvExtract';

// /api/internal/ai/hr-cv/analyze istemci sarmalayıcısı.
//
// GİZLİLİK: Bu uç, sözleşme ucundan FARKLI olarak gerçek aday verisi taşır
// (ad, telefon, e-posta, iş geçmişi). Bilinçli bir karardır; dosyanın kendisi
// değil, tarayıcıda çıkarılan metin veya küçültülmüş görsel gider. Sonuçlar
// kaydedilmeden önce İK'ya gösterilir.

export interface CvParsed {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    position_title: string | null;
    department_guess: string | null;
    education_level: string | null;
    total_experience_years: number | null;
    current_company: string | null;
    skills: string[];
    languages: string[];
    /** Yalnız CV'de açıkça yazıyorsa dolu gelir; tahmin edilmez. */
    expected_salary: number | null;
    expected_currency: string | null;
    summary: string | null;
}

export interface CvEvaluation {
    fit_score: number | null;
    summary: string | null;
    strengths: string[];
    concerns: string[];
    interview_questions: string[];
}

export interface CvAnalyzeResult {
    parsed: CvParsed | null;
    evaluation: CvEvaluation | null;
    source: 'text' | 'image';
}

export const HrCvService = {
    async analyze(params: {
        extracted: ExtractedCv;
        positionContext?: string;
        mode?: 'parse' | 'evaluate' | 'both';
    }): Promise<CvAnalyzeResult> {
        const { extracted, positionContext, mode = 'both' } = params;
        if (extracted.kind === 'empty') {
            throw new Error(extracted.warning || 'Dosyadan içerik çıkarılamadı.');
        }

        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/internal/ai/hr-cv/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify({
                mode,
                text: extracted.kind === 'text' ? extracted.text : undefined,
                images: extracted.kind === 'image' ? extracted.images : undefined,
                position_context: positionContext?.trim() || undefined,
            }),
        });

        const rawText = await res.text();
        if (!res.ok) {
            let detail = rawText;
            try { detail = JSON.parse(rawText).error || rawText; } catch { /* ignore */ }
            if (res.status === 404 || res.status === 405) {
                throw new Error('Uç henüz yayında değil. Cloudflare derlemesinin bitmesini bekleyip Ctrl+Shift+R yapın.');
            }
            if (res.status === 401 || res.status === 403) {
                throw new Error(`Yetki hatası (${res.status}). Çıkış yapıp tekrar giriş yapmayı deneyin.`);
            }
            if (res.status === 413) {
                throw new Error('Dosya çok büyük. Daha küçük bir görsel veya daha az sayfa deneyin.');
            }
            throw new Error(detail || `CV okunamadı (${res.status}).`);
        }

        try {
            const data = JSON.parse(rawText);
            return { parsed: data.parsed ?? null, evaluation: data.evaluation ?? null, source: data.source };
        } catch {
            throw new Error('AI cevabı JSON değil: ' + rawText.slice(0, 200));
        }
    },
};
