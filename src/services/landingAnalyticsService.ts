import { supabase } from '../lib/supabase/client';
import { LandingAnalyticsEvent } from '../types';

const VISITOR_KEY = 'cafepaste_visitor_id';

function getVisitorId(): string {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
}

export const LandingAnalyticsService = {
    getVisitorId,

    async track(event: Omit<LandingAnalyticsEvent, 'visitor_id'>) {
        const visitor_id = getVisitorId();
        await supabase.from('landing_analytics').insert({
            ...event,
            visitor_id,
        });
    },

    async trackPageView(variantId: string | null) {
        await this.track({ variant_id: variantId, event_type: 'page_view' });
    },

    async trackSectionView(variantId: string | null, sectionType: string) {
        await this.track({ variant_id: variantId, event_type: 'section_view', section_type: sectionType });
    },

    async trackClick(variantId: string | null, sectionType: string, x: number, y: number, element: string) {
        await this.track({
            variant_id: variantId,
            event_type: 'click',
            section_type: sectionType,
            metadata: { x, y, element },
        });
    },

    async trackScrollDepth(variantId: string | null, depth: number) {
        await this.track({
            variant_id: variantId,
            event_type: 'scroll_depth',
            metadata: { depth },
        });
    },

    async trackCtaClick(variantId: string | null, sectionType: string, label: string) {
        await this.track({
            variant_id: variantId,
            event_type: 'cta_click',
            section_type: sectionType,
            metadata: { label },
        });
    },

    async trackFormSubmit(variantId: string | null) {
        await this.track({ variant_id: variantId, event_type: 'form_submit' });
    },

    /** Admin: get analytics summary for date range */
    async getSummary(startDate: string, endDate: string) {
        const { data, error } = await supabase
            .from('landing_analytics')
            .select('variant_id, event_type, visitor_id, section_type, metadata, created_at')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data ?? [];
    },

    async trackSectionDuration(variantId: string | null, sectionType: string, durationMs: number) {
        await this.track({
            variant_id: variantId,
            event_type: 'section_duration',
            section_type: sectionType,
            metadata: { duration_ms: durationMs },
        });
    },

    /** Admin: get click heatmap data for a variant */
    async getHeatmapData(variantId: string | null | 'all', startDate: string, endDate: string) {
        let query = supabase
            .from('landing_analytics')
            .select('section_type, metadata, created_at')
            .eq('event_type', 'click')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (variantId === null) query = query.is('variant_id', null);
        else if (variantId !== 'all') query = query.eq('variant_id', variantId);

        const { data, error } = await query;
        if (error) throw error;
        return data ?? [];
    },

    /** Admin: get section durations for a variant */
    async getSectionDurations(variantId: string | null | 'all', startDate: string, endDate: string) {
        let query = supabase
            .from('landing_analytics')
            .select('section_type, metadata, visitor_id')
            .eq('event_type', 'section_duration')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (variantId === null) query = query.is('variant_id', null);
        else if (variantId !== 'all') query = query.eq('variant_id', variantId);

        const { data, error } = await query;
        if (error) throw error;
        return data ?? [];
    },

    /** Admin: get element-level click details */
    async getElementClicks(variantId: string | null | 'all', startDate: string, endDate: string) {
        let query = supabase
            .from('landing_analytics')
            .select('section_type, metadata')
            .eq('event_type', 'click')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (variantId === null) query = query.is('variant_id', null);
        else if (variantId !== 'all') query = query.eq('variant_id', variantId);

        const { data, error } = await query;
        if (error) throw error;
        return data ?? [];
    },

    /** Admin: get offer counts grouped by variant_id */
    async getOffersByVariant(startDate: string, endDate: string) {
        const { data, error } = await supabase
            .from('offer_links')
            .select('variant_id, token, created_at')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (error) throw error;

        // Group by variant_id
        const grouped: Record<string, number> = {};
        for (const row of (data ?? [])) {
            const key = row.variant_id ?? '__default__';
            grouped[key] = (grouped[key] || 0) + 1;
        }
        return grouped;
    },

    /** Admin: get sales (confirmed reservations) grouped by variant_id */
    async getSalesByVariant(startDate: string, endDate: string) {
        // Join customer_reservations with offer_links to get variant_id
        const { data, error } = await supabase
            .from('customer_reservations')
            .select('offer_token, total, status, created_at')
            .in('status', ['confirmed', 'paid', 'shipped', 'delivered'])
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (error) throw error;
        const reservations = data ?? [];

        if (reservations.length === 0) return {};

        // Fetch offer_links for these tokens to get variant_id
        const tokens = [...new Set(reservations.map(r => r.offer_token))];
        const { data: links, error: linkErr } = await supabase
            .from('offer_links')
            .select('token, variant_id')
            .in('token', tokens);

        if (linkErr) throw linkErr;

        const tokenToVariant: Record<string, string> = {};
        for (const link of (links ?? [])) {
            tokenToVariant[link.token] = link.variant_id ?? '__default__';
        }

        // Group by variant_id
        const grouped: Record<string, { count: number; revenue: number }> = {};
        for (const r of reservations) {
            const key = tokenToVariant[r.offer_token] ?? '__default__';
            if (!grouped[key]) grouped[key] = { count: 0, revenue: 0 };
            grouped[key].count++;
            grouped[key].revenue += Number(r.total) || 0;
        }
        return grouped;
    },
};
