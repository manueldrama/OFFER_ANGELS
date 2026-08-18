// Aday ekranlarının TÜRETİLMİŞ bilgileri — tek doğruluk noktası.
//
// NEDEN TEK DOSYA:
//   "Sıradaki adım" hem aday listesinde bir sütun, hem "Aksiyon bekleyen"
//   filtresinin ölçütü. İki yerde iki kural yazılsaydı, liste "aksiyon
//   bekliyor" der ama sütun başka bir şey gösterirdi — kimsenin güvenmediği
//   bir ekran olurdu.
//
//   Aynı şekilde aşama tarihleri hem detaydaki hatta hem süre özetinde
//   kullanılıyor; hesabı burada durur.
//
// Buradaki hiçbir şey KAYDEDİLMEZ. Yeni kolon eklemek yerine var olandan
// türetmek, bir alanın bayatlaması riskini tümden ortadan kaldırır.

import type {
    CandidateStatus, HrCandidate, HrCandidateEvent, HrInterviewInvite,
    HrSalaryBand,
} from '../../types/hr';

// ─────────────────────────────────────────────────────────────────────────────
// Aşama tarihleri
// ─────────────────────────────────────────────────────────────────────────────

/** Hattın ileri yönü. rejected/withdrawn buraya AİT DEĞİLDİR — çıkıştır. */
export const PIPELINE_ORDER: CandidateStatus[] = [
    'new', 'screening', 'interview', 'offer', 'hired',
];

export interface StageDates {
    /** Aşamaya İLK giriş anı (ISO). Ulaşılmamış aşama listede yoktur. */
    enteredAt: Partial<Record<CandidateStatus, string>>;
    /** Aşamada geçen gün — bir sonraki ulaşılan aşamaya kadar. */
    daysIn: Partial<Record<CandidateStatus, number>>;
    /** Süreçte toplam gün (başvurudan bugüne ya da işe alıma). */
    totalDays: number;
}

/**
 * Aşama tarihleri — huni raporundaki (hrFunnelService) kuralın aynısı:
 *
 *   • İlk 'new' durumu OLAY YAZMAZ (trigger yalnız değişimde tetiklenir),
 *     bu yüzden t₀ = candidate.created_at.
 *   • Geri alma ve tekrar giriş kaydedilir; aşamaya giriş olarak İLK İLERİ
 *     GİRİŞ alınır, yoksa süreler şişer.
 *   • Aşamaya ulaşma zincirleme değildir: aday 'screening' atlanıp doğrudan
 *     'interview'a alınabilir.
 */
export function computeStageDates(
    candidate: Pick<HrCandidate, 'created_at' | 'status'>,
    events: Pick<HrCandidateEvent, 'event_type' | 'to_status' | 'created_at'>[],
): StageDates {
    const enteredAt: Partial<Record<CandidateStatus, string>> = { new: candidate.created_at };

    const sorted = [...events]
        .filter(e => e.event_type === 'status_change' && e.to_status)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));

    for (const e of sorted) {
        const to = e.to_status as CandidateStatus;
        if (!PIPELINE_ORDER.includes(to)) continue;   // rejected/withdrawn: hat dışı
        if (!enteredAt[to]) enteredAt[to] = e.created_at;
    }

    // Olay yazılmamış bir düzeltme olabilir; mevcut durum en azından şimdi var.
    if (PIPELINE_ORDER.includes(candidate.status) && !enteredAt[candidate.status]) {
        enteredAt[candidate.status] = candidate.created_at;
    }

    const reached = PIPELINE_ORDER.filter(s => enteredAt[s]);
    const daysIn: Partial<Record<CandidateStatus, number>> = {};
    for (let i = 0; i < reached.length; i++) {
        const from = Date.parse(enteredAt[reached[i]]!);
        // Son ulaşılan aşamada "hâlâ orada" — bugüne kadar sayılır.
        const to = i + 1 < reached.length ? Date.parse(enteredAt[reached[i + 1]]!) : Date.now();
        if (Number.isFinite(from) && to > from) {
            daysIn[reached[i]] = Math.round((to - from) / 86400000);
        }
    }

    const t0 = Date.parse(candidate.created_at);
    const end = enteredAt.hired ? Date.parse(enteredAt.hired) : Date.now();
    const totalDays = Number.isFinite(t0) && end > t0 ? Math.round((end - t0) / 86400000) : 0;

    return { enteredAt, daysIn, totalDays };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sıradaki adım
