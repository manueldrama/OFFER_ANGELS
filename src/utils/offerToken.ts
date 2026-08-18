// Kriptografik güvenli token üretimi.
//
// Eskiden teklif erişim token'ları `Math.random().toString(36)` ile üretiliyordu.
// Math.random CSPRNG DEĞİLDİR (tahmin edilebilir) ve üretilen token düşük entropili
// olduğundan kör enumerasyona açıktı (token'ı bilen herkes o teklifi/lead'i görebilir).
// Bu yüzden erişim token'ları artık crypto.getRandomValues ile üretiliyor.
//
// Alfabe 32 karakter (2'nin kuvveti) → `byte % 32` modulo-bias üretmez. Karışan
// karakterler (0/O, 1/I) çıkarıldı; her karakter 5 bit taşır.
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Kripto-güvenli, belirtilen uzunlukta rastgele kod (büyük harf + rakam). */
export function randomToken(length: number): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
    }
    return out;
}

/**
 * Teklif erişim token'ı: `PREFIX-XXXXXX-XXXXXX` (12 karakter ≈ 60 bit entropi).
 * Görsel biçim eski `WEB-XXXX-XXXX` ile uyumlu (sadece daha uzun + kripto-güvenli).
 * Mevcut token'lar geçerli kalır — sadece yeni üretilenler güçlenir.
 */
export function generateOfferToken(prefix = 'WEB'): string {
    return `${prefix}-${randomToken(6)}-${randomToken(6)}`;
}
