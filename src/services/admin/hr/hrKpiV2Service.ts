import { supabase } from '../../../lib/supabase/client';
import { fetchInChunks } from '../../../lib/supabase/paginate';
import {
    computeKpiScore, slaMinutesFor, workingMinutesBetween,
    type ComponentInput, type KpiScoreResult,
} from '../../../lib/hr/kpiScoring';
import type { HrEmployeeWithUser, HrKpiConfig } from '../../../types/hr';

// KPI v2 — 5 bileşenli 100 puanlık bileşik skorun VERİ TOPLAMA katmanı.
// Puanlama matematiği src/lib/hr/kpiScoring.ts'te (saf); burası yalnız sayar.
//
// BİLEŞENLERİN AYRIMI KORUNUR (aynı davranış iki kez ödüllendirilmez):
//   conversion → sonuç ne oldu
//   followup   → verilen söz zamanında tutuldu mu
//   priority   → önemli lead açıkta mı kaldı
//   sla        → yeni lead'e ne kadar hızlı insan teması yapıldı
//   crm        → süreç sistemde doğru kaydedildi mi
//
// VARSAYIM — DOĞRULANMASI GEREKİR:
//   "Gerçek insan teması" iki sinyalden türetilir:
//     1) lead_events.event_type = 'call_logged'  (temsilci aramayı kaydetti)
//     2) whatsapp_messages: direction='outbound' VE template_name IS NULL
//        (şablonlu gönderim otomasyondur; serbest metin insan yazımıdır)
//   whatsapp_messages'ta "bot mu insan mı" diyen ayrı bir kolon YOKTUR; bu
//   yüzden şablon yokluğu vekil işaret olarak kullanılır.

const CHUNK = 100;

function monthBounds(year: number, month: number) {
    return {
        startIso: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
        endIso: new Date(Date.UTC(year, month, 1)).toISOString(),
        periodMonth: `${year}-${String(month).padStart(2, '0')}-01`,
    };
}

interface LeadRow {
    id: string;
    assigned_to: string | null;
    assigned_at: string | null;
    created_at: string;
    status: string | null;
    not_interested: boolean | null;
    not_interested_source: string | null;
}

