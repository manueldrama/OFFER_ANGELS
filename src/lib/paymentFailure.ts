import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, XCircle, Clock, LogOut, ServerCrash, CreditCard, HelpCircle } from 'lucide-react';
import type { StatusTone } from '../components/ui/StatusBadge';

/**
 * Ödeme başarısızlıklarının teşhisi — tek doğruluk kaynağı.
 *
 * TASARIM KARARI: DB'ye PayTR'ın HAM kodu + HAM mesajı yazılır (failure_code /
 * failure_message). Etiketleme ve sınıflandırma BURADA, okuma anında yapılır.
 * Böylece eşleme yanlış/eksik çıkarsa backfill gerekmez — bu dosyayı düzeltmek
 * yeterlidir.
 *
 * Kod tablosu PayTR resmi dokümanından (dev.paytr.com "Hata Kodları" →
 * Bildirim URL'ye dönen kodlar) alınmıştır. Bilinmeyen bir kod gelirse ASLA
 * etiket uydurulmaz; PayTR'ın gönderdiği failed_reason_msg zaten Türkçe ve
 * insan-okur olduğu için doğrudan o gösterilir.
 */

export type FailureKind =
    | 'bank_decline'        // banka / kart / 3D reddi — müşteri tarafında çözülür
    | 'customer_cancelled'  // müşteri ödemeyi yarıda bıraktı
    | 'system_error'        // BİZİM tarafta sorun — mağaza yetkisi, entegrasyon
    | 'unknown';

export interface FailureReason {
    kind: FailureKind;
    /** Operatöre gösterilecek kısa başlık. */
    label: string;
    /** PayTR'ın ham mesajı (varsa) — başlığın altında detay olarak gösterilir. */
    detail?: string;
    tone: StatusTone;
    /** Operatörün ne yapması gerektiğine dair tek cümlelik yönlendirme. */
    hint?: string;
}

const KIND_TONE: Record<FailureKind, StatusTone> = {
    bank_decline: 'danger',
    customer_cancelled: 'neutral',
    system_error: 'warning',
    unknown: 'danger',
};

export const FAILURE_KIND_LABEL: Record<FailureKind, string> = {
    bank_decline: 'Banka / kart reddi',
    customer_cancelled: 'Müşteri vazgeçti',
    system_error: 'Sistem hatası',
    unknown: 'Sebep belirsiz',
};

/**
 * PayTR failed_reason_code → sınıf + etiket.
 * Kaynak: dev.paytr.com — Bildirim (Callback) URL'ye dönen hata kodları.
 */
const PAYTR_REASONS: Record<string, { kind: FailureKind; label: string; hint?: string }> = {
    // 0 = değişken mesaj; asıl açıklama failed_reason_msg alanında gelir
    // (ör. "bakiye yetersiz"). Bu yüzden etiketi genel tutup detayı öne çıkarıyoruz.
    '0': {
        kind: 'bank_decline',
        label: 'Banka ödemeyi onaylamadı',
        hint: 'Müşteriye başka kart veya havale seçeneğini önerin.',
    },
    '1': {
        kind: 'customer_cancelled',
        label: '3D doğrulama tamamlanmadı',
        hint: 'Müşteri SMS doğrulama adımını bitirmemiş — tekrar denemesi yeterli.',
    },
    '2': {
        kind: 'bank_decline',
        label: '3D şifresi yanlış girildi',
        hint: 'Müşteri bankadan gelen SMS şifresini hatalı girmiş.',
    },
    '3': {
        kind: 'bank_decline',
        label: 'Güvenlik kontrolünden geçemedi',
        hint: 'PayTR güvenlik/fraud kontrolü reddetti. Havale önerin.',
    },
    '6': {
        kind: 'customer_cancelled',
        label: 'Müşteri ödeme sayfasını kapattı',
        hint: 'Ödeme sayfasına girdi ama tamamlamadan çıktı — geri arama için iyi bir sinyal.',
    },
    '8': {
        kind: 'bank_decline',
        label: 'Karta taksit uygulanamıyor',
        hint: 'Seçilen taksit bu kart için desteklenmiyor; tek çekim önerin.',
    },
    '9': {
        kind: 'system_error',
        label: 'Mağaza işlem yetkisi yok',
        hint: 'BİZİM tarafımızda sorun — PayTR mağaza ayarlarını/limitlerini kontrol edin.',
    },
    '10': {
        kind: 'bank_decline',
        label: '3D Secure zorunlu',
        hint: 'Kart 3D Secure olmadan işlem kabul etmiyor.',
    },
    '11': {
        kind: 'bank_decline',
        label: 'Güvenlik uyarısı (fraud şüphesi)',
        hint: 'İşlemde risk sinyali var. Müşteriyi doğrulayıp havale önerin.',
    },
    '99': {
        kind: 'system_error',
        label: 'Teknik entegrasyon hatası',
        hint: 'BİZİM tarafımızda sorun — entegrasyon parametrelerini kontrol edin.',
    },
};

