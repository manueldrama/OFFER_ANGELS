import { supabase } from '../../../lib/supabase/client';
import { computeBonus, resolveEmployeeBonus, type BonusScaleBand, type CountryBonusDefault } from '../../../lib/hr/kpiScoring';
import { HrCompanyService } from './hrCompanyService';
import type {
    HrBonusEntry, HrCommissionRun, HrKpiConfig, HrPremiumGateViolation,
} from '../../../types/hr';
import { hrAudit } from './hrAudit';

// Performans bonusu — KPI skorundan hesaplanır.
//
// İŞ KURALI: Satış başına prim YOKTUR. Aylık değişken ücret yalnızca toplam KPI
// skorunun düştüğü bonus bandından gelir. Bu, "bir satış daha yapayım, müşteriyi
// sıkıştırayım" davranışını bilinçli olarak ödüllendirmez.
//
// Dönem durum makinesi hr_commission_runs'tan devralınır (aynı akış: hesapla →
// düzelt → onayla/kilitle); yalnız satır şekli farklıdır.

function periodMonthOf(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}-01`;
}

export interface BonusDraftLine {
    employeeId: string;
    employeeName: string;
    kpiScore: number | null;
    eligibilityPct: number;
    maxBonus: number;
    calculatedBonus: number;
    gateApplied: boolean;
    gateCapPct: number | null;
    finalBonus: number;
    currency: string;
    /** Gate'i tetikleyen ihlallerin özeti — ekranda gösterilir. */
    gateNote: string | null;
}

export const HrBonusService = {
    async getRun(year: number, month: number): Promise<HrCommissionRun | null> {
        const { data, error } = await supabase
            .from('hr_commission_runs')
            .select('*')
            .eq('period_month', periodMonthOf(year, month))
            .neq('status', 'cancelled')
            .maybeSingle();
        if (error) throw error;
        return (data as HrCommissionRun) ?? null;
    },

    async listEntries(runId: string): Promise<HrBonusEntry[]> {
        const { data, error } = await supabase
            .from('hr_bonus_entries').select('*').eq('run_id', runId);
        if (error) throw error;
        return (data || []) as HrBonusEntry[];
    },

    // ── Premium Experience Gate ──────────────────────────────────────────────
    async listViolations(year: number, month: number): Promise<HrPremiumGateViolation[]> {
        const { data, error } = await supabase
            .from('hr_premium_gate_violations')
            .select('*')
            .eq('period_month', periodMonthOf(year, month))
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as HrPremiumGateViolation[];
    },

    async addViolation(payload: {
        employee_id: string; period_month: string;
        description: string; evidence?: string | null; cap_pct: number;
    }): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('hr_premium_gate_violations')
            .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
    },

    async deactivateViolation(id: string): Promise<void> {
        const { error } = await supabase
            .from('hr_premium_gate_violations').update({ is_active: false }).eq('id', id);
        if (error) throw error;
    },

    /**
     * Bonus taslağını hesaplar. Veriyi YAZMAZ.
     * KPI skoru KAYITLI skorlardan okunur — bonus, ekranda o an hesaplanan
     * geçici bir skordan değil, kaydedilmiş skordan türemelidir.
     */
    async calculateDraft(params: {
        year: number; month: number;
        config: HrKpiConfig;
        scores: { employee_id: string; total_score: number | null; components: unknown }[];
        nameOf: (employeeId: string) => string;
        /** Kişiye özel bonus tavanı çözümü için personel profilleri. */
        employees?: { employee_id: string; work_country?: string | null; max_monthly_bonus?: number | null; bonus_currency?: string | null }[];
    }): Promise<BonusDraftLine[]> {
        const { year, month, config, scores, nameOf, employees = [] } = params;
        const employeeById = new Map(employees.map(e => [e.employee_id, e]));

        // ÜLKE VARSAYILANLARI — koşu başına TEK sorgu, çalışan başına değil.
        // Ülke bonusunun kuru o ülkenin default_currency'sidir (20260901a
        // INVARIANT A); ayrı bir bonus kuru yoktur.
        const countryDefaults = new Map<string, CountryBonusDefault>();
        try {
            for (const c of await HrCompanyService.list()) {
                countryDefaults.set(c.country_code.toUpperCase(), {
                    max_monthly_bonus: c.max_monthly_bonus,
                    currency: c.default_currency,
                });
            }
        } catch { /* ülke tablosu okunamazsa zincir kişi → global kalır */ }

        const violations = await this.listViolations(year, month);

        const capsByEmp = new Map<string, { caps: number[]; notes: string[] }>();
        for (const v of violations) {
            if (!v.is_active) continue;
            const cur = capsByEmp.get(v.employee_id) ?? { caps: [], notes: [] };
            cur.caps.push(Number(v.cap_pct));
            cur.notes.push(`${v.description} (tavan %${v.cap_pct})`);
            capsByEmp.set(v.employee_id, cur);
        }

        const scale = (config.bonus_scale ?? []) as BonusScaleBand[];

        return scores.map(s => {
            const gate = capsByEmp.get(s.employee_id);
            // Zincir: kişiye özel → ülke → global (tek doğruluk noktası).
            const emp = employeeById.get(s.employee_id);
            const { maxBonus, currency } = resolveEmployeeBonus(
                emp, config,
                emp?.work_country
                    ? countryDefaults.get(emp.work_country.toUpperCase()) ?? null
                    : null,
            );
            const result = computeBonus({
                kpiScore: s.total_score,
                maxBonus,
                scale,
                gateCaps: gate?.caps ?? [],
            });
            return {
                employeeId: s.employee_id,
                employeeName: nameOf(s.employee_id),
                kpiScore: result.kpiScore,
                eligibilityPct: result.eligibilityPct,
                maxBonus: result.maxBonus,
                calculatedBonus: result.calculatedBonus,
                gateApplied: result.gateApplied,
                gateCapPct: result.gateCapPct,
                finalBonus: result.finalBonus,
                currency,
                gateNote: gate?.notes.join(' · ') ?? null,
            };
        });
    },

    /** Taslağı kaydeder; koşu yoksa açar. Onaylanmış dönem yeniden yazılamaz. */
    async saveDraft(
        year: number, month: number, lines: BonusDraftLine[], config: HrKpiConfig,
    ): Promise<HrCommissionRun> {
        const periodMonth = periodMonthOf(year, month);
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

        const { error: delErr } = await supabase
            .from('hr_bonus_entries').delete().eq('run_id', run.id);
        if (delErr) throw delErr;

        if (lines.length > 0) {
            const rows = lines.map(l => ({
                run_id: run!.id,
                employee_id: l.employeeId,
                kpi_score: l.kpiScore,
                eligibility_pct: l.eligibilityPct,
                max_bonus: l.maxBonus,
                calculated_bonus: l.calculatedBonus,
                gate_applied: l.gateApplied,
                gate_cap_pct: l.gateCapPct,
                gate_note: l.gateNote,
                final_bonus: l.finalBonus,
                currency: l.currency,
                // Hesabın neye dayandığı donar: skala sonradan değişse geçmiş bozulmaz.
                scale_snapshot: config.bonus_scale,
            }));
            const { error } = await supabase.from('hr_bonus_entries').insert(rows);
            if (error) throw error;
        }

        const { data, error: updErr } = await supabase
            .from('hr_commission_runs')
            .update({
                status: 'calculated',
                calculated_at: new Date().toISOString(),
                calculated_by: user?.id ?? null,
            })
            .eq('id', run.id)
            .select().single();
        if (updErr) throw updErr;
        return data as HrCommissionRun;
    },

    async adjustEntry(id: string, finalBonus: number, reason: string): Promise<void> {
        const { data: before } = await supabase
            .from('hr_bonus_entries')
            .select('final_bonus, calculated_bonus, employee_id')
            .eq('id', id).maybeSingle();

        const { error } = await supabase
            .from('hr_bonus_entries')
            .update({ final_bonus: finalBonus, adjustment_reason: reason || null })
            .eq('id', id);
        if (error) throw error;

        await hrAudit('hr.commission.adjust', 'hr_bonus_entries', id, {
            from: before?.final_bonus ?? null,
            to: finalBonus,
            calculated: before?.calculated_bonus ?? null,
            employee_id: before?.employee_id ?? null,
            reason: reason || null,
        });
    },

    async approveRun(runId: string): Promise<void> {
        const { error } = await supabase.rpc('hr_approve_commission_run', { p_run_id: runId });
        if (error) throw error;
        await hrAudit('hr.commission.approve', 'hr_commission_runs', runId, { model: 'kpi_bonus' });
    },

    async cancelRun(runId: string): Promise<void> {
        const { error } = await supabase
            .from('hr_commission_runs').update({ status: 'cancelled' }).eq('id', runId);
        if (error) throw error;
    },
};
