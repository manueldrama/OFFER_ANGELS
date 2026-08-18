import { supabase } from '../../lib/supabase/client';

/**
 * DİKKAT: Bu arayüz payment_transactions'ın GERÇEK şemasını yansıtır.
 * Eskiden burada DB'de hiç var olmayan alanlar (merchant_oid, offer_link_id,
 * provider, request_payload, error_message) tanımlıydı; select('*') onları
 * döndürmediği için hepsi runtime'da undefined geliyordu ve Payments.tsx'teki
 * hata rozeti hiçbir zaman render olmuyordu. Yeni alan eklerken önce migration
 * yazın — arayüze eklemek kolonu var etmez.
 */
export interface PaymentTransactionWithDetails {
    id: string;
    lead_id: string | null;
    token: string;
    amount: number;
    currency: string;
    status: 'initiated' | 'pending' | 'success' | 'failed' | 'refunded';
    payment_method: string | null;
    provider_transaction_id: string | null;
    generated_offer_id: string | null;
    reservation_id: string | null;
    cart_snapshot: any;
    created_at: string;
    updated_at: string;
    // ── Teşhis alanları (20260814_payment_failure_diagnostics) ──────────────
    /** PayTR ham failed_reason_code — etiketleme src/lib/paymentFailure.ts'te. */
    failure_code: string | null;
    /** PayTR ham failed_reason_msg (Türkçe). */
    failure_message: string | null;
    /** Callback'in hash'siz ham gövdesi. */
    callback_payload: any;
    test_mode: boolean | null;
    paid_at: string | null;
    leads?: {
        customer_name: string;
        phone_number: string;
    };
    offer_links?: {
        token: string;
    };
    // Havale ve manuel satış satırları payment_transactions'ta yaşamaz;
    // customer_reservations'tan sentetik olarak üretilir. UI bu bayrakla silme
    // butonunu ve detay çekmecesini gizler (gerçek bir transaction kaydı yok).
    is_bank_transfer?: boolean;
    /** Yalnızca sentetik satırlarda dolu — DB kolonu DEĞİL. */
    provider?: string;
}

/** Ağ geçidi arıza günlüğü satırı (payment_gateway_events). */
export interface PaymentGatewayEvent {
    id: string;
    created_at: string;
    provider: string;
    kind: string;
    severity: 'error' | 'warning';
    merchant_oid: string | null;
    lead_id: string | null;
    token: string | null;
    http_status: number | null;
    message: string | null;
    payload: any;
}

export interface PaymentTimelineEvent {
    id: string;
    event_type: string;
    metadata: any;
    created_at: string;
}

export interface PaymentDetailBundle {
    transaction: PaymentTransactionWithDetails;
    /** Ödemenin lead zaman çizelgesindeki izleri. */
    timeline: PaymentTimelineEvent[];
    /** Bu ödemeyle eşleşen sistem arızaları. */
    gatewayEvents: PaymentGatewayEvent[];
}

