import { supabase } from '../../../lib/supabase/client';
import { fetchInChunks } from '../../../lib/supabase/paginate';
import {
    attributeRevenue, type PaymentRow, type ReservationRow,
} from '../../../lib/hr/revenueAttribution';
import {
    evaluateCommission, type CommissionRule,
} from '../../../lib/hr/commissionRules';
import { hrAudit } from './hrAudit';
import type {
    HrCommissionEntry, HrCommissionRule, HrCommissionRun, HrEmployeeWithUser, HrKpiTarget,
} from '../../../types/hr';

// Prim motoru.
//
// AKIŞ: Dönem aç → Hesapla (öneri) → yönetici düzeltir → Onayla (kilitlenir).
//
// ATIF: Ciro, satış anında dondurulan customer_reservations.sales_rep_id /
// payment_transactions.sales_rep_id üzerinden atfedilir. Lead sonradan
// devredilse geçmiş prim DEĞİŞMEZ (20260818f migration).
//
// HAK EDİŞ: Prim para TAHSİL EDİLİNCE doğar. revenueAttribution'ın dört kuralı
// zaten tahsil edilmiş tutarı sayar; ayrı bir filtre gerekmez.

const CHUNK = 100;

function monthBounds(year: number, month: number) {
    return {
        startIso: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
        endIso: new Date(Date.UTC(year, month, 1)).toISOString(),
        periodMonth: `${year}-${String(month).padStart(2, '0')}-01`,
    };
}

/** DB satırını saf motorun beklediği şekle çevirir. */
function toRuleModel(row: HrCommissionRule): CommissionRule {
    return {
        id: row.id,
        name: row.name,
        priority: row.priority,
        is_active: row.is_active,
        valid_from: row.valid_from,
        valid_to: row.valid_to,
        scope: (row.scope || {}) as CommissionRule['scope'],
        definition: row.definition as CommissionRule['definition'],
    };
}

export interface CommissionDraftLine {
    employeeId: string;
    employeeName: string;
    currency: string;
    basisAmount: number;
    dealCount: number;
    target: number | null;
    achievementPct: number | null;
    ruleId: string | null;
    ruleName: string | null;
    ruleSnapshot: unknown;
    suggestedAmount: number;
    explanation: string;
}

