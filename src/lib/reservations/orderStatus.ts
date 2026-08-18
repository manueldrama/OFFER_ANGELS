/**
 * Sipariş (customer_reservations) durum / kova / ödeme kuralları — TEK kaynak.
 *
 * Neden var: bu listeler Orders.tsx içinde DÖRT kez, üç farklı etiket setiyle
 * tekrarlanıyordu (durum rozeti, satır menüsü, edit modal menüsü, filtre menüsü).
 * Sonuç: aynı `confirmed` durumu bir yerde "Onaylandı (EFT Bekliyor)", başka bir
 * yerde sadece "Onaylandı" görünüyordu — ve filtre menüsü `shipped`/`delivered`
 * seçeneklerini hiç içermediği için kargolanmış siparişler filtrelenemiyordu.
 *
 * React ve Supabase bağımlılığı YOKTUR; dashboard widget'ları da tüketir.
 * Efektif durum (kapora yaşam döngüsü) kuralları için bkz. ./effectiveStatus.ts
 */

import type { StatusTone } from '../../components/ui/StatusBadge';
import { hasCollectedPayment, type ReservationStatusInput } from './effectiveStatus';

/** DB CHECK kısıtıyla birebir — supabase/schema_deposit_lifecycle.sql */
export type ReservationStatus =
    | 'pending'
    | 'confirmed'
    | 'paid'
    | 'deposit_paid'
    | 'fully_paid'
    | 'price_lock_expired'
    | 'shipped'
    | 'delivered'
    | 'cancelled';

export const RESERVATION_STATUSES: readonly ReservationStatus[] = [
    'pending',
    'confirmed',
    'deposit_paid',
    'fully_paid',
    'paid',
    'price_lock_expired',
    'shipped',
    'delivered',
    'cancelled',
];

interface StatusMeta {
    label: string;
    tone: StatusTone;
}

/**
 * Tek etiket seti. `confirmed` = "Onaylandı — EFT bekleniyor": para HENÜZ
 * gelmemiştir. Bu ayrım kova hesabı için kritik (bkz. ORDER_BUCKETS).
 */
export const STATUS_META: Record<ReservationStatus, StatusMeta> = {
    pending: { label: 'Bekliyor', tone: 'warning' },
    confirmed: { label: 'Onaylandı — EFT bekleniyor', tone: 'info' },
    deposit_paid: { label: 'Kapora Ödendi', tone: 'info' },
    fully_paid: { label: 'Tam Ödendi', tone: 'success' },
    paid: { label: 'Ödendi', tone: 'success' },
    price_lock_expired: { label: 'Fiyat Güncellendi', tone: 'warning' },
    shipped: { label: 'Kargolandı', tone: 'info' },
    delivered: { label: 'Teslim Edildi', tone: 'success' },
    cancelled: { label: 'İptal Edildi', tone: 'danger' },
};

function isKnownStatus(s: string): s is ReservationStatus {
    return Object.prototype.hasOwnProperty.call(STATUS_META, s);
}

/** Bilinmeyen durumda ham değeri döndürür — veri hatasını gizlemez. */
export function statusLabel(status?: string | null): string {
    const s = String(status || '');
    return isKnownStatus(s) ? STATUS_META[s].label : s;
}

export function statusTone(status?: string | null): StatusTone {
    const s = String(status || '');
    return isKnownStatus(s) ? STATUS_META[s].tone : 'neutral';
}

/** Durum değiştirme menüleri için tek seçenek listesi. */
export const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] =
    RESERVATION_STATUSES.map(value => ({ value, label: STATUS_META[value].label }));

/**
 * Kargo bilgisi girilebilen durumlar.
 *
 * Eski kapı ['confirmed','paid','shipped'] idi; `deposit_paid` ve `fully_paid`
 * dışarıda kaldığı için manuel kapora satışları hiç kargolanamıyordu.
 * `delivered` de dahildir — teslim sonrası yanlış girilmiş takip numarası
 * düzeltilebilmeli (durum geri düşmez, bkz. ordersService.saveShipping).
 */
