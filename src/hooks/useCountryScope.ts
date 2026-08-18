import { useCallback, useState } from 'react';

/**
 * Admin CRM ekranlarının ortak ülke kapsamı.
 *
 * Müşteri Yönetimi (/admin/leads) ve Teklif Linkleri (/admin/offers) aynı
 * seçimi paylaşır: 🇩🇪 seçip teklif listesine geçince orada da 🇩🇪 açık gelir.
 * Tek pazara odaklanıp çalışırken sekmenin her geçişte sıfırlanmaması için
 * seçim localStorage'da tutulur.
 *
 * Değerler: 'all' (tümü) | ISO-2 ülke kodu | 'unknown' (ülkesi çözülemeyenler).
 */
const STORAGE_KEY = 'cafepaste.admin.countryScope';

export function useCountryScope(): [string, (v: string) => void] {
    const [country, setCountryState] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'all';
        } catch {
            return 'all';
        }
    });

    const setCountry = useCallback((v: string) => {
        setCountryState(v);
        try {
            if (v === 'all') localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, v);
        } catch { /* private mode / kota — seçim yine de oturum içinde çalışır */ }
    }, []);

    return [country, setCountry];
}
