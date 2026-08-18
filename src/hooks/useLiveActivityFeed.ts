import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { playLeadBeep } from './useNewLeadAlert';
import { isHotEvent, buildCustomerSignals, type ActivityEntry, type CustomerSignal } from '../lib/activityEvents';

/**
 * Canlı müşteri aktivite akışı.
 *
 * - İlk yükte son N olay (lead_events + opsiyonel offer_analytics) çekilir,
 *   created_at'e göre merge edilir.
 * - Realtime: ilgili tablolara postgres_changes aboneliği; değişiklikte TÜM
 *   dashboard'ı değil yalnız pencereli sorguyu debounce'lu yeniden çeker →
 *   yeni olaylar tepeye düşer (ağır metrik refetch'i bu hook'ta yok).
 * - "Şu an aktif": son LIVE_WINDOW_MS içinde olayı olan müşteriler lead/token
 *   bazında gruplanır.
 * - Sıcak olay (ürün seçildi / ödeme başladı...) geldiğinde, daha önce
 *   görülmemişse playLeadBeep() ile bip çalar (ses açıksa).
 *
 * offer_analytics realtime için tabloya supabase_realtime publication üyeliği
 * gerekir (migration: 2026XXXX_offer_analytics_realtime.sql). Üye değilse
 * granüler olaylar yine ilk yüklemede ve diğer tetiklemelerde gelir; sadece
 * kendi başına anlık push etmez.
 */

const LIVE_WINDOW_MS = 5 * 60 * 1000; // son 5 dk "şu an aktif" sayılır
const SOUND_KEY = 'live_activity_sound';

export interface LiveNowEntry {
    key: string;
    lead_id: string | null;
    token: string | null;
    customer_name: string | null;
    phone_number: string | null;
    lastEvent: string;
    lastAt: string;
    count: number;
}

interface Options {
    limit?: number;
    includeGranular?: boolean;
    /**
     * Temsilci scoping: undefined = global (davranış birebir eski hali),
     * null = kapsam henüz çözülüyor (fetch bekletilir, loading kalır),
     * [] = lead'i olmayan temsilci (boş akış),
     * [ids] = sadece bu leadlerin olayları. Anonim (lead'e bağlanmamış)
     * satırlar .in() eşleşmediği için temsilcide otomatik gizlenir.
     */
    scopeLeadIds?: string[] | null;
}

function mapLeadEvent(row: any): ActivityEntry {
    return {
        id: `le_${row.id}`,
        source: 'lead_event',
        event_type: row.event_type,
        created_at: row.created_at,
        customer_name: row.leads?.customer_name ?? null,
        phone_number: row.leads?.phone_number ?? null,
        lead_id: row.lead_id ?? null,
        token: row.token ?? null,
        metadata: row.metadata ?? null,
    };
}

function mapOfferAnalytics(row: any): ActivityEntry {
    const link = row.offer_links;
    return {
        id: `oa_${row.id}`,
        source: 'offer_analytics',
        event_type: row.action_type,
        created_at: row.created_at,
        customer_name: link?.leads?.customer_name ?? null,
        phone_number: link?.leads?.phone_number ?? null,
        lead_id: link?.lead_id ?? null,
        token: row.offer_token ?? null,
        metadata: row.metadata ?? null,
    };
}

