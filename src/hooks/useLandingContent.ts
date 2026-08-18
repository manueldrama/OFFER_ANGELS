import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LandingPageSection } from '../types';
import { LandingPagePublicService, LandingData } from '../services/landingPagePublicService';
import { DEFAULT_SECTIONS } from '../data/landingDefaults';
import { useLandingVariant } from './useLandingVariant';
import { getDefaultCurrencyForLanguage } from '../i18n';

function getCacheKey(lang: string, currency: string) {
    return `cafepaste_landing_data_${lang}_${currency}`;
}

/**
 * Cache TTL: 90 seconds.
 * Stale cache is still returned as initial-render fallback (no flash / no LCP hit),
 * but isFreshEnough = false signals that variantSections should override immediately.
 */
const CACHE_TTL_MS = 90 * 1000;

interface CachedLandingData {
    sections: LandingPageSection[];
    campaignName: string | null;
    cheapestPrice: number | null;
    cachedAt?: number;
}

interface CacheResult {
    data: CachedLandingData;
    isFreshEnough: boolean;
}

function getCached(lang: string, currency: string): CacheResult | null {
    try {
        const raw = localStorage.getItem(getCacheKey(lang, currency));
        if (raw) {
            const parsed = JSON.parse(raw) as CachedLandingData;
            if (parsed && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
                const age = Date.now() - (parsed.cachedAt ?? 0);
                return { data: parsed, isFreshEnough: age <= CACHE_TTL_MS };
            }
        }
    } catch { /* ignore */ }
    return null;
}

function saveCache(lang: string, currency: string, data: CachedLandingData) {
    try {
        localStorage.setItem(getCacheKey(lang, currency), JSON.stringify({ ...data, cachedAt: Date.now() }));
    } catch { /* quota */ }
}

/**
 * Reads landing-page sections exclusively from variants now (post 6.8.26).
 *
 * Performance contract (unchanged):
 *  - Repeat visits < 90s: cached sections render instantly, zero network wait.
 *  - Repeat visits ≥ 90s OR first visit: stale sections used for initial paint
 *    (no layout shift), replaced with fresh Supabase data within ~300ms.
 *  - Admin changes propagate to all visitors within 90s (at most).
 */
export function useLandingContent() {
    const { i18n } = useTranslation();
    const _params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isPreview = _params?.get('preview') === 'true' || _params?.get('edit') === 'true';
    const lang = i18n.language?.split('-')[0] || 'tr';
    const currency = (getDefaultCurrencyForLanguage(i18n.language) || 'TRY').toUpperCase();
    const cacheResult = isPreview ? null : getCached(lang, currency);
    const cached = cacheResult?.data ?? null;
    // If cache is stale (> 90s), do NOT treat it as "has content" so we wait for
    // fresh variantSections before declaring loading=false.
    const cacheIsFresh = cacheResult?.isFreshEnough ?? false;

    const [campaignName, setCampaignName] = useState<string | null>(cached?.campaignName ?? null);
    const [cheapestPrice, setCheapestPrice] = useState<number | null>(cached?.cheapestPrice ?? null);
    const [metaLoading, setMetaLoading] = useState(!cached);

    // Active variant resolution (with EN-fallback for langs that have no variant)
    const { variant, variantSections, forcedLang, loading: variantLoading } = useLandingVariant(lang);

    const effectiveLang = forcedLang ?? lang;

    const fetchMeta = useCallback(() => {
        LandingPagePublicService.getLandingData(effectiveLang, currency)
            .then((data: LandingData) => {
                setCampaignName(data.campaignName);
                setCheapestPrice(data.cheapestPrice);
            })
            .catch(() => { /* keep cached */ })
            .finally(() => setMetaLoading(false));
    }, [effectiveLang, currency]);

    // Cold-cache visit'lerde Supabase fetch'ini LCP frame'iyle yarıştırma.
    // DEFAULT_SECTIONS + cached campaign/price zaten initial paint için yeterli;
    // taze meta veri tarayıcı idle olduğunda çekiliyor. Cached varsa direkt fire
    // (UI'ı 90s sonra güncelleyebilmek için), cache yoksa idle bekle.
    useEffect(() => {
        if (cached) { fetchMeta(); return; }
        const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
        let cancelled = false;
        const run = () => { if (!cancelled) fetchMeta(); };
        const handle = w.requestIdleCallback
            ? w.requestIdleCallback(run, { timeout: 1500 })
            : setTimeout(run, 0);
        return () => {
            cancelled = true;
            if (w.requestIdleCallback && typeof handle === 'number') {
                (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
            } else {
                clearTimeout(handle as ReturnType<typeof setTimeout>);
            }
        };
    }, [fetchMeta, cached]);

    useEffect(() => {
        // Heatmap iframe onizlemesinde tab focus geri donduğunde re-fetch gereksiz.
        if (typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('heatmap') === '1') return;
        const h = () => { if (document.visibilityState === 'visible') fetchMeta(); };
        document.addEventListener('visibilitychange', h);
        return () => document.removeEventListener('visibilitychange', h);
    }, [fetchMeta]);

    // Preview mode: listen for postMessage from admin editor
    const [previewSections, setPreviewSections] = useState<LandingPageSection[] | null>(null);

    useEffect(() => {
        if (!isPreview) return;
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'CMS_UPDATE_SECTIONS') {
                setPreviewSections(e.data.sections);
            } else if (e.data?.type === 'CMS_REFRESH') {
                fetchMeta();
            } else if (e.data?.type === 'CMS_SCROLL_TO_SECTION') {
                const el = document.querySelector(`[data-section-type="${e.data.sectionType}"]`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [isPreview, fetchMeta]);

    // Priority: fresh variantSections > stale cached sections > DEFAULT_SECTIONS
    // Stale cache is still used as the initial-paint fallback to avoid layout shift.
    const baseSections: LandingPageSection[] = variantSections && variantSections.length > 0
        ? variantSections
        : (cached?.sections ?? DEFAULT_SECTIONS);
    const sections = previewSections ?? baseSections;

    // Cache only when we actually have variant content (not the bundled fallback)
    useEffect(() => {
        if (!isPreview && variantSections && variantSections.length > 0 && !metaLoading) {
            saveCache(effectiveLang, currency, { sections: variantSections, campaignName, cheapestPrice });
        }
    }, [isPreview, variantSections, effectiveLang, currency, campaignName, cheapestPrice, metaLoading]);

    // Fresh cache → instant render; stale cache → wait for variantSections.
    const hasContent = sections.length > 0 && (cacheIsFresh || !!variantSections);
    const loading = hasContent ? false : (variantLoading || metaLoading);

    return {
        sections,
        campaignName,
        cheapestPrice,
        loading,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
    };
}
