import { supabase } from '../../lib/supabase/client';
import { AdminManualOfferService, ManualOfferItem } from './manualOfferService';

/**
 * Manuel Satış Kaydı — offline kapatılan satışları rezervasyona aktarır.
 *
 * Bir satış telefonda/yüz yüze kapatıldığında müşteri teklif sayfasındaki ödeme
 * akışı hiç çalışmaz; dolayısıyla customer_reservations satırı da oluşmaz. Bu
 * servis, online akışın (CustomerOffer.tsx) ürettiği kaydın BİREBİR aynısını
 * admin tarafından üretir; böylece kayıt Siparişler, kargo, Paraşüt faturası,
 * kapora yaşam döngüsü, otomasyon ve ciro hattına doğal olarak dahil olur.
 *
 * Anahtar ayrım: sale_source='manual'. Ciro sorguları ve deposit-followup cron'u
 * bu bayrağa göre manuel satırları ayrı ele alır.
 */

/**
 * Offline tahsilat yöntemi — payment_method'dan ayrı tutulur (bkz. migration notu).
 *
 * Tanımın kendisi lib/reservations/orderStatus.ts'e taşındı: sipariş listesi de
 * bu etiketlere ihtiyaç duyuyor ve saf kural modülünün servise bağlanması
 * yanlış yöndü. Mevcut çağrı yerleri bozulmasın diye buradan yeniden dışa
 * aktarılıyor.
 */
export {
    MANUAL_PAYMENT_METHOD_LABELS,
    type ManualPaymentMethod,
} from '../../lib/reservations/orderStatus';
import type { ManualPaymentMethod } from '../../lib/reservations/orderStatus';

/** Kaydın hangi tahsilat durumunda olduğu. */
export type ManualSaleState = 'paid' | 'deposit_paid';

export interface ManualSaleParams {
    leadId: string;
    items: ManualOfferItem[];
    /** 'paid' = tamamı tahsil edildi, 'deposit_paid' = kapora alındı, kalan bekleniyor. */
    paymentState: ManualSaleState;
    manualPaymentMethod: ManualPaymentMethod;
    /** paymentState='deposit_paid' iken zorunlu. */
    depositAmount?: number;
    /** ISO — varsayılan satış tarihi + 14 gün. */
    priceLockExpiresAt?: string;
    /** ISO — varsayılan satış tarihi + 19 gün. */
    finalDeadlineAt?: string;
    /** Geriye dönük kayıt için satış tarihi (ISO). Varsayılan: şimdi. */
    saleDate?: string;
    note?: string;
    /** Teklif Linkleri satırından çağrıldıysa mevcut teklif zemini kullanılır. */
    existingToken?: string;
    existingOfferId?: string;
    /** Kapora otomasyonuna (deposit-followup cron) dahil edilsin mi. Varsayılan: false. */
    automationOptIn?: boolean;
    /** Yüzde. Varsayılan 20. */
    vatRate?: number;
}

export interface ManualSaleResult {
    reservationId: string;
    token: string;
    offerCode: string | null;
    total: number;
}

const DAY_MS = 86400000;
const DEFAULT_PRICE_LOCK_DAYS = 14;
const DEFAULT_FINAL_DEADLINE_DAYS = 19;

