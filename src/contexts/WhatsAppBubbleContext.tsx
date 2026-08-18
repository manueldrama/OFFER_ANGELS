import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { whatsappChatService, ChatContact, ChatMessage } from '../services/admin/whatsappChatService';

// WebAudio ile kisa bir "pling" — asset olmadan calismasi icin.
function playPling() {
    try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
        setTimeout(() => ctx.close().catch(() => {}), 600);
    } catch { /* sessizce yut */ }
}

interface WhatsAppBubbleContextValue {
    contacts: ChatContact[];
    selectedPhone: string | null;
    messages: ChatMessage[];
    totalUnread: number;
    isPanelOpen: boolean;
    loadingContacts: boolean;
    loadingMessages: boolean;
    sending: boolean;
    openPanel: () => void;
    closePanel: () => void;
    selectContact: (phone: string) => void;
    backToList: () => void;
    sendMessage: (text: string) => Promise<void>;
    refresh: () => Promise<void>;
}

const WhatsAppBubbleContext = createContext<WhatsAppBubbleContextValue | null>(null);

export const useWhatsAppBubble = () => {
    const ctx = useContext(WhatsAppBubbleContext);
    if (!ctx) throw new Error('useWhatsAppBubble must be used within WhatsAppBubbleProvider');
    return ctx;
};

function normalizePhone(p: string | null | undefined): string {
    if (!p) return '';
    return '+' + p.replace(/\D/g, '');
}

export const WhatsAppBubbleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [contacts, setContacts] = useState<ChatContact[]>([]);
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);

    const selectedPhoneRef = useRef<string | null>(null);
    selectedPhoneRef.current = selectedPhone;

    const totalUnread = useMemo(
        () => contacts.reduce((acc, c) => acc + (c.unread_count || 0), 0),
        [contacts]
    );

    const loadContacts = useCallback(async () => {
        setLoadingContacts(true);
        try {
            const data = await whatsappChatService.getContacts();
            data.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
            setContacts(data);
        } catch (err) {
            console.error('[WhatsAppBubble] loadContacts failed', err);
        } finally {
            setLoadingContacts(false);
        }
    }, []);

    const loadMessages = useCallback(async (phone: string) => {
        setLoadingMessages(true);
        try {
            const data = await whatsappChatService.getConversation(phone);
            setMessages(data);
            // Otomatik markAsRead
            await whatsappChatService.markAsRead(phone);
            // Local state'i de unread=0 yap (realtime UPDATE de gelir ama bekleme)
            setContacts(prev => prev.map(c => c.phone_number === phone ? { ...c, unread_count: 0 } : c));
        } catch (err) {
            console.error('[WhatsAppBubble] loadMessages failed', err);
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    // Ilk yukleme
    useEffect(() => { loadContacts(); }, [loadContacts]);

    // Realtime subscription
    useEffect(() => {
        const channel = whatsappChatService.subscribeToMessages((payload) => {
            if (payload.eventType === 'INSERT') {
                const row = payload.new as ChatMessage;
                if (row.direction === 'inbound') {
                    playPling();
                }
                // Contacts'i yeniden cek (en dogru unread + sira)
                loadContacts();
                // Acik sohbete aitse mesaj listesine ekle
                const phone = normalizePhone(row.phone_number);
                if (selectedPhoneRef.current && normalizePhone(selectedPhoneRef.current) === phone) {
                    setMessages(prev => [...prev, row]);
                    if (row.direction === 'inbound') {
                        whatsappChatService.markAsRead(selectedPhoneRef.current).catch(() => {});
                    }
                }
            } else if (payload.eventType === 'UPDATE') {
                const row = payload.new as ChatMessage;
                setMessages(prev => prev.map(m => m.id === row.id ? row : m));
            } else if (payload.eventType === 'DELETE') {
                const oldRow = payload.old as ChatMessage;
                setMessages(prev => prev.filter(m => m.id !== oldRow.id));
            }
        });
        return () => {
            try { channel.unsubscribe?.(); } catch { /* ignore */ }
        };
    }, [loadContacts]);

    const openPanel = useCallback(() => setIsPanelOpen(true), []);
    const closePanel = useCallback(() => {
        setIsPanelOpen(false);
        setSelectedPhone(null);
        setMessages([]);
    }, []);

    const selectContact = useCallback((phone: string) => {
        setSelectedPhone(phone);
        setMessages([]);
        loadMessages(phone);
    }, [loadMessages]);

    const backToList = useCallback(() => {
        setSelectedPhone(null);
        setMessages([]);
    }, []);

    const sendMessage = useCallback(async (text: string) => {
        if (!selectedPhone || !text.trim()) return;
        setSending(true);
        try {
            const contact = contacts.find(c => c.phone_number === selectedPhone);
            await whatsappChatService.sendMessage(selectedPhone, text.trim(), contact?.lead_id ?? null);
            // Realtime INSERT mesaj listesini guncelleyecek, ama hizli geri donus icin:
            await whatsappChatService.getConversation(selectedPhone).then(setMessages).catch(() => {});
        } catch (err: any) {
            console.error('[WhatsAppBubble] sendMessage failed', err);
            throw err;
        } finally {
            setSending(false);
        }
    }, [selectedPhone, contacts]);

    const value: WhatsAppBubbleContextValue = {
        contacts, selectedPhone, messages, totalUnread, isPanelOpen,
        loadingContacts, loadingMessages, sending,
        openPanel, closePanel, selectContact, backToList, sendMessage,
        refresh: loadContacts,
    };

    return (
        <WhatsAppBubbleContext.Provider value={value}>
            {children}
        </WhatsAppBubbleContext.Provider>
    );
};
