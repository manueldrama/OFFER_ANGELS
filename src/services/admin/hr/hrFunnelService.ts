// İşe alım hunisi — hr_candidates + hr_candidate_events'ten hesaplanır.
//
// VERİ ZATEN VARDI, ARAYÜZ YOKTU: hr_candidates_log_status() trigger'ı her
// durum geçişini (from_status, to_status, created_at) olarak yazıyor. Bu
// servis o kaydı okunur hâle getirir; yeni tablo ya da kolon EKLEMEZ.
//
// ═══════════════════════════════════════════════════════════════════════════
// ÜÇ TUZAK VE NASIL ELE ALINDIKLARI
//
//   1) İLK 'new' DURUMU OLAY YAZMAZ.
//      Trigger yalnız DEĞİŞİMDE tetiklenir; adayın doğduğu 'new' durumu için
//      olay YOKTUR. Bu yüzden hunideki t₀ candidates.created_at'tır. Buna
//      dikkat edilmezse her aday "hiç new olmamış" gibi görünür ve ilk
//      dönüşüm oranı %100'ün üstüne çıkar.
//
//   2) GERİ ALMA VE TEKRAR GİRİŞ KAYDEDİLİR.
//      Aday 'interview'a girip 'screening'e döndürülüp tekrar 'interview'a
//      alınabilir. Bu yüzden "aşamaya giriş" olarak İLK İLERİ GİRİŞ alınır;
//      max ya da last alınsaydı süreler şişerdi, sayım da mükerrer olurdu.
//
//   3) AŞAMAYA ULAŞMA ZİNCİRLEME DEĞİLDİR.
//      Aday 'screening' atlanıp doğrudan 'interview'a alınabilir. Huni
//      "önceki aşamadan geçti" varsaymaz; her aşama için ULAŞTI kümesi ayrı
//      hesaplanır. Aksi hâlde atlanan aşama sonraki tüm oranları bozar.

import { supabase } from '../../../lib/supabase/client';

/** Huninin ileri yönü. rejected/withdrawn bu sıraya AİT DEĞİLDİR — çıkıştır. */
export const FUNNEL_STAGES = ['new', 'screening', 'interview', 'offer', 'hired'] as const;
export type FunnelStage = typeof FUNNEL_STAGES[number];

export const STAGE_LABEL: Record<string, string> = {
    new: 'Yeni Başvuru',
    screening: 'Ön Eleme',
    interview: 'Mülakat',
    offer: 'Teklif',
    hired: 'İşe Alındı',
    rejected: 'Elendi',
    withdrawn: 'Vazgeçti',
};

export interface StageRow {
    stage: FunnelStage;
    reached: number;
    /** Bir önceki AŞAMAYA ULAŞANLARA oranı (%). İlk aşamada null. */
    conversionPct: number | null;
    /** Bu aşamaya girip bir sonraki aşamaya geçenlerin ortalama süresi (gün). */
    avgDaysToNext: number | null;
}

export interface BreakdownRow {
    key: string;
    total: number;
    hired: number;
    rejected: number;
    hireRatePct: number;
}

export interface FunnelResult {
    totalCandidates: number;
    stages: StageRow[];
    /** Elenenlerin HANGİ aşamada elendiği. */
    dropByStage: { stage: string; count: number }[];
    bySource: BreakdownRow[];
    byCountry: BreakdownRow[];
    byDepartment: BreakdownRow[];
    /** Başvurudan işe alıma ortalama gün. */
    avgDaysToHire: number | null;
}

interface CandidateLite {
    id: string;
    status: string;
    source: string | null;
    work_country: string | null;
    department: string | null;
    created_at: string;
}

interface EventLite {
    candidate_id: string;
    from_status: string | null;
    to_status: string | null;
    created_at: string;
}

const stageIndex = (s: string): number => FUNNEL_STAGES.indexOf(s as FunnelStage);

