import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SupportInboxService, SupportInboxItem } from '../services/admin/supportInboxService';
import { useAdminRealtime } from '../hooks/useAdminRealtime';

const SEEN_STORAGE_KEY = 'cafepaste_support_inbox_seen';

function playPling() {
    try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(740, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.14);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
        setTimeout(() => ctx.close().catch(() => { }), 700);
    } catch { /* sessizce yut */ }
}

function loadSeen(): Set<string> {
    try {
        const raw = localStorage.getItem(SEEN_STORAGE_KEY);
        if (!raw) return new Set<string>();
        const arr = JSON.parse(raw);
        const items: string[] = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
        return new Set<string>(items);
    } catch {
        return new Set<string>();
    }
}

function persistSeen(set: Set<string>) {
    try {
        // Cap to last 500 ids to keep storage small
        const arr = Array.from(set).slice(-500);
        localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(arr));
    } catch { /* ignore */ }
}

function itemKey(item: SupportInboxItem): string {
    return `${item.source}:${item.id}`;
}

interface SupportInboxContextValue {
    items: SupportInboxItem[];
    unreadCount: number;
    salesCount: number;
    serviceCount: number;
    isPanelOpen: boolean;
    loading: boolean;
    /** Son yenilemede sorgu hatası varsa mesajı; yoksa null. Tüketiciler bunu boş
     *  listeden AYIRMALI — "talep yok" ile "talepleri okuyamadım" aynı şey değil. */
    error: string | null;
    isUnread: (item: SupportInboxItem) => boolean;
    openPanel: () => void;
    closePanel: () => void;
    togglePanel: () => void;
    markAllSeen: () => void;
    markSeen: (item: SupportInboxItem) => void;
    refresh: () => Promise<void>;
}

const SupportInboxContext = createContext<SupportInboxContextValue | null>(null);

export const useSupportInbox = () => {
    const ctx = useContext(SupportInboxContext);
    if (!ctx) throw new Error('useSupportInbox must be used within SupportInboxProvider');
    return ctx;
};

export const SupportInboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<SupportInboxItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [seen, setSeen] = useState<Set<string>>(() => loadSeen());

    const prevIdsRef = useRef<Set<string>>(new Set());
    const firstLoadRef = useRef(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const data = await SupportInboxService.listOpenRequests(50);
            setError(null);
            setItems(data);

            // Detect newly arrived items (not seen before in this session) and pling.
            const newKeys = new Set(data.map(itemKey));
            if (!firstLoadRef.current) {
                let hasNew = false;
                for (const k of newKeys) {
                    if (!prevIdsRef.current.has(k)) { hasNew = true; break; }
                }
                if (hasNew) playPling();
            }
            prevIdsRef.current = newKeys;
            firstLoadRef.current = false;
        } catch (err: any) {
            console.error('[SupportInbox] refresh failed', err);
            setError(err?.message || 'Bilinmeyen hata');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    useAdminRealtime(['sales_callback_requests', 'service_requests'], refresh, 300);

    const isUnread = useCallback((item: SupportInboxItem) => !seen.has(itemKey(item)), [seen]);

    const unreadCount = useMemo(
        () => items.reduce((acc, it) => acc + (seen.has(itemKey(it)) ? 0 : 1), 0),
        [items, seen]
    );

    const { salesCount, serviceCount } = useMemo(() => {
        let s = 0; let v = 0;
        for (const it of items) {
            if (it.source === 'sales') s++;
            else if (it.source === 'service') v++;
        }
        return { salesCount: s, serviceCount: v };
    }, [items]);

    const openPanel = useCallback(() => setIsPanelOpen(true), []);
    const closePanel = useCallback(() => setIsPanelOpen(false), []);
    const togglePanel = useCallback(() => setIsPanelOpen(p => !p), []);

    const markSeen = useCallback((item: SupportInboxItem) => {
        setSeen(prev => {
            const k = itemKey(item);
            if (prev.has(k)) return prev;
            const next = new Set<string>(prev);
            next.add(k);
            persistSeen(next);
            return next;
        });
    }, []);

    const markAllSeen = useCallback(() => {
        setSeen(prev => {
            const next = new Set<string>(prev);
            for (const it of items) next.add(itemKey(it));
            persistSeen(next);
            return next;
        });
    }, [items]);

    const value: SupportInboxContextValue = {
        items, unreadCount, salesCount, serviceCount,
        isPanelOpen, loading, error,
        isUnread, openPanel, closePanel, togglePanel,
        markAllSeen, markSeen, refresh,
    };

    return (
        <SupportInboxContext.Provider value={value}>
            {children}
        </SupportInboxContext.Provider>
    );
};
