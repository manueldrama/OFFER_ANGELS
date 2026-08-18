// WhatsApp Remarketing Kampanya — client-side veri + aksiyon servisi.
//
// Otomasyon DEĞİL: admin segmenti seçer, ÖNİZLER, iki adımlı onayla toplu
// gönderir. Segment tabanını sıfırdan kurmaz — AdminWinBackService.listCandidates()
// (ölü/sessiz/teklif sinyallerini zaten toplayan motor) çıktısını taban alıp 3
// remarketing segmentine sınıflar ve opt-out + ödeme durumunu çapraz kontrol eder.
//
// Gönderim ve kampanya kaydı backend'de (functions/api/remarketing/*) yapılır;
// burası yalnız önizleme okuması + endpoint tetikleyicileridir.

import { supabase } from '../../lib/supabase/client';
import { AdminWinBackService, type WinBackCandidate } from './winbackService';

export type RemarketingSegment =
    | 'offer_unpaid' | 'dead_silent' | 'payment_abandoned' | 'model_unselected'
    | 'offer_live_unpaid' | 'fresh_expired';
export type RemarketingContentType = 'same_extend' | 'winback_discount' | 'urgency' | 'reissue_campaign' | 'reprice_same_model';

export interface RemarketingSegmentConfig {
    /** Dahil edilecek segmentlerin alt kümesi (en az 1). */
    segments: RemarketingSegment[];
    /** Geri dönme şansı skoru bu değerin altındakileri ele. */
    minScore?: number;
    /** Lead yaşı (gün) bu değerin altındakileri ele. */
    minAgeDays?: number;
    /** Lead yaşı (gün) bu değerin ÜSTÜNDEKİLERİ ele — "son X günde gelen leadler" filtresi (0/boş = sınırsız). */
    maxAgeDays?: number;
    /** true → teklifi hâlâ CANLI ama satın almamış leadleri de ADAY TABANINA ekle.
     *  Yalnız tabanı genişletir; canlıları listede görmek için ilgili segment
     *  (offer_live_unpaid / model_unselected) yine de seçili olmalı. */
    includeLive?: boolean;
    /** fresh_expired penceresi: teklifi dolalı en fazla bu kadar gün olmuş (varsayılan 7). */
    freshExpiredDays?: number;
    /** true → yalnız teklif linkini en az 1 kez AÇMIŞ leadler (opens > 0). */
    onlyOpened?: boolean;
}

export interface RemarketingContentConfig {
    contentType: RemarketingContentType;
    /** same_extend / urgency için süre. */
    extendDays?: number;
    urgencyHours?: number;
    /** winback_discount için indirim oranı (%). */
    discountRate?: number;
}

export interface RemarketingRecipient extends WinBackCandidate {
    /** Bu adayın eşleştiği segmentler (config'den bağımsız ham sınıf). */
    matchedSegments: RemarketingSegment[];
    /** Birincil segment etiketi (en sıcak → en soğuk). */
    primarySegment: RemarketingSegment;
    /** Remarketing opt-out (Hayır demiş) — true ise her zaman elenir. */
    optOut: boolean;
    /** Telefonu var + opt-out değil → gönderilebilir. */
    eligible: boolean;
}

/** create.ts eleme sebep kırılımı — "neden 0 alıcı" gösterimi için. */
export interface RemarketingCreateStats {
    added: number;
    skipped: number;
    overLimit: number;
    notFound: number;
    /** payment_transactions'ta başarılı ödemesi olan lead (create son savunması). */
    paid?: number;
    wonLost: number;
    optOut: number;
    noPhone: number;
    recent: number;
    /** Son 24 saatte HERHANGİ bir sistemden giden mesaj almış (frekans şapkası). */
    recentAny?: number;
    /** blocked_contacts listesindeki numara. */
    blocked?: number;
    noOffer: number;
    /** reprice_same_model: hedef kampanyada güncel fiyatı çözülemedi. */
    noPrice?: number;
}