function breakdown(
    candidates: CandidateLite[],
    pick: (c: CandidateLite) => string | null,
    fallback: string,
): BreakdownRow[] {
    const map = new Map<string, { total: number; hired: number; rejected: number }>();
    for (const c of candidates) {
        const key = pick(c) || fallback;
        const row = map.get(key) ?? { total: 0, hired: 0, rejected: 0 };
        row.total += 1;
        if (c.status === 'hired') row.hired += 1;
        if (c.status === 'rejected' || c.status === 'withdrawn') row.rejected += 1;
        map.set(key, row);
    }
    return [...map.entries()]
        .map(([key, r]) => ({
            key, ...r,
            hireRatePct: r.total > 0 ? (r.hired / r.total) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);
}

export const HrFunnelService = {
    /**
     * @param from ISO tarih (dahil) — adayın OLUŞTURULMA tarihine göre süzülür.
     *             Olay tarihine göre süzmek, aralık dışında başvurup içeride
     *             ilerleyen adayları huniye yarım sokardı.
     */
    async compute(from: string, to: string): Promise<FunnelResult> {
        const { data: cData, error: cErr } = await supabase
            .from('hr_candidates')
            .select('id, status, source, work_country, department, created_at')
            .gte('created_at', from)
            .lte('created_at', `${to}T23:59:59`);
        if (cErr) throw cErr;

        const candidates = (cData || []) as CandidateLite[];
        if (candidates.length === 0) {
            return {
                totalCandidates: 0,
                stages: FUNNEL_STAGES.map(stage => ({ stage, reached: 0, conversionPct: null, avgDaysToNext: null })),
                dropByStage: [], bySource: [], byCountry: [], byDepartment: [],
                avgDaysToHire: null,
            };
        }

        // Olaylar 150'lik parçalarla çekilir: PostgREST .in() büyük listede
        // SESSİZCE boş döner ve rapor "hiç geçiş olmamış" gösterirdi.
        const ids = candidates.map(c => c.id);
        const events: EventLite[] = [];
        for (let i = 0; i < ids.length; i += 150) {
            const { data, error } = await supabase
                .from('hr_candidate_events')
                .select('candidate_id, from_status, to_status, created_at')
                .eq('event_type', 'status_change')
                .in('candidate_id', ids.slice(i, i + 150))
                .order('created_at', { ascending: true });
            if (error) throw error;
            events.push(...((data || []) as EventLite[]));
        }

        const byCandidate = new Map<string, EventLite[]>();
        for (const e of events) {
            const arr = byCandidate.get(e.candidate_id) ?? [];
            arr.push(e);
            byCandidate.set(e.candidate_id, arr);
        }

        // Aday başına: her aşamaya İLK giriş anı (TUZAK 2).
        const entriesByStage: Record<string, number[]> = {};
        for (const s of FUNNEL_STAGES) entriesByStage[s] = [];

        const dropCounts = new Map<string, number>();
        const hireDurations: number[] = [];
        // stage -> o aşamadan bir SONRAKİ ulaşılan aşamaya geçen sürelerin listesi
        const transitionDays: Record<string, number[]> = {};
        for (const s of FUNNEL_STAGES) transitionDays[s] = [];

        for (const c of candidates) {
            const t0 = Date.parse(c.created_at);
            const firstEntry = new Map<string, number>();
            // TUZAK 1: doğuşta 'new' olayı yazılmaz.
            firstEntry.set('new', t0);

            for (const e of byCandidate.get(c.id) ?? []) {
                const to = e.to_status;
                if (!to) continue;
                const t = Date.parse(e.created_at);
                if (!Number.isFinite(t)) continue;

                if (to === 'rejected' || to === 'withdrawn') {
                    // Hangi aşamadan düştü: from_status boşsa 'new' sayılır.
                    const at = e.from_status || 'new';
                    dropCounts.set(at, (dropCounts.get(at) ?? 0) + 1);
                    continue;
                }
                if (stageIndex(to) < 0) continue;         // huni dışı durum
                if (!firstEntry.has(to)) firstEntry.set(to, t);
            }

            // Mevcut durum olay yazmamış olabilir (ör. tek satırlık düzeltme).
            if (stageIndex(c.status) >= 0 && !firstEntry.has(c.status)) {
                firstEntry.set(c.status, t0);
            }

            for (const s of FUNNEL_STAGES) {
                const t = firstEntry.get(s);
                if (t != null) entriesByStage[s].push(t);
            }

            // TUZAK 3: bir sonraki AŞAMA değil, ULAŞILAN bir sonraki aşama.
            const reached = FUNNEL_STAGES.filter(s => firstEntry.has(s));
            for (let i = 0; i < reached.length - 1; i++) {
                const a = firstEntry.get(reached[i])!;
                const b = firstEntry.get(reached[i + 1])!;
                if (b > a) transitionDays[reached[i]].push((b - a) / 86400000);
            }

            const hiredAt = firstEntry.get('hired');
            if (hiredAt != null && hiredAt > t0) hireDurations.push((hiredAt - t0) / 86400000);
        }

        const avg = (xs: number[]) =>
            xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

        const stages: StageRow[] = FUNNEL_STAGES.map((stage, i) => {
            const reached = entriesByStage[stage].length;
            const prev = i === 0 ? null : entriesByStage[FUNNEL_STAGES[i - 1]].length;
            return {
                stage,
                reached,
                conversionPct: prev != null && prev > 0 ? (reached / prev) * 100 : null,
                avgDaysToNext: avg(transitionDays[stage]),
            };
        });

        return {
            totalCandidates: candidates.length,
            stages,
            dropByStage: [...dropCounts.entries()]
                .map(([stage, count]) => ({ stage, count }))
                .sort((a, b) => b.count - a.count),
            bySource: breakdown(candidates, c => c.source, 'Belirtilmemiş'),
            byCountry: breakdown(candidates, c => c.work_country, 'Belirtilmemiş'),
            byDepartment: breakdown(candidates, c => c.department, 'Belirtilmemiş'),
            avgDaysToHire: avg(hireDurations),
        };
    },
};
