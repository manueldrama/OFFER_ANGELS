import { supabase } from '../../lib/supabase/client';

export interface AutomationKpiStats {
    activeScenarios: number;
    totalScenarios: number;
    todaySent: number;
    todayFailed: number;
    pendingTasks: number;
}

export interface FollowUpTaskRow {
    id: string;
    lead_id: string;
    rule_type: string;
    status: string;
    scheduled_at: string | null;
    completed_at?: string | null;
    payload: any;
    result?: any;
    created_at: string;
    leads?: {
        customer_name: string | null;
        phone_number: string | null;
        country_code: string | null;
    } | null;
}

// Activity log için birleşik satır — hem follow_up_tasks hem whatsapp_messages'tan
// gelen kayıtları aynı şekle dökmüş halde gösterir.
export interface ActivityRow {
    id: string;
    raw_id: string;                   // tablo içindeki gerçek id (retry/cancel için)
    source: 'follow_up_task' | 'whatsapp_message';
    scenario: string;                 // okunabilir senaryo etiketi (örn. 'Süre Bazlı Hatırlatma')
    rule_type: string;                // ham anahtar (UI eski kod için)
    status: string;
    template_name: string | null;
    created_at: string;
    scheduled_at: string | null;      // follow_up_task ise scheduled_at, wa ise created_at
    error_message: string | null;     // hata varsa metin
    offer_link_token: string | null;
    leads: {
        customer_name: string | null;
        phone_number: string | null;
        country_code: string | null;
    } | null;
}

const startOfTodayIso = (): string => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
};

