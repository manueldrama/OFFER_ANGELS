import { COUNTRIES, getCountryByCode, getCountryForLanguage } from './countries';

/**
 * Three-tier country detection used by the customer offer flow.
 *
 *   1. Manual override (`localStorage.cafepaste_country_manual`)
 *      — set when the customer explicitly switches language/country.
 *   2. IP geolocation (ipapi.co, free tier — no API key needed).
 *   3. Browser language → country mapping (de → DE, fr → FR, en → GB …).
 *
 * The result is cached in sessionStorage so we only hit ipapi once per tab.
 * Returns `null` only when every tier fails — callers should fall back to
 * their own default (typically `TR` or the offer link's `country_code`).
 */

const MANUAL_KEY = 'cafepaste_country_manual';
const SESSION_KEY = 'cafepaste_country_detected';

/** Persist a manual country choice (called when the customer picks a language). */
export function setManualCountry(code: string): void {
  if (typeof window === 'undefined') return;
  if (!getCountryByCode(code)) return; // Reject unknown codes silently.
  localStorage.setItem(MANUAL_KEY, code.toUpperCase());
  // Clear the session-cached IP detection so the new choice takes effect immediately.
  sessionStorage.removeItem(SESSION_KEY);
}

export function getManualCountry(): string | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(MANUAL_KEY);
  return v && getCountryByCode(v) ? v.toUpperCase() : null;
}

/** Internal: query ipapi.co. Returns null on failure. */
async function detectCountryByIp(): Promise<string | null> {
  // Cached this tab session?
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) return cached === '__none__' ? null : cached;
  } catch {
    /* ignore */
  }

  // Skip the network round-trip on localhost / dev — ipapi can't see the dev
  // server's IP anyway and the 1.5s timeout adds visible loading lag.
  if (typeof window !== 'undefined') {
    const host = window.location?.hostname || '';
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.')) {
      try { sessionStorage.setItem(SESSION_KEY, '__none__'); } catch { /* ignore */ }
      return null;
    }
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) {
      sessionStorage.setItem(SESSION_KEY, '__none__');
      return null;
    }
    const data = await res.json();
    const code = (data?.country_code || '').toString().toUpperCase();
    if (code && getCountryByCode(code)) {
      sessionStorage.setItem(SESSION_KEY, code);
      return code;
    }
    sessionStorage.setItem(SESSION_KEY, '__none__');
    return null;
  } catch {
    try { sessionStorage.setItem(SESSION_KEY, '__none__'); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Resolve the customer's country.
 *
 * Priority (most → least specific):
 *   1. Manual country override (`cafepaste_country_manual`)
 *   2. Manual *language* override (`cafepaste_language_manual`) — if the user
 *      explicitly picked a language, that's a stronger signal of intended
 *      market than their physical IP. Otherwise a Turkish customer who
 *      switches to German would keep seeing TR pricing.
 *   3. IP geolocation (ipapi.co)
 *   4. Current browser/i18n language → country
 *   5. null → caller decides (typically falls back to TR)
 */
export async function detectCustomerCountry(currentLanguage?: string): Promise<string | null> {
  const manual = getManualCountry();
  if (manual) return manual;

  // A manually-picked language is a stronger signal than IP for our purposes.
  const manualLang = typeof window !== 'undefined'
    ? localStorage.getItem('cafepaste_language_manual')
    : null;
  if (manualLang) {
    const fromLang = getCountryForLanguage(manualLang);
    if (fromLang && getCountryByCode(fromLang)) return fromLang;
  }

  const ip = await detectCountryByIp();
  if (ip) return ip;

  const langCountry = getCountryForLanguage(currentLanguage);
  if (langCountry && getCountryByCode(langCountry)) return langCountry;

  return null;
}

/** Synchronous variant — manual override + manual language + browser language, no IP. */
export function detectCustomerCountrySync(currentLanguage?: string): string | null {
  const manual = getManualCountry();
  if (manual) return manual;

  const manualLang = typeof window !== 'undefined'
    ? localStorage.getItem('cafepaste_language_manual')
    : null;
  if (manualLang) {
    const fromLang = getCountryForLanguage(manualLang);
    if (fromLang && getCountryByCode(fromLang)) return fromLang;
  }

  const langCountry = getCountryForLanguage(currentLanguage);
  if (langCountry && getCountryByCode(langCountry)) return langCountry;
  return null;
}

export const COUNTRY_LIST_FOR_FLAGS = COUNTRIES;