/**
 * Ham PayTR kodu + mesajından sınıflandırılmış sebep üretir.
 * Kod bilinmiyorsa uydurma yapılmaz; ham mesaj başlık olarak kullanılır.
 */
export function classifyFailure(
    code?: string | null,
    message?: string | null,
): FailureReason {
    const rawCode = code != null ? String(code).trim() : '';
    const rawMsg = message?.trim() || '';

    const known = rawCode ? PAYTR_REASONS[rawCode] : undefined;

    if (known) {
        return {
            kind: known.kind,
            label: known.label,
            // Kod 0'da asıl bilgi mesajdadır — her durumda ham mesajı detay olarak taşı.
            detail: rawMsg || undefined,
            tone: KIND_TONE[known.kind],
            hint: known.hint,
        };
    }

    // Kod yok/bilinmiyor ama PayTR bir mesaj göndermiş → mesajı olduğu gibi göster.
    if (rawMsg) {
        return {
            kind: 'unknown',
            label: rawMsg,
            detail: rawCode ? `PayTR kodu: ${rawCode}` : undefined,
            tone: KIND_TONE.unknown,
        };
    }

    // Hiçbir teşhis verisi yok — bu migration öncesi kaydedilmiş eski satırdır.
    return {
        kind: 'unknown',
        label: 'Sebep kaydedilmemiş (eski kayıt)',
        tone: 'neutral',
        hint: 'Bu ödeme, sebep yakalama devreye girmeden önce başarısız olmuş.',
    };
}

/**
 * "initiated" bir kaydın terk edilmiş sayılması için geçmesi gereken süre.
 * PayTR iframe oturumu 30 dk (init.ts timeout_limit), o yüzden aynı eşik.
 */
const ABANDON_THRESHOLD_MS = 30 * 60 * 1000;

export interface PaymentStatusMeta {
    label: string;
    tone: StatusTone;
    icon: LucideIcon;
    /** Başarısızlıklarda sınıflandırılmış sebep. */
    reason?: FailureReason;
    /** Durumun kendisine dair açıklama (sebep yoksa). */
    hint?: string;
}

export interface PaymentStatusInput {
    status: string;
    created_at: string;
    failure_code?: string | null;
    failure_message?: string | null;
}

/**
 * Bir ödeme satırının admin panelinde nasıl görüneceğini tek yerde çözer.
 *
 * ÖNEMLİ AYRIM: 'failed' YALNIZCA PayTR'ın imzalı callback'i ile oluşur.
 * Müşteri ödeme sayfasını hiç açmadan/iframe'i kapatmadan bırakırsa PayTR
 * callback atmaz ve kayıt sonsuza dek 'initiated' kalır — bunu ayrı bir
 * "terk edildi" durumu olarak gösteriyoruz, aksi halde operatör bu satırları
 * "bekleyen ödeme" sanıp boşuna bekliyor.
 */
