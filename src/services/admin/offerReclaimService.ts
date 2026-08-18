import { supabase } from '../../lib/supabase/client';

export type ReclaimStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled';

export interface OfferReclaimRequest {
    id: string;
    /** offer_links.token (offer_links tablosunda 'id' kolonu yok, PK = token) */
    original_offer_link_token: string;
    lead_id: string;
    selected_product_ids: string[];
    status: ReclaimStatus;
    admin_note: string | null;
    /** Admin yeni teklif hazırladıysa o offer_link'in token'ı */
    new_offer_link_token: string | null;
    created_at: string;
    fulfilled_at: string | null;
    fulfilled_by: string | null;
    // Manuel client-side join ile doldurulur (PostgREST embedded resource FK
    // gerektiriyor ve offer_reclaim_requests'te FK bilinçli olarak yok —
    // lead_events / lead_notes gibi log tablolarıyla aynı pattern).
    lead?: {
        id: string;
        customer_name: string | null;
        phone_number: string | null;
        company_name: string | null;
    } | null;
    original_offer_link?: {
        token: string;
        short_code: string | null;
        created_at: string | null;
        valid_until: string | null;
    } | null;
    selected_products?: Array<{ id: string; name: string }>;
    /**
     * Müşterinin reclaim sırasında konfigüratörde seçtiği tam cart objesi:
     * { items[], payment_method, subtotal, vat, total }. Admin yeni teklif
     * hazırlarken bu cart'ı baz alır.
     */
    cart_snapshot?: {
        payment_method?: string;
        items?: Array<{
            id: string;
            type?: string;
            name: string;
            price: number;
            quantity: number;
            listPrice?: number;
        }>;
        subtotal?: number;
        vat?: number;
        total?: number;
    } | null;
}

export const AdminOfferReclaimService = {
    /**
     * Talepleri listeler. Default: tüm pending.
     * status='all' geçersen hepsini döner (filtre yok).
     *
     * NOT: lead + original_offer_link join'leri PostgREST embedded resource
     * yerine manuel ek query ile yapılır (FK yok → PostgREST schema cache
     * relationship kuramaz).
     */
    async list(filter: { status?: ReclaimStatus | 'all' } = {}): Promise<OfferReclaimRequest[]> {
        let query = supabase
            .from('offer_reclaim_requests')
            .select('*')
            .order('created_at', { ascending: false });

        const status = filter.status ?? 'pending';
        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        const rows = (data || []) as OfferReclaimRequest[];

        if (rows.length === 0) return rows;

        // Manuel join: lead_id'leri topla, leads tablosundan ayrı çek
        const leadIds = Array.from(new Set(rows.map((r) => r.lead_id).filter(Boolean)));
        const leadMap = new Map<string, OfferReclaimRequest['lead']>();
        if (leadIds.length > 0) {
            const { data: leadRows } = await supabase
                .from('leads')
                .select('id, customer_name, phone_number, company_name')
                .in('id', leadIds);
            (leadRows || []).forEach((l: any) => leadMap.set(l.id, l));
        }

        // Manuel join: original_offer_link_token'ları topla, offer_links'ten ayrı çek.
        // offer_links tablosunda PK = token (id yok), o yüzden 'token' üzerinden eşleştirme.
        const offerLinkTokens = Array.from(
            new Set(rows.map((r) => r.original_offer_link_token).filter(Boolean)),
        );
        const offerLinkMap = new Map<string, OfferReclaimRequest['original_offer_link']>();
        if (offerLinkTokens.length > 0) {
            const { data: olRows } = await supabase
                .from('offer_links')
                .select('token, short_code, created_at, valid_until')
                .in('token', offerLinkTokens);
            (olRows || []).forEach((o: any) =>
                offerLinkMap.set(o.token, {
                    token: o.token,
                    short_code: o.short_code,
                    created_at: o.created_at,
                    valid_until: o.valid_until,
                }),
            );
        }

        // Selected products lookup — product id'leri name'e map et
        const allProductIds = Array.from(
            new Set(rows.flatMap((r) => r.selected_product_ids || []).filter(Boolean)),
        );
        const productMap = new Map<string, string>();
        if (allProductIds.length > 0) {
            const { data: prodRows } = await supabase
                .from('products')
                .select('id, name')
                .in('id', allProductIds);
            (prodRows || []).forEach((p: any) => productMap.set(p.id, p.name));
        }

        // Merge
        rows.forEach((r) => {
            r.lead = leadMap.get(r.lead_id) || null;
            r.original_offer_link = offerLinkMap.get(r.original_offer_link_token) || null;
            r.selected_products = (r.selected_product_ids || []).map((id) => ({
                id,
                name: productMap.get(id) || id,
            }));
        });

        return rows;
    },

    /**
     * Bekleyen talep sayısı — sidebar badge için.
     */
    async countPending(): Promise<number> {
        const { count, error } = await supabase
            .from('offer_reclaim_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');
        if (error) throw error;
        return count || 0;
    },

    /**
     * Status güncelleme (approve/reject/fulfilled).
     * fulfilled için new_offer_link_id verilir, fulfilled_at otomatik now() setlenir.
     */
    async updateStatus(
        id: string,
        status: ReclaimStatus,
        opts: { admin_note?: string; new_offer_link_token?: string } = {},
    ): Promise<void> {
        const patch: Record<string, unknown> = { status };
        if (opts.admin_note !== undefined) patch.admin_note = opts.admin_note;
        if (status === 'fulfilled') {
            patch.fulfilled_at = new Date().toISOString();
            if (opts.new_offer_link_token) patch.new_offer_link_token = opts.new_offer_link_token;
        }
        const { error } = await supabase
            .from('offer_reclaim_requests')
            .update(patch)
            .eq('id', id);
        if (error) throw error;
    },
};
