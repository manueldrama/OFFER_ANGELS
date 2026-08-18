import { supabase } from '../../../lib/supabase/client';
import { AdminAuditService } from '../auditService';

// İK denetim kaydı.
//
// NEDEN AYRI YARDIMCI: İK'da iki tür olay izlenir ve ikisinin de kaçırılmaması
// gerekir —
//   1) PARA KARARLARI (prim onayı, bordro onayı, tutar düzeltmesi): sonradan
//      "bunu kim onayladı" sorusunun cevabı.
//   2) HASSAS VERİ ERİŞİMİ (IBAN, kimlik no, özlük evrakı, sözleşme): KVKK
//      gereği kimin neye baktığının izi.
//
// SESSİZ BAŞARISIZLIK: Denetim yazımı asıl işlemi ASLA bloke etmez. Log
// yazılamadı diye prim onayı geri alınamaz; hata konsola düşer.

export type HrAuditAction =
    | 'hr.commission.approve'
    | 'hr.commission.adjust'
    | 'hr.payroll.generate'
    | 'hr.payroll.approve'
    | 'hr.payroll.mark_paid'
    | 'hr.document.view'
    | 'hr.document.delete'
    | 'hr.contract.send'
    | 'hr.contract.countersign'
    | 'hr.contract.reject_signed'
    | 'hr.contract_template.create'
    | 'hr.contract_template.delete'
    // Aktifleştirme hukuki bir karardır: "kim ne zaman bu metni gönderilebilir
    // ilan etti" sorusunun cevabı kayıtta durmalı.
    | 'hr.contract_template.activate'
    | 'hr.contract_template.deactivate'
    | 'hr.sensitive.view'
    | 'hr.invite.create'
    // Adayin kalici kariyer adresini yenilemek ESKI LINKI OLDURUR:
    // "bu adayin linki neden calismiyor" sorusunun cevabi kayitta durmali.
    | 'hr.candidate.portal_regenerate'
    | 'hr.job.create'
    | 'hr.job.update'
    | 'hr.job.delete'
    | 'hr.offboarding.open'
    | 'hr.offboarding.update'
    // Mülakat kaydı biyometrik olmayan ama son derece hassas kişisel veridir;
    // kimin ne zaman izlediği KVKK gereği izlenir.
    | 'hr.interview.invite'
    | 'hr.interview.view'
    // Tek çekim kuralının tek istisnası — sessiz bir sıfırlama olmamalı.
    | 'hr.interview.reopen'
    // Süre uzatma bir KARARDIR: adayın kaçırdığı teslim tarihi kim, ne zaman,
    // ne kadar ileri aldı — sonradan sorulabilmeli.
    | 'hr.interview.extend'
    | 'hr.interview.purge'
    // Görev yaşam döngüsü — "kim ne zaman atadı/kapattı" operasyon sorusudur;
    // çekmecedeki Aktivite bölümü de bu kayıtlardan beslenir.
    | 'hr.task.create'
    | 'hr.task.update'
    | 'hr.task.status'
    | 'hr.task.assign'
    | 'hr.task.approve'
    | 'hr.task.reopen'
    | 'hr.task.delete';

export async function hrAudit(
    action: HrAuditAction,
    entityType: string,
    entityId: string | null,
    details?: Record<string, unknown>,
): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
        await AdminAuditService.logAction({
            user_id: user.id,
            action_type: action,
            entity_type: entityType,
            entity_id: entityId,
            new_values: details ?? null,
        });
    } catch (e) {
        // Bilinçli sessiz: denetim kaydı asıl işlemi engellemez.
        console.error('[hrAudit]', action, e);
    }
}

/**
 * Hassas alan görüntüleme izi (KVKK).
 * Hangi ALANLARIN açıldığını yazar; DEĞERLERİ yazmaz — aksi hâlde denetim
 * kaydının kendisi ikinci bir sızıntı yüzeyi olurdu.
 */
export async function hrAuditSensitiveView(
    employeeId: string,
    fields: string[],
): Promise<void> {
    if (fields.length === 0) return;
    await hrAudit('hr.sensitive.view', 'hr_employees', employeeId, { fields });
}