export const AdminPaymentsService = {
    // 1) List Payments with advanced filtering
    async listPayments({
        status = 'all',
        currency = 'all',
        page = 1,
        limit = 20
    }: {
        status?: string;
        currency?: string;
        page?: number;
        limit?: number;
    }) {
        // 1) Kart / PayTR işlemleri (payment_transactions).
        let query = supabase
            .from('payment_transactions')
            .select(`
        *,
        leads ( customer_name, phone_number ),
        offer_links ( token )
      `);

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (currency && currency !== 'all') {
            query = query.eq('currency', currency);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('[AdminPaymentsService]', error);
            throw error;
        }

        let rows = (data as unknown as PaymentTransactionWithDetails[]) || [];

        // 2) Onaylanmış havaleler: payment_transactions'a yazılmadıkları için ayrı
        //    customer_reservations tablosundan çekip sentetik "success" satırı olarak
        //    listeye katıyoruz. Havale daima TRY; sadece onaylanmış statüler sayılır.
        //    Bu yüzden yalnızca status filtresi 'all'/'success' ve currency 'all'/'TRY'
        //    iken dahil edilirler.
        const includeBank =
            (status === 'all' || status === 'success') &&
            (currency === 'all' || currency === 'TRY');
        if (includeBank) {
            // Havale (online) + manuel (offline) satışlar — ikisi de sentetik satır.
            // Manuel satışlarda kapora aşamasındaysa tahsil edilen tutar kapora,
            // tamamlanmışsa toplam tutardır (dashboardReportingService ile aynı kural).
            const [bankRes, manualRes] = await Promise.all([
                supabase
                    .from('customer_reservations')
                    .select('id, offer_token, offer_code, customer_name, original_total, updated_total, created_at, updated_at')
                    .eq('payment_method', 'bank-transfer')
                    .eq('sale_source', 'online')
                    .in('status', ['deposit_paid', 'confirmed', 'paid', 'fully_paid', 'shipped', 'delivered'])
                    .order('created_at', { ascending: false }),
                supabase
                    .from('customer_reservations')
                    .select('id, offer_token, offer_code, customer_name, status, deposit_amount, original_total, updated_total, manual_payment_method, created_at, updated_at')
                    .eq('sale_source', 'manual')
                    .in('status', ['deposit_paid', 'paid', 'fully_paid', 'shipped', 'delivered'])
                    .order('created_at', { ascending: false }),
            ]);

            const synth = (r: any, provider: string, methodLabel: string, amount: number) => ({
                id: `res-${r.id}`,
                lead_id: null,
                provider,
                token: r.offer_token || '',
                amount,
                currency: 'TRY',
                status: 'success' as const,
                payment_method: methodLabel,
                provider_transaction_id: r.offer_code || null,
                generated_offer_id: null,
                reservation_id: r.id,
                cart_snapshot: null,
                created_at: r.created_at,
                updated_at: r.updated_at || r.created_at,
                // Sentetik satırlar hep başarılıdır — teşhis alanları boş.
                failure_code: null,
                failure_message: null,
                callback_payload: null,
                test_mode: false,
                paid_at: r.updated_at || r.created_at,
                leads: { customer_name: r.customer_name || 'İsimsiz Müşteri', phone_number: '' },
                offer_links: { token: r.offer_token || '' },
                is_bank_transfer: true,
            }) as unknown as PaymentTransactionWithDetails;

            if (bankRes.error) {
                console.error('[AdminPaymentsService] bank-transfer', bankRes.error);
            } else {
                rows = rows.concat((bankRes.data || []).map((r: any) =>
                    synth(r, 'bank-transfer', 'Havale / EFT', Number(r.updated_total) || Number(r.original_total) || 0)
                ));
            }

            if (manualRes.error) {
                console.error('[AdminPaymentsService] manual-sale', manualRes.error);
            } else {
                rows = rows.concat((manualRes.data || []).map((r: any) => {
                    const amount = r.status === 'deposit_paid'
                        ? Number(r.deposit_amount) || 0
                        : Number(r.updated_total) || Number(r.original_total) || 0;
                    const label = r.status === 'deposit_paid' ? 'Manuel Satış (Kapora)' : 'Manuel Satış';
                    return synth(r, 'manual', label, amount);
                }));
            }
        }

        // 3) İki kaynağı tarihe göre birleşik sırala, sayfayı bellekte dilimle.
        rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const count = rows.length;
        const from = (page - 1) * limit;
        const params = rows.slice(from, from + limit);

        return { params, count };
    },

    // 2) Tek bir ödemenin tam teşhis paketi: işlem + zaman çizelgesi + sistem arızaları.
    //    Detay çekmecesi bunu kullanır — "neden başarısız oldu" sorusunun cevabı
    //    üç kaynağa dağılmış durumda:
    //      a) payment_transactions.failure_* → PayTR'ın bildirdiği sebep
    //      b) lead_events                    → ödemenin akış izi (başladı/bitti)
    //      c) payment_gateway_events         → BİZİM taraftaki arızalar
    async getPaymentDetail(id: string): Promise<PaymentDetailBundle> {
        const { data, error } = await supabase
            .from('payment_transactions')
            .select(`
         *,
         leads ( customer_name, phone_number ),
         offer_links ( token )
       `)
            .eq('id', id)
            .single();

        if (error) throw error;
        const transaction = data as unknown as PaymentTransactionWithDetails;

        const merchantOid = transaction.provider_transaction_id;

        // Zaman çizelgesi: bu lead'in ödeme ile ilgili olayları. merchant_oid
        // metadata içinde yaşadığı için SQL tarafında filtrelenemiyor; lead
        // bazında çekip bellekte bu ödemeye ait olanları ayıklıyoruz.
        const [eventsRes, gatewayRes] = await Promise.all([
            transaction.lead_id
                ? supabase
                    .from('lead_events')
                    .select('id, event_type, metadata, created_at')
                    .eq('lead_id', transaction.lead_id)
                    .in('event_type', [
                        'payment_started', 'payment_completed', 'payment_failed',
                        'reservation_created', 'reservation_paid', 'reservation_recovery_insert',
                    ])
                    .order('created_at', { ascending: true })
                : Promise.resolve({ data: [], error: null } as any),
            merchantOid
                ? supabase
                    .from('payment_gateway_events')
                    .select('*')
                    .eq('merchant_oid', merchantOid)
                    .order('created_at', { ascending: false })
                : Promise.resolve({ data: [], error: null } as any),
        ]);

        if (eventsRes.error) console.error('[AdminPaymentsService] timeline', eventsRes.error);
        if (gatewayRes.error) console.error('[AdminPaymentsService] gateway events', gatewayRes.error);

        const allEvents = (eventsRes.data || []) as PaymentTimelineEvent[];
        // Aynı lead'in birden çok ödeme denemesi olabilir; sadece bu merchant_oid'e
        // ait olayları göster. merchant_oid taşımayan olaylar (rezervasyon
        // olayları eski kayıtlarda) elenmesin diye onları da bırakıyoruz.
        const timeline = merchantOid
            ? allEvents.filter(e => {
                const oid = e.metadata?.merchant_oid;
                return !oid || oid === merchantOid;
            })
            : allEvents;

        return {
            transaction,
            timeline,
            gatewayEvents: (gatewayRes.data || []) as PaymentGatewayEvent[],
        };
    },

    // 2b) İşleme bağlanamayan sistem arızaları — hiçbir payment_transactions
    // satırı üretmeyen init reddi gibi vakalar buradan görünür.
    async listRecentGatewayEvents(limit = 50): Promise<PaymentGatewayEvent[]> {
        const { data, error } = await supabase
            .from('payment_gateway_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return (data || []) as PaymentGatewayEvent[];
    },

    // 3) Delete a single payment transaction
    async deletePayment(id: string) {
        const { error } = await supabase
            .from('payment_transactions')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // 4) Preview how many stale (status='initiated' or 'failed') rows would be deleted.
    // 'initiated' = PayTR iframe açılmış, kullanıcı tamamlamamış (abandoned).
    // 'failed' = ödeme denemesi başarısız sonuçlanmış.
    // 'success' kayıtlar bu silmenin dışında kalır; tek tek satır ikonundan silinir.
    async getStalePaymentsCount(): Promise<{ initiated: number; failed: number; total: number }> {
        const [initRes, failRes] = await Promise.all([
            supabase.from('payment_transactions').select('id', { count: 'exact', head: true }).eq('status', 'initiated'),
            supabase.from('payment_transactions').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        ]);
        if (initRes.error) throw initRes.error;
        if (failRes.error) throw failRes.error;
        const initiated = initRes.count || 0;
        const failed = failRes.count || 0;
        return { initiated, failed, total: initiated + failed };
    },

    // 5) Bulk delete stale payments (initiated + failed).
    async deleteStalePayments(): Promise<number> {
        const { data, error } = await supabase
            .from('payment_transactions')
            .delete()
            .in('status', ['initiated', 'failed'])
            .select('id');
        if (error) throw error;
        return (data || []).length;
    },
};
