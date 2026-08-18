import React, { useState, useEffect, useRef } from 'react';
import {
    MessageCircle, Send, X, Sparkles, Loader2, ArrowRight, Copy, FileText, Zap, Bot, TrendingUp, User, Plus,
} from 'lucide-react';
import { whatsappChatService, ChatMessage } from '../../../services/admin/whatsappChatService';
import { apiAssistanceService } from '../../../services/admin/aiAssistanceService';
import { formatDate, formatTime } from '../../../hooks/useAppSettings';
import { supabase } from '../../../lib/supabase/client';
import { RoiSendPanel } from './RoiSendPanel';
import { CustomerInfoPanel } from '../../../pages/admin/whatsapp/components/CustomerInfoPanel';
import { NewOfferDrawer } from '../../../pages/admin/whatsapp/components/NewOfferDrawer';

/** WhatsAppQuickSend için yeterli olan dar lead şekli — Lead tipiyle de uyumlu. */
export interface WhatsAppChatLead {
    id: string;
    customer_name: string;
    phone_number?: string | null;
    company_name?: string | null;
    country_code?: string | null;
}

/**
 * WhatsApp hızlı sohbet penceresi — Müşteri Yönetimi'nde ve Teklif Linkleri sayfasında
 * paylaşılan tek bileşen. Konuşma geçmişi + AI asistan + şablon mesaj gönderimi.
 */
