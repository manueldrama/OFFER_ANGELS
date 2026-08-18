import React, { createContext, useContext } from 'react';
import type { TaskNotificationsState } from '../hooks/useTaskNotifications';

// Görev bildirim durumunu AdminLayout'tan sayfa içeriğine taşır.
//
// NEDEN CONTEXT (ReminderAlertsContext ile aynı gerekçe): useTaskNotifications
// 60sn poll + realtime aboneliği açar ve okunmamış sayısı artınca toast
// gösterir. TeamPortal'daki görev sekmesi/widget'ı hook'u kendisi çağırsaydı
// ikinci poll, ikinci kanal ve çift toast oluşurdu. Tek örnek AdminLayoutInner'da
// yaşar; kabuktaki iki zil prop'la, sayfalar bu context'le AYNI örneği okur.
//
// Provider dışında kullanılırsa null döner; tüketici kendini gizler.

const TaskNotificationsContext = createContext<TaskNotificationsState | null>(null);

export function TaskNotificationsProvider({
    value,
    children,
}: {
    value: TaskNotificationsState;
    children: React.ReactNode;
}) {
    return (
        <TaskNotificationsContext.Provider value={value}>
            {children}
        </TaskNotificationsContext.Provider>
    );
}

/** Paylaşılan görev bildirim durumu. Provider yoksa null. */
export function useTaskNotificationsContext(): TaskNotificationsState | null {
    return useContext(TaskNotificationsContext);
}