export const SHIPPABLE_STATUSES: readonly string[] = [
    'confirmed', 'paid', 'fully_paid', 'deposit_paid', 'shipped', 'delivered',
];

export function canEnterShipping(status?: string | null): boolean {
    return SHIPPABLE_STATUSES.includes(String(status || ''));
}

/* ------------------------------------------------------------------ */
/* Kovalar (KPI kartları + filtre pill'leri)                           */
/* ------------------------------------------------------------------ */

export type OrderBucket =
    | 'all'
    | 'pending_payment'
    | 'to_ship'
    | 'in_transit'
    | 'completed'
    | 'cancelled'
    | 'pending_bank_transfer';

export interface BucketDef {
    key: OrderBucket;
    /** Filtre pill'inde görünen kısa etiket. */
    label: string;
    /** KPI kartındaki başlık (pill etiketinden farklı olabilir). */
    kpiLabel?: string;
    /** KPI kartındaki açıklama satırı. */
    kpiHelp?: string;
    /** null = filtre yok (tümü). */
    statuses: ReservationStatus[] | null;
    /** to_ship: yalnızca takip numarası GİRİLMEMİŞ olanlar. */
    requiresNoTracking?: boolean;
    /** pending_bank_transfer: havale bildirimi yapılmış, admin onayı bekleyen. */
    bankTransferPending?: boolean;
    /** KPI kartındaki renkli nokta. */
    dotClass?: string;
}

/**
 * DİKKAT — bu tanımlar supabase/migrations/*_admin_orders_summary.sql içindeki
 * `admin_orders_summary` fonksiyonuyla BİREBİR aynı kalmak zorundadır. Birini
 * değiştiren diğerini de değiştirmelidir; aksi halde KPI sayıları ile listelenen
 * satırlar sessizce ayrışır.
 *
 * `to_ship` tanımı bilerek PendingShipmentsWidget.tsx ile aynıdır — dashboard
 * kutucuğu ile sayfa pill'i asla çelişmemelidir.
 */
export const ORDER_BUCKETS: Record<OrderBucket, BucketDef> = {
    all: { key: 'all', label: 'Tümü', statuses: null },
    pending_payment: {
        key: 'pending_payment',
        label: 'Bekleyen Ödeme',
        kpiLabel: 'Ödeme bekleyen',
        kpiHelp: 'Havale ve kapora onayı',
        statuses: ['pending', 'deposit_paid'],
        dotClass: 'bg-amber-500',
    },
    to_ship: {
        key: 'to_ship',
        // `confirmed` ("Onaylandı") buraya girer, ödeme kovasına değil — KPI
        // yardımcı metni de zaten "Onaylı, henüz gönderilmedi" diyor.
        // DİKKAT: dashboard'daki PendingShipmentsWidget bilerek DAHA DAR bir
        // tanım kullanır (confirmed hariç); gerekçesi o dosyada yazılı.
        label: 'Kargolanacak',
        kpiLabel: 'Kargolanacak',
        kpiHelp: 'Onaylı, henüz gönderilmedi',
        statuses: ['confirmed', 'paid', 'fully_paid'],
        requiresNoTracking: true,
        dotClass: 'bg-violet-500',
    },
    in_transit: {
        key: 'in_transit',
        label: 'Yolda',
        kpiLabel: 'Yolda',
        kpiHelp: 'Takip numarası girildi',
        statuses: ['shipped'],
        dotClass: 'bg-blue-500',
    },
    completed: {
        key: 'completed',
        label: 'Tamamlanan',
        kpiLabel: 'Tamamlanan',
        kpiHelp: 'Teslim edildi',
        statuses: ['delivered'],
        dotClass: 'bg-emerald-500',
    },
    cancelled: {
        key: 'cancelled',
        label: 'İptal / Süresi doldu',
        statuses: ['cancelled', 'price_lock_expired'],
        dotClass: 'bg-red-500',
    },
    pending_bank_transfer: {
        key: 'pending_bank_transfer',
        label: 'Bekleyen Havale',
        statuses: ['pending'],
        bankTransferPending: true,
        dotClass: 'bg-emerald-500',
    },
};