export function useLiveActivityFeed({ limit = 100, includeGranular = false, scopeLeadIds }: Options = {}) {
    const [feed, setFeed] = useState<ActivityEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        return localStorage.getItem(SOUND_KEY) !== '0';
    });
    // liveNow'ın eskimesini görmek için periyodik tetikleyici (now değişimi).
    const [, setTick] = useState(0);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const lastMaxRef = useRef<string>('');       // gördüğümüz en yeni olay zamanı
    const soundRef = useRef(soundEnabled);
    soundRef.current = soundEnabled;
    const firstLoadRef = useRef(true);

    const setSoundEnabled = useCallback((v: boolean) => {
        setSoundEnabledState(v);
        try { localStorage.setItem(SOUND_KEY, v ? '1' : '0'); } catch { /* yoksay */ }
    }, []);

    // Dep anahtarı: dizi kimliği her render'da değişebilir; içerik anahtarıyla sabitle.
    const scopeKey = scopeLeadIds === undefined ? 'global' : scopeLeadIds === null ? 'pending' : scopeLeadIds.join(',');

    const load = useCallback(async () => {
        // Kapsam henüz çözülmedi (temsilcinin lead listesi geliyor) → bekle.
        if (scopeLeadIds === null) return;
        // Lead'i olmayan temsilci → boş akış, sorgu atma.
        if (scopeLeadIds && scopeLeadIds.length === 0) {
            setFeed([]);
            setLoading(false);
            return;
        }

        let leadEventsQuery = supabase
            .from('lead_events')
            .select('id, event_type, created_at, metadata, lead_id, token, leads(customer_name, phone_number)')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (scopeLeadIds) leadEventsQuery = leadEventsQuery.in('lead_id', scopeLeadIds);

        const queries: any[] = [leadEventsQuery];
        if (includeGranular) {
            let analyticsQuery = supabase
                .from('offer_analytics')
                .select('id, action_type, created_at, metadata, offer_token, offer_links(lead_id, leads(customer_name, phone_number))')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (scopeLeadIds) {
                // offer_analytics'te lead_id yok → temsilcinin linklerinin token'ları
                // üzerinden köprü (offerLinksService.scopeTokens deseni). Sentinel
                // '__none__' text kolonda güvenli; boş .in() tüm satırları döndürürdü.
                const { data: tokenRows } = await supabase
                    .from('offer_links')
                    .select('token')
                    .in('lead_id', scopeLeadIds);
                const tokens = (tokenRows || []).map((r: any) => r.token).filter(Boolean);
                analyticsQuery = analyticsQuery.in('offer_token', tokens.length ? tokens : ['__none__']);
            }
            queries.push(analyticsQuery);
        }

        const results = await Promise.all(queries);

        // Sorgu hatası boş akış olarak gösterilemez: "hiç olay yok" ile "olayları
        // okuyamadım" operatör için taban tabana zıt iki durum.
        const failed = results.find((r: any) => r?.error);
        if (failed) {
            console.error('[useLiveActivityFeed] load failed:', failed.error);
            setError(failed.error?.message || 'Bilinmeyen hata');
            setFeed([]);
            setLoading(false);
            return;
        }
        setError(null);

        const leadEvents = (results[0]?.data || []).map(mapLeadEvent);
        const offerEvents = includeGranular ? (results[1]?.data || []).map(mapOfferAnalytics) : [];

        const merged = [...leadEvents, ...offerEvents]
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
            .slice(0, limit);

        // Yeni sıcak olay var mı? (ilk yüklemede bip çalma)
        if (!firstLoadRef.current && soundRef.current) {
            const fresh = merged.filter(
                (e) => e.created_at > lastMaxRef.current && isHotEvent(e.event_type)
            );
            if (fresh.length > 0) playLeadBeep();
        }
        if (merged.length > 0) {
            const maxAt = merged[0].created_at;
            if (maxAt > lastMaxRef.current) lastMaxRef.current = maxAt;
        }
        firstLoadRef.current = false;

        setFeed(merged);
        setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [limit, includeGranular, scopeKey]);

    const debouncedLoad = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { void load(); }, 500);
    }, [load]);

    // İlk yükleme + tablo değiştiğinde yeniden.
    useEffect(() => {
        firstLoadRef.current = true;
        setLoading(true);
        void load();
    }, [load]);

    // Realtime abonelik
    useEffect(() => {
        const tables = includeGranular ? ['lead_events', 'offer_analytics'] : ['lead_events'];
        const channel = supabase.channel(`live-activity-${tables.join('-')}`);
        for (const table of tables) {
            channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table }, debouncedLoad);
        }
        channel.subscribe();
        channelRef.current = channel;

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [includeGranular, debouncedLoad]);

    // "Şu an aktif" türevinin tazeliği için 30 sn'de bir yeniden hesapla.
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 30000);
        return () => clearInterval(id);
    }, []);

    const liveNow = useMemo<LiveNowEntry[]>(() => {
        const cutoff = Date.now() - LIVE_WINDOW_MS;
        const groups = new Map<string, LiveNowEntry>();
        for (const e of feed) {
            if (new Date(e.created_at).getTime() < cutoff) continue;
            const key = e.lead_id || e.token || e.id;
            const existing = groups.get(key);
            if (!existing) {
                groups.set(key, {
                    key,
                    lead_id: e.lead_id,
                    token: e.token,
                    customer_name: e.customer_name,
                    phone_number: e.phone_number,
                    lastEvent: e.event_type,
                    lastAt: e.created_at,
                    count: 1,
                });
            } else {
                existing.count += 1;
                if (e.created_at > existing.lastAt) {
                    existing.lastAt = e.created_at;
                    existing.lastEvent = e.event_type;
                }
                if (!existing.customer_name && e.customer_name) existing.customer_name = e.customer_name;
                if (!existing.phone_number && e.phone_number) existing.phone_number = e.phone_number;
            }
        }
        return Array.from(groups.values()).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
    }, [feed]);

    // Müşteri-bazlı sinyaller (sıcaklık, geliş sayısı, toplam hareket) —
    // satır/kart başlıklarında kullanılır.
    const customerStats = useMemo<Map<string, CustomerSignal>>(
        () => buildCustomerSignals(feed),
        [feed],
    );

    return { feed, liveNow, loading, error, soundEnabled, setSoundEnabled, customerStats };
}
