// CAFEPASTE Angels — admin işbirliği servisi (talepler/teklifler/projeler/
// ödemeler/payout'lar/Spotlight + hesap provisioning).
// Admin authenticated Supabase session'ı ile doğrudan tablolara erişir
// (RLS: yalnız authenticated = admin). Provisioning worker endpoint'i
// service-role gerektirdiğinden fetch + Bearer admin JWT ile çağrılır.

import { supabase } from '../../lib/supabase/client';
import type {
    PlatformRequest, PlatformProposal, PlatformProject, PlatformPayment,
    PlatformPayout, SpotlightPackage, CreatorPromotion,
} from '../../types/angelsPlatform';

const CREATOR_JOIN = 'creator:angels_creators(id,full_name,display_name,instagram,profile_image)';
const VENUE_JOIN = 'venue:angels_venues(id,name,city,venue_type)';

async function adminFetch<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/angels${path}`, {
        method: init.method || (init.body !== undefined ? 'POST' : 'GET'),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any)?.error || `İstek başarısız (${res.status})`);
    return data as T;
}

export const AngelsCollabAdminService = {
    // ── Hesap provisioning ─────────────────────────────────────────────────────
    provisionAccount: (kind: 'creator' | 'venue', targetId: string, email?: string, memberRole?: string) =>
        adminFetch<{ account_id: string; email: string; action_link: string; email_sent: boolean; email_error: string | null }>(
            '/accounts', { body: { kind, target_id: targetId, email, member_role: memberRole } }),

    getAccountMembers: (kind: 'creator' | 'venue', targetId: string) =>
        adminFetch<{ members: { member_role: string; is_active: boolean; account: { id: string; email: string; has_password: boolean; last_login_at: string | null; is_active: boolean } | null }[] }>(
            `/accounts?kind=${kind}&target_id=${targetId}`),

    // ── Venue hesapları ────────────────────────────────────────────────────────
    async listVenues(): Promise<any[]> {
        const { data, error } = await supabase
            .from('angels_venues')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data ?? [];
    },

    async updateVenue(id: string, patch: Record<string, unknown>): Promise<void> {
        const { error } = await supabase.from('angels_venues').update(patch).eq('id', id);
        if (error) throw error;
    },

    async createVenueAccountRecord(payload: Record<string, unknown>): Promise<any> {
        const { data, error } = await supabase
            .from('angels_venues')
            .insert({ ...payload })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // ── Talepler ───────────────────────────────────────────────────────────────
    async listRequests(): Promise<PlatformRequest[]> {
        const { data, error } = await supabase
            .from('angels_requests')
            .select(`*, ${CREATOR_JOIN}, ${VENUE_JOIN}`)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as any[]) ?? [];
    },

    async updateRequest(id: string, patch: Record<string, unknown>): Promise<void> {
        const { error } = await supabase.from('angels_requests').update(patch).eq('id', id);
        if (error) throw error;
    },

    // ── Teklifler ─────────────────────────────────────────────────────────────
    async listProposals(): Promise<PlatformProposal[]> {
        const { data, error } = await supabase
            .from('angels_proposals')
            .select(`*, request:angels_requests(id,project_title), ${CREATOR_JOIN}, ${VENUE_JOIN}`)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as any[]) ?? [];
    },

    /** Managed package (model 3): admin toplamı elle günceller; marj yeniden hesaplanır. */
    async overrideProposalTotal(id: string, newTotal: number): Promise<void> {
        const { data, error } = await supabase
            .from('angels_proposals')
            .select('creator_payout, tax_amount')
            .eq('id', id)
            .single();
        if (error) throw error;
        const payout = Number((data as any).creator_payout || 0);
        const tax = Number((data as any).tax_amount || 0);
        const { error: e2 } = await supabase
            .from('angels_proposals')
            .update({ total_amount: newTotal, platform_fee: newTotal - payout - tax })
            .eq('id', id);
        if (e2) throw e2;
    },

    // ── Projeler ──────────────────────────────────────────────────────────────
    async listProjects(): Promise<PlatformProject[]> {
        const { data, error } = await supabase
            .from('angels_projects')
            .select(`*, ${CREATOR_JOIN}, ${VENUE_JOIN}`)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as any[]) ?? [];
    },

    async updateProject(id: string, patch: Record<string, unknown>): Promise<void> {
        const { error } = await supabase.from('angels_projects').update(patch).eq('id', id);
        if (error) throw error;
    },

    // ── Ödemeler + payout'lar ─────────────────────────────────────────────────
    async listPayments(): Promise<(PlatformPayment & { project?: any; creator?: any; venue?: any })[]> {
        const { data, error } = await supabase
            .from('angels_payments')
            .select(`*, project:angels_projects(id,title,status), ${CREATOR_JOIN}, ${VENUE_JOIN}`)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as any[]) ?? [];
    },

    /** Ödemeyi paid işaretle — proje payment_received + payout pending zinciri SQL RPC'de. */
    async markPaymentPaid(id: string, opts: { transactionId?: string; invoiceUrl?: string; notes?: string } = {}): Promise<void> {
        const { error } = await supabase.rpc('angels_mark_payment_paid', {
            p_payment_id: id,
            p_transaction_id: opts.transactionId ?? null,
            p_invoice_url: opts.invoiceUrl ?? null,
            p_notes: opts.notes ?? null,
        });
        if (error) throw error;
    },

    async listPayouts(): Promise<(PlatformPayout & { project?: any; creator?: any })[]> {
        const { data, error } = await supabase
            .from('angels_payouts')
            .select(`*, project:angels_projects(id,title,status), ${CREATOR_JOIN}`)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as any[]) ?? [];
    },

    async markPayoutSent(id: string, opts: { method?: string; reference?: string; notes?: string } = {}): Promise<void> {
        const { error } = await supabase.rpc('angels_mark_payout_sent', {
            p_payout_id: id,
            p_method: opts.method ?? null,
            p_reference: opts.reference ?? null,
            p_notes: opts.notes ?? null,
        });
        if (error) throw error;
    },

    // ── Spotlight ─────────────────────────────────────────────────────────────
    async listSpotlightPackages(): Promise<SpotlightPackage[]> {
        const { data, error } = await supabase
            .from('angels_spotlight_packages')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data as any[]) ?? [];
    },

    async upsertSpotlightPackage(pkg: Partial<SpotlightPackage> & { id?: string }): Promise<void> {
        const { id, ...rest } = pkg;
        const { error } = id
            ? await supabase.from('angels_spotlight_packages').update(rest).eq('id', id)
            : await supabase.from('angels_spotlight_packages').insert(rest);
        if (error) throw error;
    },

    async listPromotions(): Promise<CreatorPromotion[]> {
        const { data, error } = await supabase
            .from('angels_creator_promotions')
            .select(`*, package:angels_spotlight_packages(id,name,duration_days,placement_type), ${CREATOR_JOIN}`)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as any[]) ?? [];
    },

    async updatePromotion(id: string, patch: Record<string, unknown>): Promise<void> {
        const { error } = await supabase.from('angels_creator_promotions').update(patch).eq('id', id);
        if (error) throw error;
    },

    /** Promosyonu aktive et: paid → active, süreyi paketten hesapla. */
    async activatePromotion(promo: CreatorPromotion): Promise<void> {
        const days = promo.package?.duration_days ?? 7;
        const now = new Date();
        const { error } = await supabase.from('angels_creator_promotions').update({
            promotion_status: 'active',
            starts_at: now.toISOString(),
            ends_at: new Date(now.getTime() + days * 86400000).toISOString(),
        }).eq('id', promo.id);
        if (error) throw error;
    },

    // ── Platform ayarları ─────────────────────────────────────────────────────
    async getSettings(): Promise<any | null> {
        const { data, error } = await supabase
            .from('angels_platform_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async updateSettings(patch: Record<string, unknown>): Promise<void> {
        const { error } = await supabase
            .from('angels_platform_settings')
            .update(patch)
            .eq('id', 1);
        if (error) throw error;
    },

    // ── Overview sayıları ─────────────────────────────────────────────────────
    async getPlatformStats(): Promise<Record<string, number>> {
        const count = async (table: string, filter?: (q: any) => any) => {
            let q = supabase.from(table).select('id', { count: 'exact', head: true });
            if (filter) q = filter(q);
            const { count: n } = await q;
            return n ?? 0;
        };
        const [openRequests, pendingProposals, paymentPending, completedProjects,
            activePromotions, pendingVenues, revenue, spotlightRevenue] = await Promise.all([
            count('angels_requests', q => q.in('status', ['request_sent', 'admin_review', 'sent_to_creator', 'creator_reviewing', 'revision_requested'])),
            count('angels_proposals', q => q.in('status', ['sent', 'viewed'])),
            count('angels_payments', q => q.eq('payment_status', 'pending')),
            count('angels_projects', q => q.eq('status', 'completed')),
            count('angels_creator_promotions', q => q.eq('promotion_status', 'active')),
            count('angels_venues', q => q.eq('account_status', 'pending_review')),
            supabase.from('angels_payments').select('platform_fee').eq('payment_status', 'paid')
                .then(r => (r.data ?? []).reduce((s: number, row: any) => s + Number(row.platform_fee || 0), 0)),
            supabase.from('angels_creator_promotions').select('price').eq('payment_status', 'paid')
                .then(r => (r.data ?? []).reduce((s: number, row: any) => s + Number(row.price || 0), 0)),
        ]);
        return {
            openRequests, pendingProposals, paymentPending, completedProjects,
            activePromotions, pendingVenues,
            commissionRevenue: revenue as number,
            spotlightRevenue: spotlightRevenue as number,
        };
    },
};
