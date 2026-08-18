import { supabase } from '../../lib/supabase/client';

export interface VisitorProfile {
    visitor_id: string;
    first_seen_at: string;
    last_seen_at: string;
    first_country: string | null;
    first_city: string | null;
    first_utm_source: string | null;
    first_utm_medium: string | null;
    first_utm_campaign: string | null;
    first_referrer: string | null;
    first_landing_path: string | null;
}

export interface VisitorSession {
    id: string;
    started_at: string;
    country: string | null;
    city: string | null;
    device_type: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    referrer: string | null;
    landing_path: string | null;
    pageviews: number;
    clarity_user_id: string | null;
    clarity_session_id: string | null;
}

export interface VisitorPageview {
    id: string;
    session_id: string;
    path: string;
    title: string | null;
    created_at: string;
}

export interface VisitorHistory {
    profile: VisitorProfile | null;
    sessions: VisitorSession[];
    pageviews: VisitorPageview[];
    totals: { sessions: number; pageviews: number };
    // Lead satırına DOĞRUDAN yazılan Clarity ID'leri (analyticsService
    // .bindLeadClarityIdsWhenReady). Visitor izi hiç olmasa bile doluysa
    // admin kartı buradan derin-link kurar — session join'e bağlı kalmaz.
    leadClarity: { user_id: string | null; session_id: string | null };
}

export const VisitorHistoryService = {
    /**
     * Fetch the full pre/post-conversion browsing history for a lead.
     * Resolves the visitor_id either from leads.visitor_id OR by reverse-lookup
     * from visitors.lead_id (in case the column wasn't backfilled).
     */
    async forLead(leadId: string): Promise<VisitorHistory> {
        // First try lead's stored visitor_id; fall back to visitors.lead_id reverse lookup.
        const { data: leadRow } = await supabase
            .from('leads')
            .select('visitor_id, clarity_user_id, clarity_session_id')
            .eq('id', leadId)
            .maybeSingle();

        const leadClarity = {
            user_id: leadRow?.clarity_user_id || null,
            session_id: leadRow?.clarity_session_id || null,
        };
        let visitorId = leadRow?.visitor_id || null;

        if (!visitorId) {
            const { data: rev } = await supabase
                .from('visitors')
                .select('visitor_id')
                .eq('lead_id', leadId)
                .maybeSingle();
            visitorId = rev?.visitor_id || null;
        }

        if (!visitorId) {
            return { profile: null, sessions: [], pageviews: [], totals: { sessions: 0, pageviews: 0 }, leadClarity };
        }

        const [profileRes, sessionsRes, pageviewsRes] = await Promise.all([
            supabase
                .from('visitors')
                .select('visitor_id, first_seen_at, last_seen_at, first_country, first_city, first_utm_source, first_utm_medium, first_utm_campaign, first_referrer, first_landing_path')
                .eq('visitor_id', visitorId)
                .maybeSingle(),
            supabase
                .from('sessions')
                .select('id, started_at, country, city, device_type, utm_source, utm_medium, utm_campaign, referrer, landing_path, pageviews, clarity_user_id, clarity_session_id')
                .eq('visitor_id', visitorId)
                .order('started_at', { ascending: false })
                .limit(50),
            supabase
                .from('pageviews')
                .select('id, session_id, path, title, created_at')
                .eq('visitor_id', visitorId)
                .order('created_at', { ascending: false })
                .limit(200),
        ]);

        return {
            profile: (profileRes.data as VisitorProfile) || null,
            sessions: (sessionsRes.data || []) as VisitorSession[],
            pageviews: (pageviewsRes.data || []) as VisitorPageview[],
            totals: {
                sessions: (sessionsRes.data || []).length,
                pageviews: (pageviewsRes.data || []).length,
            },
            leadClarity,
        };
    },
};
