import { useCallback, useEffect, useRef, useState } from 'react';
import { HrTaskNotificationsService } from '../services/hrTaskNotificationsService';
import { supabase } from '../lib/supabase/client';
import { useAdminRealtime } from './useAdminRealtime';
import { useToast } from '../contexts/ToastContext';
import { playPing } from '../lib/notificationSound';
import type { HrTaskNotification } from '../types/hrTasks';

const SOUND_KEY = 'cafepaste_task_sound';

export function isTaskSoundOn(): boolean {
    try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; }
}

export function setTaskSound(on: boolean): void {
    try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* yoksa sessiz geç */ }
}

// Görev bildirim merkezinin TEK veri kaynağı: kabuktaki iki zil (masaüstü
// sidebar + mobil üst bar), "Görevlerim" menü rozeti ve sayfa içi widget'lar
// hep bu instance'tan beslenir. AdminLayoutInner'da BİR KEZ kurulur,
// TaskNotificationsContext ile paylaşılır — ikinci instance = çift poll,
// çift realtime kanal, çift toast (bkz. ReminderAlertsContext gerekçesi).
//
// - 60sn poll: okunmamış bildirim sayısı + açık görev sayısı (iki head:true
//   count sorgusu — liste değil, ucuz).
// - Realtime (hr_task_notifications + hr_tasks): atama/yorum/durum anını
//   anında yansıtır. postgres_changes RLS'e tabidir; kullanıcı yalnız kendi
//   görebildiği satırların event'ini alır, filtre parametresi gerekmez.
// - Bildirim listesi dropdown açılınca lazy yüklenir.
// - Toast: okunmamış sayısı İLK yüklemeden sonra artarsa bir kez gösterilir
//   (panel açılışında toast yağmuru olmaz).

const POLL_MS = 60 * 1000;

export interface TaskNotificationsState {
    unreadCount: number;
    /** Bana atanmış, durumu pending/in_progress olan görev sayısı (menü rozeti). */
    openTaskCount: number;
    items: HrTaskNotification[];
    listLoading: boolean;
    /** Dropdown açılınca çağrılır — listeyi (yeniden) yükler. */
    loadList: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
    refresh: () => void;
}

export function useTaskNotifications(
    enabled: boolean,
    userId: string | null,
): TaskNotificationsState {
    const [unreadCount, setUnreadCount] = useState(0);
    const [openTaskCount, setOpenTaskCount] = useState(0);
    const [items, setItems] = useState<HrTaskNotification[]>([]);
    const [listLoading, setListLoading] = useState(false);

    const firstLoadRef = useRef(true);
    const prevUnreadRef = useRef(0);
    const toast = useToast();

    const active = enabled && !!userId;

    const refresh = useCallback(async () => {
        if (!active || !userId) return;
        try {
            const [unread, openRes] = await Promise.all([
                HrTaskNotificationsService.getUnreadCount(userId),
                supabase
                    .from('hr_tasks')
                    .select('*', { count: 'exact', head: true })
                    .eq('assigned_to', userId)
                    .in('status', ['pending', 'in_progress']),
            ]);
            const open = openRes.error ? 0 : (openRes.count ?? 0);

            if (firstLoadRef.current) {
                // İlk yükleme baseline'dır — panel açılışında toast/bip yağmuru olmaz.
                firstLoadRef.current = false;
            } else if (unread > prevUnreadRef.current) {
                toast.info('Yeni görev bildiriminiz var');
                if (isTaskSoundOn()) playPing();
            }
            prevUnreadRef.current = unread;

            setUnreadCount(unread);
            setOpenTaskCount(open);
        } catch (e) {
            console.error('[useTaskNotifications] refresh error:', e);
        }
    }, [active, userId, toast]);

    useEffect(() => {
        if (!active) {
            setUnreadCount(0);
            setOpenTaskCount(0);
            setItems([]);
            return;
        }
        // Kullanıcı değişince toast baseline'ı sıfırla.
        firstLoadRef.current = true;
        prevUnreadRef.current = 0;
        void refresh();
        const id = setInterval(() => void refresh(), POLL_MS);
        return () => clearInterval(id);
    }, [refresh, active]);

    useAdminRealtime(active ? ['hr_task_notifications', 'hr_tasks'] : [], refresh);

    const loadList = useCallback(async () => {
        if (!active || !userId) return;
        setListLoading(true);
        try {
            setItems(await HrTaskNotificationsService.list(userId, 20));
        } catch (e) {
            console.error('[useTaskNotifications] list error:', e);
        } finally {
            setListLoading(false);
        }
    }, [active, userId]);

    const markAsRead = useCallback(async (id: string) => {
        // Optimistic: rozet ve satır anında düşer, hata olursa refresh düzeltir.
        setItems(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
        setUnreadCount(prev => {
            const next = Math.max(0, prev - 1);
            prevUnreadRef.current = next;
            return next;
        });
        try {
            await HrTaskNotificationsService.markAsRead(id);
        } catch (e) {
            console.error('[useTaskNotifications] markAsRead error:', e);
            void refresh();
        }
    }, [refresh]);

    const markAllRead = useCallback(async () => {
        if (!userId) return;
        setItems(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        prevUnreadRef.current = 0;
        try {
            await HrTaskNotificationsService.markAllAsRead(userId);
        } catch (e) {
            console.error('[useTaskNotifications] markAllRead error:', e);
            void refresh();
        }
    }, [userId, refresh]);

    return {
        unreadCount,
        openTaskCount,
        items,
        listLoading,
        loadList,
        markAsRead,
        markAllRead,
        refresh: () => void refresh(),
    };
}
