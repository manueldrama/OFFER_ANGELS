// Ciro atfı — "bir satış hangi temsilcinin, hangi para biriminde, ne kadar
// cirosudur" sorusunun TEK doğruluk kaynağı.
//
// NEDEN AYRI MODÜL: Aynı hesap hem KPI (Faz 2) hem prim (Faz 3) tarafından
// kullanılır. İki yerde ayrı yazılsaydı prim tabanı raporlardan sapardı.
// Kural kümesi src/services/admin/dashboardReportingService.ts:50-95'ten
// devralınmıştır; oradaki çift sayım tuzakları burada da geçerlidir.
//
// ÇİFT SAYIM KURALLARI (dördü birbirini dışlar):
//   1) Kart          → payment_transactions.status = 'success', tam tutar
//   2) Havale        → customer_reservations: bank-transfer + online + kapanmış
//                      statü → tam tutar (bunlar payment_transactions'a düşmez)
//   3) Ön ödeme kalanı→ bank-transfer DIŞI + online + remaining_amount > 0 +
//                      tamamlanmış statü → SADECE remaining_amount
//                      (kapora zaten payment_transactions'ta sayıldı)
//   4) Manuel satış  → sale_source='manual' → kaporadaysa deposit_amount,
//                      tamamlandıysa tam tutar
//
// PARA BİRİMİ TUZAĞI: customer_reservations tablosunda currency kolonu YOKTUR.
// Para birimi generated_offers.currency'de, offer_token üzerinden bağlıdır.
// Çözülemezse 'TRY' varsayılır — bu varsayım raporda görünür kalmalı.

export const BANK_CLOSED_STATUSES = [
    'deposit_paid', 'confirmed', 'paid', 'fully_paid', 'shipped', 'delivered',
] as const;

export const PREPAID_COMPLETED_STATUSES = ['fully_paid', 'shipped', 'delivered'] as const;

export const MANUAL_COUNTED_STATUSES = [
    'deposit_paid', 'paid', 'fully_paid', 'shipped', 'delivered',
] as const;

const MANUAL_FULL_STATUSES = new Set(['fully_paid', 'shipped', 'delivered', 'paid']);

export interface PaymentRow {
    lead_id: string | null;
    /** Satış anında dondurulan temsilci (20260818f). Doluysa atfın tek kaynağıdır. */
    sales_rep_id?: string | null;
    amount: number | null;
    currency: string | null;
    status: string | null;
}

export interface ReservationRow {
    lead_id: string | null;
    sales_rep_id?: string | null;
    offer_token: string | null;
    payment_method: string | null;
    sale_source: string | null;
    status: string | null;
    original_total: number | null;
    updated_total: number | null;
    remaining_amount: number | null;
    deposit_amount: number | null;
}

/** Bir satışın tutarı: güncellenmiş toplam varsa o, yoksa ilk toplam. */
function reservationTotal(r: ReservationRow): number {
    return Number(r.updated_total ?? r.original_total ?? 0);
}

export interface RevenueBucket {
    /** Para birimi → tutar. Kur dönüşümü YAPILMAZ. */
    byCurrency: Map<string, number>;
    /** Ciroya katkı veren ayrı satış (sipariş/işlem) sayısı. */
    dealCount: number;
}

function add(bucket: RevenueBucket, currency: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const cur = (currency || 'TRY').toUpperCase();
    bucket.byCurrency.set(cur, (bucket.byCurrency.get(cur) ?? 0) + amount);
    bucket.dealCount += 1;
}

export interface AttributionInput {
    payments: PaymentRow[];
    reservations: ReservationRow[];
    /** offer_token → currency (generated_offers'tan). Eksikse 'TRY' varsayılır. */
    currencyByToken: Map<string, string>;
    /** Sayılacak lead kümesi. Verilmezse tümü sayılır. */
    leadIds?: Set<string>;
    /**
     * Temsilci kümesi. Verilirse atıf sales_rep_id üzerinden yapılır ve leadIds
     * yok sayılır. Prim için TERCİH EDİLEN yol budur: satış anında dondurulan
     * damga, lead sonradan devredilse bile geçmişi değiştirmez.
     */
    repIds?: Set<string>;
}

/**
 * Dört kaynağı birleştirip para birimi bazında ciro üretir.
 * Girdi satırları çağıran tarafından TARİH ARALIĞINA GÖRE filtrelenmiş gelmelidir.
 */
export function attributeRevenue(input: AttributionInput): RevenueBucket {
    const { payments, reservations, currencyByToken, leadIds, repIds } = input;
    const bucket: RevenueBucket = { byCurrency: new Map(), dealCount: 0 };

    // repIds verilmişse atıf temsilci damgası üzerindendir (prim yolu);
    // aksi hâlde lead kümesi kullanılır (eski raporlarla uyum).
    const inScope = (row: { lead_id: string | null; sales_rep_id?: string | null }): boolean => {
        if (repIds) return !!row.sales_rep_id && repIds.has(row.sales_rep_id);
        if (leadIds) return !!row.lead_id && leadIds.has(row.lead_id);
        return true;
    };

    // 1) Kart tahsilatları
    for (const p of payments) {
        if (p.status !== 'success') continue;
        if (!inScope(p)) continue;
        add(bucket, p.currency || 'TRY', Number(p.amount ?? 0));
    }

    const bankClosed = new Set<string>(BANK_CLOSED_STATUSES);
    const prepaidDone = new Set<string>(PREPAID_COMPLETED_STATUSES);
    const manualCounted = new Set<string>(MANUAL_COUNTED_STATUSES);

    for (const r of reservations) {
        if (!inScope(r)) continue;
        const status = r.status || '';
        const currency = (r.offer_token && currencyByToken.get(r.offer_token)) || 'TRY';

        // 4) Manuel satışlar — havale/ön ödeme kurallarından ÖNCE ele alınır,
        //    yoksa aynı satır iki kez sayılır.
        if (r.sale_source === 'manual') {
            if (!manualCounted.has(status)) continue;
            if (status === 'deposit_paid') {
                add(bucket, currency, Number(r.deposit_amount ?? 0));
            } else if (MANUAL_FULL_STATUSES.has(status)) {
                add(bucket, currency, reservationTotal(r));
            }
            continue;
        }

        if (r.sale_source !== 'online') continue;

        // 2) Havale — tam tutar
        if (r.payment_method === 'bank-transfer') {
            if (bankClosed.has(status)) add(bucket, currency, reservationTotal(r));
            continue;
        }

        // 3) Ön ödeme kalanı — SADECE kalan tutar
        const remaining = Number(r.remaining_amount ?? 0);
        if (remaining > 0 && prepaidDone.has(status)) {
            add(bucket, currency, remaining);
        }
    }

    return bucket;
}

// NOT: "baskın para birimi" gibi tek rakama indirgeyen yardımcılar bilinçli
// olarak YOK. Çağıran taraf byCurrency üzerinde dönmek zorunda kalsın ki farklı
// para birimleri yanlışlıkla tek bir toplamda birleştirilmesin.
