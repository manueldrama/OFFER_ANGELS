// KPI skorlama ve bonus hesabı — SAF fonksiyonlar, supabase bağımlılığı YOK.
//
// Bu dosya "veri nasıl toplanır" ile ilgilenmez; toplanmış sayıları puana ve
// puanı paraya çevirir. Para hesabının tek doğruluk kaynağıdır.
//
// INVARIANT'LAR:
//
//   1) HEDEF ÜSTÜ ÖDÜL YOK. achievement 1.0'da KIRPILIR.
//      Hedefi %150 tutturan da %100 tutturan da tam puan alır. Bu, "bir satış
//      daha yapayım, müşteriyi sıkıştırayım" baskısını bilinçli olarak keser.
//
//   2) VERİSİ OLMAYAN BİLEŞEN SIFIR DEĞİL, N/A'DIR.
//      denominator = 0 ise bileşen puanlamadan ÇIKARILIR ve ağırlığı toplamdan
//      düşülür; kalan ağırlıklar 100'e normalize edilir. Gerçekleşmemiş bir olay
//      için ceza verilmez.
//
//   3) PREMIUM GATE KPI'YI DEĞİŞTİRMEZ. Yalnızca bonusa tavan koyar; skor
//      analitik olarak temiz kalır.

export type KpiComponentKey =
    | 'conversion' | 'followup' | 'priority' | 'sla' | 'crm' | 'activity';

export const COMPONENT_LABELS: Record<KpiComponentKey, string> = {
    conversion: 'Lead → Satış Dönüşümü',
    followup: 'Takip Uyumu',
    priority: 'Öncelikli Lead Kapsamı',
    sla: 'İlk Temas SLA',
    crm: 'CRM / Pipeline Bütünlüğü',
    activity: 'Mesai Doluluğu',
};

/** Her bileşenin "neyi ölçtüğü" — KPI'ların çakışmaması için ayrım korunur. */
export const COMPONENT_PURPOSE: Record<KpiComponentKey, string> = {
    conversion: 'Sonuç ne oldu — lead satışa dönüştü mü?',
    followup: 'Verilen takip sözü zamanında yerine getirildi mi?',
    priority: 'Şirketin en önemli lead\'i açıkta bırakıldı mı?',
    sla: 'Yeni lead\'e ne kadar hızlı gerçek insan teması yapıldı?',
    crm: 'Süreç sistemde doğru kaydedildi mi?',
    // Aksiyon SAYISI ölçülmez — "puan için boş iş üretme" teşviki oluşmasın diye.
    activity: 'Mesai saatlerinde fiilen işinin başında mıydı?',
};

/** Bir bileşenin ham ölçümü. denominator = 0 → N/A. */
export interface ComponentInput {
    key: KpiComponentKey;
    weight: number;
    numerator: number;
    denominator: number;
    /**
     * Yalnız conversion için: oran bir HEDEFE göre değerlendirilir.
     * Diğer bileşenlerde oranın kendisi başarıdır (hedef = %100).
     */
    targetRate?: number | null;
    note?: string;
}

export interface ComponentResult {
    key: KpiComponentKey;
    label: string;
    weight: number;
    numerator: number;
    denominator: number;
    /** numerator/denominator × 100. N/A ise null. */
    rate: number | null;
    targetRate: number | null;
    /** 0..1 arası, 1'de kırpılmış. N/A ise null. */
    achievement: number | null;
    /** weight × achievement. N/A ise 0 (ve ağırlık toplamdan düşülür). */
    points: number;
    na: boolean;
    note?: string;
}

