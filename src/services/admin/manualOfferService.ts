import { supabase } from '../../lib/supabase/client';
import { computeOfferExpiry } from './campaignsService';
import { generateOfferShortCode } from './shortCode';
import { generateOfferToken } from '../../utils/offerToken';
import { OfferDisplayPrefs } from '../../lib/offerDisplayPrefs';

export interface ManualOfferItem {
    id: string;
    name: string;
    type: 'product' | 'accessory';
    /** Satış fiyatı (müşteri kartında ana fiyat) */
    price: number;
    /** Liste fiyatı (üstü çizili "oldPrice" — opsiyonel; price'tan büyükse strikethrough render edilir) */
    listPrice?: number;
    quantity: number;
    description?: string;
    image?: string;
    /**
     * Müşteri teklif sayfasının `FinalOfferHero`'su videoyu/zengin görselleri
     * BURADAN okur — normal teklifler item'da tam ürün ("originalItem") taşıdığı
     * için her zaman video gösterir. Manuel teklifte de aynı pariteyi kurmak için
     * oluşturma anında ürünün video + hero görselleri snapshot'a gömülür; böylece
     * müşteri tarafı view-time hydration'a (canlı katalog id eşleşmesine) bağlı
     * kalmadan videoyu garanti gösterir. Bkz. CustomerOffer.tsx originalItem akışı.
     */
    originalItem?: {
        id: string;
        name: string;
        subtitle?: string;
        image?: string;
        description?: string;
        hero_video_url?: string;
        final_offer_video_url?: string;
        pdp_hero_images?: string[];
    };
}

