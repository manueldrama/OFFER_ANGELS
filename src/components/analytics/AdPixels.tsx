import { useEffect } from 'react';

declare global {
    interface Window {
        fbq?: (...args: any[]) => void;
        _fbq?: any;
        gtag?: (...args: any[]) => void;
        dataLayer?: any[];
        clarity?: (...args: any[]) => void;
        lintrk?: ((...args: any[]) => void) & { q?: any[] };
        _linkedin_partner_id?: string;
        _linkedin_data_partner_ids?: string[];
    }
}

const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const GOOGLE_ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined;
const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined;
const LINKEDIN_PARTNER_ID = import.meta.env.VITE_LINKEDIN_PARTNER_ID as string | undefined;

function injectMetaPixel(id: string) {
    if (window.fbq) return;
    /* eslint-disable */
    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq?.('init', id);
    window.fbq?.('track', 'PageView');
}

/**
 * Meta `_fbp` cookie'sini fbq YÜKLENMEDEN erken garanti eder.
 *
 * Sorun: fbevents.js LCP koruması için tembel yükleniyor (ilk etkileşim / 4sn).
 * Hızlı dönüşen ziyaretçide `_fbp` henüz set edilmemiş oluyordu → lead'e fbp
 * yazılamıyor, Meta CAPI Event Match Quality düşüyordu (tarayıcı Lead'inde ~%55).
 *
 * Çözüm: Meta self-generated `_fbp`'yi kabul eder (format: fb.1.<ts>.<rastgele>).
 * fbq sonradan yüklendiğinde MEVCUT geçerli `_fbp`'yi olduğu gibi kullanır (asla
 * ezmez) → tarayıcı pixel'i + server-side CAPI aynı değeri paylaşır, dedup/uyum
 * bozulmaz. SADECE cookie yoksa yazar; gerçek fbq değerini asla değiştirmez.
 * Salt cookie yazımı — ağ/LCP maliyeti yok.
 */
function ensureFbp() {
    if (typeof document === 'undefined') return;
    if (/(?:^|;\s*)_fbp=/.test(document.cookie)) return; // zaten var (fbq veya bizden)
    let rnd: string;
    try {
        const buf = new Uint32Array(2);
        (globalThis.crypto as Crypto).getRandomValues(buf);
        rnd = `${buf[0]}${buf[1]}`;
    } catch {
        rnd = `${Math.floor(Math.random() * 1e10)}`;
    }
    const value = `fb.1.${Date.now()}.${rnd}`;
    // fbq `_fbp`'yi kayıtlı (registrable) domain'e yazar; aynısını hedefle ki
    // fbq yüklenince İKİNCİ bir `_fbp` üretmesin (host eşleşmezse çift cookie).
    const host = window.location.hostname;
    const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(host);
    const parts = host.split('.');
    const regDomain = (host === 'localhost' || isIp || parts.length < 2)
        ? undefined
        : '.' + parts.slice(-2).join('.');
    let c = `_fbp=${value}; path=/; max-age=${90 * 24 * 60 * 60}; SameSite=Lax`; // Meta _fbp ömrü 90 gün
    if (regDomain) c += `; domain=${regDomain}`;
    if (window.location.protocol === 'https:') c += '; Secure';
    document.cookie = c;
}

function injectClarity(projectId: string) {
    if (window.clarity) return;
    /* eslint-disable */
    (function (c: any, l: any, a: any, r: any, i: any, t?: any, y?: any) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", projectId);
    /* eslint-enable */
}

function injectLinkedInInsight(partnerId: string) {
    if (window.lintrk) return;
    // LinkedIn Insight Tag — li_fat_id / li_giant cookie'lerini set eder (Conversions
    // API eşleşmesi için kritik). Resmi snippet'in inject biçimi.
    window._linkedin_partner_id = partnerId;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(partnerId);
    const l = function (...args: any[]) { (window.lintrk!.q = window.lintrk!.q || []).push(args); } as Window['lintrk'];
    l!.q = [];
    window.lintrk = l;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(s, first);
}

function injectGoogleAds(id: string) {
    if (window.gtag) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer!.push(arguments as any); };
    window.gtag('js', new Date());
    window.gtag('config', id);
}

/** Mount once at app root. No-op if env vars are missing.
 *
 * Pixel scriptleri kullanıcının ilk etkileşimine (pointerdown/scroll/keydown/
 * touchstart) ya da 4 saniyelik güvenlik timeout'una kadar inject edilmez.
 * Sebep: fbevents.js (~70KB) + clarity.ms tag + gtag/js mount anında inject
 * edilince LCP görseliyle bant genişliği ve main-thread yarışıyor — özellikle
 * reklam tıklamasıyla gelen ilk-kez ziyaretçilerde 4G üzerinde hissedilir
 * gecikme yaratıyordu. İlk etkileşim her zaman LCP'den sonra olur; safety
 * timeout PageView event'inin Meta attribution penceresinin çok içinde
 * (~4s) firing'ini garantiler.
 */
