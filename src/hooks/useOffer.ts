import { useState, useEffect, useRef, useCallback } from 'react';
import { getOfferContextByToken, OfferContextData } from '../services/offerContext';
import i18n, { getSupportedLanguages } from '../i18n';

/**
 * useOffer — token + language + country triplet için offer context'i fetch eder.
 *
 * Dil-bazlı önbellek: daha önce yüklenen `${token}|${lang}|${country}` kombinasyonları
 * memory cache'inde tutulur. Dil değişince:
 *   1. Cache'te varsa: anında setData(cache) → İnstant UI swap
 *   2. Cache'te yoksa: önceki data ekranda kalır, background fetch yapılır,
 *      sonuç gelince setData ile değiştirilir
 * Bu sayede dil tab'ları arasında geçiş "anında" hissettirir.
 */
export function useOffer(token: string | undefined, languageCode?: string, countryOverride?: string | null) {
    const [data, setData] = useState<OfferContextData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<'invalid' | 'expired' | null>(null);
    const initialLoadDone = useRef(false);
    const isMountedRef = useRef(true);
    const cacheRef = useRef<Map<string, OfferContextData>>(new Map());

    const cacheKey = `${token || ''}|${languageCode || ''}|${countryOverride || ''}`;

    const loadData = useCallback(async () => {
        const isFirstLoad = !initialLoadDone.current;
        if (isFirstLoad) {
            setIsLoading(true);
            setError(null);
        }

        if (!token) {
            setError('invalid');
            setIsLoading(false);
            return;
        }

        // Cache hit → anında göster, sonra background refresh için fetch hâlâ devam etsin
        const cached = cacheRef.current.get(cacheKey);
        if (cached && !isFirstLoad) {
            setData(cached);
        }

        try {
            const response = await getOfferContextByToken(token, languageCode, countryOverride || undefined);
            if (!isMountedRef.current) return;
            if (response.data) {
                cacheRef.current.set(cacheKey, response.data);
            }
            if (initialLoadDone.current) {
                setData(prev => {
                    if (!prev || !response.data) return response.data ?? prev;
                    if (JSON.stringify(prev) === JSON.stringify(response.data)) return prev;
                    return response.data;
                });
            } else {
                setData(response.data);
            }
            if (isFirstLoad) setError(response.error);
            const wasFirstLoad = !initialLoadDone.current;
            initialLoadDone.current = true;

            // İlk yükleme tamamlandı → diğer dilleri ANINDA paralel olarak prefetch et.
            // requestIdleCallback yerine doğrudan başlat — kısa bir delay'den sonra
            // tüm dillerin cache'te olması istenir (anlık dil değişimi için).
            if (wasFirstLoad && response.data) {
                const allLangs = getSupportedLanguages();
                const otherLangs = allLangs.filter(l => l !== languageCode);
                otherLangs.forEach(lang => {
                    const key = `${token || ''}|${lang}|${countryOverride || ''}`;
                    if (cacheRef.current.has(key)) return;
                    getOfferContextByToken(token!, lang, countryOverride || undefined)
                        .then(r => {
                            if (isMountedRef.current && r.data) {
                                cacheRef.current.set(key, r.data);
                            }
                        })
                        .catch(() => { /* sessiz geç */ });
                });
            }
        } catch (err) {
            if (!isMountedRef.current) return;
            console.error('[useOffer] fetch failed:', err);
            initialLoadDone.current = true;
            if (isFirstLoad) setError('invalid');
        } finally {
            if (isMountedRef.current && isFirstLoad) {
                setIsLoading(false);
            }
        }
    }, [token, languageCode, countryOverride, cacheKey]);

    // Dil değişince — cache'te varsa anında swap. Cache miss durumunda
    // mevcut data ekranda kalır, background fetch ile gerçek data gelir.
    useEffect(() => {
        if (!initialLoadDone.current) return;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
            setData(cached); // instant swap
        }
        // cache miss durumunda loadData useEffect aşağıda zaten tetikler
    }, [cacheKey]);

    useEffect(() => {
        isMountedRef.current = true;
        loadData();
        // Background refresh - prices/quota değişiklikleri için
        const interval = setInterval(loadData, 60000);
        return () => {
            isMountedRef.current = false;
            clearInterval(interval);
        };
    }, [loadData]);

    // i18n.languageChanged event dinleyicisi: dil değişimi UI'ye anında yansısın.
    // i18n -> useOfferLocale -> useOffer prop tetiklenmesi bazen yavaş kalıyor.
    // Direk i18n event ile loadData'yi tetikliyoruz; cache hit varsa zaten anlık.
    useEffect(() => {
        const handler = () => {
            if (!isMountedRef.current || !initialLoadDone.current) return;
            // Yeni dilde cache var mı? Varsa anında swap.
            const newCacheKey = `${token || ''}|${i18n.language?.split('-')[0] || ''}|${countryOverride || ''}`;
            const cached = cacheRef.current.get(newCacheKey);
            if (cached) {
                setData(cached);
            }
            // Her durumda fresh fetch tetikle - cache stale olabilir
            loadData();
        };
        i18n.on('languageChanged', handler);
        return () => { i18n.off('languageChanged', handler); };
    }, [token, countryOverride, loadData]);

    const refetch = useCallback(() => {
        // Cache'i invalidate et — fresh fetch
        cacheRef.current.delete(cacheKey);
        loadData();
    }, [loadData, cacheKey]);

    return { data, isLoading, error, refetch };
}