export const AdminManualSaleService = {
    /**
     * Lead'in en son teklifini (generated_offers) döndürür — modal sepeti bununla
     * ön-doldurur. offer_links üzerinden lead'e bağlanır; token verilirse doğrudan
     * o teklif zemini okunur.
     */
    async fetchLatestOffer(leadId: string, token?: string): Promise<{
        token: string;
        offerId: string;
        offerNumber: string | null;
        items: ManualOfferItem[];
        total: number;
    } | null> {
        let offerToken = token;

        if (!offerToken) {
            const { data: links } = await supabase
                .from('offer_links')
                .select('token, created_at')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false })
                .limit(1);
            offerToken = links?.[0]?.token;
        }
        if (!offerToken) return null;

        const { data: offers } = await supabase
            .from('generated_offers')
            .select('id, offer_number, items, total')
            .eq('offer_token', offerToken)
            .order('created_at', { ascending: false })
            .limit(1);

        const offer = offers?.[0];
        if (!offer) return null;

        return {
            token: offerToken,
            offerId: offer.id,
            offerNumber: offer.offer_number || null,
            items: Array.isArray(offer.items) ? (offer.items as ManualOfferItem[]) : [],
            total: Number(offer.total) || 0,
        };
    },

    /**
     * Offline satışı customer_reservations kaydına dönüştürür.
     *
     * Teklif zemini yoksa AdminManualOfferService.createManualOffer ile gerçek bir
     * offer_link + generated_offer üretilir. Bu şart: customer_reservations.offer_token
     * Ödemeler / Tekliflerim / portal ekranlarında offer_links ile eşleştiriliyor;
     * uydurma bir token bu join'leri sessizce kırar.
     */
    async createManualSale(params: ManualSaleParams): Promise<ManualSaleResult> {
        if (!params.leadId) throw new Error('Müşteri seçilmedi.');
        if (!params.items.length) throw new Error('En az bir ürün eklemelisiniz.');

        const vatRate = params.vatRate ?? 20;
        const saleDate = params.saleDate ? new Date(params.saleDate) : new Date();
        const saleDateIso = saleDate.toISOString();

        // 1) Tutarlar — CustomerOffer.tsx ödeme akışıyla aynı formül.
        const subtotal = params.items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
        const vat = subtotal * (vatRate / 100);
        const total = subtotal + vat;

        const isDeposit = params.paymentState === 'deposit_paid';
        const depositAmount = isDeposit ? Math.round(Number(params.depositAmount) || 0) : 0;
        if (isDeposit && depositAmount <= 0) throw new Error('Kapora tutarı girilmedi.');
        if (isDeposit && depositAmount > total) throw new Error('Kapora tutarı toplam tutardan büyük olamaz.');
        const remainingAmount = isDeposit ? total - depositAmount : 0;

        // 2) Teklif zemini — mevcut varsa kullan, yoksa standart manuel teklif üret.
        const { data: lead } = await supabase
            .from('leads')
            .select('id, customer_name, company_name')
            .eq('id', params.leadId)
            .single();
        if (!lead) throw new Error('Müşteri bulunamadı.');

        let token = params.existingToken || '';
        let generatedOfferId = params.existingOfferId || '';
        let offerCode: string | null = null;

        if (token) {
            const { data: offers } = await supabase
                .from('generated_offers')
                .select('id, offer_number')
                .eq('offer_token', token)
                .order('created_at', { ascending: false })
                .limit(1);
            const offer = offers?.[0];
            if (offer) {
                generatedOfferId = generatedOfferId || offer.id;
                offerCode = offer.offer_number || null;
            }
        }

        if (!token) {
            const created = await AdminManualOfferService.createManualOffer({
                leadId: params.leadId,
                items: params.items,
                note: params.note
                    ? `Manuel satış kaydı: ${params.note}`
                    : 'Manuel satış kaydı için otomatik oluşturuldu.',
            });
            token = created.token;
            generatedOfferId = created.offerId;
            const { data: newOffer } = await supabase
                .from('generated_offers')
                .select('offer_number')
                .eq('id', created.offerId)
                .maybeSingle();
            offerCode = newOffer?.offer_number || null;
        }

        // 3) Rezervasyon — online akışla aynı alan seti + manuel bayrakları.
        //    payment_method mevcut UI etiketlerini besliyor; kapora → 'pre-payment',
        //    tam ödeme → offline yönteme en yakın mevcut değer.
        const paymentMethod = isDeposit
            ? 'pre-payment'
            : params.manualPaymentMethod === 'card-offline'
                ? 'credit-card'
                : 'bank-transfer';

        const priceLockExpires = isDeposit
            ? (params.priceLockExpiresAt || new Date(saleDate.getTime() + DEFAULT_PRICE_LOCK_DAYS * DAY_MS).toISOString())
            : null;
        const finalDeadline = isDeposit
            ? (params.finalDeadlineAt || new Date(saleDate.getTime() + DEFAULT_FINAL_DEADLINE_DAYS * DAY_MS).toISOString())
            : null;

        const auth = await supabase.auth.getUser();
        const adminId = auth.data.user?.id ?? null;

        const { data: reservation, error: resError } = await supabase
            .from('customer_reservations')
            .insert({
                offer_token: token,
                lead_id: params.leadId,
                generated_offer_id: generatedOfferId || null,
                offer_code: offerCode,
                customer_name: lead.customer_name,
                company_name: lead.company_name,
                payment_method: paymentMethod,
                items: params.items.map(it => ({
                    name: it.name,
                    price: it.price,
                    quantity: it.quantity,
                    listPrice: it.listPrice,
                    image: it.image,
                })),
                subtotal,
                discount: 0,
                vat,
                total,
                status: params.paymentState,
                deposit_amount: depositAmount,
                // Tam ödemede de damgalanır: Ödemeler ekranı ve kapora widget'ları
                // tahsilat anını bu alandan okuyor.
                deposit_paid_at: saleDateIso,
                remaining_amount: remainingAmount,
                original_total: total,
                price_lock_expires_at: priceLockExpires,
                final_deadline_at: finalDeadline,
                sale_source: 'manual',
                manual_payment_method: params.manualPaymentMethod,
                manual_note: params.note || null,
                manual_automation_opt_in: isDeposit ? !!params.automationOptIn : false,
                created_by: adminId,
                created_at: saleDateIso,
            })
            .select('id')
            .single();

        if (resError) throw resError;
        const reservationId = reservation.id as string;

        // 4–7) Yan etkiler — hiçbiri rezervasyonun oluşmasını engellememeli.
        await Promise.all([
            // Teklifi rezervasyona bağla; yapılmazsa "Tekliflerim" sonsuza dek
            // "Aktif Teklif" gösterir (PayTR callback de aynısını yapıyor).
            generatedOfferId
                ? supabase.from('generated_offers')
                    .update({ selected_reservation: reservationId })
                    .eq('id', generatedOfferId)
                    .then(undefined, () => null)
                : Promise.resolve(),

            supabase.from('leads')
                .update({
                    status: 'won',
                    status_source: 'manual',
                    customer_type: 'customer',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', params.leadId)
                .then(undefined, () => null),

            // Otomasyon tetikleyicileri — automationRulesService'teki isimlerle birebir.
            supabase.from('lead_events').insert([
                {
                    lead_id: params.leadId,
                    token,
                    event_type: isDeposit ? 'reservation_created' : 'reservation_paid',
                    metadata: { reservation_id: reservationId, amount: isDeposit ? depositAmount : total, manual: true },
                },
                {
                    lead_id: params.leadId,
                    token,
                    event_type: 'manual_sale_recorded',
                    metadata: {
                        reservation_id: reservationId,
                        total,
                        deposit_amount: depositAmount,
                        payment_state: params.paymentState,
                        manual_payment_method: params.manualPaymentMethod,
                        by: adminId,
                        note: params.note || null,
                    },
                },
            ]).then(undefined, () => null),

            adminId
                ? supabase.from('audit_logs').insert({
                    user_id: adminId,
                    action_type: 'CREATE',
                    entity_type: 'MANUAL_SALE',
                    entity_id: reservationId,
                    new_values: {
                        token,
                        lead_id: params.leadId,
                        status: params.paymentState,
                        total,
                        deposit_amount: depositAmount,
                        manual_payment_method: params.manualPaymentMethod,
                    },
                }).then(undefined, () => null)
                : Promise.resolve(),
        ]);

        return { reservationId, token, offerCode, total };
    },
};
