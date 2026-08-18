// Frontend wrapper for /api/internal/ai/contract/generate.
// AI üretimi ülke + dil + satıcı bilgileri + operasyonel parametrelere göre
// "Ön Bilgilendirme Formu" ve "Mesafeli Satış Sözleşmesi" HTML taslağı döner.
// Çıktı HUKUKİ TASLAKTIR — avukat onayından geçirilmelidir.

import { supabase } from '../../lib/supabase/client';

export interface ContractAiSeller {
    company_name: string;
    tax_office?: string;
    tax_number?: string;
    mersis_number?: string;
    address: string;
    phone: string;
    email?: string;
    website?: string;
}

export interface ContractAiTerms {
    withdrawal_days?: number;
    delivery_days?: number;
    shipping_company?: string;
    return_address?: string;
    jurisdiction_city?: string;
    product_category?: string;
    extra_notes?: string;
}

export type ContractAiMode = 'generate' | 'translate' | 'improve';

export interface ContractAiRequest {
    country_code: string;
    language_code: string;
    mode: ContractAiMode;
    seller: ContractAiSeller;
    terms?: ContractAiTerms;
    source_pre_info_html?: string;
    source_distance_sales_html?: string;
}

export interface ContractAiResult {
    pre_info_title: string;
    pre_info_html: string;
    distance_sales_title: string;
    distance_sales_html: string;
    mode: ContractAiMode;
    country_code: string;
    language_code: string;
}

export const ContractAiService = {
    async generate(req: ContractAiRequest): Promise<ContractAiResult> {
        console.log('[ContractAi] request', { country: req.country_code, language: req.language_code, mode: req.mode });
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/internal/ai/contract/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify(req),
        });
        const rawText = await res.text();
        console.log('[ContractAi] response', res.status, rawText.slice(0, 500));
        if (!res.ok) {
            let detail = rawText;
            try { detail = JSON.parse(rawText).error || rawText; } catch { /* ignore */ }
            if (res.status === 405) {
                throw new Error('Endpoint deploy edilmemiş (405). Cloudflare Pages build bitmesini bekle ve sayfayı Ctrl+Shift+R ile yenile.');
            }
            if (res.status === 401 || res.status === 403) {
                throw new Error(`Yetki hatası (${res.status}): Oturum geçersiz olabilir. Çıkış yapıp tekrar giriş yapmayı deneyin.`);
            }
            if (res.status === 502) {
                throw new Error(`AI sağlayıcı yanıt vermedi (502): Cloudflare env'de ANTHROPIC_API_KEY veya OPENAI_API_KEY tanımlı mı? Detay: ${detail}`);
            }
            throw new Error(`AI üretimi başarısız (${res.status}): ${detail}`);
        }
        let data: ContractAiResult & { ok?: boolean; error?: string; raw?: string };
        try { data = JSON.parse(rawText); } catch (e) {
            throw new Error('AI cevabı JSON değil: ' + rawText.slice(0, 200));
        }
        if (!data.pre_info_html && !data.distance_sales_html) {
            throw new Error('AI boş içerik döndürdü. Backend yanıtı: ' + rawText.slice(0, 300));
        }
        return data;
    },
};
