import { supabase } from '../../../lib/supabase/client';
import type {
    AttendanceStatus, HrAttendanceDay, HrHoliday, HrLeave, LeaveStatus, LeaveType,
} from '../../../types/hr';

// Puantaj ve izin.
//
// Yetki RLS'te: çalışan kendi kayıtlarını GÖRÜR ama düzeltemez; yalnızca kendi
// adına 'pending' izin talebi açabilir. Düzeltme/onay İK yetkisi ister.

/** Ay başlangıcı ve bitişi (YYYY-MM-DD) — ay seçicileri bunu kullanır. */
export function monthRange(year: number, month: number): { start: string; end: string; days: number } {
    const days = new Date(year, month, 0).getDate();  // month 1-12
    const mm = String(month).padStart(2, '0');
    return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(days).padStart(2, '0')}`, days };
}

export const HrAttendanceService = {
    async listMonth(year: number, month: number, employeeId?: string): Promise<HrAttendanceDay[]> {
        const { start, end } = monthRange(year, month);
        let query = supabase
            .from('hr_attendance_days')
            .select('*')
            .gte('work_date', start)
            .lte('work_date', end)
            .order('work_date', { ascending: true });
        if (employeeId) query = query.eq('employee_id', employeeId);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as HrAttendanceDay[];
    },

    /**
     * İK düzeltmesi. auto_* kolonlarına DOKUNULMAZ — sistemin gözlemi kanıt
     * olarak kalır, düzeltme onu örtmez (bkz. migration INVARIANT A).
     */
    async overrideDay(params: {
        employeeId: string;
        workDate: string;
        status: AttendanceStatus;
        checkIn?: string | null;
        checkOut?: string | null;
        minutes?: number | null;
        reason?: string | null;
    }): Promise<HrAttendanceDay> {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_attendance_days')
            .upsert({
                employee_id: params.employeeId,
                work_date: params.workDate,
                status: params.status,
                effective_check_in: params.checkIn || null,
                effective_check_out: params.checkOut || null,
                effective_minutes: params.minutes ?? null,
                override_reason: params.reason || null,
                overridden_by: user?.id ?? null,
                overridden_at: new Date().toISOString(),
            }, { onConflict: 'employee_id,work_date' })
            .select()
            .single();
        if (error) throw error;
        return data as HrAttendanceDay;
    },

    async listHolidays(countryCodes: string[]): Promise<HrHoliday[]> {
        if (countryCodes.length === 0) return [];
        const { data, error } = await supabase
            .from('hr_holidays')
            .select('*')
            .in('country_code', countryCodes);
        if (error) return [];
        return (data || []) as HrHoliday[];
    },

    async addHoliday(payload: {
        holiday_date: string;
        country_code: string;
        label: string;
        is_half_day?: boolean;
    }): Promise<void> {
        const { error } = await supabase.from('hr_holidays').insert(payload);
        if (error) throw error;
    },

    async deleteHoliday(id: string): Promise<void> {
        const { error } = await supabase.from('hr_holidays').delete().eq('id', id);
        if (error) throw error;
    },

    // ── İzinler ─────────────────────────────────────────────────────────────
    async listLeaves(status?: LeaveStatus): Promise<HrLeave[]> {
        let query = supabase.from('hr_leaves').select('*').order('start_date', { ascending: false });
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as HrLeave[];
    },

    // ── İzin hakkı ve bakiye (20260827b) ────────────────────────────────────
    //
    // İkisi de DB fonksiyonudur, JS'te KOPYALANMAZ: gün sayma kuralı (çalışma
    // günü + resmi tatil + yarım gün) tek yerde durmalı. Aynı hesabı burada
    // tekrar yazsaydık, tatil verisi değiştiğinde arayüz ile trigger farklı
    // sayı üretirdi.

    /** Personelin takvimine göre aralıktaki iş günü (resmi tatil düşülmüş). */
    async workingDays(employeeId: string, start: string, end: string): Promise<number | null> {
        const { data, error } = await supabase.rpc('hr_working_days', {
            p_employee: employeeId, p_start: start, p_end: end,
        });
        if (error) return null;
        return typeof data === 'number' ? data : Number(data ?? 0);
    },

    /** Yıllık izin bakiyesi. Kullanılan gün her çağrıda hr_leaves'ten sayılır. */
    async leaveSummary(employeeId: string, year: number, leaveType: LeaveType = 'annual'): Promise<{
        entitled_days: number;
        carried_over_days: number;
        adjustment_days: number;
        used_days: number;
        pending_days: number;
        remaining_days: number;
    } | null> {
        const { data, error } = await supabase.rpc('hr_leave_summary', {
            p_employee: employeeId, p_year: year, p_type: leaveType,
        });
        if (error) return null;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return null;
        return {
            entitled_days: Number(row.entitled_days ?? 0),
            carried_over_days: Number(row.carried_over_days ?? 0),
            adjustment_days: Number(row.adjustment_days ?? 0),
            used_days: Number(row.used_days ?? 0),
            pending_days: Number(row.pending_days ?? 0),
            remaining_days: Number(row.remaining_days ?? 0),
        };
    },

    /**
     * Personelin KENDİ bekleyen talebini iptali.
     *
     * Onaylanmış izne dokunmaz: o izin puantaja yazılmıştır, tek taraflı geri
     * alınması puantajla izni tutarsız bırakır (20260828b INVARIANT B).
     * .eq('status','pending') istemci nezaketidir; asıl kural RLS'tedir.
     */
    async cancelOwnLeave(id: string): Promise<void> {
        const { error } = await supabase
            .from('hr_leaves')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .eq('status', 'pending');
        if (error) throw error;
    },

    async createLeave(payload: {
        employee_id: string;
        leave_type: LeaveType;
        start_date: string;
        end_date: string;
        days?: number | null;
        reason?: string | null;
    }): Promise<HrLeave> {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_leaves')
            .insert({ ...payload, requested_by: user?.id ?? null })
            .select()
            .single();
        if (error) throw error;
        return data as HrLeave;
    },

    /**
     * Onay/ret. Onaylanan izin, ilgili günleri puantaja DB trigger'ı ile yazar —
     * burada ikinci bir yazma yapılmaz (tek doğruluk kaynağı).
     */
    async decideLeave(id: string, status: 'approved' | 'rejected' | 'cancelled', note?: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('hr_leaves')
            .update({
                status,
                decided_by: user?.id ?? null,
                decided_at: new Date().toISOString(),
                decision_note: note || null,
            })
            .eq('id', id);
        if (error) throw error;
    },

    // İzin SİLME bilinçli olarak yok: onaylanmış izin puantaja işlendiği için
    // kaydı silmek geçmişte açıklanamayan boşluk bırakır. Vazgeçme yolu
    // decideLeave(id, 'cancelled') — iz kalır, puantaj düzeltilebilir.
};
