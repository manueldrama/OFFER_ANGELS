import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAdminRealtime } from './useAdminRealtime';

// Operatörün, gönderim sessizce çökerse (ör. Meta token süresi dolması, şablon
// parametre uyuşmazlığı) HEMEN fark etmesi için son 24 saatteki başarısız
// outbound WhatsApp mesajlarını sayar. AdminLayout'taki global uyarı bandını ve
// "Gönderim Logları" sidebar rozetini besler.
//
// Tanım: whatsapp_messages where direction='outbound' AND status='failed'
//        AND created_at >= now()-24h. error_message koddan dolduruluyor
//        (send-offer-link / send-template), o yüzden son hata metni de gösterilir.
//
// Realtime + 60sn poll birlikte: realtime kaçarsa (replication kapalı vb.) poll
// yakalar; kritik bir sağlık sinyali için tek mekanizmaya güvenmiyoruz.

const WINDOW_MS = 24 * 60 * 60 * 1000;
const POLL_MS = 60 * 1000;

export interface WhatsAppFailureAlert {
    /** Son 24 saatteki başarısız outbound mesaj sayısı. */
    count: number;
    /** En son başarısız mesajın Meta/sistem hata metni (varsa). */
    lastError: string | null;
    /** En son başarısız mesajın şablon adı. */
    lastTemplate: string | null;
    /** En son başarısızlığın zaman damgası (ISO). */
    lastAt: string | null;
    /** İlk sorgu tamamlanana kadar true. */
    loading: boolean;
}

const INITIAL: WhatsAppFailureAlert = {
    count: 0,
    lastError: null,
    lastTemplate: null,
    lastAt: null,
    loading: true,
};

export function useWhatsAppFailureAlert(enabled: boolean = true): WhatsAppFailureAlert {
    const [state, setState] = useState<WhatsAppFailureAlert>(INITIAL);

    const refresh = useCallback(async () => {
        const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();
        const { data, count, error } = await supabase
            .from('whatsapp_messages')
            .select('error_message, template_name, created_at', { count: 'exact' })
            .eq('direction', 'outbound')
            .eq('status', 'failed')
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: false })
            .limit(1);
        if (error) {
            setState((s) => ({ ...s, loading: false }));
            return;
        }
        const latest = data?.[0] as { error_message?: string | null; template_name?: string | null; created_at?: string | null } | undefined;
        setState({
            count: count ?? 0,
            lastError: latest?.error_message ?? null,
            lastTemplate: latest?.template_name ?? null,
            lastAt: latest?.created_at ?? null,
            loading: false,
        });
    }, []);

    useEffect(() => {
        if (!enabled) return;
        void refresh();
        const id = setInterval(() => void refresh(), POLL_MS);
        return () => clearInterval(id);
    }, [refresh, enabled]);

    // Heatmap gibi uzun-kalıcı sayfalarda enabled=false → abonelik kurulmaz.
    useAdminRealtime(enabled ? ['whatsapp_messages'] : [], refresh);

    return state;
}
