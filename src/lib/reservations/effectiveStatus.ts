/**
 * Rezervasyonun "efektif" durumu — DB'deki `status` ile müşteriye gösterilen
 * durum arasındaki TEK köprü.
 *
 * Neden var: kapora yaşam döngüsünü backend'de deposit-followup cron'u yürütür
 * (functions/api/internal/deposit-followup.ts). Cron periyodik çalıştığı için
 * arayüz, tarihi yeni geçmiş kayıtları cron yetişmeden doğru göstersin diye aynı
 * kuralları burada tekrar uygular. İki tarafın kuralları AYNI kalmak zorundadır.
 *
 * Ayrıştıklarında ne olur (gerçek vaka, #MNL-0724-LX90): manuel satışlarda
 * "otomasyon dışı" bayrağına yalnızca cron saygı duyuyordu; arayüz sadece tarihe
 * bakıyordu. Sonuç: DB'de `deposit_paid` olan, ₺52.800 kaporası tahsil edilmiş
 * rezervasyonu müşteri "İptal Edildi / Başarısız" olarak gördü — admin panelinde
 * ise kayıt sapasağlam duruyordu. Kural artık tek yerde.
 */

/** Efektif durum hesabı için gereken minimum alan seti. */
export interface ReservationStatusInput {
    status?: string | null;
    payment_method?: string | null;
    created_at?: string | null;
    deposit_amount?: number | string | null;
    deposit_paid_at?: string | null;
    price_lock_expires_at?: string | null;
    final_deadline_at?: string | null;
    sale_source?: string | null;
    manual_automation_opt_in?: boolean | null;
    second_chance_expires_at?: string | null;
}

/** Havale bildirimi beklenen rezervasyonun pencere genişliği. */
export const BANK_TRANSFER_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Kapora otomasyonunun (14 gün fiyat güncelleme / 19 gün otomatik iptal) DIŞINDA
 * kalan kayıt mı?
 *
 * Manuel satış modalindeki "Kapora hatırlatma otomasyonuna dahil et" kutusu
 * kapalıyken kullanıcıya verilen söz aynen budur:
 * "Kapalıyken bu kayıt otomatik fiyat güncelleme ve 19 gün sonundaki otomatik
 *  iptal kuralının dışında kalır."
 * Backend tarafındaki karşılığı deposit-followup'ın
 * `or=(sale_source.eq.online,manual_automation_opt_in.is.true)` filtresidir.
 */
export function isDepositAutomationExempt(res: ReservationStatusInput): boolean {
    return res.sale_source === 'manual' && res.manual_automation_opt_in !== true;
}

function isPast(iso: string | null | undefined, nowMs: number): boolean {
    if (!iso) return false;
    const ms = new Date(iso).getTime();
    return !isNaN(ms) && nowMs > ms;
}

/**
 * Fiyat kilidi süresi dolmuş mu? Otomasyon dışı kayıtlarda tarih bilgi amaçlıdır
 * (admin modalde elle giriyor, aciliyet widget'ı okuyor) — fiyatı düşürmez.
 */
export function isPriceLockPassed(res: ReservationStatusInput, nowMs: number = Date.now()): boolean {
    if (isDepositAutomationExempt(res)) return false;
    return isPast(res.price_lock_expires_at, nowMs);
}

/** Son ödeme tarihi geçmiş mi? Otomasyon dışı kayıtlarda daima false. */
export function isFinalDeadlinePassed(res: ReservationStatusInput, nowMs: number = Date.now()): boolean {
    if (isDepositAutomationExempt(res)) return false;
    return isPast(res.final_deadline_at, nowMs);
}

/** 
 * Yönetici tarafından tanımlanmış aktif bir "İkinci Şans" süresi var mı? 
 * Varsa bu süre içinde fiyat kilidi (veya iptal durumu) bypass edilir,
 * müşteri liste fiyatı üzerinden ödeme yapabilir.
 */
export function isSecondChanceActive(res: ReservationStatusInput, nowMs: number = Date.now()): boolean {
    if (!res.second_chance_expires_at) return false;
    const ms = new Date(res.second_chance_expires_at).getTime();
    return !isNaN(ms) && ms > nowMs;
}

