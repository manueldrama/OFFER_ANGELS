import { supabase } from '../../lib/supabase/client';
import { computeOfferExpiry } from './campaignsService';

export interface OfferLink {
    token: string;
    lead_id: string;
    campaign_id: string;
    is_active: boolean;
    view_count: number;
    last_opened_at: string | null;
    valid_until: string | null;
    created_at: string;
    updated_at: string;
    offer_snapshot?: any;
    /** Market this specific offer link targets. Null → inherit from campaign, then language. */
    market_code?: string | null;
    /** ISO-3166 alpha-2 country code (e.g. 'IT', 'PL'). More specific than market_code. */
    country_code?: string | null;
    /** Language pinned at lead capture (e.g. 'tr', 'de'). */
    language_code?: string | null;
    leads?: {
        customer_name: string;
        phone_number: string;
        /** Firma adı — kapalı satırda müşteri kimliği için. */
        company_name?: string | null;
        /** İş türü / sektör — kapalı satırda firma adının yanında. */
        business_type?: string | null;
        /** Ekibin elle koyduğu sınıflandırma (manuel sıcaklık). */
        status?: string | null;
        /** Durumu AI mı (auto) yoksa ekip mi (manual) belirledi. */
        status_source?: 'auto' | 'manual' | null;
        /** AI skorlama sonucu — leads.ai_state JSONB ({ score, reasoning, ... }). */
        ai_state?: { score: number | null; reasoning: string | null } | null;
        /** Elle sıralama/sabitleme. NULL → sabit değil; dolu → grubun en üstünde artan sırayla. */
        manual_rank?: number | null;
    };
    /** Müşteri sayacının dayandığı kampanya alanı — link satırında "kalan süre"
     * hesabı buna göre `computeEffectiveOfferExpiry` ile yapılır. */
    campaigns?: {
        max_offer_validity_days?: number | null;
    } | null;
}

/** AI sıcaklık sıralamasında tek bir lead — "AI sıcaklık sıralaması" paneli için. */
export interface OfferLinkHotLead {
    leadId: string;
    customer: string;
    /** AI skoru 0–100, yoksa null. */
    score: number | null;
    /** AI'nin tek cümlelik satış önerisi. */
    scoreReason: string | null;
}

/** Haftalık açılma grafiğindeki tek bir gün. */
export interface OfferLinkWeeklyPoint {
    /** Kısa gün adı, örn. 'Pzt'. */
    day: string;
    opens: number;
}

/**
 * Tüm teklif linklerinin global özeti — sayfalamadan bağımsız.
 * KPI kartları, performans grafiği ve sıcak müşteriler bu özeti kullanır.
 */
export interface OfferLinkGlobalStats {
    totalLinks: number;
    activeLinks: number;
    expiredLinks: number;
    /** Aktif ve geçerliliği 3 gün içinde dolacak link sayısı. */
    expiringSoon: number;
    totalOpens: number;
    /** Ödeme başlatan/tamamlayan benzersiz link sayısı. */
    paymentSignals: number;
    /** Son 7 günün açılma dağılımı (en eski → bugün). */
    weeklySeries: OfferLinkWeeklyPoint[];
    /** Son hafta vs önceki hafta açılma trendi. */
    weekTrend: { value: string; up: boolean };
    /** AI skoruna göre en yüksek lead'ler. */
    hotLeads: OfferLinkHotLead[];
    /** Lead manuel durumuna göre teklif linki sayıları (üst filtre kartları). */
    statusCounts: Record<string, number>;
    /** AI skoruna göre teklif linki sayıları, aynı segment anahtarlarıyla (alt strip). */
    aiStatusCounts: Record<string, number>;
}

/** Sıcaklık filtre kartlarındaki lead durumları (Müşteri Yönetimi ile aynı). */
export const OFFER_SEGMENT_KEYS = ['hot', 'warm', 'follow_up', 'offer_sent', 'new', 'contacted'] as const;

