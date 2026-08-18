// Prim kuralı değerlendirici — SAF fonksiyonlar, supabase bağımlılığı YOK.
// (src/lib/pricingRules.ts kalıbı: hem tarayıcı hem worker import edebilir.)
//
// INVARIANT'LAR:
//
//   1) ORANLAR BURADA TANIMLI DEĞİL. Bu dosya yalnızca kural şemasını YORUMLAR.
//      Yüzdeler, kademeler ve tavan/taban hr_commission_rules.definition'dan
//      gelir; kullanıcı bunları admin ekranından girer.
//
//   2) HESAP GİRDİSİYLE BİRLİKTE DONDURULUR. Çağıran taraf, kullanılan kuralı
//      rule_snapshot olarak prim satırına kopyalar; kural sonradan değişse
//      geçmiş prim değişmez.
//
//   3) HEDEFSİZ KADEME = TABAN KADEME. target_source 'kpi_target' olduğu hâlde
//      o ay hedef tanımlanmamışsa başarı oranı hesaplanamaz; bu durumda EN
//      DÜŞÜK kademe uygulanır. Hedef yokken en yüksek oranı vermek, hedef
//      tanımlamayı unutmayı ödüllendirirdi.

export type CommissionType = 'tiered' | 'flat_percent' | 'per_unit';
export type CommissionMeasure = 'revenue' | 'deal_count';
export type TargetSource = 'kpi_target' | 'fixed';
/** 'marginal' = her dilim kendi oranıyla; 'whole' = tamamına ulaşılan en yüksek oran. */
export type ApplyMode = 'marginal' | 'whole';

export interface CommissionTier {
    /** Hedefin yüzdesi olarak dilim başlangıcı (0 = hedefin %0'ı). */
    from_pct: number;
    /** null = üst sınırsız. */
    to_pct: number | null;
    /** Bu dilime uygulanacak prim yüzdesi. */
    percent: number;
}

export interface CommissionDefinition {
    type: CommissionType;
    measure: CommissionMeasure;
    target_source?: TargetSource;
    fixed_target?: number | null;
    tiers?: CommissionTier[];
    apply_mode?: ApplyMode;
    flat_percent?: number | null;
    per_unit_amount?: number | null;
    floor_amount?: number | null;
    cap_amount?: number | null;
}

export interface CommissionRule {
    id: string;
    name: string;
    priority: number;
    is_active: boolean;
    valid_from: string;
    valid_to: string | null;
    scope: {
        departments?: string[];
        employee_ids?: string[];
        countries?: string[];
        currencies?: string[];
    };
    definition: CommissionDefinition;
}

export interface CommissionContext {
    employeeId: string;
    department: string | null;
    country: string;
    currency: string;
    /** Tahsil edilmiş ciro (bu para biriminde). */
    revenue: number;
    dealCount: number;
    /** O ay için tanımlı hedef; yoksa null. */
    kpiTarget: number | null;
    /** Dönemin ilk günü (YYYY-MM-DD) — kural geçerlilik aralığı kontrolü için. */
    periodMonth: string;
}

export interface CommissionOutcome {
    amount: number;
    rule: CommissionRule | null;
    target: number | null;
    achievementPct: number | null;
    /** İnsan okur açıklama — neden bu tutar çıktı. */
    explanation: string;
}

/** Kural bu bağlama uygulanabilir mi? */
export function ruleMatches(rule: CommissionRule, ctx: CommissionContext): boolean {
    if (!rule.is_active) return false;

    // Geçerlilik aralığı: dönem ayı kuralın penceresinde olmalı.
    if (rule.valid_from && ctx.periodMonth < rule.valid_from.slice(0, 10)) {
        // Kural dönemden sonra başlıyorsa uygulanmaz. Ancak ayın herhangi bir
        // gününde başlıyorsa (aynı ay) uygulanır — bu yüzden ay bazında kıyas.
        if (rule.valid_from.slice(0, 7) !== ctx.periodMonth.slice(0, 7)) return false;
    }
    if (rule.valid_to && ctx.periodMonth.slice(0, 7) > rule.valid_to.slice(0, 7)) return false;

    const s = rule.scope || {};
    if (s.employee_ids?.length && !s.employee_ids.includes(ctx.employeeId)) return false;
    if (s.departments?.length && (!ctx.department || !s.departments.includes(ctx.department))) return false;
    if (s.countries?.length && !s.countries.includes(ctx.country)) return false;
    if (s.currencies?.length && !s.currencies.includes(ctx.currency)) return false;
    return true;
}

/** Eşleşen kurallar arasından en düşük priority kazanır. */
export function pickRule(rules: CommissionRule[], ctx: CommissionContext): CommissionRule | null {
    const matches = rules.filter(r => ruleMatches(r, ctx));
    if (matches.length === 0) return null;
    return matches.sort((a, b) => a.priority - b.priority)[0];
}

function clamp(amount: number, def: CommissionDefinition): number {
    let out = amount;
    if (def.floor_amount != null && out < def.floor_amount) out = def.floor_amount;
    if (def.cap_amount != null && out > def.cap_amount) out = def.cap_amount;
    return Math.round(out * 100) / 100;
}

