// Geri Kazanım (Win-Back) "geri dönme şansı" skoru — saf fonksiyon, dış bağımlılık yok.
//
// Tasarım kararı: AI skoru BASKIN sinyaldir. Diğer sinyaller (ödemeye gitmiş,
// teklifi kaç kez açmış, ne kadar yakın zamanda açmış) yalnız ikincil
// ayarlayıcıdır. Böylece kova sıralaması AI lead skoruyla korele kalır.
//
// offerPriority.ts'teki deriveOffer çıktısı (opens, lastOpenedAt) ve
// offer_analytics action_type'ları (payment_started) bu fonksiyonu besler.

const HOUR_MS = 60 * 60 * 1000;

export type WinBackBucket = 'high' | 'mid' | 'low';

export interface WinBackScoreInput {
    /** lead.ai_state.score — BASKIN sinyal (0-100, yoksa null). */
    aiScore: number | null;
    /** Lead'in herhangi bir teklifinde payment_started eventi var mı (yüksek niyet). */
    paymentStarted: boolean;
    /** Teklif(ler)in toplam açılma sayısı (önceki ilgi). */
    opens: number;
    /** En son teklif açılış zamanı (tazelik). */
    lastOpenedAt: Date | null;
}

/** 0-100 arası geri dönme şansı skoru. AI skoru taban; gerisi sınırlı ikincil katkı. */
export function computeWinBackScore(input: WinBackScoreInput): number {
    const { aiScore, paymentStarted, opens, lastOpenedAt } = input;

    // BASKIN: AI skoru yoksa nötr-düşük 30 tabanı.
    let score = aiScore ?? 30;

    // İkincil: ödemeye gitmiş → güçlü niyet sinyali (+15).
    if (paymentStarted) score += 15;

    // İkincil: önceki ilgi — her açılış +2, en çok +10.
    score += Math.min(opens, 5) * 2;

    // İkincil: tazelik — yakın zamanda açtıysa hâlâ "ılık".
    if (lastOpenedAt) {
        const ageH = (Date.now() - lastOpenedAt.getTime()) / HOUR_MS;
        if (ageH <= 24 * 7) score += 6;        // bu hafta
        else if (ageH <= 24 * 30) score += 4;  // bu ay
        else if (ageH <= 24 * 90) score += 2;  // bu üç ay
    }

    return Math.max(0, Math.min(100, Math.round(score)));
}

/** Skoru kovaya çevirir. Eşikler ayarlanabilir tek doğruluk noktası. */
export function winBackBucket(score: number): WinBackBucket {
    if (score >= 60) return 'high';
    if (score >= 35) return 'mid';
    return 'low';
}

export const WINBACK_BUCKET_META: Record<WinBackBucket, { label: string; tone: string; bar: string }> = {
    high: { label: 'Yüksek Şans', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', bar: 'var(--color-ok, #10b981)' },
    mid: { label: 'Orta Şans', tone: 'text-amber-700 bg-amber-50 border-amber-200', bar: 'var(--color-warm, #f59e0b)' },
    low: { label: 'Düşük Şans', tone: 'text-slate-600 bg-slate-100 border-slate-200', bar: 'var(--color-slate-400, #94a3b8)' },
};

/** winback_status enum → TR etiket + ton (kokpit seçici + filtre için tek kaynak). */
export type WinBackStatus = 'contacted' | 'returned' | 'declined' | 'reoffered';

export const WINBACK_STATUS_META: Record<WinBackStatus, { label: string; tone: string }> = {
    contacted: { label: 'Arandı', tone: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    returned: { label: 'Geri döndü', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    declined: { label: 'İlgilenmiyor', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
    reoffered: { label: 'Yeniden teklif', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export const WINBACK_STATUS_ORDER: WinBackStatus[] = ['contacted', 'returned', 'declined', 'reoffered'];