/** Filtre pill'lerinin görünme sırası. `cancelled` yalnızca sayısı > 0 iken render edilir. */
export const BUCKET_ORDER: OrderBucket[] = [
    'all',
    'pending_payment',
    'to_ship',
    'in_transit',
    'completed',
    'cancelled',
];

/** KPI kartlarının sırası — mockup'taki dört kart. */
export const KPI_BUCKETS: Exclude<OrderBucket, 'all' | 'cancelled' | 'pending_bank_transfer'>[] = [
    'pending_payment',
    'to_ship',
    'in_transit',
];

export function isOrderBucket(value: string | null | undefined): value is OrderBucket {
    return !!value && Object.prototype.hasOwnProperty.call(ORDER_BUCKETS, value);
}

/** Kova anahtarı → okunur etiket; bilinmeyen değer 'all'a düşer. */
export function bucketDef(key: string | null | undefined): BucketDef {
    return isOrderBucket(key) ? ORDER_BUCKETS[key] : ORDER_BUCKETS.all;
}

/* ------------------------------------------------------------------ */
/* Ödeme yöntemi etiketleri                                            */
/* ------------------------------------------------------------------ */

/** Online ödeme akışı — customer_reservations.payment_method. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    'credit-card': 'Kredi Kartı',
    'bank-transfer': 'Havale / EFT',
    'pre-payment': 'Ön Ödeme (Kapora)',
};

/**
 * Offline tahsilat yöntemi — payment_method'dan ayrı tutulur.
 *
 * Bu iki tanım manualSaleService'ten BURAYA taşındı: saf kural modülünün bir
 * servise (dolayısıyla Supabase client'ına) bağlı olması yanlış yöndü.
 * manualSaleService bunları geriye yeniden dışa aktarır, mevcut çağrı yerleri
 * değişmedi.
 */
export type ManualPaymentMethod = 'cash' | 'bank-transfer' | 'card-offline' | 'other';

export const MANUAL_PAYMENT_METHOD_LABELS: Record<ManualPaymentMethod, string> = {
    cash: 'Nakit',
    'bank-transfer': 'Havale / EFT',
    'card-offline': 'Fiziksel POS',
    other: 'Diğer',
};

export interface PaymentLabelInput {
    payment_method?: string | null;
    sale_source?: string | null;
    manual_payment_method?: string | null;
}

/**
 * Satırda görünen ödeme yöntemi etiketi.
 *
 * Manuel (offline) satışlarda etiket manualSaleService'ten IMPORT edilir —
 * kopyalanmaz. Sahibi orasıdır; burada yalnızca "(Manuel)" soneki eklenir.
 */
export function paymentLabel(o: PaymentLabelInput): string {
    if (o.sale_source === 'manual') {
        const key = o.manual_payment_method as ManualPaymentMethod | null | undefined;
        const base = key ? MANUAL_PAYMENT_METHOD_LABELS[key] : undefined;
        return base ? `${base} (Manuel)` : 'Manuel Tahsilat';
    }
    const method = String(o.payment_method || '');
    return PAYMENT_METHOD_LABELS[method] || method;
}

/* ------------------------------------------------------------------ */
/* Tahsilat                                                            */
/* ------------------------------------------------------------------ */

export interface CollectedAmountInput extends ReservationStatusInput {
    total?: number | string | null;
    remaining_amount?: number | string | null;
}

function num(v: unknown): number {
    const n = Number(v ?? 0);
    return isNaN(n) ? 0 : n;
}

