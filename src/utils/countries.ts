/**
 * Static country reference. Each entry maps an ISO-3166 alpha-2 country code to
 * its display name and the currency that country uses by default.
 *
 * Used by the admin pricing forms to let an operator pick a country (e.g. IT,
 * FR, DE, PL, NL) and have the form pre-fill the matching currency. The
 * customer flow then resolves the most-specific pricing_rules row based on the
 * offer's `country_code` (more specific than `market_code`).
 *
 * If a country uses a currency that's not in `SUPPORTED_CURRENCIES`, treat the
 * customer flow as falling back to the market's default currency.
 */

export interface CountryInfo {
  code: string;          // ISO-3166 alpha-2 (e.g. 'TR', 'IT', 'PL')
  name: string;          // Display name in English
  currency: string;      // ISO-4217 alpha-3 (e.g. 'EUR', 'PLN')
  market_code: string;   // The MarketConfig this country lives under (TR / EU / GB / US / SA / AE)
  flag: string;          // Emoji flag for UI
  /** Standard VAT rate as a percent (e.g. 19 for Germany). Falls back to market default when null. */
  vat_rate: number;
}

// Currencies the app already supports for formatting / pricing.
export const SUPPORTED_CURRENCIES = [
  'TRY', 'EUR', 'GBP', 'USD', 'SAR', 'AED',
  'PLN', 'CHF', 'NOK', 'SEK', 'DKK', 'CZK', 'HUF', 'RON', 'BGN',
] as const;

// Standard VAT/sales-tax rates as of 2026. These are the customer-facing
// "B2B+B2C" rate at which we issue invoices; admins can override per-rule via
// pricing_rules if a campaign needs a different effective rate.
export const COUNTRIES: CountryInfo[] = [
  // TR market
  { code: 'TR', name: 'Türkiye', currency: 'TRY', market_code: 'TR', flag: '🇹🇷', vat_rate: 20 },

  // EU market — Eurozone
  { code: 'DE', name: 'Germany', currency: 'EUR', market_code: 'EU', flag: '🇩🇪', vat_rate: 19 },
  { code: 'FR', name: 'France', currency: 'EUR', market_code: 'EU', flag: '🇫🇷', vat_rate: 20 },
  { code: 'IT', name: 'Italy', currency: 'EUR', market_code: 'EU', flag: '🇮🇹', vat_rate: 22 },
  { code: 'ES', name: 'Spain', currency: 'EUR', market_code: 'EU', flag: '🇪🇸', vat_rate: 21 },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', market_code: 'EU', flag: '🇳🇱', vat_rate: 21 },
  { code: 'BE', name: 'Belgium', currency: 'EUR', market_code: 'EU', flag: '🇧🇪', vat_rate: 21 },
  { code: 'AT', name: 'Austria', currency: 'EUR', market_code: 'EU', flag: '🇦🇹', vat_rate: 20 },
  { code: 'PT', name: 'Portugal', currency: 'EUR', market_code: 'EU', flag: '🇵🇹', vat_rate: 23 },
  { code: 'IE', name: 'Ireland', currency: 'EUR', market_code: 'EU', flag: '🇮🇪', vat_rate: 23 },
  { code: 'GR', name: 'Greece', currency: 'EUR', market_code: 'EU', flag: '🇬🇷', vat_rate: 24 },
  { code: 'FI', name: 'Finland', currency: 'EUR', market_code: 'EU', flag: '🇫🇮', vat_rate: 24 },
  // EU market — non-Euro
  { code: 'PL', name: 'Poland', currency: 'PLN', market_code: 'EU', flag: '🇵🇱', vat_rate: 23 },
  { code: 'CZ', name: 'Czech Republic', currency: 'CZK', market_code: 'EU', flag: '🇨🇿', vat_rate: 21 },
  { code: 'HU', name: 'Hungary', currency: 'HUF', market_code: 'EU', flag: '🇭🇺', vat_rate: 27 },
  { code: 'RO', name: 'Romania', currency: 'EUR', market_code: 'EU', flag: '🇷🇴', vat_rate: 19 },
  { code: 'BG', name: 'Bulgaria', currency: 'EUR', market_code: 'EU', flag: '🇧🇬', vat_rate: 20 },
  { code: 'SE', name: 'Sweden', currency: 'SEK', market_code: 'EU', flag: '🇸🇪', vat_rate: 25 },
  { code: 'DK', name: 'Denmark', currency: 'DKK', market_code: 'EU', flag: '🇩🇰', vat_rate: 25 },
  { code: 'NO', name: 'Norway', currency: 'NOK', market_code: 'EU', flag: '🇳🇴', vat_rate: 25 },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', market_code: 'EU', flag: '🇨🇭', vat_rate: 8.1 },

  // GB market
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', market_code: 'GB', flag: '🇬🇧', vat_rate: 20 },

  // US market — sales tax varies wildly by state, default to 0 and admins set per-state if needed
  { code: 'US', name: 'United States', currency: 'USD', market_code: 'US', flag: '🇺🇸', vat_rate: 0 },
  { code: 'CA', name: 'Canada', currency: 'USD', market_code: 'US', flag: '🇨🇦', vat_rate: 5 }, // GST only; provinces add HST/PST

  // MENA markets
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', market_code: 'SA', flag: '🇸🇦', vat_rate: 15 },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', market_code: 'AE', flag: '🇦🇪', vat_rate: 5 },
];

