import { useState, useEffect, useCallback } from 'react';
import { LandingVariant, LandingPageSection } from '../types';
import { LandingVariantService } from '../services/admin/landingVariantService';

const VARIANT_KEY = 'cafepaste_variant_id';

/** Equal random pick */
function pickRandom(variants: LandingVariant[]): LandingVariant {
    return variants[Math.floor(Math.random() * variants.length)];
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

interface EdgeVariantPayload {
    v: number;
    lang: string;
    variantId: string;
    variantName: string | null;
    sections: LandingPageSection[];
}

/**
 * Edge-prerender (functions/landing/variant-prerender.ts) landing index.html'ine
 * `window.__LANDING_VARIANT__` enjekte eder. Varsa ilk render'da senkron kullanılır
 * → fetch beklenmez, ne flash ne splash. Yoksa null döner, normal fetch akışı çalışır.
 */
function readEdgePayload(): EdgeVariantPayload | null {
    if (typeof window === 'undefined') return null;
    const p = (window as unknown as { __LANDING_VARIANT__?: EdgeVariantPayload }).__LANDING_VARIANT__;
    if (p && p.v === 1 && Array.isArray(p.sections) && p.sections.length > 0) return p;
    return null;
}

/**
 * Variant fetch'ini geçici hatalara karşı dayanıklı yapar. Tek bir ağ/Supabase
 * hatası (yavaş mobil bağlantı, timeout, geçici 5xx) müşteriyi sessizce gömülü
 * DEFAULT_SECTIONS'a (eski latte_artisan IG içeriği) düşürmesin diye birkaç kez
 * artan beklemeyle dener. Boş sonuç (variant gerçekten yok) bir hata DEĞİL —
 * retry edilmez, normal şekilde döner; sadece throw eden çağrılar tekrarlanır.
 */
async function fetchActiveForLanguageWithRetry(
    lang: string,
    attempts = 3,
    backoffMs = [400, 1000],
): Promise<LandingVariant[]> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await LandingVariantService.getActiveForLanguage(lang);
        } catch (e) {
            lastErr = e;
            if (i < attempts - 1) await sleep(backoffMs[i] ?? 1000);
        }
    }
    throw lastErr;
}

export function useLandingVariant(lang?: string) {
    // Edge-prerender payload (varsa) ilk render'da senkron içerik sağlar.
    const edgeInit = readEdgePayload();
    const [variant, setVariant] = useState<LandingVariant | null>(
        // Yalnızca id/name tüketiliyor (useLandingContent + analytics); kısmi obje yeterli.
        edgeInit ? ({ id: edgeInit.variantId, name: edgeInit.variantName ?? '' } as unknown as LandingVariant) : null,
    );
    const [variantSections, setVariantSections] = useState<LandingPageSection[] | null>(edgeInit?.sections ?? null);
    const [forcedLang, setForcedLang] = useState<string | null>(null);
    // Optimistic loading: edge içeriği geldiyse veya sticky variant ID localStorage'da
    // varsa (tekrar gelen ziyaretçi useLandingContent cache'i taşır) loading=false
    // ile başla → sayfa anında boyanır, biz arka planda revalidate ederiz.
    const [loading, setLoading] = useState(() => {
        if (typeof window === 'undefined') return true;
        if (readEdgePayload()) return false;
        try { return !localStorage.getItem(VARIANT_KEY); } catch { return true; }
    });

    // Edge variant ID'sini localStorage'a yaz ki sonraki client-only navigasyonlarda
    // sticky atama (pickRandom yerine) edge cookie'siyle aynı variant'ta kalsın.
    useEffect(() => {
        if (edgeInit) {
            try { localStorage.setItem(VARIANT_KEY, edgeInit.variantId); } catch { /* quota */ }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const assign = useCallback(async () => {
        try {
            const currentLang = lang || 'tr';

            // Check URL for forced variant (used by admin heatmap preview)
            const urlParams = new URLSearchParams(window.location.search);
            const forcedVariantId = urlParams.get('variant');

            if (forcedVariantId) {
                // Admin preview mode — load specific variant by ID, ignore language scope
                const forced = await LandingVariantService.getById(forcedVariantId);
                if (forced) {
                    const sections = LandingVariantService.sectionsToLandingFormat(forced, currentLang);
                    setVariant(forced);
                    setVariantSections(sections.length > 0 ? sections : null);
                    setForcedLang(null);
                    setLoading(false);
                    return;
                }
            }

            // 1) Try variants applicable to the current language
            let candidates = await fetchActiveForLanguageWithRetry(currentLang);
            let renderLang = currentLang;
            let usingFallback = false;

            // 2) Fallback to English-applicable variants
            if (candidates.length === 0 && currentLang !== 'en') {
                candidates = await fetchActiveForLanguageWithRetry('en');
                renderLang = 'en';
                usingFallback = true;
            }

            if (candidates.length === 0) {
                // Aday yok: mevcut içeriği SİLME (edge-prerender veya önceki başarılı
                // fetch gelmişse koru). State zaten null'sa (gerçek cold visit) null
                // kalır → DEFAULT_SECTIONS + splash devreye girer. Stale içeriği geç
                // bir flash'la eskiye düşürmemek için downgrade etmiyoruz.
                setLoading(false);
                return;
            }

            // Visitor sticky assignment (only when assigned variant is in current candidate list)
            const savedId = localStorage.getItem(VARIANT_KEY);
            let chosen = savedId ? candidates.find(v => v.id === savedId) : null;
            if (!chosen) {
                chosen = pickRandom(candidates);
                localStorage.setItem(VARIANT_KEY, chosen.id);
            }

            const sections = LandingVariantService.sectionsToLandingFormat(chosen, renderLang);

            setVariant(chosen);
            setVariantSections(sections.length > 0 ? sections : null);
            setForcedLang(usingFallback ? 'en' : null);
        } catch {
            // Revalidation hatası: mevcut içeriği (edge/önceki) KORU — geç flash olmasın.
            // İlk cold visit'te state zaten null olduğundan bir şey kaybolmaz.
        } finally {
            setLoading(false);
        }
    }, [lang]);

    useEffect(() => { assign(); }, [assign]);

    return { variant, variantSections, forcedLang, loading };
}
