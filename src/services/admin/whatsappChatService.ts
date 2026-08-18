import { supabase } from '../../lib/supabase/client';

export interface ChatContact {
    phone_number: string;
    sender_name: string | null;
    last_message: string;
    last_message_at: string;
    unread_count: number;
    lead_id: string | null;
}

export interface ChatMessage {
    id: string;
    phone_number: string;
    message_content: string;
    media_url: string | null;
    media_type: string | null;
    direction: 'inbound' | 'outbound';
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    sent_at: string;
    read_at: string | null;
    error_message: string | null;
    created_at: string;
    /** Meta onaylı şablon adı (şablon mesajları için doludur). */
    template_name?: string | null;
}

// whatsapp_messages satırlarını (created_at DESC sıralı) telefon başına tek
// ChatContact'a indirger. getContacts ve searchContacts ortak kullanır.
function buildContactsFromMessages(messages: any[]): ChatContact[] {
    const contactsMap = new Map<string, ChatContact>();
    messages?.forEach(msg => {
        if (!msg.phone_number) return;
        const phone = '+' + msg.phone_number.replace(/\D/g, '');
        if (!contactsMap.has(phone)) {
            contactsMap.set(phone, {
                phone_number: phone,
                sender_name: msg.sender_name || (msg.leads as any)?.customer_name || null,
                last_message: msg.message_content || 'Media message',
                last_message_at: msg.created_at,
                unread_count: (msg.direction === 'inbound' && msg.status !== 'read') ? 1 : 0,
                lead_id: msg.lead_id,
            });
        } else {
            const existing = contactsMap.get(phone)!;
            if (msg.direction === 'inbound' && msg.status !== 'read') existing.unread_count += 1;
            if (!existing.lead_id && msg.lead_id) existing.lead_id = msg.lead_id;
            const fallbackName = (msg.leads as any)?.customer_name;
            if (!existing.sender_name && (msg.sender_name || fallbackName)) {
                existing.sender_name = msg.sender_name || fallbackName;
            }
        }
    });
    return Array.from(contactsMap.values());
}

const CONTACT_SELECT = `
    id,
    phone_number,
    sender_name,
    message_content,
    created_at,
    direction,
    status,
    lead_id,
    leads(customer_name)
`;

