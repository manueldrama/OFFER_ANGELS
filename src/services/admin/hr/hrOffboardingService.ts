// Çıkış süreci — hr_offboarding (20260829a).
//
// Kayıt İK tarafından elle açılabilir, ama ayrılış tarihi girildiğinde DB
// trigger'ı da otomatik açar. Bu yüzden buradaki `open()` upsert'tir:
// "zaten var mı" kontrolü istemcide yapılmaz, yarış durumu doğurur.

import { supabase } from '../../../lib/supabase/client';
import { hrAudit } from './hrAudit';

export type OffboardingReason =
    | 'resignation' | 'termination' | 'mutual'
    | 'contract_end' | 'retirement' | 'other';

export interface HrOffboarding {
    id: string;
    employee_id: string;
    termination_date: string | null;
    reason: OffboardingReason;
    reason_note: string | null;
    assets_returned: boolean;
    access_revoked: boolean;
    handover_done: boolean;
    final_pay_done: boolean;
    release_signed: boolean;
    exit_interview_at: string | null;
    exit_interview_note: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

export const REASON_LABEL: Record<OffboardingReason, string> = {
    resignation: 'İstifa',
    termination: 'İşveren Feshi',
    mutual: 'Karşılıklı Anlaşma',
    contract_end: 'Sözleşme Bitişi',
    retirement: 'Emeklilik',
    other: 'Diğer',
};

/** Kontrol listesi — arayüz bu diziden çizilir, JSX'te tekrar edilmez. */
export const CHECKLIST: { key: keyof HrOffboarding; label: string; hint: string }[] = [
    { key: 'assets_returned', label: 'Zimmet iadesi', hint: 'Dizüstü, telefon, kart, anahtar' },
    { key: 'access_revoked', label: 'Erişimler kapatıldı', hint: 'E-posta, panel, üçüncü parti hesaplar' },
    { key: 'handover_done', label: 'Devir teslim', hint: 'Dosyalar, müşteri portföyü, açık işler' },
    { key: 'final_pay_done', label: 'Son ödeme', hint: 'Kıdem, ihbar, kullanılmamış izin' },
    { key: 'release_signed', label: 'İbraname imzalandı', hint: 'Karşılıklı ibra belgesi' },
];

export const HrOffboardingService = {
    async get(employeeId: string): Promise<HrOffboarding | null> {
        const { data, error } = await supabase
            .from('hr_offboarding')
            .select('*')
            .eq('employee_id', employeeId)
            .maybeSingle();
        if (error) return null;
        return (data as HrOffboarding) ?? null;
    },

    async open(employeeId: string, terminationDate: string | null): Promise<void> {
        const { error } = await supabase
            .from('hr_offboarding')
            .upsert({ employee_id: employeeId, termination_date: terminationDate },
                { onConflict: 'employee_id' });
        if (error) throw error;
        await hrAudit('hr.offboarding.open', 'hr_offboarding', employeeId);
    },

    async update(employeeId: string, patch: Partial<HrOffboarding>): Promise<void> {
        const { error } = await supabase
            .from('hr_offboarding')
            .update(patch)
            .eq('employee_id', employeeId);
        if (error) throw error;
        await hrAudit('hr.offboarding.update', 'hr_offboarding', employeeId);
    },
};
