import { supabase } from '../../lib/supabase/client';
import { eventIntentScore } from '../../lib/activityEvents';

export interface VisitEntry {
    id: string;
    /** Ziyaret zamanı (grubun en yeni olayı). */
    at: string;
    event_type: string;
    /** Bu ziyarete çöken olay adedi (tablolar arası mükerrerler dahil). */
    collapsed: number;
}

export interface VisitHistoryResult {
    visits: VisitEntry[];
    /** Ham sorgular limitine çarptı → daha eski ziyaretler de var. */
    hasMore: boolean;
}

const VISIT_LIMIT = 50;
/**
 * Aynı fiziksel geliş hem lead_events'e hem offer_analytics'e yazılabiliyor
 * (bkz. offerPriority.deriveOffer — analytics'te de link_opened/offer_viewed var).
 * 60 sn penceresindeki olaylar tek ziyarete çöker.
 */
const COLLAPSE_MS = 60_000;

/**
 * Bir müşterinin TAM ziyaret geçmişi (tarih+saat). Canlı İzleme akışı son 100
 * olayla sınırlı olduğundan buradaki sorgular hedefli atılır; "Granüler izleme"
 * toggle'ından bağımsız olarak lp_viewed dahil tüm geliş olaylarını kapsar.
 */
export const VisitHistoryService = {
    async fetch(params: { leadId?: string | null; token?: string | null }): Promise<VisitHistoryResult> {
        const { leadId, token } = params;
        if (!leadId && !token) return { visits: [], hasMore: false };

        // offer_analytics'te lead_id yok → lead'in tüm linklerinin token'ları
        // üzerinden köprü (useLiveActivityFeed'deki scopeTokens deseni).
        let tokens: string[] = token ? [token] : [];
        if (leadId) {
            const { data: tokenRows } = await supabase
                .from('offer_links')
                .select('token')
                .eq('lead_id', leadId);
            const bridged = (tokenRows || []).map((r: { token: string | null }) => r.token).filter(Boolean) as string[];
            tokens = [...new Set([...tokens, ...bridged])];
        }

        let leadEventsQuery = supabase
            .from('lead_events')
            .select('id, event_type, created_at')
            .in('event_type', ['link_opened', 'offer_viewed'])
            .order('created_at', { ascending: false })
            .limit(VISIT_LIMIT);
        leadEventsQuery = leadId ? leadEventsQuery.eq('lead_id', leadId) : leadEventsQuery.eq('token', token as string);

        const queries: PromiseLike<{ data: unknown } | { data?: unknown }>[] = [leadEventsQuery];
        if (tokens.length) {
            queries.push(
                supabase
                    .from('offer_analytics')
                    .select('id, action_type, created_at')
                    .in('action_type', ['link_opened', 'offer_viewed', 'lp_viewed'])
                    .in('offer_token', tokens)
                    .order('created_at', { ascending: false })
                    .limit(VISIT_LIMIT)
            );
        }

        const results: any[] = await Promise.all(queries);
        const leadEvents = (results[0]?.data || []) as { id: string; event_type: string; created_at: string }[];
        const analytics = ((results[1]?.data || []) as { id: string; action_type: string; created_at: string }[])
            .map((r) => ({ id: `oa-${r.id}`, event_type: r.action_type, created_at: r.created_at }));

        const merged = [...leadEvents, ...analytics].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

        // Desc sırada zincirleme çökme: olay, grubun son olayına 60 sn'den
        // yakınsa aynı ziyarettir. Temsilci etiket = en yüksek niyet puanlısı.
        const visits: VisitEntry[] = [];
        let anchorMs = 0;
        for (const ev of merged) {
            const evMs = new Date(ev.created_at).getTime();
            const last = visits[visits.length - 1];
            if (last && anchorMs - evMs < COLLAPSE_MS) {
                last.collapsed += 1;
                if (eventIntentScore(ev.event_type) > eventIntentScore(last.event_type)) {
                    last.event_type = ev.event_type;
                }
            } else {
                visits.push({ id: ev.id, at: ev.created_at, event_type: ev.event_type, collapsed: 1 });
            }
            anchorMs = evMs;
        }

        const hasMore =
            leadEvents.length >= VISIT_LIMIT ||
            analytics.length >= VISIT_LIMIT ||
            visits.length > VISIT_LIMIT;
        return { visits: visits.slice(0, VISIT_LIMIT), hasMore };
    },
};
