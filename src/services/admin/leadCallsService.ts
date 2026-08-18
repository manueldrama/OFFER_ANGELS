import { supabase } from '../../lib/supabase/client';
import { fetchInChunks } from '../../lib/supabase/paginate';

/** Lead bazlı arama özeti — listCallsForLeads çıktısı. */
export interface LeadCallInfo {
    /** Toplam arama sayısı (call_logged event sayısı). */
    count: number;
    /** En son aramanın ISO zaman damgası. */
    lastAt: string;
    /** İlk aramanın ISO zaman damgası. */
    firstAt: string;
    /**
     * Ardışık son cevapsız deneme sayısı — en son aramadan geriye, ulaşılan
     * (cevapsız olmayan) ilk aramaya kadar. 3+ ise "WhatsApp'a yönlendir" sinyali.
     */
    noAnswerCount: number;
}

/**
 * Arama takibi — yeni tablo yok. Mevcut `lead_events` tablosuna
 * `event_type='call_logged'` kaydı yazıp okur (şema/RLS değişikliği gerekmez).
 * leadRemindersService.listOpenForLeads bulk desenini takip eder.
 */
export const leadCallsService = {
    /** Bir lead için arama kaydı düşer (o anki zaman = created_at). */
    async logCall(leadId: string, token: string): Promise<void> {
        const auth = await supabase.auth.getUser();
        const { error } = await supabase
            .from('lead_events')
            .insert({
                lead_id: leadId,
                token,
                event_type: 'call_logged',
                metadata: { by: auth.data.user?.id ?? null },
            });
        if (error) throw error;
    },

    /** Son aramayı geri al — o lead'in en güncel call_logged kaydını siler (yanlış basış). */
    async undoLastCall(leadId: string): Promise<void> {
        const { data, error } = await supabase
            .from('lead_events')
            .select('id')
            .eq('lead_id', leadId)
            .eq('event_type', 'call_logged')
            .order('created_at', { ascending: false })
            .limit(1);
        if (error) throw error;
        const id = data?.[0]?.id;
        if (!id) return; // silinecek arama yok
        const { error: delErr } = await supabase.from('lead_events').delete().eq('id', id);
        if (delErr) throw delErr;
    },

    /** Bulk: birçok lead için arama sayısı + ilk/son arama zamanı. */
    async listCallsForLeads(leadIds: string[]): Promise<Record<string, LeadCallInfo>> {
        if (leadIds.length === 0) return {};

        // Tüm call_logged kayıtlarını sayfa sayfa çek (Supabase'in 1000 satır
        // varsayılan sınırı aşılınca sayaçların boşalmasını önler).
        const rows = await fetchInChunks<{ lead_id: string; created_at: string; metadata: any }>(
            leadIds,
            (chunk, from, to) => supabase
                .from('lead_events')
                .select('lead_id, created_at, metadata')
                .eq('event_type', 'call_logged')
                .in('lead_id', chunk)
                .order('created_at', { ascending: true })
                .range(from, to),
        );

        const map: Record<string, LeadCallInfo> = {};
        rows.forEach((row) => {
            if (!row.lead_id) return;
            // Artan sıralı çekildiği için her satır mevcut "son arama"yı temsil eder.
            // Cevapsız serisi: cevapsızda artır, ulaşılınca sıfırla (en güncel hali kazanır).
            const isNoAnswer = row.metadata?.outcome === 'no_answer';
            const existing = map[row.lead_id];
            if (!existing) {
                map[row.lead_id] = {
                    count: 1, firstAt: row.created_at, lastAt: row.created_at,
                    noAnswerCount: isNoAnswer ? 1 : 0,
                };
            } else {
                existing.count += 1;
                existing.lastAt = row.created_at; // artan sıralı → son satır en yeni
                existing.noAnswerCount = isNoAnswer ? existing.noAnswerCount + 1 : 0;
            }
        });
        return map;
    },
};
