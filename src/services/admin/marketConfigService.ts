import { supabase } from '../../lib/supabase/client';
import type { MarketConfig } from '../../types';

/** Default market configurations - used as seed and fallback */
export const DEFAULT_MARKET_CONFIGS: Omit<MarketConfig, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    market_code: 'TR',
    market_name: 'Türkiye',
    default_language: 'tr',
    supported_languages: ['tr'],
    default_currency: 'TRY',
    supported_currencies: ['TRY'],
    payment_gateways: ['paytr'],
    vat_rate: 20,
    timezone: 'Europe/Istanbul',
    date_format: 'dd.MM.yyyy',
    phone_prefix: '+90',
    is_active: true,
  },
  {
    market_code: 'EU',
    market_name: 'European Union',
    default_language: 'en',
    supported_languages: ['en', 'de', 'fr', 'es', 'it'],
    default_currency: 'EUR',
    supported_currencies: ['EUR'],
    payment_gateways: ['stripe'],
    vat_rate: 19,
    timezone: 'Europe/Berlin',
    date_format: 'dd.MM.yyyy',
    phone_prefix: '+49',
    is_active: true,
  },
  {
    market_code: 'GB',
    market_name: 'United Kingdom',
    default_language: 'en',
    supported_languages: ['en'],
    default_currency: 'GBP',
    supported_currencies: ['GBP'],
    payment_gateways: ['stripe'],
    vat_rate: 20,
    timezone: 'Europe/London',
    date_format: 'dd/MM/yyyy',
    phone_prefix: '+44',
    is_active: true,
  },
  {
    market_code: 'US',
    market_name: 'United States',
    default_language: 'en',
    supported_languages: ['en', 'es'],
    default_currency: 'USD',
    supported_currencies: ['USD'],
    payment_gateways: ['stripe'],
    vat_rate: 0,
    timezone: 'America/New_York',
    date_format: 'MM/dd/yyyy',
    phone_prefix: '+1',
    is_active: true,
  },
  {
    market_code: 'SA',
    market_name: 'Saudi Arabia',
    default_language: 'en',
    supported_languages: ['en'],
    default_currency: 'SAR',
    supported_currencies: ['SAR'],
    payment_gateways: ['stripe'],
    vat_rate: 15,
    timezone: 'Asia/Riyadh',
    date_format: 'dd/MM/yyyy',
    phone_prefix: '+966',
    is_active: true,
  },
  {
    market_code: 'AE',
    market_name: 'United Arab Emirates',
    default_language: 'en',
    supported_languages: ['en'],
    default_currency: 'AED',
    supported_currencies: ['AED'],
    payment_gateways: ['stripe'],
    vat_rate: 5,
    timezone: 'Asia/Dubai',
    date_format: 'dd/MM/yyyy',
    phone_prefix: '+971',
    is_active: true,
  },
];

// In-memory cache — pre-populated with defaults so first call never triggers a network request
let marketConfigsCache: MarketConfig[] | null = DEFAULT_MARKET_CONFIGS.map((mc, i) => ({
  ...mc,
  id: `default-${i}`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));
let cacheTimestamp = Date.now();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let dbChecked = false;
let inflightRequest: Promise<MarketConfig[]> | null = null;

function buildDefaults(): MarketConfig[] {
  return DEFAULT_MARKET_CONFIGS.map((mc, i) => ({
    ...mc,
    id: `default-${i}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

async function fetchFromDb(): Promise<MarketConfig[] | null> {
  try {
    const { data, error } = await supabase
      .from('market_configs')
      .select('*')
      .eq('is_active', true)
      .order('market_code', { ascending: true });

    if (!error && data && data.length > 0) {
      return data as MarketConfig[];
    }
    return null;
  } catch {
    return null;
  }
}

export const MarketConfigService = {
  /**
   * Get all active market configs.
   * Returns from cache if available, otherwise fetches from DB.
   * Falls back to DEFAULT_MARKET_CONFIGS if DB is not set up yet.
   */
  async getAll(forceRefresh = false): Promise<MarketConfig[]> {
    // Return cached (defaults pre-populated) unless explicit refresh requested
    if (!forceRefresh && marketConfigsCache) return marketConfigsCache;

    // Only hit DB when explicitly requested (e.g. from admin panel)
    if (forceRefresh) {
      if (inflightRequest) return inflightRequest;
      inflightRequest = (async () => {
        const data = await fetchFromDb();
        if (data) {
          marketConfigsCache = data;
          cacheTimestamp = Date.now();
        }
        inflightRequest = null;
        return marketConfigsCache!;
      })();
      return inflightRequest;
    }

    return marketConfigsCache ?? buildDefaults();
  },

  /**
   * Get a specific market config by market_code.
   */
  async getByCode(marketCode: string): Promise<MarketConfig | null> {
    const all = await this.getAll();
    return all.find(mc => mc.market_code === marketCode) || null;
  },

  /**
   * Resolve market config from various inputs.
   * Priority: explicit market_code > country_code mapping > default 'TR'
   */
  async resolve(params: {
    market_code?: string | null;
    country_code?: string | null;
  }): Promise<MarketConfig> {
    const all = await this.getAll();

    // Try explicit market_code
    if (params.market_code) {
      const found = all.find(mc => mc.market_code === params.market_code);
      if (found) return found;
    }

    // Try country_code (country codes often match market codes)
    if (params.country_code) {
      const found = all.find(mc => mc.market_code === params.country_code);
      if (found) return found;
    }

    // Default to TR
    return all.find(mc => mc.market_code === 'TR') || all[0];
  },

  /**
   * Create a new market config.
   */
  async create(config: Omit<MarketConfig, 'id' | 'created_at' | 'updated_at'>): Promise<MarketConfig | null> {
    const { data, error } = await supabase
      .from('market_configs')
      .insert(config)
      .select()
      .single();

    if (error) {
      console.error('[MarketConfig] Create error:', error);
      return null;
    }

    marketConfigsCache = null; // Invalidate cache
    return data as MarketConfig;
  },

  /**
   * Update an existing market config.
   */
  async update(id: string, updates: Partial<MarketConfig>): Promise<MarketConfig | null> {
    const { data, error } = await supabase
      .from('market_configs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[MarketConfig] Update error:', error);
      return null;
    }

    marketConfigsCache = null; // Invalidate cache
    return data as MarketConfig;
  },

  /**
   * Delete (deactivate) a market config.
   */
  async deactivate(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('market_configs')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[MarketConfig] Deactivate error:', error);
      return false;
    }

    marketConfigsCache = null;
    return true;
  },

  /** Clear the in-memory cache */
  clearCache() {
    marketConfigsCache = null;
    cacheTimestamp = 0;
  },
};