export const AdminAutomationStatsService = {
    async getKpis(): Promise<AutomationKpiStats> {
        const startIso = startOfTodayIso();

        // Bugün Gönderilen/Hata — whatsapp_messages tek doğruluk noktası.
        // notify-offer-created, expiry cron, follow_up cron hepsi outbound olarak
        // bu tabloya yazıyor. Eski follow_up_tasks sayımı süre bazlı hatırlatmaları
        // kaçırıyordu; tüm otomasyon trafiğini buradan ölç.
        const [settingsRes, rulesRes, sentRes, failedRes, pendingRes] = await Promise.all([
            supabase.from('automation_settings').select('*').limit(1).maybeSingle(),
            supabase.from('automation_rules').select('id, is_enabled'),
            supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outbound').eq('status', 'sent').gte('created_at', startIso),
            supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outbound').eq('status', 'failed').gte('created_at', startIso),
            supabase.from('follow_up_tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);

        // Active scenarios — 5 builtin + süre bazlı + custom rules
        let activeBuiltin = 0;
        const totalBuiltin = 6;  // offer_created + 4 delayed + expiry_reminders
        const s = settingsRes.data;
        if (s) {
            if (s.rule_offer_created_whatsapp_enabled) activeBuiltin++;
            if (s.rule_no_open_enabled) activeBuiltin++;
            if (s.rule_no_offer_enabled) activeBuiltin++;
            if (s.rule_no_payment_enabled) activeBuiltin++;
            if (s.rule_payment_abandoned_enabled) activeBuiltin++;
            // Süre bazlı hatırlatma: hem toggle açık hem de en az 1 enabled pencere varsa aktif sayılır.
            const expiryReminders = Array.isArray(s.expiry_reminders) ? s.expiry_reminders : [];
            const hasEnabledWindow = expiryReminders.some((r: any) => r?.enabled && r?.template_name);
            if (s.expiry_reminders_enabled && hasEnabledWindow) activeBuiltin++;
        }

        const customRules = rulesRes.data || [];
        const activeCustom = customRules.filter(r => r.is_enabled).length;
        const totalCustom = customRules.length;

        return {
            activeScenarios: activeBuiltin + activeCustom,
            totalScenarios: totalBuiltin + totalCustom,
            todaySent: sentRes.count || 0,
            todayFailed: failedRes.count || 0,
            pendingTasks: pendingRes.count || 0,
        };
    },

    async getRecentActivity(limit: number = 30): Promise<FollowUpTaskRow[]> {
        const { data, error } = await supabase
            .from('follow_up_tasks')
            .select('id, lead_id, rule_type, status, scheduled_at, payload, result, created_at, leads:lead_id(customer_name, phone_number, country_code)')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('[AdminAutomationStatsService] getRecentActivity', error);
            return [];
        }
        return (data as any) || [];
    },

    // Birleşik aktivite akışı — follow_up_tasks (kuyruğa giren senaryolar) +
    // whatsapp_messages (gerçek gönderimler — süre bazlı cron, notify-offer-created,
    // manuel "Şablon Gönder" hepsi buraya yazıyor). Her iki kaynaktan en yeni N
    // kayıt çekilip tarihe göre birleştirilir.
    async getUnifiedActivity(limit: number = 50, statusFilter: string = 'all'): Promise<{ rows: ActivityRow[]; total: number }> {
        // Her iki kaynaktan da limit*2 çek (paging için fazla buffer), birleştir, sırala, kırp.
        const fetchLimit = Math.max(limit * 2, 100);
        let fuQ = supabase
            .from('follow_up_tasks')
            .select('id, lead_id, rule_type, status, payload, result, scheduled_at, created_at, offer_link_id, leads:lead_id(customer_name, phone_number, country_code)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .limit(fetchLimit);
        let waQ = supabase
            .from('whatsapp_messages')
            .select('id, lead_id, template_name, status, direction, created_at, phone_number, error_message, leads:lead_id(customer_name, phone_number, country_code)', { count: 'exact' })
            .eq('direction', 'outbound')
            .not('template_name', 'is', null)
            .order('created_at', { ascending: false })
            .limit(fetchLimit);

        if (statusFilter !== 'all') {
            fuQ = fuQ.eq('status', statusFilter);
            waQ = waQ.eq('status', statusFilter);
        }

        const [fuRes, waRes] = await Promise.all([fuQ, waQ]);

        const fuRows: ActivityRow[] = ((fuRes.data || []) as any[]).map(r => ({
            id: `fu:${r.id}`,
            raw_id: r.id,
            source: 'follow_up_task',
            scenario: RULE_LABELS[r.rule_type] || (r.rule_type?.startsWith('custom:') ? 'Özel Kural' : (r.rule_type || '—')),
            rule_type: r.rule_type || '',
            status: r.status,
            template_name: r.payload?.template_name || null,
            created_at: r.created_at,
            scheduled_at: r.scheduled_at || null,
            error_message: r.result?.error || null,
            offer_link_token: r.offer_link_id || null,
            leads: r.leads || null,
        }));

        const waRows: ActivityRow[] = ((waRes.data || []) as any[]).map(r => ({
            id: `wa:${r.id}`,
            raw_id: r.id,
            source: 'whatsapp_message',
            scenario: scenarioFromTemplate(r.template_name),
            rule_type: '',
            status: r.status,
            template_name: r.template_name || null,
            created_at: r.created_at,
            scheduled_at: r.created_at,
            error_message: r.error_message || null,
            offer_link_token: null,
            leads: r.leads || (r.phone_number ? { customer_name: null, phone_number: r.phone_number, country_code: null } : null),
        }));

        const merged = [...fuRows, ...waRows]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return {
            rows: merged.slice(0, limit),
            total: (fuRes.count || fuRows.length) + (waRes.count || waRows.length),
        };
    },
};

const RULE_LABELS: Record<string, string> = {
    no_open: 'Açılmadı',
    no_offer: 'Ürün seçmedi',
    no_payment: 'Ödeme başlatmadı',
    payment_abandoned: 'Ödeme yarım',
    offer_created: 'Yeni Teklif',
};

// Template adından okunabilir senaryo etiketi türet. Süre bazlı isim formatları
// (3hours, offer_reminder_1hour) ve teklif şablonları için heuristic.
function scenarioFromTemplate(templateName: string | null): string {
    if (!templateName) return 'WhatsApp Gönderim';
    const lower = templateName.toLowerCase();
    if (/^\d+hour/.test(lower) || lower.startsWith('offer_reminder_') || lower === 'offer_last') {
        return 'Süre Bazlı Hatırlatma';
    }
    if (lower === 'teklif_hazir' || lower.startsWith('offer_link') || lower === 'offer_link_utility') {
        return 'Yeni Teklif Bildirimi';
    }
    if (lower.startsWith('deposit_')) return 'Kapora Süreci';
    if (lower.startsWith('warranty_')) return 'Garanti Hatırlatması';
    if (lower.startsWith('subscription_')) return 'Abonelik';
    return 'WhatsApp Gönderim';
}
