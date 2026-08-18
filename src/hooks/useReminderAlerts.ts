import { useCallback, useEffect, useRef, useState } from 'react';
import { leadRemindersService, ReminderWithLead } from '../services/admin/leadRemindersService';
import { playLeadBeep } from './useNewLeadAlert';
import { useAdminRealtime } from './useAdminRealtime';

// Hatırlatma Bildirim & Takip Merkezi'nin TEK veri kaynağı: zil rozeti, üst
// uyarı bandı, sesli bip ve zil popover listesini birlikte besler.
//
// - listAllOpen ile açık hatırlatmaları (lead bilgisiyle) çeker.
// - 60sn poll + lead_reminders realtime: poll "vakti geldi" zaman geçişini
//   yakalar (DB event'i yok), realtime create/tamamla anını anında yansıtır.
// - Bip: bir hatırlatma YENİ due olunca (remind_at <= now ve daha önce
//   görülmediyse) bir kez çalar. İlk yüklemede mevcut due'lar baseline alınır,
//   panel açılışında bip yağmuru olmaz. localStorage toggle ile susturulabilir.

const POLL_MS = 60 * 1000;
const SOUND_KEY = 'cafepaste_reminder_sound';

export interface ReminderAlertsState {
    items: ReminderWithLead[];
    openCount: number;
    /** remind_at <= now olan (gecikmiş/vakti gelmiş) hatırlatma sayısı. */
    dueCount: number;
    loading: boolean;
    /** Manuel yenileme — aksiyon sonrası listeyi tazelemek için. */
    refresh: () => void;
}

export function isReminderSoundOn(): boolean {
    try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; }
}

export function setReminderSound(on: boolean): void {
    try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* yoksa sessiz geç */ }
}

export function useReminderAlerts(
    enabled: boolean,
    currentUserId: string | null,
    isSales: boolean,
): ReminderAlertsState {
    const [items, setItems] = useState<ReminderWithLead[]>([]);
    const [counts, setCounts] = useState<{ open: number; due: number }>({ open: 0, due: 0 });
    const [loading, setLoading] = useState(true);

    const seenDueRef = useRef<Set<string>>(new Set());
    const firstLoadRef = useRef(true);

    const refresh = useCallback(async () => {
        if (!enabled) return;
        try {
            const data = await leadRemindersService.listAllOpen({ currentUserId, isSales });
            const now = Date.now();
            const due = data.filter(r => new Date(r.remind_at).getTime() <= now);

            // İlk yükleme: mevcut due'ları baseline al, bip çalma.
            if (firstLoadRef.current) {
                due.forEach(r => seenDueRef.current.add(r.id));
                firstLoadRef.current = false;
            } else {
                const hasNewDue = due.some(r => !seenDueRef.current.has(r.id));
                due.forEach(r => seenDueRef.current.add(r.id));
                if (hasNewDue && isReminderSoundOn()) playLeadBeep();
            }

            setItems(data);
            setCounts({ open: data.length, due: due.length });
        } catch (e) {
            console.error('[useReminderAlerts] refresh error:', e);
        } finally {
            setLoading(false);
        }
    }, [enabled, currentUserId, isSales]);

    useEffect(() => {
        if (!enabled) { setLoading(false); return; }
        // enabled/rol değişince baseline'ı sıfırla.
        firstLoadRef.current = true;
        seenDueRef.current = new Set();
        void refresh();
        const id = setInterval(() => void refresh(), POLL_MS);
        return () => clearInterval(id);
    }, [refresh, enabled]);

    // Realtime: create/markDone/delete anında yansısın.
    useAdminRealtime(enabled ? ['lead_reminders'] : [], refresh);

    return { items, openCount: counts.open, dueCount: counts.due, loading, refresh: () => void refresh() };
}
