import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, AlertCircle, Loader2 } from 'lucide-react';
import { apiAssistanceService } from '../../services/admin/aiAssistanceService';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
    id: string;
    role: 'assistant' | 'user';
    content: string;
    timestamp: Date;
}

interface AiChatBotProps {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    customerName: string;
    onOpenServiceRequest?: () => void;
}

export default function AiChatBot({ isOpen, onClose, leadId, customerName, onOpenServiceRequest }: AiChatBotProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: `Merhaba ${customerName}! Ben CAFEPASTE Akıllı Servis Asistanı. Cihazınızın kurulumu, kullanımı veya yaşadığınız teknik bir sorun hakkında size nasıl yardımcı olabilirim?`,
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const chatHistory = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
            const result = await apiAssistanceService.askAi(userMsg.content, leadId, sessionId, chatHistory, 'portal');
            if (result.sessionId) setSessionId(result.sessionId);
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: result.answer,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Üzgünüm, şu an yanıt veremiyorum. Lütfen teknik ekibimizle doğrudan iletişime geçin veya servis kaydı açın.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col h-[80vh] sm:h-[600px] border border-slate-100"
                >
                    {/* Header */}
                    <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Bot size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Servis Asistanı</h3>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Çevrimiçi</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <div className={`p-4 rounded-lg text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="flex gap-3 max-w-[85%]">
                                    <div className="w-8 h-8 rounded-lg bg-white text-slate-400 border border-slate-100 flex items-center justify-center shadow-sm">
                                        <Loader2 size={16} className="animate-spin" />
                                    </div>
                                    <div className="p-4 rounded-lg bg-white text-slate-400 rounded-tl-none border border-slate-100 italic text-xs">
                                        Asistan yazıyor...
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Tools */}
                    <div className="px-6 py-3 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <button 
                            onClick={onOpenServiceRequest}
                            className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                        >
                            <AlertCircle size={14} />
                            Servis Kaydı Aç
                        </button>
                        <button className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors">
                            Cihaz Kurulumu
                        </button>
                        <button className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors">
                            Hata Kodları
                        </button>
                    </div>

                    {/* Input Area */}
                    <div className="p-6 bg-white border-t border-slate-100">
                        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-2 border border-slate-100 focus-within:border-indigo-200 transition-all">
                            <input 
                                type="text"
                                className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                                placeholder="Mesajınızı yazın..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            />
                            <button 
                                onClick={handleSend}
                                disabled={!input.trim() || isTyping}
                                className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-600/20"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