export const AdminManualOfferService = {
    /**
     * Creates an offer link + generated_offer with pre-built cart.
     * campaignId is optional — if omitted, a 7-day default validity is used.
     */
    async createManualOffer(params: {
        leadId: string;
        campaignId?: string;
        token?: string;
        items: ManualOfferItem[];
        note?: string;
        validUntil?: string;
        /** Teklif sayfası görünüm tercihleri (countdown/kontenjan/ROI).
         *  Yoksa müşteri tarafı kampanya+sepetten otomatik türetir. */
        display?: OfferDisplayPrefs;
    }): Promise<{ token: string; offerId: string; shortCode: string }> {
        // 1. Get lead info
        const { data: lead } = await supabase
            .from('leads')
            .select('id, customer_name, company_name')
            .eq('id', params.leadId)
            .single();

        if (!lead) throw new Error('Müşteri bulunamadı.');

        // 2. Compute validity from campaign's max_offer_validity_days
        let validUntil: string;
        if (params.campaignId) {
            const { data: campaign } = await supabase
                .from('campaigns')
                .select('valid_until, max_offer_validity_days, offer_cannot_exceed_campaign_end')
                .eq('id', params.campaignId)
                .single();

            if (campaign) {
                const expiry = computeOfferExpiry(campaign, new Date());
                validUntil = expiry.toISOString();
            } else {
                validUntil = new Date(Date.now() + 7 * 86400000).toISOString();
            }
        } else if (params.validUntil) {
            validUntil = params.validUntil;
        } else {
            validUntil = new Date(Date.now() + 7 * 86400000).toISOString();
        }

        // 3. Generate or use provided token
        const token = params.token || generateOfferToken('MNL');
        const shortCode = generateOfferShortCode();

        // 4. Create offer_link
        const { error: linkError } = await supabase
            .from('offer_links')
            .insert([{
                token,
                short_code: shortCode,
                lead_id: params.leadId,
                campaign_id: params.campaignId || null,
                valid_until: validUntil,
                // Müşteri tarafı her iki tarihi de kontrol ediyor — senkron tut.
                expires_at: validUntil,
                is_active: true,
                status: 'active',
                offer_snapshot: (() => {
                    const snapshot: Record<string, unknown> = {};
                    if (params.note) snapshot.admin_note = params.note;
                    if (params.display) snapshot.display = params.display;
                    return Object.keys(snapshot).length > 0 ? snapshot : null;
                })()
            }]);

        if (linkError) throw linkError;

        // 5. Calculate total
        const subtotal = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const total = subtotal * 1.20; // +20% KDV

        // 6. Generate offer number
        const now = new Date();
        const offerNumber = `#MNL-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // 7. Create generated_offer
        const { data: offer, error: offerError } = await supabase
            .from('generated_offers')
            .insert([{
                offer_token: token,
                offer_number: offerNumber,
                customer_name: lead.customer_name,
                company_name: lead.company_name,
                items: params.items,
                total,
                discount_rate: 0,
                selected_reservation: 'credit-card'
            }])
            .select('id')
            .single();

        if (offerError) throw offerError;

        // 8. Log audit + events
        const auth = await supabase.auth.getUser();
        await Promise.all([
            supabase.from('lead_events').insert({
                lead_id: params.leadId,
                event_type: 'offer_created_manual',
                metadata: { token, offer_id: offer.id, note: params.note }
            }),
            auth.data.user ? supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'CREATE',
                entity_type: 'MANUAL_OFFER',
                entity_id: offer.id,
                new_values: { token, items: params.items, total }
            }) : Promise.resolve()
        ]);

        return { token, offerId: offer.id, shortCode };
    },

    /**
     * Refreshes an EXISTING offer link in-place instead of creating a new one.
     * Süresi dolmuş bir teklif linkini "tazeler": aynı token korunur,
     * validity uzatılır + tekrar aktifleştirilir ve aynı token altına yeni bir
     * generated_offer eklenir. Böylece müşteri başına TEK link kalır, eski
     * "süreniz doldu" linki anında canlı yeni teklife dönüşür.
     *
     * Reclaim akışında "Yeni Teklif Hazırla" buradan çağrılır.
     */
    async refreshOffer(params: {
        token: string;
        leadId: string;
        campaignId?: string;
        items: ManualOfferItem[];
        note?: string;
        validUntil?: string;
        /** Teklif sayfası görünüm tercihleri — verilirse snapshot'a merge edilir,
         *  verilmezse önceki değer korunur. */
        display?: OfferDisplayPrefs;
    }): Promise<{ token: string; offerId: string; shortCode: string }> {
        const token = params.token;

        // 1. Get lead info
        const { data: lead } = await supabase
            .from('leads')
            .select('id, customer_name, company_name')
            .eq('id', params.leadId)
            .single();
        if (!lead) throw new Error('Müşteri bulunamadı.');

        // 2. Mevcut offer_link'i çek — token gerçekten var mı + short_code'u al.
        const { data: existingLink, error: linkFetchError } = await supabase
            .from('offer_links')
            .select('token, short_code, offer_snapshot')
            .eq('token', token)
            .single();
        if (linkFetchError || !existingLink) {
            throw new Error('Yenilenecek teklif linki bulunamadı.');
        }

        // 3. Yeni validity hesapla (createManualOffer ile aynı kurallar)
        let validUntil: string;
        if (params.campaignId) {
            const { data: campaign } = await supabase
                .from('campaigns')
                .select('valid_until, max_offer_validity_days, offer_cannot_exceed_campaign_end')
                .eq('id', params.campaignId)
                .single();
            validUntil = campaign
                ? computeOfferExpiry(campaign, new Date()).toISOString()
                : new Date(Date.now() + 7 * 86400000).toISOString();
        } else if (params.validUntil) {
            validUntil = params.validUntil;
        } else {
            validUntil = new Date(Date.now() + 7 * 86400000).toISOString();
        }

        // 4. offer_link'i TAZELE — yeni satır INSERT etme, mevcut token'ı güncelle.
        const snapshot = (params.note || params.display)
            ? {
                ...(existingLink.offer_snapshot || {}),
                ...(params.note ? { admin_note: params.note } : {}),
                ...(params.display ? { display: params.display } : {}),
            }
            : existingLink.offer_snapshot || null;
        const linkPatch: Record<string, unknown> = {
            valid_until: validUntil,
            // Müşteri tarafı expired kararında expires_at'ı önce kontrol ediyor
            // (offerContext.ts). Sadece valid_until tazelenirse eski expires_at
            // kalır ve yenilenen teklif "süresi doldu" görünür. extendOfferExpiry
            // ile aynı pattern — iki alan da senkron tutulur.
            expires_at: validUntil,
            is_active: true,
            status: 'active',
            offer_snapshot: snapshot,
        };
        if (params.campaignId) linkPatch.campaign_id = params.campaignId;
        const { error: linkError } = await supabase
            .from('offer_links')
            .update(linkPatch)
            .eq('token', token);
        if (linkError) throw linkError;

        // 5. Calculate total
        const subtotal = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const total = subtotal * 1.20; // +20% KDV

        // 6. Generate offer number
        const now = new Date();
        const offerNumber = `#MNL-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // 7. Aynı token altına yeni generated_offer ekle (geçmiş korunur, en yeni gösterilir)
        const { data: offer, error: offerError } = await supabase
            .from('generated_offers')
            .insert([{
                offer_token: token,
                offer_number: offerNumber,
                customer_name: lead.customer_name,
                company_name: lead.company_name,
                items: params.items,
                total,
                discount_rate: 0,
                selected_reservation: 'credit-card'
            }])
            .select('id')
            .single();
        if (offerError) throw offerError;

        // 8. Log audit + events
        const auth = await supabase.auth.getUser();
        await Promise.all([
            supabase.from('lead_events').insert({
                lead_id: params.leadId,
                event_type: 'offer_renewed',
                metadata: { token, offer_id: offer.id, note: params.note }
            }),
            auth.data.user ? supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'UPDATE',
                entity_type: 'MANUAL_OFFER',
                entity_id: offer.id,
                new_values: { token, items: params.items, total, renewed: true }
            }) : Promise.resolve()
        ]);

        return { token, offerId: offer.id, shortCode: existingLink.short_code || '' };
    }
};
