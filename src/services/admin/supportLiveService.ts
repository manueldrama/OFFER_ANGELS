import { supabase } from '../../lib/supabase/client';

export interface SupportConversation {
    id: string;
    customer_name: string | null;
    customer_phone: string | null;
    offer_token: string | null;
    visitor_id?: string | null;
    step: string | null;
    mode: 'bot' | 'live';
    needs_agent: boolean;
    status: 'open' | 'closed';
    last_message_at: string | null;
    created_at: string;
}

export interface SupportOnline {
    scope_type: 'offer' | 'visitor';
    scope_id: string;
    conversation_id: string | null;
    customer_name: string | null;
    source_page: string | null;
    last_seen_at: string;
    panel_open: boolean;
}

export interface SupportMessage {
    seq: number;
    role: 'customer' | 'assistant' | 'agent';
    text: string;
    created_at: string;
}

export interface SupportSettings {
    support_chat_enabled: string | null;
    support_live_online: string | null;
    support_ai_enabled: string | null;
    support_chat_title: string | null;
    support_notify_phone: string | null;
    support_nudge_enabled: string | null;
    support_sales_mode: string | null;
    support_sales_require_contact: string | null;
}

async function authHeader(): Promise<Record<string, string>> {
    const isBypass = localStorage.getItem('admin_bypass') === 'true';
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || (isBypass ? 'mock-admin-bypass' : '');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export const SupportLiveService = {
    async listInbox(): Promise<{ conversations: SupportConversation[]; online: SupportOnline[] }> {
        const res = await fetch('/api/support/admin/inbox', { headers: await authHeader() });
        if (!res.ok) throw new Error('Inbox yüklenemedi');
        const data = await res.json();
        return { conversations: data?.conversations || [], online: data?.online || [] };
    },

    async getMessages(conversationId: string): Promise<{ conversation: SupportConversation; messages: SupportMessage[] }> {
        const res = await fetch(`/api/support/admin/messages?conversation_id=${encodeURIComponent(conversationId)}`, {
            headers: await authHeader(),
        });
        if (!res.ok) throw new Error('Mesajlar yüklenemedi');
        return res.json();
    },

    async reply(conversationId: string, text: string): Promise<void> {
        const res = await fetch('/api/support/admin/reply', {
            method: 'POST',
            headers: await authHeader(),
            body: JSON.stringify({ conversation_id: conversationId, text }),
        });
        if (!res.ok) throw new Error('Yanıt gönderilemedi');
    },

    // Proaktif: online müşteriye (henüz konuşması yoksa) ilk mesajı gönder; dönen conversation_id.
    async replyToScope(scopeType: 'offer' | 'visitor', scopeId: string, text: string): Promise<string> {
        const res = await fetch('/api/support/admin/reply', {
            method: 'POST',
            headers: await authHeader(),
            body: JSON.stringify({ scope_type: scopeType, scope_id: scopeId, text }),
        });
        if (!res.ok) throw new Error('Mesaj gönderilemedi');
        const data = await res.json();
        return data?.conversation_id || '';
    },

    async release(conversationId: string): Promise<void> {
        const res = await fetch('/api/support/admin/reply', {
            method: 'POST',
            headers: await authHeader(),
            body: JSON.stringify({ conversation_id: conversationId, release: true }),
        });
        if (!res.ok) throw new Error('Bota devredilemedi');
    },

    async manage(action: string, conversationId: string, extra: { seq?: number; text?: string } = {}): Promise<void> {
        const res = await fetch('/api/support/admin/manage', {
            method: 'POST',
            headers: await authHeader(),
            body: JSON.stringify({ action, conversation_id: conversationId, ...extra }),
        });
        if (!res.ok) throw new Error('İşlem başarısız');
    },

    deleteConversation(id: string) { return this.manage('delete_conversation', id); },
    clearConversation(id: string) { return this.manage('clear_conversation', id); },
    editMessage(id: string, seq: number, text: string) { return this.manage('edit_message', id, { seq, text }); },
    deleteMessage(id: string, seq: number) { return this.manage('delete_message', id, { seq }); },

    async getSettings(): Promise<SupportSettings> {
        const res = await fetch('/api/support/admin/settings', { headers: await authHeader() });
        if (!res.ok) throw new Error('Ayarlar yüklenemedi');
        return res.json();
    },

    async saveSettings(patch: Partial<Record<keyof SupportSettings, string | boolean>>): Promise<void> {
        const res = await fetch('/api/support/admin/settings', {
            method: 'POST',
            headers: await authHeader(),
            body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error('Ayarlar kaydedilemedi');
    },
};