/**
 * Bu rezervasyon için gerçekten para tahsil edilmiş mi?
 *
 * DİKKAT: `deposit_amount` tahsilat kanıtı DEĞİLDİR — rezervasyon satırı ödeme
 * akışı başlamadan önce planlanan kapora tutarıyla oluşturulur
 * (CustomerOffer.tsx, insert anında deposit_amount dolu / deposit_paid_at null).
 * Tahsilat damgası yalnızca `deposit_paid_at` ve tahsilat sonrası durumlardır.
 */
export function hasCollectedPayment(res: ReservationStatusInput): boolean {
    if (res.deposit_paid_at) return true;
    return ['deposit_paid', 'price_lock_expired', 'paid', 'fully_paid', 'shipped', 'delivered'].includes(
        String(res.status || '')
    );
}

/**
 * DB status'ünü müşteriye gösterilecek duruma çevirir.
 *
 * - `deposit_paid` + son ödeme tarihi geçmiş  → `cancelled`   (cron: 19 gün kuralı)
 * - `deposit_paid` + fiyat kilidi geçmiş      → `price_lock_expired` (cron: 14 gün kuralı)
 * - `pending` havale + 24 saat geçmiş         → `cancelled`   (cron: havale temizliği)
 *
 * İlk iki kural otomasyon dışı kayıtlara UYGULANMAZ. Havale penceresi ise
 * cron'da da `sale_source` filtresi olmadan çalıştığı için herkese uygulanır.
 */
export function getEffectiveReservationStatus(
    res: ReservationStatusInput,
    nowMs: number = Date.now()
): string {
    const secondChance = isSecondChanceActive(res, nowMs);
    
    // Eğer ikinci şans aktifse, rezervasyon durumu `cancelled` veya `price_lock_expired` da olsa,
    // müşteriye "İkinci Şans" penceresini gösteririz.
    if (secondChance && ['deposit_paid', 'price_lock_expired', 'cancelled'].includes(res.status || '')) {
        return 'second_chance';
    }

    if (res.status === 'deposit_paid') {
        if (isFinalDeadlinePassed(res, nowMs)) return 'cancelled';
        if (isPriceLockPassed(res, nowMs)) return 'price_lock_expired';
    }
    if (res.status === 'pending' && res.payment_method === 'bank-transfer') {
        if (isPast(res.created_at, nowMs - BANK_TRANSFER_WINDOW_MS)) return 'cancelled';
    }
    return String(res.status || '');
}

/** Hangi son tarih için geri sayım işliyor? */
export type DeadlineKind = 'price_lock' | 'final' | 'second_chance';

/**
 * Müşteriye gösterilen geri sayımın hedefi — "aktif" son tarih.
 *
 * Efektif duruma göre seçilir; ham `status` yerine
 * `getEffectiveReservationStatus` kullanıldığı için otomasyon dışı manuel
 * satışlar (bkz. isDepositAutomationExempt) doğru davranır: onlarda fiyat kilidi
 * tarihi geçse bile durum `deposit_paid` kalır, geçmiş tarih hedef seçilemez ve
 * fonksiyon null döner — yani o kayıtlar için işleyen bir geri sayım yoktur.
 *
 * Geçmiş tarihler asla hedef olmaz; ödenecek aktif bir son tarih yoksa null.
 *
 * Kullanıcıları:
 *   - CustomerOffer.tsx getDeadlineRemainingText  → müşterinin gördüğü sayaç
 *   - functions/api/internal/deposit-deadline-reminder.ts → son 24 saat WhatsApp
 *   - src/pages/admin/Orders.tsx → manuel hatırlatma butonunun aktifliği
 * Üçü de AYNI tarihi hedeflemek zorunda; bu yüzden kural burada tek yerde.
 */
export function getActiveDeadline(
    res: ReservationStatusInput,
    nowMs: number = Date.now()
): { kind: DeadlineKind; at: Date } | null {
    const future = (iso: string | null | undefined): Date | null => {
        if (!iso) return null;
        const d = new Date(iso);
        return isNaN(d.getTime()) || d.getTime() <= nowMs ? null : d;
    };
    const eff = getEffectiveReservationStatus(res, nowMs);
    if (eff === 'second_chance') {
        const at = future(res.second_chance_expires_at);
        return at ? { kind: 'second_chance', at } : null;
    }
    if (eff === 'deposit_paid') {
        const at = future(res.price_lock_expires_at);
        return at ? { kind: 'price_lock', at } : null;
    }
    if (eff === 'price_lock_expired') {
        const at = future(res.final_deadline_at);
        return at ? { kind: 'final', at } : null;
    }
    return null;
}