export function AdPixels() {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        // Don't load pixels on admin/portal — only on customer-facing pages.
        const path = window.location.pathname;
        // /team (personel portali + calisan girisi) de ic yuzeydir — reklam
        // pixel'i calisanin tarayicisinda atesleyip kitleleri kirletmesin.
        if (path.startsWith('/admin') || path.startsWith('/portal')
            || path.startsWith('/login') || path.startsWith('/team')) return;
        // Heatmap iframe onizlemesi (admin paneldeki ?heatmap=1) gercek ziyaretci
        // sayilmaz — Clarity/Meta/Google pixel'larini yukleme. Iframe icindeki
        // Clarity postMessage zinciri konsolda yuzlerce "A listener indicated
        // an asynchronous response..." hatasi uretiyor ve gereksiz cookie yaziyordu.
        if (new URLSearchParams(window.location.search).get('heatmap') === '1') return;
        // `_fbp`'yi pixel yüklenmesini BEKLEMEDEN hemen garanti et — tembel
        // yüklemeden önce dönüşen ziyaretçide bile lead'e fbp yazılabilsin
        // (Meta CAPI match quality). Salt cookie yazımı; LCP'yi etkilemez.
        ensureFbp();
        // Clarity ayrica payment akisinda da yuklenmez (PCI / privacy).
        const isPaymentPath = path.startsWith('/payment') || /\/offer\/[^/]+\/odeme(\/|$)/.test(path);
        // Müşteri teklif sayfaları (/offer/:token, payment alt-yolu HARİÇ): burada
        // Clarity'yi ETKİLEŞİM BEKLEMEDEN hemen yükleriz. Sebep: teklife bakıp
        // dokunmadan çıkan müşteride _clck/_clsk cookie'leri hiç düşmüyordu →
        // session/lead'e clarity ID yazılamıyor, admin kartındaki "Kaydı Aç"
        // derin-linki çıkmıyordu. Landing/pazarlama sayfalarında tembel
        // (etkileşim/4sn) davranış LCP için korunur.
        const isOfferPath = path.startsWith('/offer/') && !isPaymentPath;

        let fired = false;
        const runPixels = () => {
            if (fired) return;
            fired = true;
            if (META_PIXEL_ID) injectMetaPixel(META_PIXEL_ID);
            if (GOOGLE_ADS_ID) injectGoogleAds(GOOGLE_ADS_ID);
            if (LINKEDIN_PARTNER_ID) injectLinkedInInsight(LINKEDIN_PARTNER_ID);
            if (!isPaymentPath) {
                if (CLARITY_PROJECT_ID) {
                    injectClarity(CLARITY_PROJECT_ID);
                } else {
                    fetch('/api/internal/runtime-config')
                        .then(r => r.ok ? r.json() : null)
                        .then((cfg: any) => {
                            const id = cfg?.clarityProjectId;
                            if (id && typeof id === 'string') injectClarity(id);
                        })
                        .catch(() => { /* swallow */ });
                }
            }
        };

        const fireOnce = () => {
            cleanup();
            const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
            if (w.requestIdleCallback) w.requestIdleCallback(runPixels, { timeout: 1500 });
            else setTimeout(runPixels, 0);
        };

        // Teklif sayfasında etkileşim bekleme — idle callback ile hemen yükle
        // (main-thread'i bloklamadan). Listener/safety-timeout kurmayız.
        if (isOfferPath) {
            const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
            if (w.requestIdleCallback) w.requestIdleCallback(runPixels, { timeout: 1500 });
            else setTimeout(runPixels, 0);
            return;
        }

        const opts: AddEventListenerOptions = { once: true, passive: true, capture: true };
        const cleanup = () => {
            window.removeEventListener('pointerdown', fireOnce, opts);
            window.removeEventListener('touchstart', fireOnce, opts);
            window.removeEventListener('scroll', fireOnce, opts);
            window.removeEventListener('keydown', fireOnce, opts);
            window.removeEventListener('mousemove', fireOnce, opts);
        };
        window.addEventListener('pointerdown', fireOnce, opts);
        window.addEventListener('touchstart', fireOnce, opts);
        window.addEventListener('scroll', fireOnce, opts);
        window.addEventListener('keydown', fireOnce, opts);
        window.addEventListener('mousemove', fireOnce, opts);

        // Safety net: hiç etkileşim olmasa bile 4s sonra fire et. Meta CAPI
        // PageView attribution penceresi (24-saat click) için sorunsuz.
        const safety = setTimeout(fireOnce, 4000);

        return () => {
            cleanup();
            clearTimeout(safety);
        };
    }, []);
    return null;
}

/**
 * Forward a conversion event to all installed pixels. Safe to call even when
 * pixels aren't installed — fbq/gtag will just be undefined.
 *
 * `eventId` opsiyonel — Meta CAPI dedup için aynı event_id ile server-side
 * CAPI çağrısı yapılır. fbq 4. argümanı `{ eventID }` formatında kabul eder.
 *
 * `linkedInConversionId` opsiyonel — verilirse LinkedIn Insight Tag'e
 * `lintrk('track', { conversion_id })` ile dönüşüm bildirilir (id eşlemesi
 * tracking.ts'te). Server-side LinkedIn Conversions API ayrıca aynı eventId ile
 * /api/linkedin/conversion-event üzerinden gönderilir (dedup).
 */
export function firePixelEvent(
    name: string,
    params?: Record<string, any>,
    eventId?: string,
    linkedInConversionId?: number,
): void {
    try {
        if (eventId) {
            window.fbq?.('track', name, params, { eventID: eventId });
        } else {
            window.fbq?.('track', name, params);
        }
    } catch { /* swallow */ }
    try {
        // For Google Ads, conversion events use 'conversion' with send_to.
        if (window.gtag && GOOGLE_ADS_ID) {
            window.gtag('event', name, { ...params, send_to: GOOGLE_ADS_ID });
        }
    } catch { /* swallow */ }
    try {
        if (linkedInConversionId && window.lintrk) {
            window.lintrk('track', { conversion_id: linkedInConversionId });
        }
    } catch { /* swallow */ }
}