export function paymentStatusMeta(txn: PaymentStatusInput): PaymentStatusMeta {
    switch (txn.status) {
        case 'success':
            return { label: 'Başarılı', tone: 'success', icon: CheckCircle2 };

        case 'refunded':
            return { label: 'İade edildi', tone: 'info', icon: CreditCard };

        case 'failed': {
            const reason = classifyFailure(txn.failure_code, txn.failure_message);
            // Müşteri vazgeçtiyse bunu "başarısız" diye kırmızıya boyamak yanıltıcı —
            // satış fırsatı hâlâ canlı, kayıp değil.
            const label = reason.kind === 'customer_cancelled'
                ? 'Yarıda bırakıldı'
                : reason.kind === 'system_error'
                    ? 'Sistem hatası'
                    : 'Başarısız';
            return { label, tone: reason.tone, icon: FAILURE_ICON[reason.kind], reason };
        }

        case 'initiated':
        case 'pending': {
            const age = Date.now() - new Date(txn.created_at).getTime();
            if (age > ABANDON_THRESHOLD_MS) {
                return {
                    label: 'Ödeme sayfasından çıktı',
                    tone: 'neutral',
                    icon: LogOut,
                    hint: 'Ödeme başlatıldı ama PayTR\'dan hiç sonuç dönmedi — müşteri tamamlamadan ayrılmış.',
                };
            }
            return {
                label: 'Ödeme sürüyor',
                tone: 'warning',
                icon: Clock,
                hint: 'Müşteri şu anda ödeme sayfasında olabilir.',
            };
        }

        default:
            return { label: txn.status, tone: 'neutral', icon: HelpCircle };
    }
}

const FAILURE_ICON: Record<FailureKind, LucideIcon> = {
    bank_decline: XCircle,
    customer_cancelled: LogOut,
    system_error: ServerCrash,
    unknown: XCircle,
};

/**
 * payment_gateway_events.kind → operatör diline çeviri.
 * Bu olaylar işlem satırına bağlanamayan ya da işlem satırı HİÇ oluşmayan
 * arızalardır (ör. init reddi hiçbir zaman payment_transactions satırı üretmez).
 */
export const GATEWAY_EVENT_META: Record<string, { label: string; tone: StatusTone; description: string }> = {
    bad_hash: {
        label: 'İmza doğrulanamadı',
        tone: 'danger',
        description: 'PayTR callback\'i geldi ama imza eşleşmedi. Müşteri ödemiş olabilir; merchant key/salt ayarını kontrol edin.',
    },
    txn_not_found: {
        label: 'İşlem kaydı bulunamadı',
        tone: 'danger',
        description: 'PayTR bir sonuç bildirdi ama eşleşen ödeme kaydı yok — init sırasında insert başarısız olmuş olabilir.',
    },
    config_missing: {
        label: 'PayTR ayarı eksik',
        tone: 'danger',
        description: 'Merchant kimlik bilgileri yapılandırılmamış — ödeme hiç başlatılamaz.',
    },
    duplicate_callback: {
        label: 'Tekrarlı bildirim',
        tone: 'neutral',
        description: 'Sonuçlanmış bir işlem için tekrar callback geldi; yok sayıldı (normal davranış).',
    },
    txn_update_failed: {
        label: 'Kayıt güncellenemedi',
        tone: 'danger',
        description: 'Sonuç geldi ama veritabanı güncellemesi başarısız oldu — kayıt eski durumunda kalmış olabilir.',
    },
    callback_exception: {
        label: 'Callback beklenmedik hata',
        tone: 'danger',
        description: 'Bildirim işlenirken beklenmeyen bir hata oluştu.',
    },
    init_rejected: {
        label: 'PayTR ödemeyi başlatmadı',
        tone: 'danger',
        description: 'Ödeme sayfası hiç açılamadı — PayTR isteği reddetti. Genelde mağaza ayarı veya parametre hatasıdır.',
    },
    init_invalid_response: {
        label: 'PayTR geçersiz cevap',
        tone: 'danger',
        description: 'PayTR ağ geçidinden okunamayan bir cevap döndü.',
    },
    amount_guard: {
        label: 'Tutar koruması reddetti',
        tone: 'warning',
        description: 'Gönderilen tutar teklifin tutarıyla uyuşmadığı için ödeme başlatılmadı.',
    },
};

export function gatewayEventMeta(kind: string) {
    return GATEWAY_EVENT_META[kind] || {
        label: kind,
        tone: 'neutral' as StatusTone,
        description: 'Tanımlanmamış ağ geçidi olayı.',
    };
}
