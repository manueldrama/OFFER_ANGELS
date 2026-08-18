import { supabase } from '../lib/supabase/client';
import { findOrCreateLeadByPhone, normalizePhone } from './leadDedup';
import { getLeadAttribution, pushClarityIdentity } from './analyticsService';
import { computeOfferExpiry, isCampaignUsable } from '../lib/offerExpiry';
import { generateOfferToken, randomToken } from '../utils/offerToken';

export const GuestService = {
    // Generate a guest token
    startGuestSession(): string {
        return `guest_${randomToken(8)}`;
    },

    // Upgrade guest session to a real offer link
    async upgradeGuestSession(guestToken: string, leadData: {
        fullName: string;
        phone: string;
        companyName?: string;
        businessType?: string;
        countryCode?: string;
        languageCode?: string;
        phonePrefix?: string;
    }): Promise<{ success: boolean; token?: string; error?: string; existingCustomer?: boolean; customerName?: string; isReclaim?: boolean; isPendingReview?: boolean }> {
        try {
            // 1. Build E.164 phone from user-selected prefix + local digits.
            // Works the same for every market (TR/DE/FR/US/SA/AE/...): the
            // prefix the customer picked in the form is the authoritative
            // dial code. Strip any leading 0 from the local portion (common
            // domestic-form input like "0555...") and drop a duplicate prefix
            // if the user typed it themselves (e.g. "+49 5544..." with +49
            // already selected).
            const localDigits = (() => {
                let digits = leadData.phone.replace(/\D/g, '');
                if (!digits) return '';
                // If user pasted their own prefix, peel it off so we don't double it.
                if (leadData.phonePrefix) {
                    const prefixDigits = leadData.phonePrefix.replace(/\D/g, '');
                    if (prefixDigits && digits.startsWith(prefixDigits) && digits.length > prefixDigits.length) {
                        digits = digits.slice(prefixDigits.length);
                    }
                }
                // Trim a leading 0 commonly used in domestic notation (TR/DE/FR/...).
                if (digits.startsWith('0')) {
                    digits = digits.replace(/^0+/, '');
                }
                return digits;
            })();
            if (!localDigits) {
                return { success: false, error: 'Geçersiz telefon numarası.' };
            }
            const effectivePrefix = leadData.phonePrefix || '+90';
            const e164Phone = `${effectivePrefix}${localDigits}`;
            const phone_normalized = normalizePhone(e164Phone);
            if (!phone_normalized) {
                return { success: false, error: 'Geçersiz telefon numarası.' };
            }

            // 2. Check if blocked
            const { count: blockedCount } = await supabase
                .from('blocked_contacts')
                .select('*', { count: 'exact', head: true })
                .or(`phone_number.eq.${e164Phone},phone_number.eq.+${phone_normalized},phone_number.eq.${phone_normalized}`);

            if ((blockedCount ?? 0) > 0) {
                return { success: false, error: 'Erişim engellendi. Girdiğiniz numara kara listede bulunuyor.' };
            }

            // 3. Resolve geo + UTM attribution (best-effort; null if tracker
            //    didn't run yet, e.g. very fast bot or disabled JS).
            const attribution = await getLeadAttribution().catch(() => null);

            // 4. Find or create lead by normalized phone. We persist phone_number
            // in E.164 (+<prefix><digits>) so downstream WhatsApp/Meta calls
            // can derive the correct international dial code by simply stripping
            // non-digits.
            const { lead, isExisting } = await findOrCreateLeadByPhone({
                phone: e164Phone,
                customer_name: leadData.fullName,
                company_name: leadData.companyName,
                business_type: leadData.businessType || null,
                source: 'Landing Page Flow (Cold)',
                country_code: leadData.countryCode || null,
                language_code: leadData.languageCode || null,
                attribution: attribution || undefined,
            });

            const leadId = lead.id;

            // "İlgilenmiyor" işaretli lead geri geldi: OTOMATİK teklif verme. Ne aktif
            // link döndür ne de canlı teklif bas — link'i pending_review (admin onayı)
            // olarak aç; admin görüp yeni kampanyayla teklif verilsin mi karar versin.
            const notInterested = lead.not_interested === true;

            // Meta CAPI server-side eşleştirme için lead'i sunucuda damgala:
            // gerçek IP (CF-Connecting-IP) + user-agent + fbp/fbc. Tarayıcı geo
            // yazımı anon RLS'e takıldığından IP burada güvenilir alınır.
            // Best-effort, non-blocking — lead akışına sıfır risk.
            void fetch('/api/lead/stamp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: leadId,
                    visitor_id: attribution?.visitor_id || undefined,
                    fbp: attribution?.fbp || undefined,
                    fbc: attribution?.fbc || undefined,
                    fbclid: attribution?.fbclid || undefined,
                }),
            }).catch(() => undefined);

            // Link the visitor to the lead (only on new leads; existing leads
            // already had a visitor_id from a prior conversion).
            if (!isExisting && attribution?.visitor_id) {
                void supabase
                    .from('visitors')
                    .update({ lead_id: leadId })
                    .eq('visitor_id', attribution.visitor_id)
                    .then(() => undefined);
            }

            // Clarity'ye lead_id tag'i gonder — bu sayede admin dashboard'da
            // o lead'in session replay'ini filtre ile bulabilir.
            pushClarityIdentity({ lead_id: leadId });

            if (isExisting) {
                // Mevcut müşteri: aktif/geçerli teklif linki varsa onu döndür
                const { data: activeLink } = await supabase
                    .from('offer_links')
                    .select('token, valid_until')
                    .eq('lead_id', leadId)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!notInterested && activeLink && activeLink.valid_until && new Date(activeLink.valid_until) > new Date()) {
                    return { success: true, token: activeLink.token, existingCustomer: true, customerName: lead.customer_name };
                }

                // Aktif yok — ama önceki teklif(leri) süresi dolmuşsa otomatik yeni
                // teklif yaratmıyoruz. Yerine reclaim akışına yönlendiriyoruz:
                // müşteri admin onayı şart, çünkü stok/fiyat/lansman değişmiş olabilir.
                const { data: latestLink } = await supabase
                    .from('offer_links')
                    .select('token')
                    .eq('lead_id', leadId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (latestLink?.token) {
                    return {
                        success: true,
                        token: latestLink.token,
                        existingCustomer: true,
                        isReclaim: true,
                        customerName: lead.customer_name,
                    };
                }
                // Lead var ama hiç teklif kaydı yok → aşağıda yeni offer_link oluştur
            } else {
                // Yeni lead: round-robin satış temsilcisi ataması
                const { data: salesUsers } = await supabase
                    .from('sales_users')
                    .select('id, last_assigned_at')
                    .eq('role', 'sales_admin')
                    .eq('is_active', true)
                    .order('last_assigned_at', { ascending: true, nullsFirst: true })
                    .limit(1);

                if (salesUsers && salesUsers.length > 0) {
                    const nextRep = salesUsers[0];
                    await supabase.from('leads').update({
                        assigned_to: nextRep.id,
                        assigned_at: new Date().toISOString()
                    }).eq('id', leadId);

                    await supabase.from('sales_users').update({
                        last_assigned_at: new Date().toISOString()
                    }).eq('id', nextRep.id);

                    console.log(`[GuestService] Round-robin assigned lead ${leadId} to ${nextRep.id}`);
                }
            }

            // 3. Find active campaign
            const { data: activeCampaign } = await supabase
                .from('campaigns')
                .select('id, valid_until, max_offer_validity_days, offer_cannot_exceed_campaign_end')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            // 4. Generate a real token
            const realToken = generateOfferToken('WEB');

            // 5. Kampanya kullanılabilir mi? (var + pasif değil + tarihi geçmemiş)
            //    • Kullanılabilir → normal CANLI teklif: süre = created_at +
            //      max_offer_validity_days (kampanya bitişiyle cap'lenir).
            //    • Kullanılabilir DEĞİL (yok / süresi dolmuş) → güncel fiyat/parti
            //      şartı yok. Otomatik teklif basmak yerine link'i 'pending_review'
            //      olarak açıp lead'i admin ONAY (reclaim) akışına yönlendiriyoruz.
            //      Sessiz "born-expired" YOK; müşteri "teklifiniz hazırlanıyor"
            //      ekranını görür, admin paneli de kampanya uyarısı + bekleyen talep.
            const now = new Date();
            // not_interested lead → kampanya uygun olsa bile pending_review'a düşür.
            const campaignUsable = isCampaignUsable(activeCampaign, now) && !notInterested;
            const validUntil = campaignUsable ? computeOfferExpiry(activeCampaign!, now) : null;

            // 6. Create the offer link in DB with campaign + A/B variant + market lock
            const variantId = localStorage.getItem('cafepaste_variant_id') || null;
            // Map countryCode → its market for downstream pricing/payment lookup.
            const COUNTRY_TO_MARKET: Record<string, string> = {
                TR: 'TR', GB: 'GB', US: 'US', SA: 'SA', AE: 'AE',
                DE: 'EU', FR: 'EU', IT: 'EU', ES: 'EU', NL: 'EU', BE: 'EU', AT: 'EU',
                PT: 'EU', IE: 'EU', GR: 'EU', FI: 'EU', PL: 'EU', CZ: 'EU', HU: 'EU',
                RO: 'EU', BG: 'EU', SE: 'EU', DK: 'EU', NO: 'EU', CH: 'EU',
            };
            const linkCountry = leadData.countryCode || null;
            const linkMarket = linkCountry ? (COUNTRY_TO_MARKET[linkCountry] || null) : null;
            const { error: linkError } = await supabase
                .from('offer_links')
                .insert([{
                    token: realToken,
                    lead_id: leadId,
                    is_active: true,
                    valid_until: validUntil ? validUntil.toISOString() : null,
                    status: campaignUsable ? 'active' : 'pending_review',
                    campaign_id: activeCampaign?.id || null,
                    variant_id: variantId,
                    country_code: linkCountry,
                    market_code: linkMarket,
                    language_code: leadData.languageCode || null,
                }]);

            if (linkError) {
                console.error('[GuestService] Error creating offer link', linkError);
                return { success: false, error: 'Offer link creation failed' };
            }

            // Kampanya yoksa/süresi geçmişse: onay akışına yönlendir (isReclaim).
            if (!campaignUsable) {
                return {
                    success: true,
                    token: realToken,
                    isReclaim: true,
                    isPendingReview: true,
                    customerName: lead.customer_name,
                };
            }

            return { success: true, token: realToken };

        } catch (err: any) {
            console.error('[GuestService] Upgrade exception', err);
            return { success: false, error: err.message || 'Unknown error' };
        }
    }
};