export const whatsappChatService = {
    /**
     * Gets a distinct list of all phone numbers we have ever conversed with,
     * ordered by the most recent message.
     */
    async getContacts(assignedUserId?: string | null): Promise<ChatContact[]> {
        // If assignedUserId is provided (sales role), first fetch lead IDs assigned to that user
        let allowedLeadIds: string[] | null = null;
        if (assignedUserId) {
            const { data: assignedLeads } = await supabase
                .from('leads')
                .select('id')
                .eq('assigned_to', assignedUserId);
            allowedLeadIds = (assignedLeads || []).map((l: any) => l.id);
            // If no leads assigned, return empty
            if (allowedLeadIds.length === 0) return [];
        }

        let query = supabase
            .from('whatsapp_messages')
            .select(`
                phone_number,
                sender_name,
                message_content,
                created_at,
                direction,
                status,
                lead_id,
                leads(customer_name)
            `)
            .order('created_at', { ascending: false })
            .limit(1000);

        // Filter to only messages linked to assigned leads
        if (allowedLeadIds) {
            query = query.in('lead_id', allowedLeadIds);
        }

        const { data: messages, error } = await query;

        if (error) {
            console.error('[WhatsAppChatService] Error fetching contacts:', error);
            throw error;
        }

        const contactsMap = new Map<string, ChatContact>();

        messages?.forEach(msg => {
            if (!msg.phone_number) return;

            // Normalize phone: strip all non-digits then prepend "+"
            const phone = '+' + msg.phone_number.replace(/\D/g, '');

            if (!contactsMap.has(phone)) {
                contactsMap.set(phone, {
                    phone_number: phone,
                    sender_name: msg.sender_name || (msg.leads as any)?.customer_name || null,
                    last_message: msg.message_content || 'Media message',
                    last_message_at: msg.created_at,
                    unread_count: (msg.direction === 'inbound' && msg.status !== 'read') ? 1 : 0,
                    lead_id: msg.lead_id
                });
            } else {
                // If we already added the contact, just increment unread count if needed
                const existing = contactsMap.get(phone)!;
                if (msg.direction === 'inbound' && msg.status !== 'read') {
                    existing.unread_count += 1;
                }

                // En yeni mesaj lead_id'siz olabilir (örn. send-offer-link null yazıyor) →
                // kontağın lead'i kopmasın diye aynı telefondaki HERHANGI bir mesajdaki
                // geçerli lead_id'yi kullan. Yoksa panel "Lead Eşleştirilmemiş" diyordu.
                if (!existing.lead_id && msg.lead_id) {
                    existing.lead_id = msg.lead_id;
                }

                // Keep the earliest found sender_name if missing
                const fallbackName = (msg.leads as any)?.customer_name;
                if (!existing.sender_name && (msg.sender_name || fallbackName)) {
                    existing.sender_name = msg.sender_name || fallbackName;
                }
            }
        });

        return Array.from(contactsMap.values());
    },

    /**
     * Sunucu taraflı sohbet araması — getContacts'ın 1000 mesajlık penceresine
     * TAKILMADAN tüm geçmişte arar. Şuna göre eşleşir:
     *   - müşteri/lead adı (leads.customer_name)  → lead_id üzerinden mesajlar
     *   - telefon (her format: +90 / 0 / boşluklu — son 10 hane ile eşleşir)
     *   - mesaj içeriği (message_content) ve sender_name
     * Türkçe karakterler PostgREST ilike ile küçük/büyük harf duyarsız eşleşir.
     */
    async searchContacts(query: string, assignedUserId?: string | null): Promise<ChatContact[]> {
        const q = query.trim();
        if (!q) return [];

        // Sales rol kapsamı: yalnız atanmış lead'lerin mesajları.
        let allowedLeadIds: string[] | null = null;
        if (assignedUserId) {
            const { data } = await supabase.from('leads').select('id').eq('assigned_to', assignedUserId);
            allowedLeadIds = (data || []).map((l: any) => l.id);
            if (allowedLeadIds.length === 0) return [];
        }

        // Telefon: son 10 hane → +90 / 0 / boşluklu tüm formatları yakalar.
        const digits = q.replace(/\D/g, '');
        const core = digits.length > 10 ? digits.slice(-10) : digits;
        // PostgREST .or() virgül/parantezle ayrışır → metni güvenli hale getir.
        const safe = q.replace(/[,()]/g, ' ').trim();

        // 1) Ada/telefona göre lead eşleşmesi → lead_id listesi.
        const leadOr: string[] = [];
        if (safe) leadOr.push(`customer_name.ilike.%${safe}%`);
        if (core.length >= 3) leadOr.push(`phone_number.ilike.%${core}%`);
        if (leadOr.length === 0) return [];
        let leadQ = supabase.from('leads').select('id').or(leadOr.join(',')).limit(100);
        if (allowedLeadIds) leadQ = leadQ.in('id', allowedLeadIds);
        const { data: leadRows } = await leadQ;
        const nameLeadIds = (leadRows || []).map((r: any) => r.id).filter(Boolean);

        // 2) Mesaj içeriği / gönderen adı / telefon eşleşmesi.
        const msgOr: string[] = [];
        if (safe) { msgOr.push(`message_content.ilike.%${safe}%`); msgOr.push(`sender_name.ilike.%${safe}%`); }
        if (core.length >= 3) msgOr.push(`phone_number.ilike.%${core}%`);
        let msgQ = supabase.from('whatsapp_messages').select(CONTACT_SELECT)
            .or(msgOr.join(',')).order('created_at', { ascending: false }).limit(600);
        if (allowedLeadIds) msgQ = msgQ.in('lead_id', allowedLeadIds);

        // 3) Ada göre eşleşen lead'lerin mesajları (ad mesaj metninde geçmese de).
        const promises: any[] = [msgQ];
        if (nameLeadIds.length) {
            promises.push(
                supabase.from('whatsapp_messages').select(CONTACT_SELECT)
                    .in('lead_id', nameLeadIds).order('created_at', { ascending: false }).limit(600),
            );
        }
        const results = await Promise.all(promises);

        // Birleştir + id'ye göre tekille, created_at DESC sırala, kişiye indir.
        const seen = new Set<string>();
        const merged: any[] = [];
        for (const res of results) {
            for (const m of (res.data || [])) {
                if (m.id && seen.has(m.id)) continue;
                if (m.id) seen.add(m.id);
                merged.push(m);
            }
        }
        merged.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        return buildContactsFromMessages(merged);
    },

    /**
     * Gets the full conversation history for a specific phone number
     */
    async getConversation(phoneNumber: string): Promise<ChatMessage[]> {
        // Ensure consistent formatting
        const cleanPhone1 = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
        const cleanPhone2 = phoneNumber.replace('+', '');

        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .or(`phone_number.eq.${cleanPhone1},phone_number.eq.${cleanPhone2}`)
            .order('created_at', { ascending: true }); // Chronological order

        if (error) {
            console.error('[WhatsAppChatService] Error fetching conversation:', error);
            throw error;
        }

        return (data || []) as ChatMessage[];
    },

    /**
     * Marks all unread messages from a contact as read
     */
    async markAsRead(phoneNumber: string) {
        const cleanPhone1 = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
        const cleanPhone2 = phoneNumber.replace('+', '');

        const { error } = await supabase
            .from('whatsapp_messages')
            .update({ status: 'read', read_at: new Date().toISOString() })
            .eq('direction', 'inbound')
            .neq('status', 'read')
            .or(`phone_number.eq.${cleanPhone1},phone_number.eq.${cleanPhone2}`);

        if (error) {
            console.error('[WhatsAppChatService] Error marking as read:', error);
        }
    },

    /**
     * Sends a new free-form text message or media message to the contact
     * Admin chat is already protected by admin panel authentication.
     * We use 'mock-admin-bypass' token here which the backend accepts for admin routes.
     */
    async sendMessage(phoneNumber: string, content: string, leadId?: string | null, mediaUrl?: string, mediaType?: string) {
        // Admin panel is already authenticated - use bypass token which the backend accepts
        const token = 'mock-admin-bypass';

        // Use the existing manual send route in backend
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                phone_number: phoneNumber,
                message_content: content,
                lead_id: leadId,
                media_url: mediaUrl,
                media_type: mediaType
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to send message');
        }

        return result;
    },

    /**
     * Uploads a file to Supabase Storage and returns its public URL
     */
    async uploadMedia(file: File): Promise<string> {
        // Construct a unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data, error } = await supabase.storage
            .from('whatsapp_media')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('[WhatsAppChatService] Error uploading file:', error);
            throw error;
        }

        const { data: publicData } = supabase.storage
            .from('whatsapp_media')
            .getPublicUrl(filePath);

        return publicData.publicUrl;
    },

    /**
     * Deletes a message from the database
     */
    async deleteMessage(messageId: string) {
        const { error } = await supabase
            .from('whatsapp_messages')
            .delete()
            .eq('id', messageId);

        if (error) {
            console.error('[WhatsAppChatService] Error deleting message:', error);
            throw error;
        }
    },

    /**
     * Deletes an entire conversation for a specific phone number
     */
    async deleteConversation(phoneNumber: string) {
        const cleanPhone1 = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
        const cleanPhone2 = phoneNumber.replace('+', '');

        const { error } = await supabase
            .from('whatsapp_messages')
            .delete()
            .or(`phone_number.eq.${cleanPhone1},phone_number.eq.${cleanPhone2}`);

        if (error) {
            console.error('[WhatsAppChatService] Error deleting conversation:', error);
            throw error;
        }
    },

    /**
     * Subscribes to real-time changes on the whatsapp_messages table
     */
    subscribeToMessages(callback: (payload: any) => void) {
        return supabase.channel('whatsapp-chat-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'whatsapp_messages' },
                (payload) => callback(payload)
            )
            .subscribe();
    }
};