export const HrCommissionService = {
    // ── Kurallar ─────────────────────────────────────────────────────────────
    async listRules(): Promise<HrCommissionRule[]> {
        const { data, error } = await supabase
            .from('hr_commission_rules')
            .select('*')
            .order('priority', { ascending: true });
        if (error) throw error;
        return (data || []) as HrCommissionRule[];
    },

    async saveRule(rule: Partial<HrCommissionRule> & { name: string; definition: unknown }): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        const payload = { ...rule, created_by: rule.id ? undefined : user?.id ?? null };
        const { error } = rule.id
            ? await supabase.from('hr_commission_rules').update(payload).eq('id', rule.id)
            : await supabase.from('hr_commission_rules').insert(payload);
        if (error) throw error;
    },

    async deleteRule(id: string): Promise<void> {
        const { error } = await supabase.from('hr_commission_rules').delete().eq('id', id);
        if (error) throw error;
    },

    // ── Dönem koşusu ─────────────────────────────────────────────────────────
    async getRun(year: number, month: number): Promise<HrCommissionRun | null> {
        const { periodMonth } = monthBounds(year, month);
        const { data, error } = await supabase
            .from('hr_commission_runs')
            .select('*')
            .eq('period_month', periodMonth)
            .neq('status', 'cancelled')
            .maybeSingle();
        if (error) throw error;
        return (data as HrCommissionRun) ?? null;
    },

    async listEntries(runId: string): Promise<HrCommissionEntry[]> {
        const { data, error } = await supabase
            .from('hr_commission_entries')
            .select('*')
            .eq('run_id', runId);
        if (error) throw error;
        return (data || []) as HrCommissionEntry[];
    },

    /**
     * Dönemin prim önerisini hesaplar. Veriyi YAZMAZ — önce ekranda gösterilir.
     * Kural bulunamayan çalışan için tutar 0 gelir; varsayılan oran uydurulmaz.
     */
    async calculateDraft(
        year: number, month: number, employees: HrEmployeeWithUser[],
    ): Promise<CommissionDraftLine[]> {
        const { startIso, endIso, periodMonth } = monthBounds(year, month);
        const repIds = employees.map(e => e.employee_id);
        if (repIds.length === 0) return [];

        const [rulesRaw, targetsRaw, payments, reservations] = await Promise.all([
            this.listRules(),
            supabase.from('hr_kpi_targets').select('*').eq('period_month', periodMonth)
                .then(r => (r.data || []) as HrKpiTarget[]),
            fetchInChunks<PaymentRow>(
                repIds,
                (chunk, from, to) => supabase
                    .from('payment_transactions')
                    .select('lead_id, sales_rep_id, amount, currency, status')
                    .in('sales_rep_id', chunk)
                    .gte('created_at', startIso).lt('created_at', endIso)
                    .range(from, to),
                CHUNK,
            ),
            fetchInChunks<ReservationRow>(
                repIds,
                (chunk, from, to) => supabase
                    .from('customer_reservations')
                    .select('lead_id, sales_rep_id, offer_token, payment_method, sale_source, status, original_total, updated_total, remaining_amount, deposit_amount')
                    .in('sales_rep_id', chunk)
                    .gte('created_at', startIso).lt('created_at', endIso)
                    .range(from, to),
                CHUNK,
            ),
        ]);

        // Para birimi: customer_reservations'ta currency kolonu yok, teklif üzerinden.
        const tokens = [...new Set(reservations.map(r => r.offer_token).filter(Boolean))] as string[];
        const offers = tokens.length
            ? await fetchInChunks<{ offer_token: string; currency: string | null }>(
                tokens,
                (chunk, from, to) => supabase
                    .from('generated_offers').select('offer_token, currency')
                    .in('offer_token', chunk).range(from, to),
                CHUNK,
            )
            : [];
        const currencyByToken = new Map<string, string>();
        for (const o of offers) if (o.offer_token && o.currency) currencyByToken.set(o.offer_token, o.currency);

        const rules = rulesRaw.map(toRuleModel);
        const lines: CommissionDraftLine[] = [];

        for (const emp of employees) {
            const bucket = attributeRevenue({
                payments, reservations, currencyByToken,
                repIds: new Set([emp.employee_id]),
            });

            // Hiç cirosu yoksa satır üretilmez — sıfırlık satır tabloyu şişirir.
            if (bucket.byCurrency.size === 0) continue;

            for (const [currency, revenue] of bucket.byCurrency) {
                // Hedef: kişiye özel > departman geneli. Ciro hedefi para birimine bağlıdır.
                const target = targetsRaw.find(t =>
                    t.kpi_key === 'revenue' && t.employee_id === emp.employee_id
                    && (t.currency ?? 'TRY') === currency)
                    ?? targetsRaw.find(t =>
                        t.kpi_key === 'revenue' && t.department === emp.department
                        && (t.currency ?? 'TRY') === currency);

                const outcome = evaluateCommission(rules, {
                    employeeId: emp.employee_id,
                    department: emp.department,
                    country: emp.work_country,
                    currency,
                    revenue,
                    dealCount: bucket.dealCount,
                    kpiTarget: target ? Number(target.target_value) : null,
                    periodMonth,
                });

                lines.push({
                    employeeId: emp.employee_id,
                    employeeName: emp.user?.full_name || emp.user?.email || emp.employee_id.slice(0, 8),
                    currency,
                    basisAmount: revenue,
                    dealCount: bucket.dealCount,
                    target: outcome.target,
                    achievementPct: outcome.achievementPct,
                    ruleId: outcome.rule?.id ?? null,
                    ruleName: outcome.rule?.name ?? null,
                    // INVARIANT B: kural hesap anındaki hâliyle dondurulur
                    ruleSnapshot: outcome.rule?.definition ?? null,
                    suggestedAmount: outcome.amount,
                    explanation: outcome.explanation,
                });
            }
        }

        return lines;
    },

    /** Taslağı kaydeder; koşu yoksa açar, varsa satırlarını tazeler. */
    async saveDraft(year: number, month: number, lines: CommissionDraftLine[]): Promise<HrCommissionRun> {
        const { periodMonth } = monthBounds(year, month);
        const { data: { user } } = await supabase.auth.getUser();

        let run = await this.getRun(year, month);
        if (!run) {
            const { data, error } = await supabase
                .from('hr_commission_runs')
                .insert({ period_month: periodMonth, status: 'draft' })
                .select().single();
            if (error) throw error;
            run = data as HrCommissionRun;
        }
        if (run.status === 'approved' || run.status === 'locked') {
            throw new Error('Bu dönem onaylanmış; yeniden hesaplanamaz.');
        }

        // Eski satırları temizle — yeniden hesap tam değişim demektir.
        const { error: delErr } = await supabase
            .from('hr_commission_entries').delete().eq('run_id', run.id);
        if (delErr) throw delErr;

        if (lines.length > 0) {
            const rows = lines.map(l => ({
                run_id: run!.id,
                employee_id: l.employeeId,
                currency: l.currency,
                basis_amount: l.basisAmount,
                deal_count: l.dealCount,
                target_amount: l.target,
                achievement_pct: l.achievementPct,
                rule_id: l.ruleId,
                rule_name: l.ruleName,
                rule_snapshot: l.ruleSnapshot,
                suggested_amount: l.suggestedAmount,
                final_amount: l.suggestedAmount,   // başlangıçta öneriye eşit
                source_breakdown: { explanation: l.explanation },
            }));
            const { error } = await supabase.from('hr_commission_entries').insert(rows);
            if (error) throw error;
        }

        const { data, error: updErr } = await supabase
            .from('hr_commission_runs')
            .update({ status: 'calculated', calculated_at: new Date().toISOString(), calculated_by: user?.id ?? null })
            .eq('id', run.id)
            .select().single();
        if (updErr) throw updErr;
        return data as HrCommissionRun;
    },

    /** Yöneticinin tutar düzeltmesi. Onaydan sonra trigger reddeder. */
    async adjustEntry(id: string, finalAmount: number, reason: string): Promise<void> {
        // Eski tutarı denetim kaydına yazabilmek için önce oku.
        const { data: before } = await supabase
            .from('hr_commission_entries')
            .select('final_amount, suggested_amount, employee_id, currency')
            .eq('id', id).maybeSingle();

        const { error } = await supabase
            .from('hr_commission_entries')
            .update({ final_amount: finalAmount, adjustment_reason: reason || null })
            .eq('id', id);
        if (error) throw error;

        await hrAudit('hr.commission.adjust', 'hr_commission_entries', id, {
            from: before?.final_amount ?? null,
            to: finalAmount,
            suggested: before?.suggested_amount ?? null,
            employee_id: before?.employee_id ?? null,
            currency: before?.currency ?? null,
            reason: reason || null,
        });
    },

    /** Onay — atomik RPC; satırlar bu andan sonra dondurulur. */
    async approveRun(runId: string): Promise<void> {
        const { error } = await supabase.rpc('hr_approve_commission_run', { p_run_id: runId });
        if (error) throw error;
        // Para kararı: "bu dönemi kim kilitledi" izi.
        await hrAudit('hr.commission.approve', 'hr_commission_runs', runId);
    },

    async cancelRun(runId: string): Promise<void> {
        const { error } = await supabase
            .from('hr_commission_runs')
            .update({ status: 'cancelled' })
            .eq('id', runId);
        if (error) throw error;
    },
};
