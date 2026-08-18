import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAdminRealtime } from './useAdminRealtime';

/**
 * offer_reclaim_requests tablosunda status='pending' kayıt sayısı —
 * AdminLayout sidebar'da "Geri Dönüş Talepleri" item'ı yanında badge
 * olarak gösterilir. Realtime ile canlı güncellenir (yeni talep gelince
 * sayfa yenilemeye gerek kalmadan badge artar).
 */
export function usePendingReclaimCount(enabled: boolean = true): number {
    const [count, setCount] = useState(0);

    const refresh = useCallback(async () => {
        const { count: c, error } = await supabase
            .from('offer_reclaim_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending');
        if (!error) setCount(c ?? 0);
    }, []);

    useEffect(() => {
        if (!enabled) return;
        void refresh();
    }, [refresh, enabled]);

    // Heatmap gibi uzun-kalıcı analitik sayfalarında pasif tut —
    // realtime tick'leri AdminLayout'u gereksiz re-render ettiriyordu.
    useAdminRealtime(enabled ? ['offer_reclaim_requests'] : [], refresh);

    return count;
}