/** Kademeli hesap. Dilimler hedefin YÜZDESİ üzerinden tanımlıdır. */
function evaluateTiered(def: CommissionDefinition, base: number, target: number | null): {
    amount: number; explanation: string;
} {
    const tiers = [...(def.tiers || [])].sort((a, b) => a.from_pct - b.from_pct);
    if (tiers.length === 0) return { amount: 0, explanation: 'Kuralda kademe tanımlı değil.' };

    // INVARIANT 3: hedef yoksa en düşük kademe.
    if (target == null || target <= 0) {
        const lowest = tiers[0];
        const amount = base * (lowest.percent / 100);
        return {
            amount,
            explanation: `Hedef tanımsız → en düşük kademe (%${lowest.percent}) uygulandı.`,
        };
    }

    const achievement = (base / target) * 100;

    if (def.apply_mode === 'whole') {
        // Ulaşılan en yüksek dilimin oranı TÜM tabana uygulanır.
        let chosen = tiers[0];
        for (const t of tiers) if (achievement >= t.from_pct) chosen = t;
        return {
            amount: base * (chosen.percent / 100),
            explanation: `Hedefin %${achievement.toFixed(0)}'i → tamamına %${chosen.percent} uygulandı.`,
        };
    }

    // marginal: her dilim kendi oranıyla, yalnız o dilime düşen tutar üzerinden.
    let amount = 0;
    const parts: string[] = [];
    for (const t of tiers) {
        const fromAmount = (t.from_pct / 100) * target;
        const toAmount = t.to_pct == null ? Infinity : (t.to_pct / 100) * target;
        if (base <= fromAmount) continue;
        const slice = Math.min(base, toAmount) - fromAmount;
        if (slice <= 0) continue;
        amount += slice * (t.percent / 100);
        parts.push(`%${t.percent} × ${Math.round(slice).toLocaleString('tr-TR')}`);
    }
    return {
        amount,
        explanation: `Hedefin %${achievement.toFixed(0)}'i → kademeli: ${parts.join(' + ') || 'dilim yok'}.`,
    };
}

/**
 * Bir çalışanın bir para birimindeki primini hesaplar.
 * Kural bulunamazsa prim SIFIR döner — varsayılan bir oran uydurmaz.
 */
export function evaluateCommission(rules: CommissionRule[], ctx: CommissionContext): CommissionOutcome {
    const rule = pickRule(rules, ctx);
    if (!rule) {
        return {
            amount: 0, rule: null, target: null, achievementPct: null,
            explanation: 'Bu çalışana uyan aktif prim kuralı yok.',
        };
    }

    const def = rule.definition || ({} as CommissionDefinition);
    const base = def.measure === 'deal_count' ? ctx.dealCount : ctx.revenue;

    const target = def.target_source === 'fixed'
        ? (def.fixed_target ?? null)
        : ctx.kpiTarget;

    const achievementPct = target && target > 0
        ? Math.round((base / target) * 1000) / 10
        : null;

    let amount = 0;
    let explanation = '';

    switch (def.type) {
        case 'flat_percent': {
            const pct = def.flat_percent ?? 0;
            amount = base * (pct / 100);
            explanation = `Sabit oran %${pct}.`;
            break;
        }
        case 'per_unit': {
            const per = def.per_unit_amount ?? 0;
            // Adet başı prim her zaman satış ADEDİ üzerinden hesaplanır;
            // "measure: revenue" seçilmiş olsa bile ciro ile çarpmak anlamsızdır.
            amount = ctx.dealCount * per;
            explanation = `${ctx.dealCount} satış × ${per.toLocaleString('tr-TR')}.`;
            break;
        }
        case 'tiered':
        default: {
            const res = evaluateTiered(def, base, target);
            amount = res.amount;
            explanation = res.explanation;
            break;
        }
    }

    const final = clamp(amount, def);
    if (final !== Math.round(amount * 100) / 100) {
        explanation += def.cap_amount != null && amount > def.cap_amount
            ? ` Tavan ${def.cap_amount.toLocaleString('tr-TR')} uygulandı.`
            : ` Taban ${(def.floor_amount ?? 0).toLocaleString('tr-TR')} uygulandı.`;
    }

    return { amount: final, rule, target, achievementPct, explanation };
}

/** Yeni kural oluştururken kullanılacak boş şablon. */
export function defaultDefinition(type: CommissionType): CommissionDefinition {
    switch (type) {
        case 'flat_percent':
            return { type, measure: 'revenue', flat_percent: 3 };
        case 'per_unit':
            return { type, measure: 'deal_count', per_unit_amount: 5000 };
        default:
            return {
                type: 'tiered',
                measure: 'revenue',
                target_source: 'kpi_target',
                apply_mode: 'marginal',
                tiers: [
                    { from_pct: 0, to_pct: 100, percent: 2 },
                    { from_pct: 100, to_pct: null, percent: 4 },
                ],
            };
    }
}
