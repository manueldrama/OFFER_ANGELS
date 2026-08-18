import { supabase } from '../../lib/supabase/client';
import { sanitizeSearchTerm } from '../../utils/searchFilter';
import {
    ORDER_BUCKETS,
    type OrderBucket,
    type ReservationStatus,
} from '../../lib/reservations/orderStatus';
import type { CustomerReservation } from '../../types/orders';

/**
 * Siparişler sayfasının tüm Supabase erişimi.
 *
 * Neden servis: sayfa daha önce sorguları doğrudan kendi içinde kuruyordu ve
 * `select('*')` LİMİTSİZ çalışıyordu — her açılışta tüm rezervasyonlar
 * çekiliyordu. Sorgular buraya taşındığında sayfalama, arama ve sayım tek yerden
 * yönetilebiliyor; ayrıca durum değişiminin `lead_events` yan etkisi tek bir
 * fonksiyona hapsediliyor.
 */

export const ORDERS_PAGE_SIZE = 25;

export interface OrdersQuery {
    bucket: OrderBucket;
    search: string;
    page: number;
    pageSize?: number;
}

export interface OrdersPage {
    rows: CustomerReservation[];
    total: number;
}

export type BucketCounts = Record<Exclude<OrderBucket, 'all'>, number>;

export interface OrdersSummary {
    total: number;
    counts: BucketCounts;
    /** null = SQL fonksiyonu henüz uygulanmamış; arayüz "—" gösterir. */
    collectedTotal: number | null;
}

const COUNTABLE_BUCKETS: Exclude<OrderBucket, 'all'>[] = [
    'pending_payment',
    'to_ship',
    'in_transit',
    'completed',
    'cancelled',
    'pending_bank_transfer',
];

/** Kova kurallarını bir sorguya uygular. ORDER_BUCKETS ile tek kaynaktan beslenir. */
function applyBucket<T>(query: T, bucket: OrderBucket): T {
    const def = ORDER_BUCKETS[bucket];
    if (!def || !def.statuses) return query;
    let q = query as any;
    q = def.statuses.length === 1
        ? q.eq('status', def.statuses[0])
        : q.in('status', def.statuses);
    if (def.requiresNoTracking) q = q.is('tracking_number', null);
    if (def.bankTransferPending) {
        q = q.eq('payment_method', 'bank-transfer').not('bank_transfer_notified_at', 'is', null);
    }
    return q as T;
}

/** Arama filtresi — sanitizeSearchTerm PostgREST ayırıcılarını temizler. */
function applySearch<T>(query: T, search: string): T {
    const s = sanitizeSearchTerm(search);
    if (!s) return query;
    return (query as any).or(
        [
            `customer_name.ilike.%${s}%`,
            `offer_code.ilike.%${s}%`,
            `company_name.ilike.%${s}%`,
            `tracking_number.ilike.%${s}%`,
        ].join(','),
    ) as T;
}