export interface RemarketingPreview {
    recipients: RemarketingRecipient[];
    total: number;
    eligible: number;
    optedOut: number;
    noPhone: number;
    bySegment: Record<RemarketingSegment, number>;
    /** Hiçbir segmente girmediği için listeye alınmayan aday sayısı (tanı için). */
    unmatched: number;
}

/** En sıcak/anlamlı segment önce: ödeme yarıda > model seçmemiş > teklifi canlı > taze dolmuş > teklif ödememiş > ölü/sessiz. */
const SEGMENT_PRIORITY: RemarketingSegment[] = ['payment_abandoned', 'model_unselected', 'offer_live_unpaid', 'fresh_expired', 'offer_unpaid', 'dead_silent'];

async function authHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
    };
}

export const AdminRemarketingService = {
    /**
     * Segment önizlemesi — HİÇBİR gönderim yapmaz.
     * listCandidates() (won/lost zaten hariç) tabanını alır, payment_transactions
     * 'success' ve leads.remarketing_opt_out ile çapraz kontrol eder, istenen
     * segmentlere ve skor/yaş eşiklerine göre filtreler.
     */
    async previewSegment(config: RemarketingSegmentConfig): Promise<RemarketingPreview> {
        // offer_live_unpaid seçiliyse canlı teklifli adayların tabana girmesi ŞART —
        // HERKES kutusuna gerek kalmadan includeLive otomatik açılır.
        const needLive = config.includeLive || config.segments.includes('offer_live_unpaid');
        const candidates = await AdminWinBackService.listCandidates({ includeLive: needLive });
        const leadIds = candidates.map((c) => c.leadId);

        // Çapraz kontrol sorguları (boş leadId'de sorma).
        const [paidSet, optOutSet] = leadIds.length
            ? await Promise.all([fetchPaidLeadIds(leadIds), fetchOptedOutLeadIds(leadIds)])
            : [new Set<string>(), new Set<string>()];

        // Yalnız SEÇİLEN segmentler listelenir — "HERKES" modu tabanı genişletir ama
        // seçilmemiş segmenti gizlice eklemez (eski wanted.add('offer_unpaid') footgun'ı kaldırıldı).
        const wanted = new Set(config.segments);
        const minScore = config.minScore ?? 0;
        const minAgeDays = config.minAgeDays ?? 0;
        const maxAgeDays = config.maxAgeDays ?? 0; // 0 = sınırsız
        const onlyOpened = config.onlyOpened === true;
        const freshDays = Math.max(1, Number(config.freshExpiredDays) || 7);

        const recipients: RemarketingRecipient[] = [];
        const bySegment: Record<RemarketingSegment, number> = {
            offer_unpaid: 0, dead_silent: 0, payment_abandoned: 0, model_unselected: 0,
            offer_live_unpaid: 0, fresh_expired: 0,
        };

        const now = Date.now();
        let unmatched = 0;
        for (const c of candidates) {
            const isPaid = paidSet.has(c.leadId) || c.paymentCompleted;
            if (isPaid) continue; // satın almış — remarketing dışı.

            // Final teklif (generated_offer) yok → lead model seçme aşamasında takılmış.
            const hasFinalOffer = !!c.offerNumber || (Array.isArray(c.offerItems) && c.offerItems.length > 0);
            // Canlılık: offerValidUntil artık EFEKTİF bitiş (winbackService deriveOffer'dan).
            const expiryMs = c.offerValidUntil ? Date.parse(c.offerValidUntil) : NaN;
            const isLive = c.offerIsActive && Number.isFinite(expiryMs) && expiryMs > now;
            const expiredDaysMs = !isLive && Number.isFinite(expiryMs) ? now - expiryMs : null;
            const isFreshExpired = expiredDaysMs !== null && expiredDaysMs > 0 && expiredDaysMs <= freshDays * 86400_000;

            // AYRIK segment tanımları — bir lead birden çok segmente girebilir ama
            // kapsama kuralları net: model_unselected ∩ offer_unpaid = ∅,
            // fresh_expired ∩ dead_silent = ∅.
            const matched: RemarketingSegment[] = [];
            // "Teklif almış" = FİNAL teklifi gerçekten var (model seçmemişler sızmaz).
            if (c.offerToken && hasFinalOffer) matched.push('offer_unpaid');
            if (c.offerToken && !hasFinalOffer) matched.push('model_unselected');
            // Canlı + final teklif — "kampanya bitiyor" hatırlatması kitlesi.
            if (isLive && hasFinalOffer) matched.push('offer_live_unpaid');
            // Taze dolmuş: final teklifi dolalı ≤ freshDays. Dikkat: kampanya bitince tüm
            // teklifler AYNI GÜN dolar — pencere o günü kapsıyorsa tüm kampanya tabanı girer.
            if (isFreshExpired && hasFinalOffer) matched.push('fresh_expired');
            // Ölü/sessiz: dolmuş ama taze DEĞİL (fresh ile ayrık) — iptal edilmişler dahil.
            if (!isLive && !isFreshExpired) matched.push('dead_silent');
            if (c.paymentStarted) matched.push('payment_abandoned');

            // Hiçbir segmente girmeyen aday listeye alınmaz (eski körlemesine
            // offer_unpaid fallback'i kaldırıldı) — sayaç tanı için tutulur.
            if (!matched.length) { unmatched++; continue; }

            // İstenen segmentlerden en az biriyle kesişmeli.
            if (![...matched].some((s) => wanted.has(s))) continue;
            if (c.score < minScore) continue;
            if (c.ageDays < minAgeDays) continue;
            if (maxAgeDays > 0 && c.ageDays > maxAgeDays) continue; // yalnız son X günde gelen leadler
            if (onlyOpened && !(c.opens > 0)) continue; // yalnız linki açmış olanlar

            const primarySegment = SEGMENT_PRIORITY.find((s) => matched.includes(s)) || 'dead_silent';
            const optOut = optOutSet.has(c.leadId);
            const hasPhone = !!(c.phone && c.phone.trim());
            const eligible = hasPhone && !optOut;

            for (const s of matched) if (wanted.has(s)) bySegment[s]++;

            recipients.push({
                ...c,
                matchedSegments: matched,
                primarySegment,
                optOut,
                eligible,
            });
        }

        return {
            recipients,
            total: recipients.length,
            eligible: recipients.filter((r) => r.eligible).length,
            optedOut: recipients.filter((r) => r.optOut).length,
            noPhone: recipients.filter((r) => !(r.phone && r.phone.trim())).length,
            bySegment,
            unmatched,
        };
    },

    /**
     * Kampanyayı backend'de oluşturur (draft) + alıcı kuyruğunu hazırlar.
     * Gönderim YAPMAZ. leadIds: admin'in önizlemeden seçtiği uygun alıcılar.
     */
    async createCampaign(payload: {
        name: string;
        segments: RemarketingSegment[];
        segmentParams: { minScore?: number; minAgeDays?: number; freshExpiredDays?: number };
        content: RemarketingContentConfig;
        templateName: string;
        templateLanguage?: string;
        templateParamsMap?: Record<string, string>;
        sendLimit: number;
        dryRun: boolean;
        /** ISO tarih — verilirse kampanya bu ana zamanlanır (hemen gönderilmez). */
        scheduledAt?: string;
        /** Hedef fiyat kampanyası (campaigns.id) — reissue_campaign / winback_discount için. */
        targetCampaignId?: string;
        leadIds: string[];
    }): Promise<{ campaignId: string; totalRecipients: number; scheduled: boolean; scheduledAt: string | null; stats: RemarketingCreateStats | null }> {
        const res = await fetch('/api/remarketing/create', {
            method: 'POST',
            headers: await authHeader(),
            body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `create failed (${res.status})`);
        return {
            campaignId: body.campaignId,
            totalRecipients: body.totalRecipients ?? 0,
            scheduled: !!body.scheduled,
            scheduledAt: body.scheduledAt ?? null,
            stats: body.stats ?? null,
        };
    },

    /**
     * Kampanyanın bekleyen alıcılarına bir tick gönderir (≤100). dry_run ise Meta'ya
     * dokunmaz. Büyük kitlelerde pending kalırsa tekrar çağrılır (idempotent).
     */
    async sendCampaign(campaignId: string): Promise<{
        stats: { sent: number; failed: number; skipped: number; errors: number };
        remaining: number;
        status: string;
    }> {
        const res = await fetch('/api/remarketing/send', {
            method: 'POST',
            headers: await authHeader(),
            body: JSON.stringify({ campaignId }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `send failed (${res.status})`);
        return body;
    },

    /** Sonuç paneli: kampanya geçmişi (tüm statüler) + "İlgileniyorum" sıcak kuyruğu. */
    async listResults(): Promise<{ campaigns: RemarketingHistoryCampaign[]; interested: RemarketingInterestedLead[] }> {
        const res = await fetch('/api/remarketing/results', { headers: await authHeader() });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `results failed (${res.status})`);
        return { campaigns: body.campaigns ?? [], interested: body.interested ?? [] };
    },

    /** Tek kampanyanın hunisi: gönderilen → iletilen → okunan → linki açan → ödeyen. */
    async getCampaignFunnel(campaignId: string): Promise<RemarketingFunnel> {
        const res = await fetch(`/api/remarketing/results?campaignId=${encodeURIComponent(campaignId)}`, { headers: await authHeader() });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `funnel failed (${res.status})`);
        return body.funnel as RemarketingFunnel;
    },

    /** Zamanlanmış + devam eden kampanyaları listeler (iptal paneli için). */
    async listScheduledCampaigns(): Promise<ScheduledCampaign[]> {
        const res = await fetch('/api/remarketing/scheduled', { headers: await authHeader() });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `list failed (${res.status})`);
        return (body.campaigns ?? []) as ScheduledCampaign[];
    },

    /** Zamanlanmış/devam eden bir kampanyayı iptal eder (status='cancelled'). */
    async cancelCampaign(campaignId: string): Promise<void> {
        const res = await fetch('/api/remarketing/scheduled', {
            method: 'POST',
            headers: await authHeader(),
            body: JSON.stringify({ campaignId }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.message || body?.error || `cancel failed (${res.status})`);
    },
};

export interface ScheduledCampaign {
    id: string;
    name: string;
    status: string;
    scheduled_at: string | null;
    total_recipients: number | null;
    sent_count: number | null;
    failed_count: number | null;
    created_at: string | null;
}

export interface RemarketingHistoryCampaign extends ScheduledCampaign {
    content_type: string | null;
    template_name: string | null;
    dry_run: boolean | null;
    sent_started_at: string | null;
    sent_finished_at: string | null;
}

export interface RemarketingInterestedLead {
    leadId: string;
    customerName: string | null;
    companyName: string | null;
    phone: string | null;
    leadStatus: string | null;
    clickedAt: string | null;
}

export interface RemarketingFunnel {
    totals: {
        queued: number; sent: number; failed: number; skipped: number;
        delivered: number; read: number; opened: number; paid: number;
    };
    topErrors: Array<{ message: string; count: number }>;
    bySegment: Record<string, number>;
}

// ── Remarketing Otomasyonu — kural CRUD + global anahtar ─────────────────────
// Kurallar remarketing_automation_rules tablosunda; değerlendirme 15dk cron'da
// (functions/api/remarketing/automation.ts). Bir lead bir kuraldan varsayılan
// hayatta 1 kez mesaj alır (remarketing_automation_log UNIQUE).

export interface RemarketingAutomationRule {
    id: string;
    name: string;
    is_active: boolean;
    segment: 'fresh_expired' | 'offer_live_unpaid';
    window_days: number;
    content_type: 'same_extend' | 'urgency' | 'reprice_same_model';
    extend_days: number | null;
    urgency_hours: number | null;
    target_campaign_id: string | null;
    template_name: string;
    template_language: string;
    template_params_map: Record<string, string>;
    daily_cap: number;
    repeat_after_days: number | null;
    dry_run: boolean;
    last_run_at: string | null;
    created_at: string | null;
}

export type RemarketingAutomationRuleInput = Omit<RemarketingAutomationRule, 'id' | 'last_run_at' | 'created_at'>;

export const AdminRemarketingAutomationService = {
    async listRules(): Promise<RemarketingAutomationRule[]> {
        const { data, error } = await supabase
            .from('remarketing_automation_rules')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []) as RemarketingAutomationRule[];
    },

    async createRule(input: RemarketingAutomationRuleInput): Promise<void> {
        const { error } = await supabase.from('remarketing_automation_rules').insert([input]);
        if (error) throw error;
    },

    async updateRule(id: string, patch: Partial<RemarketingAutomationRuleInput>): Promise<void> {
        const { error } = await supabase
            .from('remarketing_automation_rules')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    async deleteRule(id: string): Promise<void> {
        const { error } = await supabase.from('remarketing_automation_rules').delete().eq('id', id);
        if (error) throw error;
    },

    /** Global anahtar — false ise hiçbir kural çalışmaz (acil durdurma). */
    async getGlobalEnabled(): Promise<boolean> {
        const { data } = await supabase
            .from('automation_settings')
            .select('id, remarketing_automation_enabled')
            .limit(1);
        const row = (data || [])[0] as { remarketing_automation_enabled?: boolean } | undefined;
        return row?.remarketing_automation_enabled !== false;
    },

    async setGlobalEnabled(enabled: boolean): Promise<void> {
        const { data } = await supabase.from('automation_settings').select('id').limit(1);
        const id = (data || [])[0]?.id as string | undefined;
        if (!id) throw new Error('automation_settings satırı bulunamadı');
        const { error } = await supabase
            .from('automation_settings')
            .update({ remarketing_automation_enabled: enabled })
            .eq('id', id);
        if (error) throw error;
    },
};

/** payment_transactions'ta status='success' kaydı olan lead'ler (kesin satın alanlar). */
// .in() sorguları 150'lik parçalara bölünür — 700+ UUID tek sorguda URL limitini
// aşıp SESSİZCE boş dönüyor, bu da satın almış/opt-out leadlerin ELENMEMESİNE yol
// açıyordu (güvenlik kritiği). winbackService'teki chunk düzeltmesiyle aynı desen.
const IN_CHUNK = 150;
function chunkIds(ids: string[]): string[][] {
    const out: string[][] = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(ids.slice(i, i + IN_CHUNK));
    return out;
}

async function fetchPaidLeadIds(leadIds: string[]): Promise<Set<string>> {
    const set = new Set<string>();
    const chunks = await Promise.all(chunkIds(leadIds).map(async (chunk) => {
        const { data, error } = await supabase
            .from('payment_transactions')
            .select('lead_id')
            .in('lead_id', chunk)
            .eq('status', 'success');
        if (error) console.error('[remarketing] paid chunk failed:', error.message);
        return (data as Array<{ lead_id: string | null }> | null) || [];
    }));
    for (const row of chunks.flat()) if (row.lead_id) set.add(row.lead_id);
    return set;
}

/** remarketing_opt_out = true olan lead'ler (Hayır demiş — her zaman elenir). */
async function fetchOptedOutLeadIds(leadIds: string[]): Promise<Set<string>> {
    const set = new Set<string>();
    const chunks = await Promise.all(chunkIds(leadIds).map(async (chunk) => {
        const { data, error } = await supabase
            .from('leads')
            .select('id')
            .in('id', chunk)
            .eq('remarketing_opt_out', true);
        if (error) console.error('[remarketing] opt-out chunk failed:', error.message);
        return (data as Array<{ id: string }> | null) || [];
    }));
    for (const row of chunks.flat()) set.add(row.id);
    return set;
}
