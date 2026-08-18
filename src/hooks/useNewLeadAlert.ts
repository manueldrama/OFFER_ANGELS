import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useToast } from '../contexts/ToastContext';

/**
 * Yeni lead geldiğinde admin panelde GÖRSEL bildirim (toast) + SES (bip) verir.
 *
 * Sağlamlık için iki kanal birlikte çalışır, çift tetiklemeyi `seen` set'i önler:
 *   1) Supabase realtime — leads INSERT (anlık). leads zaten
 *      supabase_realtime publication'ında (20260328_admin_realtime.sql).
 *   2) 30 sn'lik polling yedeği — realtime kaçırırsa/kopsa yine yakalar.
 *
 * Ses Web Audio API ile üretilir (harici asset yok). Tarayıcı autoplay
 * politikası gereği AudioContext ilk kullanıcı etkileşiminde resume edilir;
 * bu yüzden ses çalmasa bile toast her durumda görünür.
 *
 * Sadece YENİ lead tetikler: sayfa açıldığı andaki en son lead "baseline"
 * alınır, sadece ondan SONRAKİLER duyurulur (eski leadler için bip yağmuru yok).
 */

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!sharedCtx) {
        const AC =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) sharedCtx = new AC();
    }
    return sharedCtx;
}

/** İki kısa yükselen bip — dikkat çeker ama rahatsız etmez. Manuel test için de export. */
export function playLeadBeep(): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    [
        { at: 0, freq: 880 },
        { at: 0.18, freq: 1175 },
    ].forEach(({ at, freq }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0 + at);
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(0.28, t0 + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + 0.16);
    });
}

interface LeadRow {
    id?: string;
    customer_name?: string | null;
    phone_number?: string | null;
    created_at?: string | null;
}

export function useNewLeadAlert(enabled: boolean) {
    const { info } = useToast();
    const infoRef = useRef(info);
    infoRef.current = info;

    const channelRef = useRef<RealtimeChannel | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const seenRef = useRef<Set<string>>(new Set());
    const baselineRef = useRef<string>(new Date().toISOString());

    // İlk kullanıcı gesture'ında AudioContext'i resume et (autoplay politikası).
    useEffect(() => {
        if (!enabled) return;
        const resume = () => {
            const c = getCtx();
            if (c && c.state === 'suspended') void c.resume();
        };
        window.addEventListener('pointerdown', resume);
        window.addEventListener('keydown', resume);
        getCtx();
        return () => {
            window.removeEventListener('pointerdown', resume);
            window.removeEventListener('keydown', resume);
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;

        const announce = (row: LeadRow) => {
            const id = row?.id;
            if (id) {
                if (seenRef.current.has(id)) return;
                seenRef.current.add(id);
            }
            playLeadBeep();
            const name = (row?.customer_name || '').trim() || 'Yeni müşteri';
            const phone = row?.phone_number ? ` · ${row.phone_number}` : '';
            infoRef.current('🔔 Yeni Lead Geldi', `${name}${phone}`);
            if (row?.created_at && row.created_at > baselineRef.current) {
                baselineRef.current = row.created_at;
            }
        };

        // Baseline = şu anki en son lead (yoksa "şimdi"). Sadece bundan sonrası duyurulur.
        void (async () => {
            const { data } = await supabase
                .from('leads')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (!cancelled && data?.created_at) baselineRef.current = data.created_at;
        })();

        // 1) Realtime — anlık
        const channel = supabase
            .channel('admin-new-lead-alert')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'leads' },
                (payload) => announce((payload.new || {}) as LeadRow)
            )
            .subscribe((status) => {
                // Hata teşhisi için: realtime bağlanamazsa konsola düşer.
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('[newLeadAlert] realtime status:', status, '— polling yedegi devrede');
                }
            });
        channelRef.current = channel;

        // 2) Polling yedeği — 30 sn'de bir baseline'dan sonraki leadleri yakala
        pollRef.current = setInterval(() => {
            void (async () => {
                const since = baselineRef.current;
                const { data, error } = await supabase
                    .from('leads')
                    .select('id, customer_name, phone_number, created_at')
                    .gt('created_at', since)
                    .order('created_at', { ascending: true })
                    .limit(10);
                if (error || !data || cancelled) return;
                for (const row of data as LeadRow[]) announce(row);
            })();
        }, 30000);

        return () => {
            cancelled = true;
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [enabled]);
}
