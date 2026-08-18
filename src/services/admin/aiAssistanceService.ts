/// <reference types="vite/client" />

// Utility service to call the internal AI endpoints

import { supabase } from '../../lib/supabase/client';

export const apiAssistanceService = {
    async callAction(leadId: string, actionType: 'score' | 'summary' | 'suggest', tone: string = 'professional') {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`/api/internal/ai/lead/${leadId}/action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token ?? ''}`
            },
            body: JSON.stringify({ actionType, tone })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `AI Request Failed with ${response.status}`);
        }

        const json = await response.json();
        return json.data;
    },

    async suggestReply(leadId: string, tone: string = 'professional'): Promise<string> {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`/api/internal/ai/lead/${leadId}/suggest-reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token ?? ''}`
            },
            body: JSON.stringify({ tone })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `AI Suggest Reply Failed with ${response.status}`);
        }

        const json = await response.json();
        return json.suggestion;
    },

    // WhatsApp Sohbet "Düzelt" butonu — mesajı göndermeden önce Türkçe yazım
    // ve dilbilgisi hatalarını düzeltir. Anlamı/tonu/emojileri korur.
    async fixGrammar(text: string): Promise<{ corrected: string; changed: boolean }> {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`/api/internal/ai/grammar-check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token ?? ''}`
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Yazım kontrolü başarısız (${response.status})`);
        }

        const json = await response.json();
        return { corrected: json.corrected ?? text, changed: !!json.changed };
    },

    async askAi(question: string, leadId?: string | null, sessionId?: string | null, messages?: { role: string; content: string }[], mode?: 'sales' | 'portal' | 'faq_assistant', productContext?: { productName?: string; productId?: string; faqItems?: Array<{ title: string; description: string }>; specs?: Array<{ title: string; value_text: string }> }): Promise<{ answer: string; sessionId: string }> {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`/api/internal/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token ?? ''}`
            },
            body: JSON.stringify({ question, leadId, sessionId, messages, mode, productContext })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `AI Chat Failed with ${response.status}`);
        }

        const json = await response.json();
        return { answer: json.answer, sessionId: json.sessionId };
    },

    // "AI bana soru sorsun" eğitim modu — AI, bilgi tabanında eksik kalan
    // konularda admin'e cevaplaması için sorular üretir.
    async suggestTrainingQuestions(count: number = 5): Promise<string[]> {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`/api/internal/ai/training/suggest-questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token ?? ''}`
            },
            body: JSON.stringify({ count })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Soru üretimi başarısız (${response.status})`);
        }

        const json = await response.json();
        return (json.questions || []) as string[];
    },

    // "Gerçek konuşmalarımdan öğren" — geçmiş manuel (insan) WhatsApp cevaplarını
    // few-shot örnek adayı (müşteri sorusu → temsilci cevabı) olarak çıkarır.
    async mineFromConversations(days: number = 60): Promise<Array<{ question: string; answer: string; leadName?: string; when?: string }>> {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`/api/internal/ai/training/from-conversations?days=${encodeURIComponent(days)}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Konuşma taraması başarısız (${response.status})`);
        }

        const json = await response.json();
        return (json.candidates || []) as Array<{ question: string; answer: string; leadName?: string; when?: string }>;
    },

    async generateDashboardInsights() {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`/api/internal/ai/insights`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session?.access_token ?? ''}`
            }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `AI Insights Failed with ${response.status}`);
        }

        const json = await response.json();
        return json.insights;
    }
};
