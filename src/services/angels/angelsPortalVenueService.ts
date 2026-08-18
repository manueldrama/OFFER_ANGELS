// Venue portal servisi — /api/angels/venue/* uçlarının ince sarmalayıcısı.
// Keşif okumaları ise anon Supabase view'larından yapılır (angels_creators_directory
// + angels_promotions_active_view) — endpoint gerektirmez.

import { supabase } from '../../lib/supabase/client';
import { angelsApiFetch } from './angelsAuthService';
import type {
    PlatformRequest, PlatformProject, PlatformPayment, AngelsNote,
} from '../../types/angelsPlatform';

export interface DirectoryCreator {
    id: string;
    full_name: string;
    display_name: string;
    instagram: string;
    city: string | null;
    country: string | null;
    profile_image: string | null;
    gallery_images: string[];
    bio: string | null;
    categories: string[];
    is_featured: boolean;
    tier: string;
    languages: string[];
    content_formats: string[];
    preferred_collaboration_cities: string[];
    travel_available: boolean;
    rate_min: number | null;
    rate_max: number | null;
    currency: string;
    style_description: string | null;
    created_at: string;
}

export interface ActivePromotion {
    id: string;
    creator_id: string;
    placement_type: string;
    target_cities: string[];
    target_venue_types: string[];
    ends_at: string | null;
}

export const AngelsPortalVenueService = {
    // ── Keşif (anon view'lar — dizin herkese değil, UI venue guard'ının arkasında) ──
    async getDirectory(): Promise<DirectoryCreator[]> {
        const { data, error } = await supabase
            .from('angels_creators_directory')
            .select('*')
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as DirectoryCreator[]) ?? [];
    },

    async getDirectoryCreator(id: string): Promise<DirectoryCreator | null> {
        const { data, error } = await supabase
            .from('angels_creators_directory')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return (data as DirectoryCreator) ?? null;
    },

    async getActivePromotions(): Promise<ActivePromotion[]> {
        const { data, error } = await supabase
            .from('angels_promotions_active_view')
            .select('*');
        if (error) {
            console.warn('[angels-venue] promotions view', error.message);
            return [];
        }
        return (data as ActivePromotion[]) ?? [];
    },

    // ── Spotlight metrikleri (ucuz sayaç RPC'leri) ─────────────────────────────
    recordImpressions(promotionIds: string[]): void {
        if (!promotionIds.length) return;
        void supabase.rpc('angels_record_promotion_impressions', { p_ids: promotionIds });
    },
    recordProfileView(promotionId: string): void {
        void supabase.rpc('angels_record_promotion_view', { p_id: promotionId });
    },
    recordClick(promotionId: string): void {
        void supabase.rpc('angels_record_promotion_click', { p_id: promotionId });
    },

    // ── Portal uçları ──────────────────────────────────────────────────────────
    getOverview: () => angelsApiFetch<{
        venue: { id: string; name: string; account_status: string };
        openRequests: number; proposalsAwaiting: number; activeProjects: number;
        paymentsPending: number; recentRequests: PlatformRequest[];
    }>('/venue/overview'),

    listRequests: () => angelsApiFetch<{ requests: PlatformRequest[] }>('/venue/requests'),

    getRequest: (id: string) => angelsApiFetch<{
        request: PlatformRequest;
        proposals: {
            id: string; proposed_fee: number; total_amount: number; tax_amount: number;
            currency: string; deliverables: any[]; available_dates: string[];
            message: string | null; valid_until: string | null; status: string;
            revision_note: string | null; created_at: string;
        }[];
        notes: AngelsNote[];
    }>(`/venue/requests/${id}`),

    submitRequest: (payload: Record<string, unknown>) =>
        angelsApiFetch<{ request: PlatformRequest }>('/venue/requests', { body: payload }),

    respondProposal: (proposalId: string, action: 'accept' | 'decline' | 'revision', note?: string) =>
        angelsApiFetch<{ ok: boolean; project_id: string | null }>(
            `/venue/proposals/${proposalId}/respond`, { body: { action, note } }),

    listProjects: () => angelsApiFetch<{ projects: PlatformProject[] }>('/venue/projects'),

    getProject: (id: string) => angelsApiFetch<{
        project: PlatformProject;
        payment: Pick<PlatformPayment, 'id' | 'amount' | 'currency' | 'payment_status' | 'invoice_url' | 'paid_at'> | null;
        notes: AngelsNote[];
    }>(`/venue/projects/${id}`),

    getProjectContacts: (id: string) => angelsApiFetch<{
        contacts: { full_name: string; display_name: string | null; email: string; whatsapp: string | null; instagram: string };
    }>(`/venue/projects/${id}/contacts`),

    listPayments: () => angelsApiFetch<{ payments: any[] }>('/venue/payments'),

    getProfile: () => angelsApiFetch<{ venue: any }>('/venue/profile'),
    updateProfile: (patch: Record<string, unknown>) =>
        angelsApiFetch<{ venue: any }>('/venue/profile', { method: 'PATCH', body: patch }),

    addNote: (subjectType: 'request' | 'proposal' | 'project', subjectId: string, body: string) =>
        angelsApiFetch<{ note: AngelsNote }>('/venue/notes', {
            body: { subject_type: subjectType, subject_id: subjectId, body },
        }),
};