/**
 * Bu siparişten bugüne kadar GERÇEKTEN tahsil edilmiş tutar.
 *
 * hasCollectedPayment() üzerine kurulur; o fonksiyonun docblock'unda uyarıldığı
 * gibi `deposit_amount` tek başına tahsilat kanıtı DEĞİLDİR — rezervasyon satırı
 * ödeme akışı başlamadan önce planlanan kapora tutarıyla oluşturulur. Bu yüzden
 * kapora ancak gerçekten tahsil edildiyse sayılır.
 *
 * Belirleyici olan durum listesi DEĞİL, "bakiye duruyor mu" sorusudur: kapora
 * alınmış ve kalan tutar > 0 ise yalnızca kapora sayılır. Bir sipariş hem
 * "Kargolanacak" kovasında olup (durumu `confirmed`) hem de yalnızca kaporası
 * tahsil edilmiş olabilir — mockup'taki #MNL-0616-MA1F tam olarak budur.
 */
export function collectedAmount(o: CollectedAmountInput): number {
    if (!hasCollectedPayment(o)) return 0;
    const remaining = num(o.remaining_amount);
    const deposit = num(o.deposit_amount);
    if (remaining > 0 && deposit > 0) return deposit;
    return num(o.total);
}

/* ------------------------------------------------------------------ */
/* "Ödemeyi Onayla" geçiş matrisi                                      */
/* ------------------------------------------------------------------ */

export interface PaymentApprovalInput extends CollectedAmountInput {
    remaining_amount?: number | string | null;
}

export interface PaymentApproval {
    nextStatus: ReservationStatus;
    /** status ile birlikte tek UPDATE'te yazılacak ek alanlar. */
    patch: Record<string, unknown>;
    buttonLabel: string;
    confirmTitle: string;
    confirmDescription: string;
}

/**
 * Satır içi "Ödemeyi Onayla" butonunun hangi geçişi yapacağını çözer.
 * null → tahsilat aksiyonu yok, buton hiç render edilmez.
 *
 * `deposit_paid_at` tam ödemede de damgalanır: manualSaleService ve Ödemeler
 * ekranı tahsilat zamanını bu kolondan okur.
 */
export function resolvePaymentApproval(
    o: PaymentApprovalInput,
    nowIso: string = new Date().toISOString(),
): PaymentApproval | null {
    const status = String(o.status || '');
    if (['shipped', 'delivered', 'cancelled', 'price_lock_expired', 'paid', 'fully_paid'].includes(status)) {
        return null;
    }

    // Kapora alınmış, bakiye duruyor → kalan tahsil edildi.
    if (status === 'deposit_paid' && num(o.remaining_amount) > 0) {
        return {
            nextStatus: 'fully_paid',
            patch: { remaining_amount: 0 },
            buttonLabel: 'Kalan Ödemeyi Onayla',
            confirmTitle: 'Kalan ödeme tahsil edildi mi?',
            confirmDescription:
                'Sipariş "Tam Ödendi" durumuna geçecek ve kalan bakiye sıfırlanacak. Bu işlem otomasyon tetikler.',
        };
    }

    // Ön ödeme akışı, henüz tahsilat yok → kapora alındı.
    if (status === 'pending' && o.payment_method === 'pre-payment') {
        return {
            nextStatus: 'deposit_paid',
            patch: { deposit_paid_at: o.deposit_paid_at ?? nowIso },
            buttonLabel: 'Kaporayı Onayla',
            confirmTitle: 'Kapora tahsil edildi mi?',
            confirmDescription:
                'Sipariş "Kapora Ödendi" durumuna geçecek ve kapora yaşam döngüsü (fiyat kilidi / son ödeme) işlemeye başlayacak.',
        };
    }

    // Havale bildirimi veya EFT bekleyen → tamamı tahsil edildi.
    if (status === 'pending' || status === 'confirmed') {
        return {
            nextStatus: 'paid',
            patch: { deposit_paid_at: o.deposit_paid_at ?? nowIso, remaining_amount: 0 },
            buttonLabel: 'Ödemeyi Onayla',
            confirmTitle: 'Ödeme hesabınıza geçti mi?',
            confirmDescription:
                'Sipariş "Ödendi" durumuna geçecek ve kargo adımına hazır hale gelecek. Bu işlem otomasyon tetikler.',
        };
    }

    return null;
}