export const ordersService = {
    /** Tek sayfa sipariş + filtreye uyan toplam kayıt sayısı. */
    async list({ bucket, search, page, pageSize = ORDERS_PAGE_SIZE }: OrdersQuery): Promise<OrdersPage> {
        const safePage = Math.max(1, page);
        const from = (safePage - 1) * pageSize;

        let query = supabase
            .from('customer_reservations')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            // created_at eşitliğinde sıra kaymasın — locate() ile tutarlı kalmalı.
            .order('id', { ascending: false })
            .range(from, from + pageSize - 1);

        query = applyBucket(query, bucket);
        query = applySearch(query, search);

        const { data, error, count } = await query;
        if (error) throw error;
        return { rows: (data || []) as CustomerReservation[], total: count ?? 0 };
    },

    /**
     * KPI değerleri + filtre pill sayıları.
     *
     * Önce tek SQL fonksiyonunu dener (tek gidiş-dönüş, tahsilat toplamını da
     * hesaplar). Fonksiyon henüz Studio'dan uygulanmadıysa sayma sorgularına
     * düşer — sayfa çalışmaya devam eder, yalnızca `collectedTotal` null kalır
     * çünkü PostgREST SUM üretemez.
     */
    async summary(search: string): Promise<OrdersSummary> {
        const s = sanitizeSearchTerm(search);

        const { data, error } = await supabase.rpc('admin_orders_summary', { p_search: s || null });
        if (!error && data) {
            const row: any = Array.isArray(data) ? data[0] : data;
            if (row) {
                return {
                    total: Number(row.total_count ?? 0),
                    counts: {
                        pending_payment: Number(row.pending_payment ?? 0),
                        to_ship: Number(row.to_ship ?? 0),
                        in_transit: Number(row.in_transit ?? 0),
                        completed: Number(row.completed ?? 0),
                        cancelled: Number(row.cancelled ?? 0),
                        pending_bank_transfer: Number(row.pending_bank_transfer ?? 0),
                    },
                    collectedTotal: Number(row.collected_total ?? 0),
                };
            }
        }

        // Fallback: fonksiyon yok (PGRST202) veya beklenmedik yanıt.
        const countOf = async (bucket: OrderBucket): Promise<number> => {
            let q = supabase.from('customer_reservations').select('id', { count: 'exact', head: true });
            q = applyBucket(q, bucket);
            q = applySearch(q, search);
            const { count, error: countErr } = await q;
            if (countErr) throw countErr;
            return count ?? 0;
        };

        const [total, ...values] = await Promise.all([
            countOf('all'),
            ...COUNTABLE_BUCKETS.map(countOf),
        ]);

        const counts = {} as BucketCounts;
        COUNTABLE_BUCKETS.forEach((key, i) => { counts[key] = values[i]; });

        return { total, counts, collectedTotal: null };
    },

    /**
     * Durum güncellemesi + otomasyon olayı.
     *
     * `lead_events` insert'i otomasyon kurallarının tetikleyicisidir
     * (automationRulesService: "Kargoya verildi", "Teslim edildi" vb.).
     * Olay adları ve metadata şekli DEĞİŞTİRİLEMEZ.
     */
    async updateStatus(
        id: string,
        newStatus: ReservationStatus,
        patch: Record<string, unknown> = {},
        options: { currentStatus?: string } = {},
    ): Promise<void> {
        const { error } = await supabase
            .from('customer_reservations')
            .update({ status: newStatus, ...patch })
            .eq('id', id);
        if (error) throw error;

        // Durum gerçekten değişmediyse otomasyonu tekrar tetikleme.
        if (options.currentStatus && options.currentStatus === newStatus) return;

        const statusToEvent: Record<string, string> = {
            shipped: 'reservation_shipped',
            delivered: 'reservation_delivered',
            cancelled: 'reservation_cancelled',
            paid: 'reservation_paid',
            fully_paid: 'reservation_paid',
        };
        const eventType = statusToEvent[newStatus];
        if (!eventType) return;

        const { data: resData } = await supabase
            .from('customer_reservations')
            .select('lead_id, offer_token')
            .eq('id', id)
            .maybeSingle();
        if (!resData?.lead_id) return;

        await supabase.from('lead_events').insert({
            lead_id: resData.lead_id,
            token: resData.offer_token || null,
            event_type: eventType,
            metadata: { reservation_id: id, new_status: newStatus, admin_triggered: true },
        });
    },

    /**
     * Kargo bilgisi kaydı.
     *
     * DİKKAT — bilinçli olarak `updateStatus`'ten GEÇMEZ. Bugünkü davranış
     * korunuyor: kargo bilgisi girmek durumu 'shipped' yapar ama
     * `reservation_shipped` otomasyon olayını ATMAZ (yalnızca satırdaki durum
     * menüsünden seçmek atar). Bu tutarsızlık bilinen bir açıktır; düzeltmek
     * bugüne dek hiç çalışmamış "Kargoya verildi" otomasyonlarını canlı
     * müşterilere karşı devreye sokacağı için ayrı bir iş olarak bekletiliyor.
     *
     * Zaten kargolanmış/teslim edilmiş kayıtta durum geri düşürülmez — teslim
     * edilmiş bir siparişte takip numarası düzeltmek onu 'shipped'e çekmemeli.
     */
    async saveShipping(
        id: string,
        currentStatus: string,
        company: string,
        tracking: string,
    ): Promise<void> {
        const keepStatus = currentStatus === 'shipped' || currentStatus === 'delivered';
        const { error } = await supabase
            .from('customer_reservations')
            .update({
                shipping_company: company,
                tracking_number: tracking,
                ...(keepStatus ? {} : { status: 'shipped' }),
            })
            .eq('id', id);
        if (error) throw error;
    },

    async remove(ids: string[]): Promise<void> {
        if (!ids.length) return;
        const { error } = await supabase.from('customer_reservations').delete().in('id', ids);
        if (error) throw error;
    },

    /**
     * `?focus=<id>` için: siparişin hangi sayfada olduğunu bulur.
     * Sıralama list() ile aynı olmalıdır (created_at desc, id desc).
     */
    async locate(
        id: string,
        pageSize: number = ORDERS_PAGE_SIZE,
    ): Promise<{ page: number; row: CustomerReservation } | null> {
        const { data: row, error } = await supabase
            .from('customer_reservations')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error || !row) return null;

        const { count } = await supabase
            .from('customer_reservations')
            .select('id', { count: 'exact', head: true })
            .gt('created_at', (row as CustomerReservation).created_at);

        return {
            page: Math.floor((count ?? 0) / pageSize) + 1,
            row: row as CustomerReservation,
        };
    },
};
