import type { BackendModule, ReadCallback, Services } from 'i18next';
import { supabase } from '../lib/supabase/client';

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const LS_PREFIX = 'cafepaste_translations_';

interface CacheEntry {
  data: Record<string, any>;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();

/**
 * Bellek (in-memory) ceviri cache'ini temizler. localStorage temizligi
 * tek basina yetmiyordu: 10 dk TTL'li memoryCache canli oturumda eski
 * degeri servis etmeye devam ediyordu, bu yuzden admin edit'leri on
 * sayfaya yansimiyor goruluyordu. langCode verilirse yalnizca o dil,
 * yoksa tum cache temizlenir.
 */
export function clearMemoryTranslationCache(langCode?: string) {
  if (!langCode) {
    memoryCache.clear();
    return;
  }
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(`${langCode}_`)) memoryCache.delete(key);
  }
}

/** Unflatten dot-notation keys into nested object */
function unflatten(flat: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [dotKey, value] of Object.entries(flat)) {
    const parts = dotKey.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

function cacheKey(language: string, namespace: string) {
  return `${language}_${namespace}`;
}

function readLocalStorage(language: string, namespace: string): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${cacheKey(language, namespace)}`);
    if (!raw) return null;
    const parsed: CacheEntry = JSON.parse(raw);
    return parsed.data;
  } catch {
    return null;
  }
}

function writeLocalStorage(language: string, namespace: string, data: Record<string, any>) {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    localStorage.setItem(`${LS_PREFIX}${cacheKey(language, namespace)}`, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

async function fetchFromSupabase(language: string, namespace: string): Promise<Record<string, any> | null> {
  const { data, error } = await supabase
    .from('translations')
    .select('key, value')
    .eq('language_code', language)
    .eq('namespace', namespace);

  if (error || !data || data.length === 0) return null;

  const flat: Record<string, string> = {};
  for (const row of data) {
    flat[row.key] = row.value;
  }
  return unflatten(flat);
}

const SupabaseBackend: BackendModule = {
  type: 'backend',

  init(_services: Services, _backendOptions: object) {
    // no config needed
  },

  read(language: string, namespace: string, callback: ReadCallback) {
    const key = cacheKey(language, namespace);

    // 1. Memory cache (hot)
    const mem = memoryCache.get(key);
    if (mem && Date.now() - mem.timestamp < CACHE_TTL) {
      callback(null, mem.data);
      return;
    }

    // 2. localStorage (stale-while-revalidate)
    const ls = readLocalStorage(language, namespace);
    if (ls) {
      // Return stale immediately, refresh in background
      callback(null, ls);
      fetchFromSupabase(language, namespace).then((fresh) => {
        if (fresh) {
          memoryCache.set(key, { data: fresh, timestamp: Date.now() });
          writeLocalStorage(language, namespace, fresh);
        }
      });
      return;
    }

    // 3. Fetch from Supabase
    fetchFromSupabase(language, namespace)
      .then((data) => {
        if (data) {
          memoryCache.set(key, { data, timestamp: Date.now() });
          writeLocalStorage(language, namespace, data);
          callback(null, data);
        } else {
          // Let i18next fall through to bundled resources
          callback(null, {});
        }
      })
      .catch(() => {
        callback(null, {});
      });
  },

  /** Handle missing keys by inserting them for the default language (tr) */
  create(languages: readonly string[], namespace: string, key: string, fallbackValue: string) {
    // We only care about the first language (usually 'tr' in dev)
    // or specifically 'tr' to maintain it as our source of truth.
    if (!languages.includes('tr')) return;

    // Use silence to not flood console
    supabase
      .from('translations')
      .upsert({
        namespace,
        key,
        language_code: 'tr',
        value: fallbackValue || key,
        updated_at: new Date().toISOString()
      }, { onConflict: 'namespace,key,language_code' })
      .then(({ error }) => {
        if (error) console.warn('[i18n saveMissing]', error.message);
      });
  }
};

export default SupabaseBackend;
