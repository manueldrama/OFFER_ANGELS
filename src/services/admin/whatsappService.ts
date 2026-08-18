import { supabase } from '../../lib/supabase/client';

export interface WhatsAppMessageLog {
    id: string;
    lead_id: string;
    template_name: string | null;
    phone_number: string;
    provider: string;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    error_message: string | null;
    message_content: string | null;
    sent_at: string | null;
    created_at: string;
    leads?: {
        customer_name: string;
    };
}

export const AdminWhatsAppService = {
    // 1) List Logs
    async listLogs({
        status = 'all',
        page = 1,
        limit = 20
    }: {
        status?: string;
        page?: number;
        limit?: number;
    }) {
        let query = supabase
            .from('whatsapp_messages')
            .select(`
        *,
        leads (
          customer_name
        )
      `, { count: 'exact' });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[AdminWhatsAppService]', error);
            throw error;
        }

        return { logs: data as unknown as WhatsAppMessageLog[], count: count || 0 };
    },

    // 2) Retry — actually re-sends the message via the backend (Meta API),
    //    updating the same row in place. Throws on failure so the UI can surface it.
    async retryMessage(id: string) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        const isBypass = localStorage.getItem('admin_bypass') === 'true';

        if (!isBypass && (sessionError || !session?.access_token)) {
            throw new Error('You must be logged in to retry a message.');
        }
        const token = session?.access_token || (isBypass ? 'mock-admin-bypass' : '');

        const response = await fetch('/api/whatsapp/retry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Failed to retry WhatsApp message');
        }
        return result.message as WhatsAppMessageLog;
    },

    // 2b) Bulk retry — re-sends every stuck (failed + pending) message one by one.
    //     Returns a { sent, failed } summary. onProgress fires after each attempt.
    async retryAllStuck(onProgress?: (done: number, total: number) => void) {
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .in('status', ['failed', 'pending'])
            .order('created_at', { ascending: true })
            .limit(200);

        if (error) throw error;
        const ids = (data || []).map((r: any) => r.id as string);

        let sent = 0;
        let failed = 0;
        for (let i = 0; i < ids.length; i++) {
            try {
                await this.retryMessage(ids[i]);
                sent++;
            } catch {
                failed++;
            }
            onProgress?.(i + 1, ids.length);
        }
        return { sent, failed, total: ids.length };
    },

    // 2c) Hatalı gönderim kayıtlarını temizle — SADECE status='failed' VE
    //     direction='outbound' (başarısız otomatik gönderim denemeleri).
    //     Başarılı mesajlar, bekleyenler ve müşteri SOHBET geçmişi (inbound)
    //     ETKİLENMEZ. Amaç: log/banner'ı temizleyip yeni hataları öne çıkarmak.
    //     olderThanDays verilirse yalnız o günden eski hatalı kayıtlar silinir.
    async deleteFailedLogs(olderThanDays?: number): Promise<number> {
        let query = supabase
            .from('whatsapp_messages')
            .delete({ count: 'exact' })
            .eq('status', 'failed')
            .eq('direction', 'outbound');
        if (olderThanDays && olderThanDays > 0) {
            const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
            query = query.lt('created_at', cutoff);
        }
        const { count, error } = await query;
        if (error) {
            console.error('[AdminWhatsAppService] deleteFailedLogs', error);
            throw error;
        }
        return count || 0;
    },

    // 3) Send Manual Message
    async sendManualMessage(payload: { lead_id: string; phone_number: string; message_content: string; template_name?: string }) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        const isBypass = localStorage.getItem('admin_bypass') === 'true';

        if (!isBypass && (sessionError || !session?.access_token)) {
            console.error('[AdminWhatsAppService] No valid auth session found.', sessionError);
            throw new Error('You must be logged in to send a message.');
        }

        const token = session?.access_token || (isBypass ? 'mock-admin-bypass' : '');

        try {
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('[AdminWhatsAppService] Backend Error:', result);
                throw new Error(result.error || 'Failed to send WhatsApp message');
            }

            return result.message as WhatsAppMessageLog;
        } catch (error) {
            console.error('[AdminWhatsAppService] Error sending manual message:', error);
            throw error;
        }
    }
};
