import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import SupabaseBackend from './supabaseBackend';
import { recordI18nUsage } from '../hooks/i18nUsageTracker';

// Bundled fallback (TR only) — used when DB is unreachable
import trCommon from './locales/tr/common.json';
import trOffer from './locales/tr/offer.json';
import trPayment from './locales/tr/payment.json';
import trValidation from './locales/tr/validation.json';
import trInfluencer from './locales/tr/influencer.json';
import trContact from './locales/tr/contact.json';
// İşe alım portalı (aday yüzeyi). YALNIZ TR paketlenir — aşağıdaki nota bakın.
import trOnboarding from './locales/tr/onboarding.json';
// Online video mülakat (aday yüzeyi). Aynı kural: YALNIZ TR paketlenir.
import trInterview from './locales/tr/interview.json';
import trCareer from './locales/tr/career.json';
import trPortal from './locales/tr/portal.json';
import enOffer from './locales/en/offer.json';
import deOffer from './locales/de/offer.json';
import frOffer from './locales/fr/offer.json';
import esOffer from './locales/es/offer.json';
import itOffer from './locales/it/offer.json';
import plOffer from './locales/pl/offer.json';

// ── Static fallback (used before DB loads) ───────────────────────
export const FALLBACK_LANGUAGES = ['tr', 'en', 'de', 'fr', 'es', 'pl', 'it'] as const;

/** @deprecated Use getSupportedLanguages() for dynamic list */
export const SUPPORTED_LANGUAGES = FALLBACK_LANGUAGES;
export type SupportedLanguage = string;

/** @deprecated Use getLanguageLabels() for dynamic map */
export const LANGUAGE_LABELS: Record<string, string> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  pl: 'Polski',
  it: 'Italiano',
};

/** @deprecated Use getLanguageLocales() for dynamic map */
export const LANGUAGE_LOCALES: Record<string, string> = {
  tr: 'tr-TR',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  pl: 'pl-PL',
  it: 'it-IT',
};

// ── Dynamic state (populated from DB) ────────────────────────────
let _dynamicLanguages: string[] = [...FALLBACK_LANGUAGES];
let _dynamicLabels: Record<string, string> = { ...LANGUAGE_LABELS };
let _dynamicLocales: Record<string, string> = { ...LANGUAGE_LOCALES };
let _dynamicFlags: Record<string, string> = {
  tr: '🇹🇷',
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
  es: '🇪🇸',
  pl: '🇵🇱',
  it: '🇮🇹',
  ro: '🇷🇴',
};
let _loaded = false;

/** Get current active language codes */
export function getSupportedLanguages(): string[] {
  return _dynamicLanguages;
}

/** Get current language label map */
export function getLanguageLabels(): Record<string, string> {
  return _dynamicLabels;
}

/** Get current language locale map */
export function getLanguageLocales(): Record<string, string> {
  return _dynamicLocales;
}

/** Get current language flag emoji map */
export function getLanguageFlags(): Record<string, string> {
  return _dynamicFlags;
}

/** Whether dynamic languages have been loaded from DB */
export function isLanguagesLoaded(): boolean {
  return _loaded;
}

/** Load active languages from Supabase and update i18n config */
export async function loadLanguagesFromDB(): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { LanguageService } = await import('../services/admin/languageService');
    const langs = await LanguageService.getActive();
    if (langs.length > 0) {
      _dynamicLanguages = langs.map(l => l.code);
      _dynamicLabels = Object.fromEntries(langs.map(l => [l.code, l.label]));
      _dynamicLocales = Object.fromEntries(langs.map(l => [l.code, l.locale]));
      _dynamicFlags = Object.fromEntries(langs.map(l => [l.code, l.flag_emoji]));
      _loaded = true;
    }
  } catch (e) {
    console.warn('[i18n] Could not load languages from DB, using fallback:', e);
  }
}

/** Refresh languages from DB (call after add/remove) */
export async function refreshSupportedLanguages(): Promise<void> {
  const { LanguageService } = await import('../services/admin/languageService');
  LanguageService.invalidateCache();
  await loadLanguagesFromDB();
}

/**
 * Map a language code to a default market_code when no explicit market is set
 * on the offer link or campaign. Used as a last-resort fallback before defaulting to 'TR'.
 *
 *   tr             → TR
 *   it,de,fr,es,pl → EU
 *   en             → GB
 *   <other>        → TR (safe default)
 */
