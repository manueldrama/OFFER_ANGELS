import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MarketConfigService } from '../services/admin/marketConfigService';
import { formatPrice, formatPriceCompact, formatNumber, formatPercent, type SupportedCurrency } from '../utils/currency';
import { getLanguageLocales, detectBrowserLanguage, type SupportedLanguage } from '../i18n';
import { getVatRateForCountry, getCurrencyForCountry, getCountryByCode } from '../utils/countries';
import type { MarketConfig } from '../types';

export interface OfferLocaleContextValue {
  /** Current language code (e.g. 'tr', 'en', 'de') */
  language: SupportedLanguage;
  /** Current currency code (e.g. 'TRY', 'EUR') */
  currency: SupportedCurrency;
  /** Current Intl locale string (e.g. 'tr-TR', 'en-US') */
  locale: string;
  /** Current market config */
  market: MarketConfig | null;
  /** Resolved country code (ISO alpha-2, uppercase). Null when offer has no country. */
  countryCode: string | null;
  /** VAT rate as percentage (e.g. 20) */
  vatRate: number;
  /** Format a price with the current locale and currency */
  fp: (amount: number, currencyOverride?: SupportedCurrency) => string;
  /** Format a price with no decimals */
  fpc: (amount: number, currencyOverride?: SupportedCurrency) => string;
  /** Format a number with locale grouping */
  fn: (amount: number) => string;
  /** Format a percentage */
  fpct: (value: number) => string;
  /** Format a date with locale */
  fd: (dateStr: string | Date) => string;
  /** Change language */
  setLanguage: (lang: SupportedLanguage) => void;
  /** Whether locale data is still loading */
  isLoading: boolean;
}

const OfferLocaleContext = createContext<OfferLocaleContextValue | null>(null);

interface OfferLocaleProviderProps {
  children: React.ReactNode;
  /** Market code from offer link or campaign */
  marketCode?: string | null;
  /** Country code (ISO-3166 alpha-2) — overrides market currency/VAT when set */
  countryCode?: string | null;
  /** Currency override (saved offer's stamped currency — contract lock) */
  currencyOverride?: string | null;
  /** Currency from the matched pricing_rules row. Authoritative source: matches
   *  the admin's per-country pricing input. Beats country-derived guess so the
   *  navigator-language cold-paint race can never stamp the wrong symbol. */
  productCurrency?: string | null;
  /** Whether to auto-detect customer country via IP/browser. Defaults to true. */
  autoDetectCountry?: boolean;
}

export function OfferLocaleProvider({
  children,
  marketCode,
  countryCode,
  currencyOverride,
  productCurrency,
  autoDetectCountry = true,
}: OfferLocaleProviderProps) {
  const { i18n } = useTranslation();
  const [market, setMarket] = useState<MarketConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Customer country is now driven solely by the `countryCode` prop, which the
  // offer page wires up to `offer_links.country_code` — the country the lead
  // declared via their phone prefix on the capture form. IP/browser heuristics
  // no longer override this: a +90 lead viewing the page in German keeps TRY
  // pricing; only the labels change. Same immutability contract as saved offers.
  const effectiveCountry = countryCode ?? null;

  // Resolve market config
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await MarketConfigService.resolve({
        market_code: marketCode,
      });
      if (!cancelled) {
        setMarket(resolved);
        setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [marketCode]);

  // Determine effective language. We follow i18next's current language so that
  // a customer-driven switch (LanguageSwitcher) propagates everywhere without
  // a page reload. Falls back to the browser-detected default at first paint.
  const language = useMemo<SupportedLanguage>(() => {
    const current = i18n.language?.split('-')[0];
    return (current as SupportedLanguage) || detectBrowserLanguage();
  }, [i18n.language]);

  // Determine effective currency. Priority:
  //   1. explicit currencyOverride (saved offer's stamped currency — contract lock)
  //   2. productCurrency (matched pricing_rule.currency_code — admin source of truth)
  //   3. effective country currency (static map fallback when no rule matched)
  //   4. market default
  //   5. TRY
  const currency = useMemo<SupportedCurrency>(() => {
    if (currencyOverride) return currencyOverride as SupportedCurrency;
    if (productCurrency) return productCurrency as SupportedCurrency;
    if (effectiveCountry && getCountryByCode(effectiveCountry)) {
      return getCurrencyForCountry(effectiveCountry) as SupportedCurrency;
    }
    if (market?.default_currency) return market.default_currency as SupportedCurrency;
    return 'TRY';
  }, [currencyOverride, productCurrency, effectiveCountry, market]);

  const locale = getLanguageLocales()[language] || 'tr-TR';
  // VAT priority: effective country VAT > market default > 20.
  const vatRate = effectiveCountry
    ? getVatRateForCountry(effectiveCountry, market?.vat_rate ?? 20)
    : (market?.vat_rate ?? 20);

  // (No reverse sync needed: `language` is derived from i18n.language, not the
  // other way around. Calling i18n.changeLanguage here would just race with
  // the LanguageSwitcher and the language detector.)

  // Formatting helpers
  const fp = useCallback(
    (amount: number, cur?: SupportedCurrency) => formatPrice(amount, cur || currency, language),
    [currency, language]
  );

  const fpc = useCallback(
    (amount: number, cur?: SupportedCurrency) => formatPriceCompact(amount, cur || currency, language),
    [currency, language]
  );

  const fn = useCallback(
    (amount: number) => formatNumber(amount, language),
    [language]
  );

  const fpct = useCallback(
    (value: number) => formatPercent(value, language),
    [language]
  );

  const fd = useCallback(
    (dateStr: string | Date) => {
      try {
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        return date.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      } catch {
        return String(dateStr);
      }
    },
    [locale]
  );

  const setLanguage = useCallback(
    (lang: SupportedLanguage) => {
      // Language change is text-only on the offer pages — it does NOT
      // change the locked-in country/currency/VAT. Those are pinned by
      // the lead's country_code at capture time.
      localStorage.setItem('cafepaste_language_manual', lang);
      i18n.changeLanguage(lang);
    },
    [i18n]
  );

  const value = useMemo<OfferLocaleContextValue>(
    () => ({
      language,
      currency,
      locale,
      market,
      countryCode: effectiveCountry ? effectiveCountry.toUpperCase() : null,
      vatRate,
      fp,
      fpc,
      fn,
      fpct,
      fd,
      setLanguage,
      isLoading,
    }),
    [language, currency, locale, market, effectiveCountry, vatRate, fp, fpc, fn, fpct, fd, setLanguage, isLoading]
  );

  return (
    <OfferLocaleContext.Provider value={value}>
      {children}
    </OfferLocaleContext.Provider>
  );
}

/**
 * Hook to access the offer locale context.
 * Must be used within an OfferLocaleProvider.
 */
export function useOfferLocale(): OfferLocaleContextValue {
  const ctx = useContext(OfferLocaleContext);
  if (!ctx) {
    // Fallback for components used outside the provider (e.g. admin pages)
    return {
      language: 'tr',
      currency: 'TRY',
      locale: 'tr-TR',
      market: null,
      countryCode: null,
      vatRate: 20,
      fp: (amount) => formatPrice(amount, 'TRY', 'tr'),
      fpc: (amount) => formatPriceCompact(amount, 'TRY', 'tr'),
      fn: (amount) => formatNumber(amount, 'tr'),
      fpct: (value) => formatPercent(value, 'tr'),
      fd: (dateStr) => {
        try {
          const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
          return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch { return String(dateStr); }
      },
      setLanguage: () => {},
      isLoading: false,
    };
  }
  return ctx;
}