export function WhatsAppQuickSend({ lead, onClose }: { lead: WhatsAppChatLead; onClose: () => void }) {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loadingMsgs, setLoadingMsgs] = useState(true);
    const [error, setError] = useState('');
    const [showAi, setShowAi] = useState(false);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [aiSuggesting, setAiSuggesting] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [aiChatMessages, setAiChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
    const [aiChatInput, setAiChatInput] = useState('');
    const [aiChatLoading, setAiChatLoading] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templates, setTemplates] = useState<{ name: string; body: string; language: string }[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<{ name: string; body: string; language: string } | null>(null);
    const [templateParams, setTemplateParams] = useState<string[]>([]);
    const [sendingTemplate, setSendingTemplate] = useState(false);
    const [showRoiPanel, setShowRoiPanel] = useState(false);
    const [showCustomer, setShowCustomer] = useState(false);
    const [showNewOffer, setShowNewOffer] = useState(false);
    const [customerRefreshKey, setCustomerRefreshKey] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // En son gelen (inbound) mesajın zamanı — ROI görseli 24sa kuralı için.
    const lastInboundAt = (() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].direction === 'inbound') return messages[i].created_at;
        }
        return null;
    })();

    const QUICK_REPLIES = [
        { title: 'Hosgeldiniz', text: 'Merhaba, Cafepaste platformuna hos geldiniz. Size nasil yardimci olabilirim?' },
        { title: 'Fiyat', text: 'Fiyatlandirma hakkinda detayli bilgi almak icin lutfen talep bilgilerinizi paylasin.' },
        { title: 'Tesekkur', text: 'Bizimle iletisime gectiginiz icin tesekkur ederiz. En kisa surede geri donus yapacagiz.' },
    ];

    useEffect(() => {
        if (!lead.phone_number) return;
        loadConversation();
        whatsappChatService.markAsRead(lead.phone_number);
        const sub = whatsappChatService.subscribeToMessages(() => loadConversation());
        return () => { sub.unsubscribe(); };
    }, [lead.phone_number]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const loadConversation = async () => {
        if (!lead.phone_number) return;
        try { setMessages(await whatsappChatService.getConversation(lead.phone_number)); } catch {} finally { setLoadingMsgs(false); }
    };

    const handleSend = async (text?: string) => {
        const content = (text || message).trim();
        if (!content || !lead.phone_number) return;
        setSending(true); setError('');
        try {
            await whatsappChatService.sendMessage(lead.phone_number, content, lead.id);
            setMessage(''); setShowQuickReplies(false);
            await loadConversation();
        } catch (err: any) { setError(err.message || 'Mesaj gonderilemedi'); } finally { setSending(false); }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

    // Teklif linkini WhatsApp'tan gönder — ana paneldeki handleSendOfferLink ile
    // aynı mantık (CustomerInfoPanel + NewOfferDrawer bunu bekliyor).
    const handleSendOfferLink = async (token: string, offerId?: string | null, salutationOverride?: 'Bey' | 'Hanım' | 'none'): Promise<void> => {
        if (!lead.phone_number) { setError('Telefon numarası yok'); return; }
        const res = await fetch('/api/customer/send-offer-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offer_token: token, offer_id: offerId || undefined, admin_final: true, salutation_override: salutationOverride }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false)
            throw new Error(data?.message || data?.error || 'Teklif linki gönderilemedi');
        await loadConversation();
    };

    const handleAiSuggest = async () => {
        if (aiSuggesting) return;
        setAiSuggesting(true); setAiSuggestion(null);
        try { setAiSuggestion(await apiAssistanceService.suggestReply(lead.id)); } catch (err: any) { setAiSuggestion('Oneri uretilemedi: ' + (err.message || 'Hata')); } finally { setAiSuggesting(false); }
    };

    const handleAiChat = async (e: React.FormEvent) => {
        e.preventDefault();
        const q = aiChatInput.trim();
        if (!q || aiChatLoading) return;
        setAiChatInput('');
        setAiChatMessages(prev => [...prev, { role: 'user', text: q }]);
        setAiChatLoading(true);
        try {
            const result = await apiAssistanceService.askAi(q, lead.id);
            setAiChatMessages(prev => [...prev, { role: 'ai', text: result.answer }]);
        } catch (err: any) {
            setAiChatMessages(prev => [...prev, { role: 'ai', text: 'Hata: ' + (err.message || 'Cevap alinamadi') }]);
        } finally { setAiChatLoading(false); }
    };

    const loadTemplates = async () => {
        try {
            // Endpoint gerçek admin oturumu doğruluyor — sahte "mock-admin-bypass" 403 yiyip
            // Meta şablon gövdelerini boş bırakıyordu; oturum token'ı ile isteniyor.
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/whatsapp/templates', { headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` } });
            const data = await res.json();
            const metaTemplates = (data.templates || []).map((t: any) => ({ name: t.name, body: t.body, language: t.language || 'tr' }));

            const { data: localTemplates } = await supabase
                .from('whatsapp_templates')
                .select('name, content, language')
                .eq('is_active', true)
                .order('name');
            const dbTemplates = (localTemplates || []).map((t: any) => ({ name: t.name, body: t.content, language: t.language || 'tr' }));

            const seen = new Set<string>();
            const merged: { name: string; body: string; language: string }[] = [];
            for (const t of [...metaTemplates, ...dbTemplates]) {
                if (!seen.has(t.name)) { seen.add(t.name); merged.push(t); }
            }
            setTemplates(merged.length > 0 ? merged : [{ name: 'offer_link3', body: 'Merhaba {{1}}, teklifiniz hazır! 🎉 Teklif linkiniz: {{2}} Buradan ulaşabilirsiniz. Herhangi bir sorunuz için bize bu numaradan yanıt verebilirsiniz. İyi günler! 🙏', language: 'en' }]);
        } catch {
            try {
                const { data: localTemplates } = await supabase
                    .from('whatsapp_templates')
                    .select('name, content, language')
                    .eq('is_active', true)
                    .order('name');
                const dbTemplates = (localTemplates || []).map((t: any) => ({ name: t.name, body: t.content, language: t.language || 'tr' }));
                if (dbTemplates.length > 0) { setTemplates(dbTemplates); return; }
            } catch {}
            setTemplates([{ name: 'offer_link3', body: 'Merhaba {{1}}, teklifiniz hazır! 🎉 Teklif linkiniz: {{2}} Buradan ulaşabilirsiniz. Herhangi bir sorunuz için bize bu numaradan yanıt verebilirsiniz. İyi günler! 🙏', language: 'en' }]);
        }
    };

    const openTemplateModal = () => {
        loadTemplates();
        setSelectedTemplate(null);
        setTemplateParams([]);
        setShowTemplateModal(true);
    };

    const handleSelectTemplate = (tmpl: { name: string; body: string; language: string }) => {
        setSelectedTemplate(tmpl);
        const numberedMatches = tmpl.body.match(/\{\{\d+\}\}/g) || [];
        const namedMatches = tmpl.body.match(/\{\{[a-zA-Z_]+\}\}/g) || [];
        const allMatches = numberedMatches.length > 0 ? numberedMatches : namedMatches;
        const defaults: string[] = [];
        for (let i = 0; i < allMatches.length; i++) {
            if (i === 0) defaults.push(lead.customer_name || '');
            else defaults.push('');
        }
        setTemplateParams(defaults);
    };

    const handleSendTemplate = async () => {
        if (!selectedTemplate || !lead.phone_number || sendingTemplate) return;
        setSendingTemplate(true);
        try {
            const res = await fetch('/api/whatsapp/send-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer mock-admin-bypass' },
                body: JSON.stringify({
                    phone_number: lead.phone_number,
                    lead_id: lead.id,
                    template_name: selectedTemplate.name,
                    language_code: selectedTemplate.language || 'tr',
                    parameters: templateParams
                })
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Template gönderilemedi'); }
            setShowTemplateModal(false);
            await loadConversation();
        } catch (err: any) {
            setError(`Template Hatası: ${err.message}`);
        } finally { setSendingTemplate(false); }
    };

    const chatFormatTime = (date: string) => formatTime(date);
    const chatFormatDate = (date: string) => {
        const d = new Date(date); const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Bugun';
        const y = new Date(today); y.setDate(today.getDate() - 1);
        if (d.toDateString() === y.toDateString()) return 'Dun';
        return formatDate(date);
    };

    const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
    messages.forEach(msg => {
        const dk = new Date(msg.created_at).toDateString();
        const last = groupedMessages[groupedMessages.length - 1];
        if (last && new Date(last.msgs[0].created_at).toDateString() === dk) last.msgs.push(msg);
        else groupedMessages.push({ date: msg.created_at, msgs: [msg] });
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative bg-white rounded-lg shadow-lg w-full mx-4 flex overflow-hidden" style={{ height: '75vh', maxHeight: '650px', maxWidth: (showAi || showCustomer) ? '900px' : '500px' }} onClick={e => e.stopPropagation()}>

                {/* Chat Column */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-600 rounded-tl-lg shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                <MessageCircle size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">{lead.customer_name}</p>
                                <p className="text-[10px] text-emerald-100">{lead.phone_number}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => { setShowCustomer(v => !v); setShowAi(false); }} className={`p-1.5 rounded-md transition-colors ${showCustomer ? 'bg-white/20 text-white' : 'text-emerald-200 hover:bg-white/10 hover:text-white'}`} title="Müşteri Bilgileri">
                                <User size={16} />
                            </button>
                            <button onClick={() => setShowNewOffer(true)} className="p-1.5 rounded-md text-emerald-200 hover:bg-white/10 hover:text-white transition-colors" title="Yeni Teklif Oluştur">
                                <Plus size={16} />
                            </button>
                            <button onClick={() => setShowRoiPanel(true)} className="p-1.5 rounded-md text-emerald-200 hover:bg-white/10 hover:text-white transition-colors" title="Müşteriye Özel ROI Gönder">
                                <TrendingUp size={16} />
                            </button>
                            <button onClick={openTemplateModal} className="p-1.5 rounded-md text-emerald-200 hover:bg-white/10 hover:text-white transition-colors" title="Şablon Mesaj">
                                <FileText size={16} />
                            </button>
                            <button onClick={() => setShowQuickReplies(!showQuickReplies)} className={`p-1.5 rounded-md transition-colors ${showQuickReplies ? 'bg-white/20 text-white' : 'text-emerald-200 hover:bg-white/10 hover:text-white'}`} title="Hazir cevaplar">
                                <Zap size={16} />
                            </button>
                            <button onClick={() => { setShowAi(v => !v); setShowCustomer(false); }} className={`p-1.5 rounded-md transition-colors ${showAi ? 'bg-white/20 text-white' : 'text-emerald-200 hover:bg-white/10 hover:text-white'}`} title="AI Asistan">
                                <Bot size={16} />
                            </button>
                            <button onClick={onClose} className="p-1.5 rounded-md text-emerald-200 hover:bg-white/10 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Quick Replies Bar */}
                    {showQuickReplies && (
                        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                            {QUICK_REPLIES.map((qr, i) => (
                                <button key={i} onClick={() => handleSend(qr.text)} className="flex-shrink-0 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-medium text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors cursor-pointer">
                                    {qr.title}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-[#e5ddd5]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
                        {loadingMsgs ? (
                            <div className="flex items-center justify-center h-full"><p className="text-xs text-slate-400">Mesajlar yukleniyor...</p></div>
                        ) : messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full"><p className="text-xs text-slate-400">Henuz mesaj yok.</p></div>
                        ) : (
                            groupedMessages.map((group, gi) => (
                                <div key={gi}>
                                    <div className="flex justify-center my-2">
                                        <span className="bg-white/80 text-[10px] text-slate-500 font-medium px-3 py-1 rounded-full shadow-sm">{chatFormatDate(group.date)}</span>
                                    </div>
                                    {group.msgs.map(msg => (
                                        <div key={msg.id} className={`flex mb-1 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${msg.direction === 'outbound' ? 'bg-[#dcf8c6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
                                                {msg.media_url && <img src={msg.media_url} alt="" className="max-w-full rounded-lg mb-1" />}
                                                <p className="text-[13px] text-slate-800 whitespace-pre-wrap break-words">{msg.message_content}</p>
                                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                                    <span className="text-[9px] text-slate-400">{chatFormatTime(msg.created_at)}</span>
                                                    {msg.direction === 'outbound' && (
                                                        <span className={`text-[9px] ${msg.status === 'read' ? 'text-blue-500' : msg.status === 'delivered' ? 'text-slate-400' : 'text-slate-300'}`}>
                                                            {msg.status === 'read' || msg.status === 'delivered' ? '✓✓' : msg.status === 'sent' ? '✓' : msg.status === 'failed' ? '✕' : '◷'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Input */}
                    <div className="border-t border-slate-200 bg-slate-50 px-3 py-2.5 rounded-bl-lg shrink-0">
                        {error && <p className="text-red-500 text-[10px] font-bold mb-1">{error}</p>}
                        <div className="flex items-end gap-2">
                            <textarea value={message} onChange={e => setMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder="Mesaj yazin..." rows={1} className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none max-h-24" />
                            <button onClick={() => handleSend()} disabled={!message.trim() || sending} className="p-2.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer shrink-0">
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* AI Panel */}
                {showAi && (
                    <div className="w-80 border-l border-slate-200 flex flex-col bg-white rounded-r-lg shrink-0">
                        <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-tr-lg shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} className="text-purple-600" />
                                    <span className="text-sm font-bold text-slate-800">AI Asistan</span>
                                </div>
                                <button onClick={() => setShowAi(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X size={14} /></button>
                            </div>
                        </div>

                        {/* Suggest Reply */}
                        <div className="px-4 py-3 border-b border-slate-200 shrink-0">
                            <button onClick={handleAiSuggest} disabled={aiSuggesting} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors text-xs font-medium">
                                {aiSuggesting ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                                {aiSuggesting ? 'Oneri uretuluyor...' : 'Cevap Oner'}
                            </button>
                            {aiSuggestion && (
                                <div className="mt-2 p-2.5 bg-purple-50 rounded-lg border border-purple-100">
                                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{aiSuggestion}</p>
                                    <div className="flex gap-1.5 mt-2">
                                        <button onClick={() => { setMessage(aiSuggestion); setAiSuggestion(null); }} className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-[10px] font-medium hover:bg-purple-700">
                                            <ArrowRight size={10} /> Kullan
                                        </button>
                                        <button onClick={() => navigator.clipboard.writeText(aiSuggestion)} className="flex items-center gap-1 px-2 py-1 bg-white text-slate-600 border border-slate-200 rounded text-[10px] font-medium hover:bg-slate-50">
                                            <Copy size={10} /> Kopyala
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* AI Chat */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="px-4 py-2 border-b border-slate-200 shrink-0">
                                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">AI'a Sor</h4>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {aiChatMessages.length === 0 && (
                                    <div className="text-center text-slate-400 text-[10px] py-6">
                                        <Sparkles size={20} className="mx-auto mb-1.5 text-slate-300" />
                                        <p>Urun bilgisi, fiyat, teknik detay</p>
                                        <p>gibi sorular sorabilirsiniz.</p>
                                    </div>
                                )}
                                {aiChatMessages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                            <p className="whitespace-pre-wrap">{msg.text}</p>
                                        </div>
                                    </div>
                                ))}
                                {aiChatLoading && (
                                    <div className="flex justify-start"><div className="bg-slate-100 px-2.5 py-1.5 rounded-lg"><Loader2 size={14} className="animate-spin text-slate-400" /></div></div>
                                )}
                            </div>
                            <form onSubmit={handleAiChat} className="p-2.5 border-t border-slate-200 flex gap-1.5 shrink-0">
                                <input type="text" value={aiChatInput} onChange={e => setAiChatInput(e.target.value)} placeholder="Bir soru sorun..." className="flex-1 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-purple-200 outline-none" disabled={aiChatLoading} />
                                <button type="submit" disabled={!aiChatInput.trim() || aiChatLoading} className="p-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors">
                                    <Send size={12} />
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Customer Info Panel — ana paneldeki müşteri detay paneli */}
                {showCustomer && (
                    <div className="w-[340px] border-l border-slate-200 shrink-0">
                        <CustomerInfoPanel
                            key={`${lead.phone_number}-${customerRefreshKey}`}
                            leadId={lead.id}
                            phoneNumber={lead.phone_number || ''}
                            senderName={lead.customer_name}
                            onClose={() => setShowCustomer(false)}
                            onSendOfferLink={handleSendOfferLink}
                            onLeadDataChanged={loadConversation}
                        />
                    </div>
                )}
            </div>

            {/* Yeni Teklif Oluştur drawer */}
            <NewOfferDrawer
                isOpen={showNewOffer}
                onClose={() => setShowNewOffer(false)}
                leadId={lead.id}
                customerName={lead.customer_name}
                onSendOfferLink={handleSendOfferLink}
                onCreated={() => setCustomerRefreshKey(k => k + 1)}
            />

            {/* ROI Send Panel */}
            {showRoiPanel && (
                <RoiSendPanel
                    lead={lead}
                    lastInboundAt={lastInboundAt}
                    onClose={() => setShowRoiPanel(false)}
                    onSent={loadConversation}
                />
            )}

            {/* Template Modal */}
            {showTemplateModal && (
                <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center rounded-lg" onClick={() => setShowTemplateModal(false)}>
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <FileText size={16} className="text-emerald-600" />
                                    Şablon Mesajı Gönder
                                </h2>
                                <p className="text-[11px] text-slate-500 mt-0.5">Onaylı WhatsApp şablonlarından seçin</p>
                            </div>
                            <button onClick={() => setShowTemplateModal(false)} className="p-1.5 hover:bg-slate-100 rounded-md"><X size={16} className="text-slate-400" /></button>
                        </div>

                        <div className="px-5 py-4 space-y-4 max-h-[50vh] overflow-y-auto">
                            <div>
                                <label className="text-xs font-medium text-slate-700 mb-2 block">Şablon Seçin</label>
                                <div className="space-y-2">
                                    {templates.length === 0 && <div className="text-xs text-slate-400 text-center py-4">Onaylı şablon bulunamadı.</div>}
                                    {templates.map(tmpl => (
                                        <button key={tmpl.name} onClick={() => handleSelectTemplate(tmpl)}
                                            className={`w-full text-left p-3 rounded-md border-2 transition-colors ${selectedTemplate?.name === tmpl.name ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                                            <div className="font-medium text-slate-800 text-xs">{tmpl.name}</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{tmpl.body}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {selectedTemplate && templateParams.length > 0 && (
                                <div>
                                    <label className="text-xs font-medium text-slate-700 mb-2 block">Değişkenler</label>
                                    <div className="space-y-2">
                                        {templateParams.map((param, idx) => (
                                            <div key={idx}>
                                                {(() => {
                                                    const vars = selectedTemplate.body.match(/\{\{\w+\}\}/g) || [];
                                                    const varName = vars[idx]?.replace(/[{}]/g, '') || `${idx + 1}`;
                                                    return <label className="text-[10px] text-slate-500 mb-1 block">{vars[idx] || `{{${idx + 1}}}`} — {varName === 'name' ? 'Müşteri Adı' : varName === 'offer_link' ? 'Teklif Linki' : varName === 'company' ? 'Şirket' : varName}</label>;
                                                })()}
                                                <input type="text" value={param}
                                                    onChange={e => { const u = [...templateParams]; u[idx] = e.target.value; setTemplateParams(u); }}
                                                    placeholder={idx === 0 ? 'Müşteri adı...' : 'Değer girin...'}
                                                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-200 outline-none" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                        <div className="text-[10px] text-emerald-600 mb-1 font-medium">Önizleme:</div>
                                        <div className="text-xs text-slate-700">
                                            {(() => {
                                                const vars = selectedTemplate.body.match(/\{\{\w+\}\}/g) || [];
                                                let preview = selectedTemplate.body;
                                                vars.forEach((v, i) => { preview = preview.replace(v, templateParams[i] || v); });
                                                return preview;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
                            <button onClick={() => setShowTemplateModal(false)} className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-md">İptal</button>
                            <button onClick={handleSendTemplate} disabled={!selectedTemplate || sendingTemplate}
                                className="px-4 py-2 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
                                {sendingTemplate ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                {sendingTemplate ? 'Gönderiliyor...' : 'Gönder'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
