import { useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { AuthContext } from '../components/auth/AuthProvider';

/**
 * Oturumdaki kullanıcı satış temsilcisiyse (sales_admin) kendisine atanmış
 * lead id listesini döner — SalesDashboard ve Canlı İzleme scoping'inin tek
 * kanonik kaynağı (Offers.tsx getLeadIds deseninin hook hali).
 *
 * Dönüş: undefined = temsilci değil (global görünüm, filtre yok),
 *        null      = liste yükleniyor (fetch bekletilmeli),
 *        string[]  = temsilcinin lead id'leri (boş dizi = hiç lead yok).
 */
export function useAssignedLeadIds(): string[] | null | undefined {
    const { role, session } = useContext(AuthContext);
    const isSalesRole = role === 'sales_admin';
    const userId = session?.user?.id;
    const [leadIds, setLeadIds] = useState<string[] | null>(null);

    useEffect(() => {
        if (!isSalesRole || !userId) return;
        let cancelled = false;
        supabase
            .from('leads')
            .select('id')
            .eq('assigned_to', userId)
            .then(({ data }) => {
                if (!cancelled) setLeadIds((data || []).map((l: any) => l.id));
            });
        return () => { cancelled = true; };
    }, [isSalesRole, userId]);

    if (!isSalesRole) return undefined;
    return leadIds;
}
