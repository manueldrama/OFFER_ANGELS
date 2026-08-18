import { getLanguageLocales, type SupportedLanguage } from '../i18n';

export type SupportedCurrency =
  | 'TRY' | 'EUR' | 'GBP' | 'USD' | 'SAR' | 'AED'
  | 'PLN' | 'RON' | 'CZK' | 'HUF'
  | 'BGN' | 'DKK' | 'SEK' | 'NOK';

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  TRY: '₺',
  EUR: '€',
  GBP: '£',
  USD: '$',
  SAR: 'SAR',
  AED: 'AED',
  PLN: 'zł',
  RON: 'lei',
  CZK: 'Kč',
  HUF: 'Ft',
  BGN: 'лв',
  DKK: 'kr',
  SEK: 'kr',
  NOK: 'kr',
};

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}-${currency}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    formatterCache.set(key, fmt);
  }
  return fmt;
}

/**
 * Format a price amount with locale-aware currency display.
 *
 * @example
 * formatPrice(149000, 'TRY', 'tr') → '₺149.000'
 * formatPrice(5500, 'EUR', 'de')   → '5.500 €'
 * formatPrice(5500, 'EUR', 'en')   → '€5,500.00'
 * formatPrice(5500, 'GBP', 'en')   → '£5,500.00'
 */
export function formatPrice(
  amount: number,
  currency: SupportedCurrency = 'TRY',
  language: SupportedLanguage = 'tr'
): string {
  const locale = getLanguageLocales()[language] || 'tr-TR';
  return getFormatter(locale, currency).format(amount);
}

/**
 * Format a price with no decimal places (for whole numbers like 149.000 ₺).
 */
export function formatPriceCompact(
  amount: number,
  currency: SupportedCurrency = 'TRY',
  language: SupportedLanguage = 'tr'
): string {
  const locale = getLanguageLocales()[language] || 'tr-TR';
  const fmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return fmt.format(amount);
}

/**
 * Get the currency symbol for display purposes.
 */
export function getCurrencySymbol(currency: SupportedCurrency): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * Format a number with locale-aware grouping (no currency symbol).
 *
 * @example
 * formatNumber(149000, 'tr') → '149.000'
 * formatNumber(149000, 'en') → '149,000'
 */
export function formatNumber(amount: number, language: SupportedLanguage = 'tr'): string {
  const locale = getLanguageLocales()[language] || 'tr-TR';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a percentage value.
 *
 * @example
 * formatPercent(0.15, 'tr') → '%15'
 * formatPercent(0.15, 'en') → '15%'
 */
export function formatPercent(value: number, language: SupportedLanguage = 'tr'): string {
  const locale = getLanguageLocales()[language] || 'tr-TR';
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}
