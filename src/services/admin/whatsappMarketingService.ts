import { supabase } from '../../lib/supabase/client';
import { whatsappChatService } from './whatsappChatService';

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

export type MarketingMediaType = 'image' | 'video' | 'document';

export interface MarketingMedia {
    url: string;
    type: MarketingMediaType;
    name: string;
    /** Bu medyayla birlikte gidecek opsiyonel açıklama (WhatsApp caption). */
    caption?: string;
}

export interface MarketingItem {
    id: string;
    title: string;
    body_text: string | null;
    media: MarketingMedia[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

/** Kaydetmeden / paketsiz, anlık gönderilecek içerik. */
export interface MarketingPayload {
    body_text?: string | null;
    media: MarketingMedia[];
}

export interface BroadcastRecipient {
    phone_number: string;
    lead_id: string | null;
    name: string | null;
}

export interface RecipientProgress {
    recipient: BroadcastRecipient;
    status: 'ok' | 'failed';
    error?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Meta gönderim hız sınırına takılmamak için her mesaj arası bekleme.
const PER_MESSAGE_DELAY_MS = 650;

// ---------------------------------------------------------------------------
// Servis
// ---------------------------------------------------------------------------

export const whatsappMarketingService = {
    // --- Paket CRUD --------------------------------------------------------

    async listItems(activeOnly = true): Promise<MarketingItem[]> {
        let query = supabase
            .from('whatsapp_marketing_items')
            .select('*')
            .order('created_at', { ascending: false });
        if (activeOnly) query = query.eq('is_active', true);
        const { data, error } = await query;
        if (error) {
            console.error('[WhatsAppMarketing] listItems error:', error);
            throw error;
        }
        return (data || []).map(normalizeItem);
    },

    async createItem(input: { title: string; body_text?: string | null; media: MarketingMedia[] }): Promise<MarketingItem> {
        const { data, error } = await supabase
            .from('whatsapp_marketing_items')
            .insert([{
                title: input.title.trim(),
                body_text: input.body_text?.trim() || null,
                media: input.media,
            }])
            .select('*')
            .single();
        if (error) {
            console.error('[WhatsAppMarketing] createItem error:', error);
            throw error;
        }
        return normalizeItem(data);
    },

    async updateItem(id: string, patch: Partial<{ title: string; body_text: string | null; media: MarketingMedia[]; is_active: boolean }>): Promise<void> {
        const { error } = await supabase
            .from('whatsapp_marketing_items')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) {
            console.error('[WhatsAppMarketing] updateItem error:', error);
            throw error;
        }
    },

    async deleteItem(id: string): Promise<void> {
        const { error } = await supabase
            .from('whatsapp_marketing_items')
            .delete()
            .eq('id', id);
        if (error) {
            console.error('[WhatsAppMarketing] deleteItem error:', error);
            throw error;
        }
    },

    // --- Alıcı kaynakları --------------------------------------------------

    /**
     * Son 24 saatte BİZE yazmış (inbound) kişiler. WhatsApp 24 saat kuralı
     * gereği serbest medya yalnızca bu kişilere gider — diğerlerine Meta hata
     * döndürür. Bu yüzden "Serbest Medya" modunun varsayılan hedef kitlesi.
     */
    async getActiveContacts(): Promise<BroadcastRecipient[]> {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('phone_number, lead_id, sender_name, leads(customer_name)')
            .eq('direction', 'inbound')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(1000);
        if (error) {
            console.error('[WhatsAppMarketing] getActiveContacts error:', error);
            throw error;
        }
        const map = new Map<string, BroadcastRecipient>();
        (data || []).forEach((m: any) => {
            if (!m.phone_number) return;
            const phone = '+' + String(m.phone_number).replace(/\D/g, '');
            if (map.has(phone)) return;
            map.set(phone, {
                phone_number: phone,
                lead_id: m.lead_id || null,
                name: m.sender_name || m.leads?.customer_name || null,
            });
        });
        return Array.from(map.values());
    },

    /**
     * Telefon numarası olan tüm leadler. "Onaylı Şablon" modunda soğuk listeye
     * de gidilebileceği için tüm leadleri hedeflemeye izin verir.
     */
    async getAllLeadRecipients(): Promise<BroadcastRecipient[]> {
        const { data, error } = await supabase
            .from('leads')
            .select('id, customer_name, phone_number')
            .not('phone_number', 'is', null)
            .order('created_at', { ascending: false })
            .limit(2000);
        if (error) {
            console.error('[WhatsAppMarketing] getAllLeadRecipients error:', error);
            throw error;
        }
        const map = new Map<string, BroadcastRecipient>();
        (data || []).forEach((l: any) => {
            const digits = String(l.phone_number || '').replace(/\D/g, '');
            if (!digits) return;
            const phone = '+' + digits;
            if (map.has(phone)) return;
            map.set(phone, {
                phone_number: phone,
                lead_id: l.id || null,
                name: l.customer_name || null,
            });
        });
        return Array.from(map.values());
    },

    // --- Gönderim ----------------------------------------------------------

    /**
     * Tek bir kişiye bir paketi/anlık içeriği sıralı gönderir:
     * önce varsa yazı, sonra sırayla her medya (kendi caption'ıyla).
     * Mevcut /api/whatsapp/send route'unu (whatsappChatService.sendMessage)
     * kullanır — yeni backend gerektirmez.
     */
    async sendPayloadToContact(
        recipient: BroadcastRecipient,
        payload: MarketingPayload,
        opts: { delayMs?: number } = {}
    ): Promise<void> {
        const delay = opts.delayMs ?? PER_MESSAGE_DELAY_MS;
        const body = payload.body_text?.trim();
        const media = payload.media || [];

        // Yazı tek başınaysa metin mesajı; medya varsa yazıyı ilk medyanın
        // caption'ına gömmek yerine ayrı metin olarak yollamak daha okunur.
        if (body) {
            await whatsappChatService.sendMessage(recipient.phone_number, body, recipient.lead_id);
            if (media.length > 0) await sleep(delay);
        }

        for (let i = 0; i < media.length; i++) {
            const m = media[i];
            await whatsappChatService.sendMessage(
                recipient.phone_number,
                (m.caption || '').trim(),
                recipient.lead_id,
                m.url,
                m.type
            );
            if (i < media.length - 1) await sleep(delay);
        }
    },

    /**
     * Toplu gönderim: alıcılar üzerinde sırayla döner, her birine paketi yollar,
     * her adımda onProgress çağırır. Bir kişide hata olursa diğerlerine devam eder.
     */
    async broadcast(
        recipients: BroadcastRecipient[],
        payload: MarketingPayload,
        onProgress?: (done: number, total: number, last: RecipientProgress) => void
    ): Promise<RecipientProgress[]> {
        const results: RecipientProgress[] = [];
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            let progress: RecipientProgress;
            try {
                await this.sendPayloadToContact(recipient, payload);
                progress = { recipient, status: 'ok' };
            } catch (err: any) {
                progress = { recipient, status: 'failed', error: err?.message || 'Gönderilemedi' };
            }
            results.push(progress);
            onProgress?.(i + 1, recipients.length, progress);
            // Kişiler arası ekstra nefes — numara kalitesini korur.
            if (i < recipients.length - 1) await sleep(PER_MESSAGE_DELAY_MS);
        }
        return results;
    },
};

function normalizeItem(row: any): MarketingItem {
    return {
        id: row.id,
        title: row.title,
        body_text: row.body_text ?? null,
        media: Array.isArray(row.media) ? row.media : [],
        is_active: row.is_active ?? true,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
