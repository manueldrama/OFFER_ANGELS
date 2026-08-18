import { supabase } from '../../../lib/supabase/client';
import type { HrCompensation, HrEmployee, HrEmployeeWithUser } from '../../../types/hr';

// İK personel profili + tarihli ücret kayıtları.
//
// GÜVENLİK NOTU: Burada hiçbir yetki kontrolü YOKTUR ve olmamalıdır. Kimin
// hangi satırı görebileceğine hr_employees / hr_compensation üzerindeki RLS
// karar verir (hr_is_manager() or employee_id = auth.uid()). Yetkisiz kullanıcı
// için sorgular hata değil, BOŞ/kendi satırı döner — ekranların bunu doğal
// karşılaması gerekir.
//
// DB VIEW KULLANILMADI: PostgreSQL view'ları varsayılan olarak sahibinin
// hakkıyla çalışır ve alttaki tabloların RLS'ini BYPASS eder. Bu yüzden
// "personel + güncel maaş" birleşimi view ile değil, iki sorgu + client-side
// map ile kurulur.

export const HrEmployeeService = {
    /** Personel listesi + sales_users kimliği. Ücret ayrı sorguyla eklenir. */
    async listEmployees(includeInactive = false): Promise<HrEmployeeWithUser[]> {
        let query = supabase
            .from('hr_employees')
            .select('*, user:sales_users!hr_employees_employee_id_fkey(full_name, email, role, is_active)');

        if (!includeInactive) query = query.eq('is_active', true);

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data || []) as unknown as HrEmployeeWithUser[];
        rows.sort((a, b) =>
            (a.user?.full_name || a.user?.email || '').localeCompare(
                b.user?.full_name || b.user?.email || '', 'tr'));
        return rows;
    },

    /**
     * Listeye o an geçerli ücreti ekler. Ayrı çağrı olmasının sebebi: İK
     * yetkisi olmayan kullanıcıda ücret sorgusu boş döner ve liste yine de
     * çalışır (kısmi başarı, tam çökme değil).
     */
    async attachCurrentCompensation(employees: HrEmployeeWithUser[]): Promise<HrEmployeeWithUser[]> {
        if (employees.length === 0) return employees;

        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
            .from('hr_compensation')
            .select('*')
            .lte('effective_from', today)
            .or(`effective_to.is.null,effective_to.gte.${today}`);

        // Yetki yoksa/hata varsa liste ücretsiz gösterilir — ekran çökmemeli.
        if (error) return employees;

        const byEmployee = new Map<string, HrCompensation>();
        for (const row of (data || []) as HrCompensation[]) {
            const existing = byEmployee.get(row.employee_id);
            // Çakışma trigger'la engellenir; yine de en yeni başlangıç kazanır.
            if (!existing || row.effective_from > existing.effective_from) {
                byEmployee.set(row.employee_id, row);
            }
        }

        return employees.map(e => ({ ...e, current_compensation: byEmployee.get(e.employee_id) ?? null }));
    },

    async getEmployee(employeeId: string): Promise<HrEmployeeWithUser | null> {
        const { data, error } = await supabase
            .from('hr_employees')
            .select('*, user:sales_users!hr_employees_employee_id_fkey(full_name, email, role, is_active)')
            .eq('employee_id', employeeId)
            .maybeSingle();
        if (error) throw error;
        return (data as unknown as HrEmployeeWithUser) ?? null;
    },

    /**
     * Profil oluşturur veya günceller. employee_id mutlaka mevcut bir
     * sales_users kaydına ait olmalıdır (FK) — yeni kullanıcı önce
     * AdminUsersService.createUser ile açılır.
     */
    async upsertEmployee(payload: Partial<HrEmployee> & { employee_id: string }): Promise<HrEmployee> {
        const { data, error } = await supabase
            .from('hr_employees')
            .upsert(payload, { onConflict: 'employee_id' })
            .select()
            .single();
        if (error) throw error;
        return data as HrEmployee;
    },

    async listCompensation(employeeId: string): Promise<HrCompensation[]> {
        const { data, error } = await supabase
            .from('hr_compensation')
            .select('*')
            .eq('employee_id', employeeId)
            .order('effective_from', { ascending: false });
        if (error) throw error;
        return (data || []) as HrCompensation[];
    },

    /**
     * Yeni ücret kaydı. Önceki açık kaydın kapatılmasını DB trigger'ı
     * (hr_compensation_close_previous) yapar — burada elle kapatma YAPILMAZ,
     * yoksa iki farklı doğruluk kaynağı oluşur.
     */
    async addCompensation(payload: {
        employee_id: string;
        effective_from: string;
        base_amount: number;
        currency: string;
        pay_period?: HrCompensation['pay_period'];
        /** Brüt mü net mi. Verilmezse DB varsayılanı 'gross'. Dönüşüm YAPILMAZ. */
        amount_type?: HrCompensation['amount_type'];
        note?: string | null;
    }): Promise<HrCompensation> {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_compensation')
            .insert({ ...payload, created_by: user?.id ?? null })
            .select()
            .single();
        if (error) throw error;
        return data as HrCompensation;
    },

    async deleteCompensation(id: string): Promise<void> {
        const { error } = await supabase.from('hr_compensation').delete().eq('id', id);
        if (error) throw error;
    },

    /** Geçerli oturumun İK yöneticisi olup olmadığı (menü/buton görünürlüğü için). */
    async isHrManager(): Promise<boolean> {
        const { data, error } = await supabase.rpc('hr_is_manager');
        if (error) return false;
        return data === true;
    },
};
