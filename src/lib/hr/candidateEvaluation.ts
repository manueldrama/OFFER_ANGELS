import type { EvaluationRecommendation, HrCandidateEvaluation } from '../../types/hr';

// Aday değerlendirme kriterleri ve hesaplama.
//
// Kriterler KODDA tanımlı ama DB'de jsonb olarak saklanır: yeni bir kriter
// eklemek migration gerektirmesin, eski kayıtlar da bozulmasın. Kaldırılan bir
// kriterin eski kayıtlardaki puanı jsonb'de kalır, ortalamaya girmez.

export interface EvaluationCriterion {
    key: string;
    label: string;
    hint: string;
}

export const EVALUATION_CRITERIA: EvaluationCriterion[] = [
    { key: 'experience', label: 'Deneyim', hint: 'Pozisyonun gerektirdiği iş tecrübesi' },
    { key: 'technical', label: 'Teknik Yetkinlik', hint: 'İşin gerektirdiği bilgi ve beceri' },
    { key: 'communication', label: 'İletişim', hint: 'Kendini ifade etme, dinleme, yazışma' },
    { key: 'motivation', label: 'Motivasyon', hint: 'İşe ve şirkete ilgi, istek' },
    { key: 'culture_fit', label: 'Ekibe Uyum', hint: 'Çalışma biçimi ve ekiple uyum' },
];

export const RECOMMENDATION_META: Record<EvaluationRecommendation, { label: string; tone: string }> = {
    strong_yes: { label: 'Kesinlikle olumlu', tone: 'success' },
    yes: { label: 'Olumlu', tone: 'success' },
    maybe: { label: 'Kararsız', tone: 'warning' },
    no: { label: 'Olumsuz', tone: 'danger' },
};

/**
 * Kriter puanlarının ortalaması — genel puanın ÖNERİSİ.
 *
 * Puanlanmamış kriterler paydaya girmez; üç kriteri boş bırakan biri
 * yanlışlıkla düşük ortalama almasın.
 */
export function suggestOverall(criteria: Record<string, number>): number | null {
    const values = EVALUATION_CRITERIA
        .map(c => criteria[c.key])
        .filter(v => typeof v === 'number' && v >= 1 && v <= 5);
    if (!values.length) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Birden çok değerlendirmenin ortalaması — DB trigger'ıyla aynı mantık. */
export function averageOverall(evaluations: HrCandidateEvaluation[]): number | null {
    if (!evaluations.length) return null;
    const sum = evaluations.reduce((a, e) => a + e.overall, 0);
    return Math.round(sum / evaluations.length);
}

/**
 * AI skoru için etiket. Sayının tek başına "karar" gibi okunmaması için
 * daima tavsiye dilinde yazılır.
 */
export function fitScoreLabel(score: number | null | undefined): { text: string; tone: string } | null {
    if (score == null) return null;
    if (score >= 80) return { text: 'Yüksek uyum', tone: 'success' };
    if (score >= 60) return { text: 'Orta uyum', tone: 'info' };
    if (score >= 40) return { text: 'Sınırlı uyum', tone: 'warning' };
    return { text: 'Düşük uyum', tone: 'neutral' };
}