const TR_DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DAY_MS = 24 * 60 * 60 * 1000;

export type OfferLinkSort = 'newest' | 'expiring' | 'recent_activity' | 'ai_score';

/** Son 7 günü (en eski → bugün) sıfır açılma ile doldurur. */
function buildEmptyWeek(): OfferLinkWeeklyPoint[] {
    const week: OfferLinkWeeklyPoint[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        week.push({ day: TR_DAY_NAMES[d.getDay()], opens: 0 });
    }
    return week;
}

export const AdminOfferLinksService = {
    // 1) List Offers with filtering
    async listOffers({
        search = '',
        status = 'all',
        leadStatus,
        sort = 'newest',
        page = 1,
        limit = 20,
        leadIds,
    }: {
        search?: string;
        status?: string;
        /** Lead'in manuel durumu (sıcaklık) — verilirse leads tablosuna inner join + filtre. */
        leadStatus?: string;
        sort?: OfferLinkSort;
        page?: number;
        limit?: number;
        leadIds?: string[];
    }) {
        if (leadIds && leadIds.length === 0) {
            return { offers: [], count: 0 };
        }

        // leadStatus filtresi varken inner join şart; aksi halde normal embed
        // (orphan offer_link satırlarını gizlememek için).
        const leadEmbed = leadStatus
            ? 'leads!inner ( customer_name, phone_number, company_name, business_type, status, status_source, ai_state, manual_rank )'
            : 'leads ( customer_name, phone_number, company_name, business_type, status, status_source, ai_state, manual_rank )';

        let query = supabase
            .from('offer_links')
            .select(
                `*, ${leadEmbed}, campaigns ( max_offer_validity_days ), offer_analytics ( action_type, created_at )`,
                { count: 'exact' },
            );

        // Arşivlenmiş 'superseded' linkleri gizle (null status = eski linkler gösterilir).
        query = query.or('status.is.null,status.neq.superseded');

        if (leadIds) {
            query = query.in('lead_id', leadIds);
        }

        if (leadStatus) {
            query = query.eq('leads.status', leadStatus);
        }

        if (status && status !== 'all') {
            if (status === 'active') {
                query = query.eq('is_active', true);
            } else if (status === 'expired') {
                query = query.eq('is_active', false);
            } else if (status === 'expiring_soon') {
                // Aktif + geçerliliği 3 gün içinde dolacak.
                const nowIso = new Date().toISOString();
                const soonIso = new Date(Date.now() + 3 * DAY_MS).toISOString();
                query = query.eq('is_active', true).gte('valid_until', nowIso).lte('valid_until', soonIso);
            } else if (status === 'completed') {
                // Ödeme tamamlanmış token'ları analitiklerden çöz, sonra linkleri filtrele.
                const { data: paidRows } = await supabase
                    .from('offer_analytics')
                    .select('offer_token')
                    .eq('action_type', 'payment_completed');
                const paidTokens = [...new Set((paidRows || []).map((r: any) => r.offer_token).filter(Boolean))];
                if (paidTokens.length === 0) {
                    return { offers: [], count: 0 };
                }
                query = query.in('token', paidTokens);
            }
        }

        if (search) {
            // Supabase text search across joined tables is tricky, we filter post-fetch for deeply nested
            // For now, search matches exact tokens
            query = query.ilike('token', `%${search}%`);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Sıralama. ai_score dışındakiler offer_links kolonlarına denk gelir;
        // ai_score gömülü leads.ai_state JSONB alanına göre sıralar.
        if (sort === 'expiring') {
            query = query.order('valid_until', { ascending: true, nullsFirst: false });
        } else if (sort === 'recent_activity') {
            query = query.order('last_opened_at', { ascending: false, nullsFirst: false });
        } else if (sort === 'ai_score') {
            // offer_links'i gömülü leads.ai_state.score'a göre sıralar.
            query = query.order('leads(ai_state->score)', { ascending: false, nullsFirst: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data, count, error } = await query.range(from, to);

        if (error) {
            console.error('[AdminOfferLinksService] Error:', error);
            throw error;
        }

        return { offers: data as unknown as OfferLink[], count: count || 0 };
    },

    // 1a) Tüm teklif linkleri — komuta merkezi (Teklif Linkleri sayfası) + Geri Kazanım
    // + Remarketing client-side gruplama/öncelik/aylık görünüm için TÜM satırları çeker.
    //
    // ÖNEMLİ: PostgREST tek istekte en fazla ~1000 satır döndürür. Proje 1000 teklifi
    // geçtiğinde tek sorgu eski teklifleri SESSİZCE eler (ölü leadler kaybolurdu).
    // Bu yüzden 1000'lik sayfalarla döngüyle hepsini toplarız. 1000'den az teklif
    // varsa tek tur döner — davranış eskisiyle birebir aynı, sıfır risk.
    // listOffers ile birebir aynı embed; sales scope korunur.
    async listAllOffers({ leadIds }: { leadIds?: string[] } = {}): Promise<OfferLink[]> {
        if (leadIds && leadIds.length === 0) return [];

        const PAGE = 1000;
        const MAX_PAGES = 20; // 20k teklif güvenlik tavanı (sonsuz döngü önlemi)
        const all: OfferLink[] = [];

        for (let page = 0; page < MAX_PAGES; page++) {
            let query = supabase
                .from('offer_links')
                .select(
                    '*, leads ( customer_name, phone_number, company_name, business_type, status, status_source, ai_state, manual_rank ), ' +
                    'campaigns ( max_offer_validity_days ), offer_analytics ( action_type, created_at )',
                )
                // Yenileme (refreshOffer) tek-link modelinde artık eski link doğmuyor;
                // geçmişte arşivlenmiş 'superseded' linkleri listede gizle. (null status
                // = eski normal linkler → gösterilmeye devam.)
                .or('status.is.null,status.neq.superseded')
                // İkincil sıralama (token) ŞART: toplu kampanyada yüzlerce link aynı
                // created_at ile doğar; tek kolonlu sıralamada sayfa sınırındaki satırlar
                // iki sorgu arasında yer değiştirir → bazı linkler İKİ kez gelir, bazıları
                // HİÇ gelmez (lead segmentten sessizce düşer).
                .order('created_at', { ascending: false })
                .order('token', { ascending: true })
                .range(page * PAGE, page * PAGE + PAGE - 1);

            if (leadIds) query = query.in('lead_id', leadIds);

            const { data, error } = await query;
            if (error) {
                console.error('[AdminOfferLinksService] listAllOffers error:', error);
                throw error;
            }
            const rows = (data as unknown as OfferLink[]) || [];
            all.push(...rows);
            if (rows.length < PAGE) break; // son sayfa — daha fazla yok
            if (page === MAX_PAGES - 1) {
                console.warn(`[AdminOfferLinksService] listAllOffers ${MAX_PAGES * PAGE} tavanına ulaştı — liste KESİLMİŞ olabilir (en eski linkler dışarıda).`);
            }
        }
        return all;
    },

    // 1a-bis) Bulk: lead başına toplam görüntülenme (offer_links.view_count toplamı).
    // WhatsApp Sohbet sidebar'ında "müşteri teklife kaç kez baktı" rozeti için.
    // CustomerInfoPanel'deki totalViews reduce ile aynı mantık, toplu sürümü.
    async getViewsForLeads(leadIds: string[]): Promise<Record<string, number>> {
        if (leadIds.length === 0) return {};
        const { data, error } = await supabase
            .from('offer_links')
            .select('lead_id, view_count')
            .in('lead_id', leadIds);
        if (error) {
            console.error('[AdminOfferLinksService] getViewsForLeads error:', error);
            throw error;
        }
        const map: Record<string, number> = {};
        ((data || []) as { lead_id: string | null; view_count: number | null }[]).forEach(r => {
            if (!r.lead_id) return;
            map[r.lead_id] = (map[r.lead_id] || 0) + (r.view_count || 0);
        });
        return map;
    },

    // 1b) Global stats — tüm teklif linklerini kapsar, sayfalamadan bağımsız.
    // Sayım sorguları head:true ile sıfır satır transfer eder; analitik sorguları
    // yalnız ihtiyaç duyulan dar kolonları çeker.
    async getGlobalStats({ leadIds }: { leadIds?: string[] } = {}): Promise<OfferLinkGlobalStats> {
        const empty: OfferLinkGlobalStats = {
            totalLinks: 0, activeLinks: 0, expiredLinks: 0, expiringSoon: 0,
            totalOpens: 0, paymentSignals: 0,
            weeklySeries: buildEmptyWeek(), weekTrend: { value: '%0', up: true },
            hotLeads: [], statusCounts: {}, aiStatusCounts: {},
        };
        if (leadIds && leadIds.length === 0) return empty;

        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        const soonIso = new Date(now + 3 * DAY_MS).toISOString();
        const fourteenDaysAgoIso = new Date(now - 14 * DAY_MS).toISOString();

        // Sales rolü kapsamı: offer_analytics'te lead_id yok; bu role ait token'ları
        // önce çözüp analitik sorgularını token bazlı daraltırız.
        let scopeTokens: string[] | null = null;
        if (leadIds) {
            const { data: tokenRows } = await supabase
                .from('offer_links')
                .select('token')
                .in('lead_id', leadIds);
            scopeTokens = (tokenRows || []).map((r: any) => r.token).filter(Boolean);
        }

        const scopedLinks = () => {
            // offer_links tablosunun PK'i 'token' — 'id' kolonu yok.
            let q = supabase.from('offer_links').select('token', { count: 'exact', head: true });
            if (leadIds) q = q.in('lead_id', leadIds);
            return q;
        };
        const scopeAnalytics = (q: any) =>
            scopeTokens ? q.in('offer_token', scopeTokens.length ? scopeTokens : ['__none__']) : q;

        // AI sıcaklık sıralaması — en yüksek AI skorlu ilk 5 lead.
        let hotLeadsQuery = supabase
            .from('leads')
            .select('id, customer_name, ai_state')
            .not('ai_state', 'is', null)
            .order('ai_state->score', { ascending: false, nullsFirst: false })
            .limit(5);
        if (leadIds) hotLeadsQuery = hotLeadsQuery.in('id', leadIds);

        // Lead manuel durumuna göre teklif linki sayıları (filtre kartları).
        const statusCountQueries = OFFER_SEGMENT_KEYS.map(s => {
            let q = supabase
                .from('offer_links')
                .select('token, leads!inner(status)', { count: 'exact', head: true })
                .eq('leads.status', s);
            if (leadIds) q = q.in('lead_id', leadIds);
            return q;
        });

        const [
            totalRes, activeRes, expiredRes, soonRes, opensRes, paymentRowsRes, recentRowsRes, hotLeadsRes,
            ...statusCountRes
        ] = await Promise.all([
                scopedLinks(),
                scopedLinks().eq('is_active', true),
                scopedLinks().eq('is_active', false),
                scopedLinks().eq('is_active', true).gte('valid_until', nowIso).lte('valid_until', soonIso),
                scopeAnalytics(
                    supabase.from('offer_analytics').select('*', { count: 'exact', head: true })
                        .eq('action_type', 'link_opened')
                ),
                scopeAnalytics(
                    supabase.from('offer_analytics').select('offer_token')
                        .in('action_type', ['payment_started', 'payment_completed'])
                ),
                scopeAnalytics(
                    supabase.from('offer_analytics').select('offer_token, action_type, created_at')
                        .eq('action_type', 'link_opened')
                        .gte('created_at', fourteenDaysAgoIso)
                ),
                hotLeadsQuery,
                ...statusCountQueries,
            ]);

        const statusCounts: Record<string, number> = {};
        OFFER_SEGMENT_KEYS.forEach((s, i) => {
            statusCounts[s] = (statusCountRes[i] as any)?.count || 0;
        });

        // AI skoruna göre offer_links bucket'leri (segment kartlarıyla aynı anahtarlar).
        // Tek bounded query + client-side bucketing — JSONB range filtre belirsizliğini
        // tamamen atlatır. 1000 satır cap'i var; bu projede toplam <1000.
        let aiLinksQuery = supabase
            .from('offer_links')
            .select('lead_id, leads!inner(ai_state)');
        if (leadIds) aiLinksQuery = aiLinksQuery.in('lead_id', leadIds);
        const { data: aiLinkRows } = await aiLinksQuery;
        const aiStatusCounts: Record<string, number> = {
            hot: 0, warm: 0, follow_up: 0, offer_sent: 0, new: 0, contacted: 0,
        };
        for (const row of (aiLinkRows || []) as any[]) {
            const s = row.leads?.ai_state?.score;
            if (typeof s !== 'number') continue;
            if (s >= 80) aiStatusCounts.hot++;
            else if (s >= 40) aiStatusCounts.warm++;  // 40–79 ılık → warm (AiScoreRing eşiğiyle birebir)
            else if (s >= 25) aiStatusCounts.offer_sent++;
            else if (s >= 10) aiStatusCounts.new++;
            else if (s >= 1) aiStatusCounts.contacted++;
        }

        const paymentTokens = new Set(
            (paymentRowsRes.data || []).map((r: any) => r.offer_token).filter(Boolean)
        );

        // Haftalık dağılım + trend (recentRowsRes yalnız link_opened içerir).
        const weeklySeries = buildEmptyWeek();
        const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
        let currentWeek = 0;
        let previousWeek = 0;

        for (const row of (recentRowsRes.data || []) as any[]) {
            const ts = new Date(row.created_at).getTime();
            if (ts > now - 7 * DAY_MS) currentWeek++;
            else if (ts > now - 14 * DAY_MS) previousWeek++;
            const dayDiff = Math.floor((todayMidnight.getTime() - new Date(row.created_at).setHours(0, 0, 0, 0)) / DAY_MS);
            if (dayDiff >= 0 && dayDiff < 7) weeklySeries[6 - dayDiff].opens++;
        }

        let weekTrend: { value: string; up: boolean } = { value: '%0', up: true };
        if (previousWeek > 0) {
            const pct = Math.round(((currentWeek - previousWeek) / previousWeek) * 100);
            weekTrend = { value: `${pct >= 0 ? '+' : ''}%${pct}`, up: pct >= 0 };
        } else if (currentWeek > 0) {
            weekTrend = { value: '+%100', up: true };
        }

        // AI sıcaklık sıralaması — AI skoruna göre en yüksek lead'ler.
        const hotLeads: OfferLinkHotLead[] = ((hotLeadsRes as any).data || [])
            .map((r: any) => ({
                leadId: r.id,
                customer: r.customer_name || '—',
                score: typeof r.ai_state?.score === 'number' ? r.ai_state.score : null,
                scoreReason: r.ai_state?.reasoning || null,
            }))
            .filter((l: OfferLinkHotLead) => l.score != null);

        return {
            totalLinks: totalRes.count || 0,
            activeLinks: activeRes.count || 0,
            expiredLinks: expiredRes.count || 0,
            expiringSoon: soonRes.count || 0,
            totalOpens: opensRes.count || 0,
            paymentSignals: paymentTokens.size,
            weeklySeries,
            weekTrend,
            hotLeads,
            statusCounts,
            aiStatusCounts,
        };
    },

    // 2) Deactivate Link
    async deactivateLink(token: string) {
        const { error } = await supabase
            .from('offer_links')
            .update({ is_active: false })
            .eq('token', token);

        if (error) throw error;
    },

    // 3) Reactivate Link
    async reactivateLink(token: string) {
        const { error } = await supabase
            .from('offer_links')
            .update({ is_active: true })
            .eq('token', token);

        if (error) throw error;
    },

    // 4) Create Manual Link — validity from campaign.max_offer_validity_days
    async createManualLink(payload: {
        lead_id: string;
        token: string;
        campaign_id?: string;
        expires_at?: string;
        offer_snapshot?: any;
        market_code?: string | null;
        country_code?: string | null;
    }) {
        // Compute validity from campaign settings if campaign selected; also pull
        // the campaign's default market/country so we can inherit when the form
        // didn't explicitly override them.
        let validUntil = payload.expires_at;
        let inheritedMarket: string | null = null;
        let inheritedCountry: string | null = null;
        if (payload.campaign_id) {
            const { data: campaign } = await supabase
                .from('campaigns')
                .select('valid_until, max_offer_validity_days, offer_cannot_exceed_campaign_end, market_code, country_code')
                .eq('id', payload.campaign_id)
                .single();
            if (campaign) {
                if (!payload.expires_at) {
                    validUntil = computeOfferExpiry(campaign, new Date()).toISOString();
                }
                inheritedMarket = (campaign as any).market_code || null;
                inheritedCountry = (campaign as any).country_code || null;
            }
        }

        // created_by kolonu şemada vardı ama hiç doldurulmuyordu; teklifi kimin
        // kestiği bilinmediği için temsilci atfı yapılamıyordu.
        const creator = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('offer_links')
            .insert([{
                lead_id: payload.lead_id,
                token: payload.token,
                campaign_id: payload.campaign_id || null,
                valid_until: validUntil || null,
                offer_snapshot: payload.offer_snapshot || null,
                market_code: payload.market_code ?? inheritedMarket,
                country_code: payload.country_code ?? inheritedCountry,
                created_by: creator.data.user?.id ?? null,
                status: 'active'
            }])
            .select()
            .single();

        if (error) {
            console.error('[AdminOfferLinksService] Error creating link:', error);
            throw error;
        }

        const auth = await supabase.auth.getUser();
        await Promise.all([
            supabase.from('lead_events').insert({
                lead_id: payload.lead_id,
                event_type: 'offer_created_manual',
                metadata: { token: payload.token }
            }),
            auth.data.user ? supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'CREATE',
                entity_type: 'OFFER_LINK',
                entity_id: data.id,
                new_values: payload
            }) : Promise.resolve()
        ]);

        return data as OfferLink;
    },

    // 5) Extend Offer Expiry (admin manuel uzatma)
    // Süresi dolmuş veya iptalli tekliflerde otomatik olarak is_active=true yapar.
    // Hem valid_until hem expires_at güncellenir — müşteri tarafı her ikisini de kontrol ediyor.
    // generated_offers (final teklifler) kendi expiry alanı tutmuyor; parent offer_link'in
    // süresine bağlı olduğundan link uzatılınca otomatik olarak hepsi uzar.
    async extendOfferExpiry(token: string, newValidUntil: string): Promise<{ valid_until: string; is_active: boolean }> {
        const { data: existing, error: fetchErr } = await supabase
            .from('offer_links')
            .select('valid_until, is_active, lead_id')
            .eq('token', token)
            .single();
        if (fetchErr) throw fetchErr;

        const { error } = await supabase
            .from('offer_links')
            .update({
                valid_until: newValidUntil,
                expires_at: newValidUntil,
                is_active: true,
                status: 'active',
            })
            .eq('token', token);
        if (error) throw error;

        try {
            const auth = await supabase.auth.getUser();
            await Promise.all([
                supabase.from('lead_events').insert({
                    lead_id: existing.lead_id,
                    event_type: 'offer_expiry_extended',
                    metadata: { token, old_valid_until: existing.valid_until, new_valid_until: newValidUntil },
                }),
                auth.data.user ? supabase.from('audit_logs').insert({
                    user_id: auth.data.user.id,
                    action_type: 'EXTEND_EXPIRY',
                    entity_type: 'OFFER_LINK',
                    entity_id: token,
                    old_values: { valid_until: existing.valid_until, is_active: existing.is_active },
                    new_values: { valid_until: newValidUntil, is_active: true },
                }) : Promise.resolve(),
            ]);
        } catch (auditErr) {
            console.warn('[extendOfferExpiry] audit warning:', auditErr);
        }

        return { valid_until: newValidUntil, is_active: true };
    },

    // 5b) End Offer Expiry (admin elle "süreyi bitir" — extendOfferExpiry'nin tersi)
    // Sayacı şimdiye çeker: valid_until/expires_at = now, is_active=false, status='expired'.
    // Müşteri tarafı (getOfferContextByToken) bu üç koşuldan herhangi biriyle reclaim moduna
    // geçtiğinden etki anında olur; 15 dk'lık cron sweep'i beklemeye gerek yok.
    // Geri almak için extendOfferExpiry ile ileri tarih verilir (is_active=true, status='active').
    async endOfferExpiry(token: string): Promise<{ valid_until: string; is_active: boolean; status: string }> {
        const nowIso = new Date().toISOString();

        const { data: existing, error: fetchErr } = await supabase
            .from('offer_links')
            .select('valid_until, is_active, status, lead_id')
            .eq('token', token)
            .single();
        if (fetchErr) throw fetchErr;

        const { error } = await supabase
            .from('offer_links')
            .update({
                valid_until: nowIso,
                expires_at: nowIso,
                is_active: false,
                status: 'expired',
            })
            .eq('token', token);
        if (error) throw error;

        try {
            const auth = await supabase.auth.getUser();
            await Promise.all([
                supabase.from('lead_events').insert({
                    lead_id: existing.lead_id,
                    event_type: 'offer_expiry_ended',
                    metadata: { token, old_valid_until: existing.valid_until, new_valid_until: nowIso },
                }),
                auth.data.user ? supabase.from('audit_logs').insert({
                    user_id: auth.data.user.id,
                    action_type: 'END_EXPIRY',
                    entity_type: 'OFFER_LINK',
                    entity_id: token,
                    old_values: { valid_until: existing.valid_until, is_active: existing.is_active, status: existing.status },
                    new_values: { valid_until: nowIso, is_active: false, status: 'expired' },
                }) : Promise.resolve(),
            ]);
        } catch (auditErr) {
            console.warn('[endOfferExpiry] audit warning:', auditErr);
        }

        return { valid_until: nowIso, is_active: false, status: 'expired' };
    },

    // 6) Delete Offers (handles foreign key constraints)
    async deleteOffers(tokens: string[]) {
        if (!tokens.length) return;

        // Step 1: Set token to NULL in payment_transactions to preserve financial history 
        // without blocking offer link deletion (ON DELETE NO ACTION)
        const { error: paymentErr } = await supabase
            .from('payment_transactions')
            .update({ token: null })
            .in('token', tokens);

        if (paymentErr) {
            console.error('[AdminOfferLinksService] Error cleaning payment transactions:', paymentErr);
            // Non-fatal, attempt to continue
        }

        // Step 2: Delete generated_offers linked to these tokens
        const { error: genErr } = await supabase
            .from('generated_offers')
            .delete()
            .in('offer_token', tokens);

        if (genErr) {
            console.error('[AdminOfferLinksService] Error deleting generated_offers:', genErr);
        }

        // Step 3: Delete the offer links themselves
        // Other related records (offer_analytics, lead_events) will be cascaded by DB
        const { error } = await supabase
            .from('offer_links')
            .delete()
            .in('token', tokens);

        if (error) {
            console.error('[AdminOfferLinksService] Error deleting offers:', error);
            throw error;
        }
    }
};