export interface KpiScoreResult {
    components: ComponentResult[];
    /** N/A'lar düşüldükten sonra geçerli ağırlık toplamı. */
    appliedWeight: number;
    /** 0-100. Hiç geçerli bileşen yoksa null (skor hesaplanamaz). */
    totalScore: number | null;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * Bileşenleri puana çevirir ve N/A'ları normalize eder.
 *
 * Normalizasyon: ham puanlar geçerli ağırlık toplamı üzerinden 100'e taşınır.
 *   total = (Σ points / Σ geçerli weight) × 100
 */
export function computeKpiScore(inputs: ComponentInput[]): KpiScoreResult {
    const components: ComponentResult[] = inputs.map(input => {
        const label = COMPONENT_LABELS[input.key];

        // INVARIANT 2: ölçülecek olay yoksa N/A
        if (!input.denominator || input.denominator <= 0) {
            return {
                key: input.key, label, weight: input.weight,
                numerator: input.numerator, denominator: input.denominator,
                rate: null, targetRate: input.targetRate ?? null,
                achievement: null, points: 0, na: true,
                note: input.note ?? 'Bu ay ölçülecek kayıt yok.',
            };
        }

        const rate = (input.numerator / input.denominator) * 100;

        // Conversion hedefe göre; diğerleri oranın kendisi.
        const target = input.targetRate ?? null;
        let achievement: number;
        if (target && target > 0) {
            achievement = rate / target;
        } else {
            achievement = rate / 100;
        }

        // INVARIANT 1: hedef üstü ödül yok
        achievement = Math.max(0, Math.min(1, achievement));

        return {
            key: input.key, label, weight: input.weight,
            numerator: input.numerator, denominator: input.denominator,
            rate: round2(rate),
            targetRate: target,
            achievement: round2(achievement * 100) / 100,
            points: round2(input.weight * achievement),
            na: false,
            note: input.note,
        };
    });

    const applied = components.filter(c => !c.na);
    const appliedWeight = applied.reduce((s, c) => s + c.weight, 0);
    const rawPoints = applied.reduce((s, c) => s + c.points, 0);

    const totalScore = appliedWeight > 0
        ? round2((rawPoints / appliedWeight) * 100)
        : null;

    return { components, appliedWeight: round2(appliedWeight), totalScore };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bonus
// ─────────────────────────────────────────────────────────────────────────────

export interface BonusScaleBand {
    min: number;
    max: number;
    pct: number;
}

/** Ülke varsayılanı — hr_companies satırından türetilir (20260901a). */
export interface CountryBonusDefault {
    max_monthly_bonus: number | null;
    /** Ülkenin default_currency'si; ülke bonusu HEP bu kurdadır. */
    currency: string | null;
}

/**
 * Bir çalışanın geçerli bonus tavanı ve para birimi.
 *
 * ÇÖZÜM ZİNCİRİ: kişiye özel → ülke → global. Tek yerde çözülür ki KPI
 * kartı, prim koşusu ve sözleşme metni farklı sayı üretmesin — bugün dört
 * çağıran var ve dördü de buradan geçer.
 *
 * `countryDefault` OPSİYONEL ve verilmezse eski davranış birebir korunur:
 * ileride beşinci bir çağıran ülkeyi geçirmeyi unutursa yanlış bir zincir
 * değil, yalnızca daha kısa (kişi → global) zincir çalışır.
 *
 * Ülke satırında 0, "bu ülkede bonus yok" demektir ve globale DÜŞÜLMEZ;
 * yalnız NULL düşer (INVARIANT B, 20260901a).
 */
export function resolveEmployeeBonus(
    employee: { max_monthly_bonus?: number | null; bonus_currency?: string | null } | null | undefined,
    config: { max_monthly_bonus: number; bonus_currency: string },
    countryDefault?: CountryBonusDefault | null,
): { maxBonus: number; currency: string; isOverride: boolean; source: 'employee' | 'country' | 'global' } {
    const own = employee?.max_monthly_bonus;
    const hasOwn = own != null && Number.isFinite(Number(own));
    if (hasOwn) {
        return {
            maxBonus: Number(own),
            currency: employee?.bonus_currency || countryDefault?.currency || config.bonus_currency,
            isOverride: true,
            source: 'employee',
        };
    }

    const country = countryDefault?.max_monthly_bonus;
    if (country != null && Number.isFinite(Number(country))) {
        return {
            maxBonus: Number(country),
            currency: countryDefault?.currency || config.bonus_currency,
            isOverride: false,
            source: 'country',
        };
    }

    return {
        maxBonus: Number(config.max_monthly_bonus),
        currency: employee?.bonus_currency || config.bonus_currency,
        isOverride: false,
        source: 'global',
    };
}

export const DEFAULT_BONUS_SCALE: BonusScaleBand[] = [
    { min: 0, max: 69, pct: 0 },
    { min: 70, max: 79, pct: 40 },
    { min: 80, max: 89, pct: 70 },
    { min: 90, max: 94, pct: 90 },
    { min: 95, max: 100, pct: 100 },
];

/**
 * KPI skorunun düştüğü bandın yüzdesi.
 * Bant aralıkları kapalıdır (min ≤ skor ≤ max). Skor hiçbir banda düşmezse 0 —
 * eksik yapılandırılmış bir skala sessizce tam bonus ödememelidir.
 */
export function bonusEligibility(score: number | null, scale: BonusScaleBand[]): number {
    if (score == null) return 0;
    const rounded = Math.round(score);
    for (const band of scale) {
        if (rounded >= band.min && rounded <= band.max) return band.pct;
    }
    return 0;
}

export interface BonusResult {
    kpiScore: number | null;
    eligibilityPct: number;
    maxBonus: number;
    /** Gate ÖNCESİ tutar. */
    calculatedBonus: number;
    gateApplied: boolean;
    gateCapPct: number | null;
    /** Gate SONRASI ödenecek tutar. */
    finalBonus: number;
}

/**
 * Bonus hesabı.
 *
 * INVARIANT 3: gate skoru değil TUTARI kısar. En düşük tavan uygulanır —
 * birden çok ihlal varsa en ağırı geçerlidir.
 */
export function computeBonus(params: {
    kpiScore: number | null;
    maxBonus: number;
    scale: BonusScaleBand[];
    /** Aktif ihlallerin tavan yüzdeleri. Boşsa gate uygulanmaz. */
    gateCaps?: number[];
}): BonusResult {
    const { kpiScore, maxBonus, scale, gateCaps = [] } = params;

    const eligibilityPct = bonusEligibility(kpiScore, scale);
    const calculatedBonus = round2(maxBonus * (eligibilityPct / 100));

    if (gateCaps.length === 0) {
        return {
            kpiScore, eligibilityPct, maxBonus, calculatedBonus,
            gateApplied: false, gateCapPct: null, finalBonus: calculatedBonus,
        };
    }

    const cap = Math.min(...gateCaps);
    // Tavan, hak edilen yüzdeyi AŞAMAZ; zaten %70 hak edilmişse %90'lık tavan
    // bir şey değiştirmez.
    const effectivePct = Math.min(eligibilityPct, cap);
    const finalBonus = round2(maxBonus * (effectivePct / 100));

    return {
        kpiScore, eligibilityPct, maxBonus, calculatedBonus,
        gateApplied: finalBonus < calculatedBonus,
        gateCapPct: cap,
        finalBonus,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Çalışma saati farkı — First Contact SLA için
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkSchedule {
    /** ISO gün numaraları (1=Pzt … 7=Paz). */
    workDays: number[];
    /** "09:00" biçiminde. */
    shiftStart: string;
    shiftEnd: string;
    /**
     * Çalışanın IANA saat dilimi (hr_employees.timezone).
     * Verilmezse tarayıcının saat dilimi kullanılır — yurtdışı personelde
     * mesai penceresi saat farkı kadar kayar.
     */
    timeZone?: string | null;
}

/**
 * Bir anın verilen saat diliminde okunan duvar saati ile UTC arasındaki fark.
 * Intl üzerinden hesaplanır; DST geçişleri dahil doğru sonuç verir.
 */
function tzOffsetMs(date: Date, timeZone: string): number {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = dtf.formatToParts(date);
    const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
    // 'en-US' saat 24'ü 00 olarak verebilir; gün kaymasını engelle.
    const hour = get('hour') === 24 ? 0 : get('hour');
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
    return asUtc - date.getTime();
}

function minutesOfDay(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

/**
 * İki zaman arasında geçen ÇALIŞMA dakikası.
 *
 * NEDEN: Lead gece 22:30'da geldiyse temsilci uyurken SLA işlememelidir; sayaç
 * ertesi çalışma günü mesai başında başlar. Takvim farkı kullanılsaydı gece
 * gelen her lead otomatik ihlal sayılırdı.
 *
 * SAAT DİLİMİ: Hesap ÇALIŞANIN saat diliminde yapılır. Tarayıcının saati
 * kullanılsaydı yurtdışı personelin mesai penceresi saat farkı kadar kayar,
 * SLA yanlış ölçülürdü. Bunun için her iki uç, hedef saat diliminin ofsetiyle
 * kaydırılıp "duvar saati" uzayında karşılaştırılır (UTC getter'ları ile).
 *
 * Gün gün ilerler; SLA pencereleri saatler mertebesinde olduğu için 60 günlük
 * tavan yeterlidir (daha uzunsa zaten SLA aşılmıştır).
 */
export function workingMinutesBetween(
    fromIso: string, toIso: string, schedule: WorkSchedule,
): number | null {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    if (to <= from) return 0;

    const startMin = minutesOfDay(schedule.shiftStart || '09:00');
    const endMin = minutesOfDay(schedule.shiftEnd || '18:00');
    if (endMin <= startMin) return null;
    const days = schedule.workDays?.length ? schedule.workDays : [1, 2, 3, 4, 5];

    // Duvar saati uzayına taşı. Geçersiz saat dilimi verilirse kaydırma
    // yapılmaz — puanlama tamamen durmaktansa tarayıcı saatine düşer.
    const tz = schedule.timeZone;
    let shiftFrom = 0;
    let shiftTo = 0;
    if (tz) {
        try {
            shiftFrom = tzOffsetMs(from, tz);
            shiftTo = tzOffsetMs(to, tz);
        } catch {
            shiftFrom = 0; shiftTo = 0;
        }
    }
    const wFrom = from.getTime() + shiftFrom;
    const wTo = to.getTime() + shiftTo;

    // Duvar saatiyle günün başlangıcı (UTC epoch üzerinde)
    const DAY = 86400000;
    let cursor = Math.floor(wFrom / DAY) * DAY;

    let total = 0;
    for (let i = 0; i < 60 && cursor <= wTo; i++, cursor += DAY) {
        // 1970-01-01 Perşembe → ISO 4
        const dow = ((Math.floor(cursor / DAY) + 3) % 7) + 1;
        if (!days.includes(dow)) continue;

        const dayStart = cursor + startMin * 60000;
        const dayEnd = cursor + endMin * 60000;

        const segStart = Math.max(wFrom, dayStart);
        const segEnd = Math.min(wTo, dayEnd);
        if (segEnd > segStart) total += (segEnd - segStart) / 60000;
    }

    return Math.round(total);
}

/** AI skoruna göre SLA penceresi (dakika). */
export function slaMinutesFor(
    aiScore: number | null,
    cfg: {
        sla_band_high_min: number; sla_band_mid_min: number;
        sla_minutes_high: number; sla_minutes_mid: number; sla_minutes_low: number;
    },
): number {
    const s = aiScore ?? 0;
    if (s >= cfg.sla_band_high_min) return cfg.sla_minutes_high;
    if (s >= cfg.sla_band_mid_min) return cfg.sla_minutes_mid;
    return cfg.sla_minutes_low;
}
