import { supabase } from '../../../lib/supabase/client';
import type {
    HrPayrollItem, HrPayrollLine, HrPayrollPeriod, PayrollItemKind,
} from '../../../types/hr';
import { hrAudit } from './hrAudit';

// Bordro / hakediş.
//
// KAPSAM: Basit hakediş. SGK/vergi motoru YOK.
//   net = (baz ücret + prim + ek kalemler) − (avans + kesintiler)
//
// TOPLAMLAR SQL'DE: gross/deduction/net kolonları buradan YAZILMAZ; kalem
// değiştikçe DB trigger'ı yeniden hesaplar (tek doğruluk kaynağı).

function periodMonthOf(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** Kesinti sayılan kalem türleri — SQL'deki hr_payroll_is_deduction ile aynı küme. */
export const DEDUCTION_KINDS: PayrollItemKind[] = ['advance', 'deduction'];

export const HrPayrollService = {
    async listPeriods(): Promise<HrPayrollPeriod[]> {
        const { data, error } = await supabase
            .from('hr_payroll_periods')
            .select('*')
            .order('period_month', { ascending: false });
        if (error) throw error;
        return (data || []) as HrPayrollPeriod[];
    },

    async getOrCreatePeriod(year: number, month: number): Promise<HrPayrollPeriod> {
        const periodMonth = periodMonthOf(year, month);
        const { data: existing } = await supabase
            .from('hr_payroll_periods')
            .select('*')
            .eq('period_month', periodMonth)
            .maybeSingle();
        if (existing) return existing as HrPayrollPeriod;

        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_payroll_periods')
            .insert({ period_month: periodMonth, status: 'draft', opened_by: user?.id ?? null })
            .select().single();
        if (error) throw error;
        return data as HrPayrollPeriod;
    },

    /**
     * Ücret + onaylanmış prim + puantajı satırlara kopyalar.
     * Tekrar çalıştırılabilir: elle girilen kalemler KORUNUR, yalnız türetilmiş
     * alanlar tazelenir (SQL tarafında garanti).
     */
    async generate(periodId: string): Promise<number> {
        const { data, error } = await supabase.rpc('hr_generate_payroll', { p_period_id: periodId });
        if (error) throw error;
        await hrAudit('hr.payroll.generate', 'hr_payroll_periods', periodId, { lines: Number(data ?? 0) });
        return Number(data ?? 0);
    },

    async listLines(periodId: string): Promise<HrPayrollLine[]> {
        const { data, error } = await supabase
            .from('hr_payroll_lines')
            .select('*')
            .eq('period_id', periodId);
        if (error) throw error;
        return (data || []) as HrPayrollLine[];
    },

    async listItems(lineIds: string[]): Promise<HrPayrollItem[]> {
        if (lineIds.length === 0) return [];
        const out: HrPayrollItem[] = [];
        // .in() 150+ ID'de sessizce boşalır — parçalı çek.
        for (let i = 0; i < lineIds.length; i += 100) {
            const { data, error } = await supabase
                .from('hr_payroll_items')
                .select('*')
                .in('line_id', lineIds.slice(i, i + 100));
            if (error) throw error;
            out.push(...((data || []) as HrPayrollItem[]));
        }
        return out;
    },

    async addItem(payload: {
        line_id: string; kind: PayrollItemKind; label: string; amount: number; note?: string | null;
    }): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('hr_payroll_items')
            .insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
    },

    async deleteItem(id: string): Promise<void> {
        const { error } = await supabase.from('hr_payroll_items').delete().eq('id', id);
        if (error) throw error;
    },

    async approve(periodId: string): Promise<void> {
        const { error } = await supabase.rpc('hr_approve_payroll', { p_period_id: periodId });
        if (error) throw error;
        // Para kararı: ödenecek tutarları kim kilitledi.
        await hrAudit('hr.payroll.approve', 'hr_payroll_periods', periodId);
    },

    /** Ödeme işaretleme — dönem onaylandıktan SONRA yapılır, kilitten muaftır. */
    async markPaid(lineId: string, status: 'unpaid' | 'partial' | 'paid', note?: string): Promise<void> {
        const { error } = await supabase
            .from('hr_payroll_lines')
            .update({
                payment_status: status,
                paid_at: status === 'paid' ? new Date().toISOString() : null,
                payment_note: note || null,
            })
            .eq('id', lineId);
        if (error) throw error;
        await hrAudit('hr.payroll.mark_paid', 'hr_payroll_lines', lineId, { status, note: note || null });
    },

    async markPeriodPaid(periodId: string): Promise<void> {
        const { error } = await supabase
            .from('hr_payroll_periods')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', periodId);
        if (error) throw error;
    },

    // ── Çalışan self-servis ─────────────────────────────────────────────────
    /** Kendi bordro satırları. RLS zaten kısıtlar; filtre okunabilirlik için. */
    async listOwnLines(employeeId: string): Promise<(HrPayrollLine & { period_month?: string })[]> {
        const { data, error } = await supabase
            .from('hr_payroll_lines')
            .select('*, period:hr_payroll_periods!inner(period_month, status)')
            .eq('employee_id', employeeId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as any;
    },
};

/**
 * CSV export — Excel'in Türkçe yerelde doğru açması için ayraç ";" ve
 * başta BOM kullanılır (aksi hâlde Türkçe karakterler bozulur).
 */
export function payrollToCsv(
    lines: HrPayrollLine[],
    nameOf: (employeeId: string) => string,
): string {
    const head = [
        'Personel', 'Para Birimi', 'Baz Ücret', 'Prim', 'Ek Kalemler',
        'Kesinti', 'Brüt', 'Net Ödenecek', 'Çalışılan Gün', 'İzin', 'Devamsız', 'Ödeme Durumu',
    ];
    const rows = lines.map(l => {
        const extras = Number(l.gross_amount) - Number(l.base_amount) - Number(l.commission_amount);
        return [
            nameOf(l.employee_id),
            l.currency,
            l.base_amount, l.commission_amount, extras.toFixed(2),
            l.deduction_amount, l.gross_amount, l.net_payable,
            l.worked_days ?? '', l.leave_days ?? '', l.absent_days ?? '',
            l.payment_status === 'paid' ? 'Ödendi' : l.payment_status === 'partial' ? 'Kısmi' : 'Ödenmedi',
        ];
    });
    const esc = (v: unknown) => {
        const s = String(v ?? '');
        return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return '﻿' + [head, ...rows].map(r => r.map(esc).join(';')).join('\r\n');
}

export function downloadCsv(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
