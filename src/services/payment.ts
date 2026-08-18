/**
 * Payment Integration Service (PayTR Ready)
 * 
 * Stub implementation designed to be replaced by actual API hooks
 * towards payment gateways such as PayTR, iyzico, or bank transfer endpoints.
 */

export interface PaymentInitializationPayload {
    offerId?: string;
    token: string;
    amount: number;
    method: 'credit-card' | 'bank-transfer' | 'pre-payment' | string;
    currency?: string;
    leadId?: string;
    /** Ödeme niyeti: ilk kapora/tam ödeme ('deposit') mı yoksa mevcut bir
     * rezervasyonun kalan tutarı ('remaining') mı. Sunucu tutar korumasını buna
     * göre kapsamlandırır (kalan ödeme, rezervasyonun remaining_amount'una karşı
     * doğrulanır; teklif tam fiyatına karşı değil). */
    paymentType?: 'deposit' | 'remaining';
    /** generated_offers.id (UUID) of the SPECIFIC offer being paid. One offer_token
     * can host multiple offers (Lite + Pro); this disambiguates which one the
     * customer paid so the callback marks the right reservation. */
    offerDbId?: string;
    /** customer_reservations.id of the pending reservation just created for this
     * payment — lets the PayTR callback update the EXACT reservation. */
    reservationId?: string;
    /** Cart snapshot — persisted in payment_transactions so the PayTR callback
     * can recreate a full customer_reservations row (with items) when the
     * frontend insert is skipped or fails. */
    cart?: Array<{ name: string; price: number; quantity: number; image?: string; listPrice?: number }>;
}

export interface PaymentInitializationResponse {
    success: boolean;
    redirectUrl?: string;
    iframeToken?: string;
    errorMessage?: string;
}

export async function initiatePayment(payload: PaymentInitializationPayload): Promise<PaymentInitializationResponse> {
    try {
        const response = await fetch('/api/payments/paytr/init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: payload.token || undefined,
                lead_id: payload.leadId || undefined,
                payment_type: payload.paymentType || 'deposit',
                method: payload.method,
                amount: payload.amount,
                offer_id: payload.offerDbId || undefined,
                reservation_id: payload.reservationId || undefined,
                cart: payload.cart || undefined,
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            return {
                success: false,
                errorMessage: data.error || 'Ödeme altyapısına bağlanılamadı.'
            };
        }

        return {
            success: true,
            iframeToken: data.paytr_token,
            // You can optionally pass back other meta like merchant_oid from data
        };

    } catch (err: any) {
        console.error('[Payment Init Error]', err);
        return {
            success: false,
            errorMessage: 'Bağlantı hatası. Lütfen daha sonra tekrar deneyin.'
        };
    }
}