export function getDefaultMarketForLanguage(lang?: string | null): string {
  const code = (lang || '').split('-')[0].toLowerCase();
  if (code === 'tr') return 'TR';
  if (['it', 'de', 'fr', 'es', 'pl'].includes(code)) return 'EU';
  if (code === 'en') return 'GB';
  return 'TR';
}

/**
 * Public/anonymous bağlamlarda (lead capture'dan önce) currency tahmini için.
 * Lead capture sonrası `useOfferLocale().currency` kullanılır — bu helper
 * yalnızca LandingPage ve admin designer preview gibi locale provider'sız
 * yerlerde çağrılmalı.
 *
 *   tr             → TRY
 *   en             → GBP (EN-GB önceliği — EN-US için ileride genişletilebilir)
 *   de,it,fr,es,pl → EUR
 *   ro             → RON
 *   cs             → CZK
 *   hu             → HUF
 *   <other>        → TRY
 */
export function getDefaultCurrencyForLanguage(lang?: string | null): string {
  const code = (lang || '').split('-')[0].toLowerCase();
  if (code === 'tr') return 'TRY';
  if (code === 'en') return 'GBP';
  // Eurozone üyeleri (2024 itibarıyla 20 ülke):
  //   de (Almanya, Avusturya), it (İtalya), fr (Fransa), es (İspanya),
  //   pt (Portekiz), nl (Hollanda), be (Belçika - flam.), el/gr (Yunanistan),
  //   ga (İrlanda), fi (Fince), et (Estonya), lv (Letonca), lt (Litvanca),
  //   sk (Slovakça), sl (Slovence), mt (Maltaca), hr (Hırvatistan - 2023)
  if (['de', 'it', 'fr', 'es', 'pt', 'nl', 'be', 'el', 'gr', 'ga', 'fi', 'et', 'lv', 'lt', 'sk', 'sl', 'mt', 'hr'].includes(code)) return 'EUR';
  // Eurozone DIŞI Avrupa para birimleri:
  if (code === 'pl') return 'PLN'; // Polonya — Złoty
  if (code === 'ro') return 'RON'; // Romanya — Leu
  if (code === 'cs') return 'CZK'; // Çekya — Koruna
  if (code === 'hu') return 'HUF'; // Macaristan — Forint
  if (code === 'bg') return 'BGN'; // Bulgaristan — Lev (2025'te EUR'a geçecek)
  if (code === 'da') return 'DKK'; // Danimarka — Krone
  if (code === 'sv') return 'SEK'; // İsveç — Krona
  if (code === 'no') return 'NOK'; // Norveç — Krone
  return 'TRY';
}

/**
 * Kurumsal iletişim sayfasının dile özel URL slug'ları.
 *   tr → iletisim, en/fr → contact, de/pl → kontakt, es → contacto, it → contatti
 * Bilinmeyen dillerde nötr İngilizce 'contact'.
 */
const CONTACT_SLUGS: Record<string, string> = {
  tr: 'iletisim',
  en: 'contact',
  de: 'kontakt',
  fr: 'contact',
  es: 'contacto',
  it: 'contatti',
  pl: 'kontakt',
};

/** Verilen dil için iletişim sayfası slug'ı (örn. 'de' → 'kontakt'). */
export function contactSlugForLang(lang?: string | null): string {
  const code = (lang || '').split('-')[0].toLowerCase();
  return CONTACT_SLUGS[code] || 'contact';
}

/** Router'a kaydedilecek benzersiz iletişim slug listesi (iletisim, contact, kontakt, contacto, contatti). */
export const CONTACT_SLUG_LIST: string[] = Array.from(new Set(Object.values(CONTACT_SLUGS)));

/** Detect browser language, strip region, and validate against supported list */
export function detectBrowserLanguage(): string {
  // 1. Manual user choice
  const manual = localStorage.getItem('cafepaste_language_manual');
  if (manual && _dynamicLanguages.includes(manual)) {
    return manual;
  }
  // 2. Browser language
  const nav = navigator.language?.split('-')[0];
  if (nav && _dynamicLanguages.includes(nav)) {
    return nav;
  }
  // 3. Check all browser languages
  for (const lang of navigator.languages || []) {
    const code = lang.split('-')[0];
    if (_dynamicLanguages.includes(code)) {
      return code;
    }
  }
  return 'tr';
}

const detectedLang = detectBrowserLanguage();

