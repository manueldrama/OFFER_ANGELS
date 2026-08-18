/**
 * Product Content AI Service (frontend wrapper)
 *
 * Calls backend /api/internal/ai/product/generate-field with the bearer token
 * pattern. Backend loads skills/cafepaste-product-marketing/ files as the
 * Claude system prompt, so this client only carries the request parameters.
 */

import { supabase } from '../../lib/supabase/client';

export type AiTone = 'aggressive' | 'premium' | 'urgency' | 'educational';

export interface MarketingContext {
    audience?: string;
    tone?: AiTone;
    sector?: string;
    customHint?: string;
}

export interface GenerateFieldParams {
    productId: string;
    sectionType: string;
    fieldKey: string;
    itemContext?: Record<string, any>;
    targetLang: string;
    marketingContext?: MarketingContext;
}

export interface GenerateFieldResult {
    text: string;
    skillsUsed: string[];
}

export const ProductContentAiService = {
    async generateField(params: GenerateFieldParams): Promise<GenerateFieldResult> {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/internal/ai/product/generate-field', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify(params),
        });

        if (!res.ok) {
            let detail = '';
            try { detail = (await res.json()).error || ''; } catch { /* ignore */ }
            throw new Error(`AI generation failed (${res.status}): ${detail}`);
        }

        const data = await res.json();
        if (!data?.text) throw new Error('AI generation returned empty');
        return { text: data.text, skillsUsed: data.skillsUsed || [] };
    },
};