/** "HH:MM[:SS]" → günün dakikası. */
function minutesOfDay(hhmm: string | null | undefined, fallback: number): number {
    if (!hhmm) return fallback;
    const [h, m] = hhmm.split(':').map(Number);
    if (!Number.isFinite(h)) return fallback;
    return h * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * Bir çalışanın ay içinde BEKLENEN mesai dakikası.
 *
 * Düşülenler:
 *   • Çalışma günü olmayan günler (work_days)
 *   • Ülkesine tanımlı resmi tatiller
 *   • Onaylı izin günleri
 *   • BUGÜNDEN SONRAKİ GÜNLER — açık ayda gelecek günler beklenene eklenirse
 *     doluluk oranı ayın başında %10, ortasında %50 görünür; bu, ölçüm değil
 *     takvim artefaktı olur. (SLA'daki "süresi dolmamış lead" ile aynı sınıf hata.)
 */
function expectedWorkMinutes(params: {
    year: number; month: number;
    workDays: number[]; shiftStart: string | null; shiftEnd: string | null;
    holidayDates: Set<string>;
    leaveDates: Set<string>;
    todayIso: string;
}): number {
    const { year, month, workDays, shiftStart, shiftEnd, holidayDates, leaveDates, todayIso } = params;

    const startMin = minutesOfDay(shiftStart, 9 * 60);
    const endMin = minutesOfDay(shiftEnd, 18 * 60);
    const perDay = endMin - startMin;
    if (perDay <= 0) return 0;

    const days = workDays?.length ? workDays : [1, 2, 3, 4, 5];
    const daysInMonth = new Date(year, month, 0).getDate();

    let total = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (iso > todayIso) break;                       // gelecek günler beklenmez

        const dow = new Date(year, month - 1, d).getDay();
        const isoDow = dow === 0 ? 7 : dow;
        if (!days.includes(isoDow)) continue;
        if (holidayDates.has(iso)) continue;
        if (leaveDates.has(iso)) continue;

        total += perDay;
    }
    return total;
}

export interface EmployeeKpiBreakdown {
    employeeId: string;
    employeeName: string;
    score: KpiScoreResult;
}

export const HrKpiV2Service = {
    async getConfig(): Promise<HrKpiConfig> {
        const { data, error } = await supabase
            .from('hr_kpi_config').select('*').eq('id', 1).single();
        if (error) throw error;
        return data as HrKpiConfig;
    },

    async saveConfig(patch: Partial<HrKpiConfig>): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('hr_kpi_config')
            .update({ ...patch, updated_by: user?.id ?? null })
            .eq('id', 1);
        if (error) throw error;
    },

    /** Etiket listesi — "geçersiz lead" seçimi için. */
    async listLeadTags(): Promise<{ id: string; name: string; color: string }[]> {
        const { data, error } = await supabase
            .from('lead_tags').select('id, name, color').order('sort_order');
        if (error) return [];
        return (data || []) as { id: string; name: string; color: string }[];
    },

    /**
     * Bir ay için tüm satış temsilcilerinin bileşik KPI skorunu hesaplar.
     * Veriyi YAZMAZ — önce ekranda gösterilir, ay kapatılınca dondurulur.
     */
    async computeMonth(
        year: number, month: number, employees: HrEmployeeWithUser[], config: HrKpiConfig,
    ): Promise<EmployeeKpiBreakdown[]> {
        const { startIso, endIso } = monthBounds(year, month);
        const empIds = employees.map(e => e.employee_id);
        if (empIds.length === 0) return [];

        // ── Ortak veri: temsilcinin TÜM portföyü ───────────────────────────
        //
        // KAPSAM DÜZELTMESİ: Önceden yalnız "bu ay atanan" leadler çekiliyordu.
        // Bu, Takip Uyumu ve Öncelikli Lead bileşenlerini kırıyordu: temsilcinin
        // vadesi gelen hatırlatmaları ve öncelikli leadleri çoğunlukla ÖNCEKİ
        // aylardan atanmış leadlere aittir; onlar sorgu dışında kalınca bileşen
        // "ölçülecek kayıt yok" (N/A) sanılıyordu.
        //
        // Ayrım:
        //   own          → tüm portföy (takip, öncelik, CRM bunun üzerinden)
        //   newThisMonth → bu ay atananlar (dönüşüm paydası ve SLA bunun üzerinden)
        const leads = await fetchInChunks<LeadRow>(
            empIds,
            (chunk, from, to) => supabase
                .from('leads')
                .select('id, assigned_to, assigned_at, created_at, status, not_interested, not_interested_source')
                .in('assigned_to', chunk)
                .range(from, to),
            CHUNK,
        );

        const leadIds = leads.map(l => l.id);
        const leadsByEmp = new Map<string, LeadRow[]>();
        for (const l of leads) {
            if (!l.assigned_to) continue;
            const arr = leadsByEmp.get(l.assigned_to) ?? [];
            arr.push(l);
            leadsByEmp.set(l.assigned_to, arr);
        }

        // ── Paralel veri toplama ───────────────────────────────────────────
        const [aiStates, reminders, callEvents, leadNotes, waOutbound, paidReservations, paidPayments] =
            await Promise.all([
                leadIds.length ? fetchInChunks<{ lead_id: string; score: number | null }>(
                    leadIds,
                    (chunk, from, to) => supabase
                        .from('lead_ai_states').select('lead_id, score')
                        .in('lead_id', chunk).range(from, to),
                    CHUNK,
                ) : Promise.resolve([]),

                // Takip sözleri.
                //
                // ATFETME KURALI: Takip, EMEĞİN HARCANDIĞI aya işlenir.
                //   • Bu ay TAMAMLANAN takip bu ayın metriğidir — vadesi geçen
                //     aydan gelse bile. Zamanında yapıldıysa puanı bu ay kazanır.
                //   • Bu ay vadesi gelip HÂLÂ yapılmamış takip bu ayın kaçırılmışı.
                //   • Önceki aya ait olup hâlâ açık olanlar puanı etkilemez;
                //     "birikmiş gecikme" olarak nota yazılır ki görünmez kalmasın.
                //
                // 6 aylık alt sınır hacmi makul tutar. Üst sınır YOKTUR: vadesi
                // ileride olan bir takip erken tamamlanmışsa da sayılabilmeli.
                leadIds.length ? fetchInChunks<{
                    lead_id: string; remind_at: string; is_done: boolean; done_at: string | null;
                }>(
                    leadIds,
                    (chunk, from, to) => supabase
                        .from('lead_reminders')
                        .select('lead_id, remind_at, is_done, done_at')
                        .in('lead_id', chunk)
                        .gte('remind_at', new Date(Date.UTC(year, month - 7, 1)).toISOString())
                        .range(from, to),
                    CHUNK,
                ) : Promise.resolve([]),

                // İnsan teması 1: Arama Asistanı ve elle arama kaydı.
                //
                // DÖRT OLAY TİPİ VAR, ÜÇÜ TEMASTIR:
                //   call_logged  → elle kaydedilen arama + asistanda "ulaşılamadı"
                //   call_note    → müşteriye ULAŞILDI (asıl temas sinyali)
                //   call_outcome → görüşme sonuçlandı (kazanıldı/kaybedildi + sebep)
                //   call_snooze  → erteleme; temas kanıtı DEĞİL, bu yüzden dışarıda
                //
                // Yalnız call_logged'a bakılırsa müşteriye gerçekten ulaşan temsilci
                // "hiç temas etmemiş" görünür ve SLA'sı haksız yere sıfırlanır.
                leadIds.length ? fetchInChunks<{
                    lead_id: string; created_at: string; event_type: string; metadata: any;
                }>(
                    leadIds,
                    (chunk, from, to) => supabase
                        .from('lead_events')
                        .select('lead_id, created_at, event_type, metadata')
                        .in('lead_id', chunk)
                        .in('event_type', ['call_logged', 'call_note', 'call_outcome'])
                        // Ay başından itibaren: "bu lead şu an işleniyor mu" sorusunu
                        // ölçüyoruz. 3 ay önce yapılmış tek bir arama, leadin bugün
                        // takip edildiği anlamına gelmez.
                        .gte('created_at', startIso)
                        .range(from, to),
                    CHUNK,
                ) : Promise.resolve([]),

                // Süreç kaydı: temsilcinin yazdığı notlar (sistem notları hariç)
                leadIds.length ? fetchInChunks<{ lead_id: string }>(
                    leadIds,
                    (chunk, from, to) => supabase
                        .from('lead_notes')
                        .select('lead_id')
                        .in('lead_id', chunk)
                        .eq('is_system_generated', false)
                        .gte('created_at', startIso)
                        .range(from, to),
                    CHUNK,
                ) : Promise.resolve([]),

                // İnsan teması 2: şablonsuz giden WhatsApp (serbest metin)
                leadIds.length ? fetchInChunks<{ lead_id: string; created_at: string }>(
                    leadIds,
                    (chunk, from, to) => supabase
                        .from('whatsapp_messages')
                        .select('lead_id, created_at')
                        .in('lead_id', chunk)
                        .eq('direction', 'outbound')
                        .is('template_name', null)
                        .range(from, to),
                    CHUNK,
                ) : Promise.resolve([]),

                // Satış: tahsil edilmiş sipariş
                fetchInChunks<{ lead_id: string | null; sales_rep_id: string | null; status: string | null }>(
                    empIds,
                    (chunk, from, to) => supabase
                        .from('customer_reservations')
                        .select('lead_id, sales_rep_id, status')
                        .in('sales_rep_id', chunk)
                        .in('status', ['deposit_paid', 'confirmed', 'paid', 'fully_paid', 'shipped', 'delivered'])
                        .gte('created_at', startIso).lt('created_at', endIso)
                        .range(from, to),
                    CHUNK,
                ),

                fetchInChunks<{ lead_id: string | null; sales_rep_id: string | null }>(
                    empIds,
                    (chunk, from, to) => supabase
                        .from('payment_transactions')
                        .select('lead_id, sales_rep_id')
                        .in('sales_rep_id', chunk)
                        .eq('status', 'success')
                        .gte('created_at', startIso).lt('created_at', endIso)
                        .range(from, to),
                    CHUNK,
                ),
            ]);

        const aiScoreByLead = new Map<string, number | null>();
        for (const a of aiStates) aiScoreByLead.set(a.lead_id, a.score);

        // İlk insan teması zamanı (tüm sinyallerin en erkeni)
        const firstContactByLead = new Map<string, string>();
        for (const ev of [...callEvents, ...waOutbound]) {
            const cur = firstContactByLead.get(ev.lead_id);
            if (!cur || ev.created_at < cur) firstContactByLead.set(ev.lead_id, ev.created_at);
        }

        // Kapanış sebebi girilmiş mi — Arama Asistanı call_outcome.metadata.reason
        const closeReasonByLead = new Set<string>();
        for (const ev of callEvents) {
            if (ev.event_type === 'call_outcome' && ev.metadata?.reason) {
                closeReasonByLead.add(ev.lead_id);
            }
        }

        // Süreç notu yazılmış mı (CRM bütünlüğü için)
        const notedLeads = new Set<string>(leadNotes.map(n => n.lead_id));

        // Satışa dönen lead kümesi (temsilci bazında).
        //
        // KAPSAM KARARI: Bu ay KAPANAN tüm satışlar sayılır — leadin hangi ay
        // atandığına bakılmaz. Satış döngüsü uzun olduğunda temsilcinin geçen ay
        // ektiği emeği bu ay biçmesi cezalandırılmasın diye böyle seçildi.
        // (Alternatif "kohort" mantığında yalnız bu ay atanan leadlerin satışı
        // sayılırdı ve uzun döngüde oran yapay olarak düşük çıkardı.)
        const paidLeadsByEmp = new Map<string, Set<string>>();
        const paidLeadIds = new Set<string>();
        for (const row of [...paidReservations, ...paidPayments]) {
            if (!row.sales_rep_id || !row.lead_id) continue;
            const set = paidLeadsByEmp.get(row.sales_rep_id) ?? new Set<string>();
            set.add(row.lead_id);
            paidLeadsByEmp.set(row.sales_rep_id, set);
            paidLeadIds.add(row.lead_id);
        }

        // ── Geçersiz lead etiketleri (INVARIANT: kodda liste yok, veriden) ──
        //
        // Etiket kontrolü HEM bu ay atanan leadleri HEM de bu ay satışa dönen
        // (belki önceki aylardan gelen) leadleri kapsar. Yalnız ilk küme
        // taransaydı, geçen aydan gelen geçersiz bir lead paya girip dönüşüm
        // oranını şişirebilirdi.
        const invalidTagIds = config.invalid_lead_tag_ids ?? [];
        const invalidLeadIds = new Set<string>();
        const tagScope = [...new Set([...leadIds, ...paidLeadIds])];
        if (invalidTagIds.length > 0 && tagScope.length > 0) {
            const assigns = await fetchInChunks<{ lead_id: string; tag_id: string }>(
                tagScope,
                (chunk, from, to) => supabase
                    .from('lead_tag_assignments')
                    .select('lead_id, tag_id')
                    .in('lead_id', chunk)
                    .in('tag_id', invalidTagIds)
                    .range(from, to),
                CHUNK,
            );
            for (const a of assigns) invalidLeadIds.add(a.lead_id);
        }

        // ── Mesai doluluğu için: puantaj, tatil ve onaylı izinler ───────────
        const monthStartDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthEndDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;
        const todayIso = new Date().toISOString().slice(0, 10);

        // Aktivite kolonları (20260819c) uygulanmamışsa bu sorgu hata verir.
        // O hatanın TÜM KPI hesabını çökertmesine izin verilmez: yalnız aktivite
        // bileşeni N/A olur, diğer beş bileşen hesaplanmaya devam eder.
        let activityDataAvailable = true;

        const [attendanceRows, holidayRows, leaveRows] = await Promise.all([
            fetchInChunks<{
                employee_id: string; work_date: string;
                auto_active_minutes: number | null; interaction_minutes: number | null;
            }>(
                empIds,
                (chunk, from, to) => supabase
                    .from('hr_attendance_days')
                    .select('employee_id, work_date, auto_active_minutes, interaction_minutes')
                    .in('employee_id', chunk)
                    .gte('work_date', monthStartDate).lte('work_date', monthEndDate)
                    .range(from, to),
                CHUNK,
            ).catch(() => { activityDataAvailable = false; return []; }),
            supabase.from('hr_holidays')
                .select('holiday_date, country_code')
                .gte('holiday_date', monthStartDate).lte('holiday_date', monthEndDate)
                .then(r => (r.data || []) as { holiday_date: string; country_code: string }[]),
            // Ay ile KESİŞEN onaylı izinler (ay içinde başlamamış olabilir)
            fetchInChunks<{ employee_id: string; start_date: string; end_date: string }>(
                empIds,
                (chunk, from, to) => supabase
                    .from('hr_leaves')
                    .select('employee_id, start_date, end_date')
                    .in('employee_id', chunk)
                    .eq('status', 'approved')
                    .lte('start_date', monthEndDate).gte('end_date', monthStartDate)
                    .range(from, to),
                CHUNK,
            ),
        ]);

        const attendanceByEmp = new Map<string, { auto: number; interaction: number }>();
        for (const a of attendanceRows) {
            const cur = attendanceByEmp.get(a.employee_id) ?? { auto: 0, interaction: 0 };
            cur.auto += Number(a.auto_active_minutes ?? 0);
            cur.interaction += Number(a.interaction_minutes ?? 0);
            attendanceByEmp.set(a.employee_id, cur);
        }

        const holidaysByCountry = new Map<string, Set<string>>();
        for (const h of holidayRows) {
            const set = holidaysByCountry.get(h.country_code) ?? new Set<string>();
            set.add(h.holiday_date);
            holidaysByCountry.set(h.country_code, set);
        }

        const leaveDatesByEmp = new Map<string, Set<string>>();
        for (const l of leaveRows) {
            const set = leaveDatesByEmp.get(l.employee_id) ?? new Set<string>();
            // İzin aralığını ay içine kırparak gün gün aç
            for (let d = 1; d <= daysInMonth; d++) {
                const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                if (iso >= l.start_date && iso <= l.end_date) set.add(iso);
            }
            leaveDatesByEmp.set(l.employee_id, set);
        }

        // Hatırlatmaları lead bazında topla
        const remindersByLead = new Map<string, typeof reminders>();
        for (const r of reminders) {
            const arr = remindersByLead.get(r.lead_id) ?? [];
            arr.push(r);
            remindersByLead.set(r.lead_id, arr);
        }

        const toleranceMs = (config.followup_tolerance_hours ?? 0) * 3600 * 1000;
        const now = Date.now();

        // ── Her temsilci için bileşenleri hesapla ──────────────────────────
        return employees.map(emp => {
            const own = leadsByEmp.get(emp.employee_id) ?? [];
            const ownIds = own.map(l => l.id);

            // Bu ay atanan leadler — dönüşüm paydası ve SLA yalnız bunları kapsar.
            const newThisMonth = own.filter(l =>
                !!l.assigned_at && l.assigned_at >= startIso && l.assigned_at < endIso);

            // 1) CONVERSION
            //    Payda: bu ay ATANAN geçerli leadler.
            //    Pay:   bu ay KAPANAN satışlar (lead hangi ay atanmış olursa olsun),
            //           geçersiz etiketliler hariç.
            //    Bu asimetri bilinçlidir; bkz. paidLeadsByEmp yanındaki not.
            const validLeads = newThisMonth.filter(l => !invalidLeadIds.has(l.id));
            const paidSet = paidLeadsByEmp.get(emp.employee_id) ?? new Set<string>();
            const paidCount = [...paidSet].filter(id => !invalidLeadIds.has(id)).length;

            // 2) FOLLOW-UP — emeğin harcandığı aya işlenir
            let dueCount = 0;
            let onTimeCount = 0;
            let backlogCount = 0;   // önceki aylardan devreden, hâlâ açık
            for (const id of ownIds) {
                for (const r of remindersByLead.get(id) ?? []) {
                    const dueMs = new Date(r.remind_at).getTime();
                    const doneInMonth = r.is_done && !!r.done_at
                        && r.done_at >= startIso && r.done_at < endIso;

                    // (a) Bu ay TAMAMLANAN takip — vadesi ne zaman olursa olsun
                    //     bu ayın metriğidir; zamanındaysa puanı bu ay kazanır.
                    if (doneInMonth) {
                        dueCount += 1;
                        if (new Date(r.done_at!).getTime() <= dueMs + toleranceMs) onTimeCount += 1;
                        continue;
                    }

                    if (r.is_done) continue;   // başka bir ayda tamamlanmış

                    // (b) Bu ay vadesi gelip hâlâ yapılmamış → bu ayın kaçırılmışı
                    if (r.remind_at >= startIso && r.remind_at < endIso && dueMs <= now) {
                        dueCount += 1;
                        continue;
                    }

                    // (c) Önceki aya ait, hâlâ açık → puanı etkilemez, görünür olsun
                    if (r.remind_at < startIso) backlogCount += 1;
                }
            }

            // 3) PRIORITY COVERAGE — önemli lead açıkta mı
            //
            // Öncelik iki kaynağın BİRLEŞİMİDİR:
            //   • leads.status configure edilen listede (hot/warm gibi) — ekibin
            //     fiilen kullandığı, insan kararına dayanan sınıflandırma
            //   • lead_ai_states.score eşiğin üstünde — AI skorlaması çalışıyorsa
            // Böylece AI ileride devreye girerse havuz kod değişmeden genişler.
            //
            // Kapanmış leadler öncelik havuzuna girmez: kapanmış bir kaydı
            // "açıkta unutulmuş" saymak anlamsızdır.
            const priorityStatuses = config.priority_statuses ?? ['hot', 'warm'];
            const priorityLeads = own.filter(l => {
                const closed = l.status === 'won' || l.status === 'lost' || l.not_interested;
                if (closed) return false;
                const byStatus = !!l.status && priorityStatuses.includes(l.status);
                const byAi = (aiScoreByLead.get(l.id) ?? 0) >= (config.priority_ai_min ?? 80);
                return byStatus || byAi;
            });
            const staleMs = (config.priority_stale_days ?? 7) * 86400000;
            const managedCount = priorityLeads.filter(l => {
                // Sonuçlandırılmış ve sebebi var
                if (l.not_interested && l.not_interested_source) return true;
                if (l.status === 'won') return true;
                if (paidSet.has(l.id)) return true;
                // Sonuçlandırılmış ve sebebi Arama Asistanı'na girilmiş
                if (closeReasonByLead.has(l.id)) return true;
                // İlk aksiyonu yapılmış (arama/ulaşma/sonuç) veya süreç notu yazılmış
                if (firstContactByLead.has(l.id) || notedLeads.has(l.id)) return true;
                // Aktif bir sonraki aksiyon var (açık hatırlatma)
                const rem = remindersByLead.get(l.id) ?? [];
                if (rem.some(r => !r.is_done)) return true;
                // Hiçbiri yoksa: yeni atanmışsa henüz unutulmuş sayılmaz
                const assigned = l.assigned_at ? new Date(l.assigned_at).getTime() : now;
                return (now - assigned) < staleMs;
            }).length;

            // 4) FIRST CONTACT SLA — mesai saatleri dikkate alınır
            // Saat dilimi çalışanın kendi profilinden gelir; yurtdışı personelde
            // mesai penceresi kaymasın diye şart (bkz. workingMinutesBetween).
            const schedule = {
                workDays: emp.work_days ?? [1, 2, 3, 4, 5],
                shiftStart: emp.shift_start?.slice(0, 5) ?? '09:00',
                shiftEnd: emp.shift_end?.slice(0, 5) ?? '18:00',
                timeZone: emp.timezone,
            };
            let slaEligible = 0;
            let slaMet = 0;
            let slaPending = 0;     // suresi henuz dolmamis, olculemez
            const nowIso = new Date(now).toISOString();
            for (const l of validLeads) {
                const startedAt = l.assigned_at ?? l.created_at;
                if (!startedAt) continue;

                const window = slaMinutesFor(aiScoreByLead.get(l.id) ?? null, config);
                const contactedAt = firstContactByLead.get(l.id);

                if (!contactedAt) {
                    // SÜRESİ HENÜZ DOLMAMIŞ lead ihlal sayılmaz — temsilcinin
                    // hâlâ vakti var. Aksi hâlde açık ayda her yeni lead anında
                    // ihlal olarak yazılır ve skor haksız yere düşerdi.
                    const elapsed = workingMinutesBetween(startedAt, nowIso, schedule);
                    if (elapsed != null && elapsed <= window) { slaPending += 1; continue; }
                    slaEligible += 1;                          // süre doldu, temas yok → ihlal
                    continue;
                }

                slaEligible += 1;
                const mins = workingMinutesBetween(startedAt, contactedAt, schedule);
                if (mins != null && mins <= window) slaMet += 1;
            }

            // 5) CRM COMPLETENESS — işlenmiş kayıtlarda süreç doğru yazılmış mı
            //
            // "İşlenmiş" = temsilci bu lead'e dokunmuş: aramış, not yazmış,
            // hatırlatma kurmuş veya durumunu sınıflandırmış.
            //
            // Kapsam: temsilcinin ŞU AN sorumlu olduğu defter — açık leadler ve
            // bu ay atananlar. Aylar önce kapanmış leadler tekrar tekrar
            // puanlanmaz; kapanmış bir kaydı düzeltmek mümkün de değildir.
            const crmScope = own.filter(l => {
                const closed = l.status === 'won' || l.status === 'lost' || l.not_interested;
                if (!closed) return true;
                return newThisMonth.includes(l);
            });
            const processed = crmScope.filter(l =>
                firstContactByLead.has(l.id)
                || notedLeads.has(l.id)
                || (remindersByLead.get(l.id)?.length ?? 0) > 0
                || l.status !== 'new');

            const complete = processed.filter(l => {
                const closed = l.status === 'won' || l.status === 'lost' || l.not_interested;
                if (closed) {
                    // Kapanmışsa sebebi yazılmış olmalı. Sebep üç yerden gelebilir:
                    // Arama Asistanı sonucu, ilgilenmiyor kaydı veya satışın kendisi.
                    return l.status === 'won' || paidSet.has(l.id)
                        || closeReasonByLead.has(l.id) || !!l.not_interested_source;
                }
                // Açık lead: önce sınıflandırılmış olmalı (status 'new' kalmamalı),
                // sonra ya bir sonraki aksiyon tanımlı ya da son görüşme sonucu kayıtlı.
                if (l.status === 'new') return false;
                const rem = remindersByLead.get(l.id) ?? [];
                return rem.some(r => !r.is_done)
                    || firstContactByLead.has(l.id)
                    || notedLeads.has(l.id);
            }).length;

            // 6) MESAİ DOLULUĞU — "işinin başında mıydı"
            //
            // Aksiyon SAYISI ölçülmez; ölçülseydi puan için boş iş üretme teşviki
            // doğardı ve şirket ilkesiyle ("arama sayısına prim yok") çelişirdi.
            // Başarı hedef doluluğa göre hesaplanır ve %100'de kırpılır — fazla
            // mesai de ödüllendirilmez.
            const att = attendanceByEmp.get(emp.employee_id) ?? { auto: 0, interaction: 0 };
            const expectedMinutes = expectedWorkMinutes({
                year, month,
                workDays: emp.work_days ?? [1, 2, 3, 4, 5],
                shiftStart: emp.shift_start, shiftEnd: emp.shift_end,
                holidayDates: holidaysByCountry.get(emp.work_country) ?? new Set(),
                leaveDates: leaveDatesByEmp.get(emp.employee_id) ?? new Set(),
                todayIso,
            });
            const targetFill = Number(config.activity_target_fill_pct ?? 85);
            const idleMinutes = Math.max(0, att.auto - att.interaction);

            const inputs: ComponentInput[] = [
                {
                    key: 'conversion', weight: Number(config.weight_conversion),
                    numerator: paidCount, denominator: validLeads.length,
                    targetRate: Number(config.target_conversion_rate),
                    note: [
                        'Pay: bu ay kapanan tüm satışlar. Payda: bu ay atanan geçerli leadler.',
                        invalidLeadIds.size > 0
                            ? `${own.length - validLeads.length} geçersiz lead paydadan düşüldü.`
                            : null,
                    ].filter(Boolean).join(' '),
                },
                {
                    key: 'followup', weight: Number(config.weight_followup),
                    numerator: onTimeCount, denominator: dueCount,
                    note: [
                        'Bu ay tamamlanan takipler bu aya islenir (vadesi onceki aydan olsa bile).',
                        dueCount === 0 ? 'Bu ay tamamlanan veya vadesi gelen takip yok.' : null,
                        backlogCount > 0
                            ? `${backlogCount} takip onceki aylardan devrediyor ve halen acik — tamamlandiginda tamamlandigi ayin puanina yazilir.`
                            : null,
                    ].filter(Boolean).join(' '),
                },
                {
                    key: 'priority', weight: Number(config.weight_priority),
                    numerator: managedCount, denominator: priorityLeads.length,
                    // Payda BU AY DEGIL, tum portfoydur — kullanici ekranda farkli
                    // sayilar gorunce hakli olarak "bu ay 10 leadi vardi" diye soruyor.
                    note: priorityLeads.length === 0
                        ? `Oncelikli lead yok. Su durumlar oncelikli sayiliyor: ${priorityStatuses.join(', ') || '(yok)'}.`
                        : `Payda TUM PORTFOY: bugun elinde duran acik ${priorityStatuses.join('/')} leadler `
                          + '(bu ayla sinirli degil). Gecen aydan kalmis unutulmus lead de burada sayilir.',
                },
                {
                    key: 'sla', weight: Number(config.weight_sla),
                    numerator: slaMet, denominator: slaEligible,
                    note: 'Payda: yalnizca BU AY atanan leadler. '
                        + (slaPending > 0
                            ? `${slaPending} tanesinin SLA suresi henuz dolmadi, olcume alinmadi.`
                            : ''),
                },
                {
                    key: 'crm', weight: Number(config.weight_crm),
                    numerator: complete, denominator: processed.length,
                    note: 'Payda: bugun sorumlu oldugu defter — acik leadler + bu ay atananlar. '
                        + 'Aylar once kapanmis kayitlar tekrar puanlanmaz.',
                },
                {
                    key: 'activity', weight: Number(config.weight_activity ?? 0),
                    numerator: att.interaction,
                    // Veri yoksa denominator 0 → N/A. Sıfır puan VERİLMEZ:
                    // ölçüm altyapısı hazır değilken personeli cezalandırmak yanlış olur.
                    denominator: activityDataAvailable ? expectedMinutes : 0,
                    // Hedef doluluk oranı: %85 tutturmak tam puan demektir.
                    targetRate: targetFill,
                    note: !activityDataAvailable
                        ? 'Aktivite kolonlari veritabaninda yok — 20260819c migration calistirilmali.'
                        : expectedMinutes === 0
                            ? 'Bu ay beklenen mesai yok (izin/tatil veya vardiya tanimsiz).'
                            : `Panel ${att.auto} dk aciktir, ${att.interaction} dk etkilesim vardi`
                              + (idleMinutes > 0 ? ` (${idleMinutes} dk bosta).` : '.')
                              + ` Beklenen mesai ${expectedMinutes} dk (bugune kadar).`,
                },
            ];

            return {
                employeeId: emp.employee_id,
                employeeName: emp.user?.full_name || emp.user?.email || emp.employee_id.slice(0, 8),
                score: computeKpiScore(inputs),
            };
        });
    },

    /** Hesaplanan skorları kaydeder (ay kapatma opsiyonel). */
    async saveScores(
        year: number, month: number, rows: EmployeeKpiBreakdown[], lock: boolean,
    ): Promise<void> {
        const { periodMonth } = monthBounds(year, month);
        const { data: { user } } = await supabase.auth.getUser();
        const now = new Date().toISOString();

        const payload = rows.map(r => ({
            employee_id: r.employeeId,
            period_month: periodMonth,
            components: r.score.components,
            applied_weight: r.score.appliedWeight,
            total_score: r.score.totalScore,
            computed_at: now,
            locked: lock,
            locked_at: lock ? now : null,
            locked_by: lock ? user?.id ?? null : null,
        }));

        for (let i = 0; i < payload.length; i += 100) {
            const { error } = await supabase
                .from('hr_kpi_scores')
                .upsert(payload.slice(i, i + 100), { onConflict: 'employee_id,period_month' });
            if (error) throw error;
        }
    },

    async listScores(year: number, month: number) {
        const { periodMonth } = monthBounds(year, month);
        const { data, error } = await supabase
            .from('hr_kpi_scores').select('*').eq('period_month', periodMonth);
        if (error) throw error;
        return data || [];
    },

    async unlockMonth(year: number, month: number): Promise<void> {
        const { periodMonth } = monthBounds(year, month);
        const { error } = await supabase
            .from('hr_kpi_scores')
            .update({ locked: false, locked_at: null })
            .eq('period_month', periodMonth);
        if (error) throw error;
    },
};