// Post-processor that records every t() call so the Universal Edit Overlay
// can list all rendered i18n keys (even ones not wrapped with EditableI18nText).
const usageTracker = {
    type: 'postProcessor' as const,
    name: 'usageTracker',
    process: function (value: string, key: string | string[], options: any): string {
        try {
            const k = Array.isArray(key) ? key[0] : key;
            const ns = options?.ns
                ? (Array.isArray(options.ns) ? options.ns[0] : options.ns)
                : (k && k.includes(':') ? k.split(':')[0] : 'common');
            const cleanKey = k && k.includes(':') ? k.split(':').slice(1).join(':') : k;
            recordI18nUsage(ns, cleanKey, value, i18n.language || 'tr');
        } catch { /* ignore */ }
        return value;
    },
};

export const i18nReady = i18n
  .use(SupabaseBackend)
  .use(initReactI18next)
  .use(usageTracker)
  .init({
    postProcess: ['usageTracker'],
    lng: detectedLang,
    partialBundledLanguages: true,
    resources: {
      // NOT: Bundled bir resource olan namespace, i18next tarafindan "yuklendi"
      // sayilir ve backend'den (Supabase DB) CEKILMEZ (queueLoad → hasResourceBundle
      // kisa devre; partialBundledLanguages bunu engellemiyor). Bu yuzden cevirisi
      // DB'den gelen `offer` namespace'i HICBIR dilde bundle EDILMEMELI (tr fallback
      // haric). Indirilen teklif gorselinin pdf metinleri ayri `offerpdf`
      // namespace'inde bundle edilir — boylece `offer` DB'den yuklenir, gorsel yine
      // tum dillerde calisir.
      // `portal` follows the same rule as the others: bundled for tr only, so
      // the remaining six locales load it from the DB backend instead.
      tr: { common: trCommon, offer: trOffer, payment: trPayment, validation: trValidation, influencer: trInfluencer, contact: trContact, onboarding: trOnboarding, interview: trInterview, career: trCareer, portal: trPortal, offerpdf: trOffer },
      en: { offerpdf: enOffer },
      de: { offerpdf: deOffer },
      fr: { offerpdf: frOffer },
      es: { offerpdf: esOffer },
      it: { offerpdf: itOffer },
      pl: { offerpdf: plOffer },
    },
    load: 'languageOnly',
    supportedLngs: false, // Accept any language code dynamically
    // ONCE EN, SONRA TR — bilincli sira.
    //
    // Eskiden yalniz 'tr' idi. Sonuc: cevirisi tamamlanmamis bir dilde
    // (Lehce, Ispanyolca, Almanca) eksik anahtar TURKCE basiliyordu. Polonyali
    // adayin Turkce metin gormesi, Ingilizce gormesinden kotudur.
    //
    // Zincir yalnizca AKTIF DILDE ANAHTAR YOKSA devreye girer; Turkce
    // kullanicinin gordugu hicbir sey degismez (aktif dil zaten tr).
    // Ingilizce de eksikse Turkce'ye dusmeye devam eder — yani bu degisiklik
    // hicbir metni kaybettirmez, yalnizca ara bir basamak ekler.
    fallbackLng: ['en', 'tr'],
    defaultNS: 'common',
    ns: ['common', 'offer', 'payment', 'validation', 'products', 'influencer', 'contact', 'onboarding', 'interview', 'career', 'portal', 'offerpdf'],
    // saveMissing KAPALI: acikken, henuz DB'ye senkronlanmamis bir anahtar
    // render edilince i18next backend.create() ile DB'ye "TR degeri = anahtar
    // adi" olarak yaziyordu (orn. reservation.singlePayment kaynagi
    // 'reservation.singlePayment' oluyordu). Bu kaynak kirliligini kalici hale
    // getiriyordu. Anahtarlar artik syncBundledKeysToDb ile dogru TR metniyle
    // DB'ye dusuyor; saveMissing'e gerek yok ve zararli.
    saveMissing: false,
    updateMissing: false,
    interpolation: {
      escapeValue: false,
    },
  });

// Sync <html lang="..."> with i18next so locale-aware CSS (text-transform: uppercase)
// behaves correctly per language (e.g., Turkish "i" → "İ" vs English "i" → "I").
function syncHtmlLang(lang: string) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
  }
}
syncHtmlLang(i18n.language || detectedLang);
i18n.on('languageChanged', syncHtmlLang);

// After init, load languages from DB and force the detected language
export const i18nFullyReady = i18nReady.then(async () => {
  await loadLanguagesFromDB();
  const lang = detectBrowserLanguage();
  if (i18n.language !== lang) {
    return i18n.changeLanguage(lang);
  }
});

export default i18n;
