import React, { createContext, useContext } from 'react';
import type { ReminderAlertsState } from '../hooks/useReminderAlerts';

// Hatırlatma verisini AdminLayout'tan sayfa içeriğine taşır.
//
// NEDEN CONTEXT: useReminderAlerts 60sn poll + lead_reminders realtime aboneliği
// açar ve yeni bir hatırlatma "vakti geldi" olunca bip çalar. Dashboard widget'ı
// hook'u kendisi çağırsaydı ikinci bir poll döngüsü, ikinci bir realtime kanalı ve
// — her kopyanın kendi "görüldü" kaydı olduğu için — ÇİFT BİP oluşurdu. Tek örnek
// AdminLayout'ta yaşar, tüketiciler buradan okur.
//
// Provider dışında (ör. admin dışı bir sayfa) kullanılırsa null döner; tüketici
// widget kendini gizler, hata fırlatmaz.

const ReminderAlertsContext = createContext<ReminderAlertsState | null>(null);

export function ReminderAlertsProvider({
    value,
    children,
}: {
    value: ReminderAlertsState;
    children: React.ReactNode;
}) {
    return (
        <ReminderAlertsContext.Provider value={value}>
            {children}
        </ReminderAlertsContext.Provider>
    );
}

/** Paylaşılan hatırlatma durumu. Provider yoksa null. */
export function useReminderAlertsContext(): ReminderAlertsState | null {
    return useContext(ReminderAlertsContext);
}
