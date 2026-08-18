import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, ArrowLeft, Send, ExternalLink, Check, CheckCheck, Clock, AlertCircle, MessageCircle, Loader2 } from 'lucide-react';
import { useWhatsAppBubble } from '../../../contexts/WhatsAppBubbleContext';
import { ChatMessage } from '../../../services/admin/whatsappChatService';

const HIDDEN_PATH = '/admin/whatsapp-chat';

function formatTime(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
}

function formatRelative(iso: string): string {
    try {
        const d = new Date(iso);
        const now = new Date();
        const diffH = (now.getTime() - d.getTime()) / 36e5;
        if (diffH < 24 && d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        }
        if (diffH < 48) return 'Dün';
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
    } catch { return ''; }
}

const StatusIcon: React.FC<{ status: ChatMessage['status'] }> = ({ status }) => {
    switch (status) {
        case 'pending': return <Clock size={11} className="text-gray-400" />;
        case 'sent': return <Check size={12} className="text-gray-400" />;
        case 'delivered': return <CheckCheck size={12} className="text-gray-400" />;
        case 'read': return <CheckCheck size={12} className="text-blue-400" />;
        case 'failed': return <AlertCircle size={12} className="text-red-500" />;
        default: return null;
    }
};

export const WhatsAppMiniPanel: React.FC = () => {
    const location = useLocation();
    const {
        contacts, selectedPhone, messages,
        isPanelOpen, loadingContacts, loadingMessages, sending,
        closePanel, selectContact, backToList, sendMessage,
    } = useWhatsAppBubble();

    const [draft, setDraft] = useState('');
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (selectedPhone) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, selectedPhone]);

    if (!isPanelOpen) return null;
    if (location.pathname.startsWith(HIDDEN_PATH)) return null;

    const selectedContact = contacts.find(c => c.phone_number === selectedPhone);

    const handleSend = async () => {
        const text = draft.trim();
        if (!text || sending) return;
        setDraft('');
        try {
            await sendMessage(text);
        } catch {
            // Hata durumunda drafta geri yaz
            setDraft(text);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-40 w-[380px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#075E54] text-white">
                <div className="flex items-center gap-2 min-w-0">
                    {selectedPhone ? (
                        <button onClick={backToList} className="p-1 -ml-1 rounded hover:bg-white/10" aria-label="Geri">
                            <ArrowLeft size={18} />
                        </button>
                    ) : (
                        <MessageCircle size={18} />
                    )}
                    <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                            {selectedPhone
                                ? (selectedContact?.sender_name || selectedPhone)
                                : 'WhatsApp Sohbetleri'}
                        </div>
                        {selectedPhone && (
                            <div className="text-[11px] text-white/70 truncate">{selectedPhone}</div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Link
                        to="/admin/whatsapp-chat"
                        onClick={closePanel}
                        className="p-1.5 rounded hover:bg-white/10"
                        aria-label="Tam ekran"
                        title="Tam ekran sohbet sayfasi"
                    >
                        <ExternalLink size={15} />
                    </Link>
                    <button onClick={closePanel} className="p-1.5 rounded hover:bg-white/10" aria-label="Kapat">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Body */}
            {!selectedPhone ? (
                <ContactsList />
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto px-3 py-3 bg-[#ECE5DD] space-y-1.5">
                        {loadingMessages && messages.length === 0 ? (
                            <div className="flex justify-center py-6 text-slate-500">
                                <Loader2 className="animate-spin" size={18} />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="text-center text-xs text-slate-500 py-8">Henüz mesaj yok.</div>
                        ) : messages.map(msg => {
                            const isOut = msg.direction === 'outbound';
                            return (
                                <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm shadow-sm ${isOut ? 'bg-[#DCF8C6] text-slate-800' : 'bg-white text-slate-800'}`}>
                                        <div className="whitespace-pre-wrap break-words">{msg.message_content}</div>
                                        <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-slate-500">
                                            <span>{formatTime(msg.created_at)}</span>
                                            {isOut && <StatusIcon status={msg.status} />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-200 bg-white">
                        <input
                            type="text"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Mesaj yaz..."
                            disabled={sending}
                            className="flex-1 px-3 py-2 text-sm bg-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!draft.trim() || sending}
                            className="w-9 h-9 rounded-full bg-[#25D366] hover:bg-[#1ebd5b] disabled:bg-slate-300 text-white flex items-center justify-center transition-colors"
                            aria-label="Gönder"
                        >
                            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    function ContactsList() {
        return (
            <div className="flex-1 overflow-y-auto">
                {loadingContacts && contacts.length === 0 ? (
                    <div className="flex justify-center py-8 text-slate-400">
                        <Loader2 className="animate-spin" size={20} />
                    </div>
                ) : contacts.length === 0 ? (
                    <div className="text-center text-sm text-slate-400 py-10">
                        Henüz sohbet yok.
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {contacts.map(c => (
                            <li
                                key={c.phone_number}
                                onClick={() => selectContact(c.phone_number)}
                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold text-sm shrink-0">
                                    {(c.sender_name || c.phone_number).slice(c.sender_name ? 0 : -2, c.sender_name ? 2 : undefined).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-medium text-slate-800 truncate">
                                            {c.sender_name || c.phone_number}
                                        </div>
                                        <div className="text-[10px] text-slate-400 shrink-0">{formatRelative(c.last_message_at)}</div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                        <div className="text-xs text-slate-500 truncate">{c.last_message}</div>
                                        {c.unread_count > 0 && (
                                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#25D366] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                                {c.unread_count > 99 ? '99+' : c.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    }
};

export default WhatsAppMiniPanel;
