/**
 * Runtime tracker for i18n keys actually rendered on the current page.
 *
 * The Universal Edit Overlay reads from this store to list every t('ns:key')
 * call that happened during the current session, regardless of whether the
 * call site is wrapped with EditableI18nText.
 */

export interface I18nUsage {
    namespace: string;
    key: string;
    value: string;
    language: string;
    /** how many times this (ns,key) was invoked in current session */
    count: number;
    /** last seen at (epoch ms) */
    lastSeen: number;
}

type Listener = () => void;

const usageMap = new Map<string, I18nUsage>();
const listeners = new Set<Listener>();

function notify() {
    listeners.forEach(l => {
        try { l(); } catch { /* ignore */ }
    });
}

export function recordI18nUsage(namespace: string, key: string, value: string, language: string) {
    if (!key || typeof key !== 'string') return;
    const id = `${namespace}::${key}::${language}`;
    const existing = usageMap.get(id);
    if (existing) {
        existing.count++;
        existing.lastSeen = Date.now();
        existing.value = value;
    } else {
        usageMap.set(id, {
            namespace,
            key,
            value,
            language,
            count: 1,
            lastSeen: Date.now(),
        });
        // Defer notify to next tick to avoid mid-render setState
        setTimeout(notify, 0);
    }
}

export function getI18nUsage(): I18nUsage[] {
    return Array.from(usageMap.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}

export function subscribeI18nUsage(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function clearI18nUsage() {
    usageMap.clear();
    notify();
}

/** Update the in-memory record after a manual save (so overlay reflects new value). */
export function updateI18nUsageValue(namespace: string, key: string, language: string, newValue: string) {
    const id = `${namespace}::${key}::${language}`;
    const existing = usageMap.get(id);
    if (existing) {
        existing.value = newValue;
        existing.lastSeen = Date.now();
        notify();
    }
}
