import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAdminRealtime } from './useAdminRealtime';

// Shared counter for "customer reported a bank transfer but admin hasn't
// confirmed it yet". Drives the sidebar badge (AdminLayout) and the dashboard
// KPI card. One Supabase count query, reused via two hook callers — realtime
// keeps both call sites in sync without each owning its own subscription.
//
// Definition: payment_method='bank-transfer' AND bank_transfer_notified_at IS
// NOT NULL AND status='pending'. Pending is the only state where action is
// still required — once admin flips to deposit_paid/paid/etc. the row drops
// out of the count.

export function usePendingBankTransfersCount(enabled: boolean = true): number {
    const [count, setCount] = useState(0);

    const refresh = useCallback(async () => {
        const { count: c, error } = await supabase
            .from('customer_reservations')
            .select('id', { count: 'exact', head: true })
            .eq('payment_method', 'bank-transfer')
            .eq('status', 'pending')
            .not('bank_transfer_notified_at', 'is', null);
        if (error) {
            // Sayı bir ROZET besliyor (sidebar + KPI kartı); rozetin içinde hata
            // durumu render edilemez, bu yüzden son bilinen değer korunur. Ama hata
            // artık tamamen görünmez DEĞİL — sessizce 0'a düşen bir rozet, gerçekten
            // bekleyen havale olmadığı anlamına geliyormuş gibi okunuyordu.
            console.error('[usePendingBankTransfersCount] refresh failed:', error);
            return;
        }
        setCount(c ?? 0);
    }, []);

    useEffect(() => {
        if (!enabled) return;
        void refresh();
    }, [refresh, enabled]);

    // Heatmap gibi uzun-kalıcı analitik sayfalarında realtime tick'leri
    // gereksiz re-render üretiyordu; enabled=false ile abonelik kurulmuyor.
    useAdminRealtime(enabled ? ['customer_reservations'] : [], refresh);

    return count;
}