export function getCountryByCode(code?: string | null): CountryInfo | null {
  if (!code) return null;
  return COUNTRIES.find(c => c.code === code.toUpperCase()) || null;
}

export function getCountriesByMarket(marketCode: string): CountryInfo[] {
  return COUNTRIES.filter(c => c.market_code === marketCode);
}

export function getCurrencyForCountry(code: string): string {
  return getCountryByCode(code)?.currency || 'TRY';
}

/**
 * Map a UI language to the most likely target country. Used by the customer flow
 * so switching the language switcher (TR → DE → IT) re-prices the offer in that
 * country's currency and VAT.
 *
 *   tr → TR, de → DE, fr → FR, it → IT, es → ES, pl → PL,
 *   en → GB (defaults to UK; admins can override per-link with country_code)
 */
export function getCountryForLanguage(lang?: string | null): string | null {
  const code = (lang || '').split('-')[0].toLowerCase();
  if (!code) return null;
  const map: Record<string, string> = {
    tr: 'TR', de: 'DE', fr: 'FR', it: 'IT', es: 'ES', pt: 'PT',
    nl: 'NL', pl: 'PL', cs: 'CZ', hu: 'HU', ro: 'RO', bg: 'BG',
    sv: 'SE', da: 'DK', no: 'NO', fi: 'FI', el: 'GR', en: 'GB',
  };
  return map[code] || null;
}

/**
 * Dial code → ISO country. Mirrors the lead-capture modal's
 * PHONE_PREFIX_TO_COUNTRY (CustomerOffer.tsx); kept here so the offer flow can
 * recover a country from the lead's stored E.164 phone when no country was
 * declared on the link.
 */
const PHONE_DIAL_TO_COUNTRY: Record<string, string> = {
  '+90': 'TR', '+49': 'DE', '+33': 'FR', '+39': 'IT', '+34': 'ES', '+31': 'NL',
  '+32': 'BE', '+43': 'AT', '+351': 'PT', '+353': 'IE', '+30': 'GR', '+358': 'FI',
  '+48': 'PL', '+420': 'CZ', '+36': 'HU', '+40': 'RO', '+359': 'BG',
  '+46': 'SE', '+45': 'DK', '+47': 'NO', '+41': 'CH',
  '+44': 'GB', '+1': 'US', '+966': 'SA', '+971': 'AE',
};

/**
 * Derive an ISO country code from an E.164 phone number ("+905551234567" → "TR").
 * Used as a LAST-RESORT signal in the offer flow when the lead declared no
 * country_code: without it a +90 lead viewing a non-Turkish offer falls through
 * to GLOBAL/USD pricing and gets a USD amount stamped with ₺. Longest dial-code
 * prefix wins so '+1' never shadows '+44'/'+49'/etc.
 */
export function getCountryByPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return null;
  const e164 = '+' + digits;
  const prefixes = Object.keys(PHONE_DIAL_TO_COUNTRY).sort((a, b) => b.length - a.length);
  for (const p of prefixes) {
    if (e164.startsWith(p)) return PHONE_DIAL_TO_COUNTRY[p];
  }
  return null;
}

/** Admin ülke sekmelerinde "hiçbir ülkeye çözülemedi" kovasının anahtarı. */
export const UNKNOWN_COUNTRY = 'unknown';

/** Bir ISO ülkeye ait çevirme kodları, '+' olmadan ('TR' → ['90']). */
export function getDialCodesForCountry(code?: string | null): string[] {
  if (!code) return [];
  const iso = code.toUpperCase();
  return Object.entries(PHONE_DIAL_TO_COUNTRY)
    .filter(([, c]) => c === iso)
    .map(([dial]) => dial.slice(1));
}

/** Bilinen tüm çevirme kodları, '+' olmadan. */
export function getAllDialCodes(): string[] {
  return Object.keys(PHONE_DIAL_TO_COUNTRY).map(d => d.slice(1));
}