// ─────────────────────────────────────────────────────────────────────────────

export interface NextStep {
    label: string;
    /** true → İK'nın yapması gereken bir iş var ("Aksiyon bekleyen" filtresi). */
    needsAction: boolean;
    tone: 'default' | 'warning' | 'danger' | 'success';
}

/**
 * "Şimdi ne yapılmalı" — tek cümle.
 *
 * SIRALAMA ÖNEMLİ: en acil olan kazanır. Aday hem eksik evraklıysa hem mülakatı
 * incelenmeyi bekliyorsa, İK'ya önce mülakat söylenir; evrak beklemeye
 * tahammül eder, bekleyen bir mülakat aday kaybettirir.
 */
export function nextStep(
    candidate: Pick<HrCandidate, 'status' | 'offer_approval_status' | 'offered_salary'>,
    interview?: Pick<HrInterviewInvite, 'status' | 'expires_at'> | null,
    missingRequiredDocs = 0,
): NextStep {
    if (candidate.status === 'rejected' || candidate.status === 'withdrawn') {
        return { label: 'Süreç kapandı', needsAction: false, tone: 'default' };
    }
    if (candidate.status === 'hired') {
        return { label: 'İşe alındı', needsAction: false, tone: 'success' };
    }

    // Mülakat gelmiş ve incelenmemişse her şeyin önündedir.
    if (interview && (interview.status === 'submitted')) {
        return { label: 'Mülakatı incele', needsAction: true, tone: 'warning' };
    }

    if (candidate.offer_approval_status === 'pending') {
        return { label: 'Teklif onayı bekliyor', needsAction: true, tone: 'warning' };
    }

    switch (candidate.status) {
        case 'new':
            return { label: 'Ön eleme yap', needsAction: true, tone: 'default' };
        case 'screening':
            if (!interview) return { label: 'Mülakat daveti gönder', needsAction: true, tone: 'default' };
            if (interview.status === 'expired') {
                return { label: 'Mülakat süresi doldu', needsAction: true, tone: 'danger' };
            }
            return { label: 'Adayın mülakatı bekleniyor', needsAction: false, tone: 'default' };
        case 'interview':
            if (interview?.status === 'reviewed') {
                return { label: 'Teklif hazırla', needsAction: true, tone: 'default' };
            }
            return { label: 'Değerlendirme bekliyor', needsAction: true, tone: 'default' };
        case 'offer':
            if (!candidate.offered_salary) {
                return { label: 'Teklif tutarı girilmedi', needsAction: true, tone: 'warning' };
            }
            if (missingRequiredDocs > 0) {
                return { label: `${missingRequiredDocs} evrak eksik`, needsAction: true, tone: 'warning' };
            }
            return { label: 'Adayın yanıtı bekleniyor', needsAction: false, tone: 'default' };
        default:
            return { label: '—', needsAction: false, tone: 'default' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Maaş bandı konumu
// ─────────────────────────────────────────────────────────────────────────────

export interface BandPosition {
    /** Teklifin bant içindeki konumu (0-1). Bandın dışındaysa kırpılır. */
    ratio: number;
    aboveBand: boolean;
    belowBand: boolean;
}

export function bandPosition(offer: number, band: HrSalaryBand): BandPosition {
    const span = band.max_amount - band.min_amount;
    const raw = span > 0 ? (offer - band.min_amount) / span : 0.5;
    return {
        ratio: Math.min(1, Math.max(0, raw)),
        aboveBand: offer > band.max_amount,
        belowBand: offer < band.min_amount,
    };
}

/** "2 hafta içinde" / "hemen" — müsaitliğin okunur hâli. */
export function availabilityLabel(weeks: number | null | undefined): string {
    if (weeks == null) return '—';
    if (weeks <= 0) return 'Hemen';
    if (weeks === 1) return '1 hafta içinde';
    if (weeks < 5) return `${weeks} hafta içinde`;
    const months = Math.round(weeks / 4.345);
    return months <= 1 ? '1 ay içinde' : `${months} ay içinde`;
}

/** "2 yıl 4 ay" — tam sayı yıl verisinden okunur ifade. */
export function experienceLabel(years: number | null | undefined): string {
    if (years == null) return '—';
    const whole = Math.floor(years);
    const months = Math.round((years - whole) * 12);
    if (whole === 0) return months > 0 ? `${months} ay` : '—';
    return months > 0 ? `${whole} yıl ${months} ay` : `${whole} yıl`;
}