/**
 * getCountryByPhone'un "uzun önek kazanır" kuralının SQL karşılığı.
 * JS tarafında önekler uzunluğa göre sıralanıp ilk eşleşme alınıyor; `like`
 * ile bu yapılamadığı için daha uzun ve BAŞKA ülkeye ait önekler açıkça
 * dışlanmalı (ör. '+1' seçiliyken '+1xxx' bir ülkeye atansa onu kapmasın).
 *
 *   include → telefon bu öneklerden biriyle başlamalı
 *   exclude → ...ama bunlarla başlamamalı
 */
export function buildCountryPhoneFilter(code: string): { include: string[]; exclude: string[] } {
  const include = getDialCodesForCountry(code);
  if (include.length === 0) return { include: [], exclude: [] };
  const exclude = getAllDialCodes().filter(
    p => include.some(i => p.length > i.length && p.startsWith(i)),
  );
  return { include, exclude };
}

/**
 * resolveLeadCountry'nin PostgREST karşılığı: belirli bir ülkeye ait satırları
 * seçen `.or()` argümanı. Saf fonksiyon — sorgu dizgisi test edilebilsin diye
 * servisten ayrı tutuluyor.
 *
 *   'TR' → "country_code.eq.TR,country_code.eq.tr,
 *           and(country_code.is.null,phone_number.like.90*)"
 *
 * Beyan edilmiş kod büyük/küçük harfli olabildiği için iki eq (ilike yerine —
 * btree indeksi kullanılmaya devam etsin). Beyan yoksa telefon ön ekine düşülür.
 */
export function buildCountryOrFilter(code: string): string {
  const iso = code.toUpperCase();
  const conds = [`country_code.eq.${iso}`, `country_code.eq.${iso.toLowerCase()}`];
  const { include, exclude } = buildCountryPhoneFilter(iso);
  if (include.length > 0) {
    const parts = ['country_code.is.null'];
    parts.push(include.length === 1
      ? `phone_number.like.${include[0]}*`
      : `or(${include.map(p => `phone_number.like.${p}*`).join(',')})`);
    exclude.forEach(p => parts.push(`phone_number.not.like.${p}*`));
    conds.push(`and(${parts.join(',')})`);
  }
  return conds.join(',');
}

/**
 * "Bilinmiyor" kovasının `.or()` argümanı — `.is('country_code', null)` ile
 * BİRLİKTE kullanılır (zincirlenen filtreler üst düzeyde AND'lenir).
 *
 * phone_number.is.null şart: telefonsuz satırda `not.like` NULL döner ve satır
 * hiçbir sekmeye düşmeden sessizce kaybolurdu.
 */
export function buildUnknownCountryOrFilter(): string {
  const unmatched = getAllDialCodes().map(p => `phone_number.not.like.${p}*`).join(',');
  return unmatched ? `phone_number.is.null,and(${unmatched})` : 'phone_number.is.null';
}

/**
 * Bir lead/teklif satırının ait olduğu ülke — TEK doğruluk kaynağı.
 *
 * country_code yalnız guest yakalama yolunda doluyor (guest.ts / leadDedup.ts);
 * elle veya sheet'ten açılan leadlerde boş. Bu yüzden telefon ön eki son çare
 * sinyal olarak kullanılır. Ülke sekmesi sayacı, sunucu filtresi, istemci
 * filtresi ve tablodaki bayrak hep BUNU çağırmalı — aksi halde bir lead 🇹🇷
 * sekmesinde listelenirken satırında bayrağı görünmez.
 */
export function resolveLeadCountry(
  row?: { country_code?: string | null; phone_number?: string | null } | null,
): string | null {
  const declared = (row?.country_code || '').trim().toUpperCase();
  if (declared) return declared;
  return getCountryByPhone(row?.phone_number);
}

/**
 * Resolve VAT rate for a country, falling back to a sane default by market when
 * the country is unknown. Returns a percent (e.g. 22 for Italy).
 */
export function getVatRateForCountry(countryCode?: string | null, marketFallback?: number): number {
  const c = getCountryByCode(countryCode);
  if (c) return c.vat_rate;
  if (typeof marketFallback === 'number') return marketFallback;
  return 20;
}

/**
 * Get the default UI language for a given country code.
 * Used for auto-selecting the language dropdown when IP detects a country
 * or when the user manually changes the country dropdown.
 */
export function getLanguageForCountry(countryCode?: string | null): string {
  if (!countryCode) return 'en';
  const code = countryCode.toUpperCase();
  const map: Record<string, string> = {
    TR: 'tr', DE: 'de', FR: 'fr', IT: 'it', ES: 'es', PT: 'pt',
    NL: 'nl', PL: 'pl', CZ: 'cs', HU: 'hu', RO: 'ro', BG: 'bg',
    SE: 'sv', DK: 'da', NO: 'no', FI: 'fi', GR: 'el', GB: 'en',
    US: 'en', CA: 'en', AE: 'ar', SA: 'ar',
  };
  return map[code] || 'en';
}
