import { supabase } from '../../../lib/supabase/client';
import { HR_CONTRACT_PLACEHOLDERS } from '../../../lib/hr/contractPlaceholders';
import type { ContractType, EngagementType, HrKpiConfig } from '../../../types/hr';

// /api/internal/ai/hr-contract/generate istemci sarmalayıcısı.
//
// GİZLİLİK: Bu servis ÇALIŞAN VERİSİ TAŞIMAZ. İsteğe yalnızca yer tutucu
// listesi, KPI ağırlıkları (şirket politikası) ve varsa örnek sözleşme metni
// girer. Ad/kimlik/maaş dış sağlayıcıya çıkmaz — doldurma tarayıcıda yapılır.
//
// Bu kısıtı bozmak istemeden kolaydır: buildKpiStructure()'a çalışana özel
// prim tavanı EKLENMEMELİDİR; şablonda o alan {{primTavani}} kalır.

export type HrContractAiMode = 'generate' | 'improve' | 'from_sample';

export interface HrContractAiRequest {
    mode: HrContractAiMode;
    contractType: ContractType;
    languageCode?: string;
    /** Hukuki çerçeveyi ve dili belirler. Boşsa TR varsayılır. */
    countryCode?: string;
    /** 'contractor' → iş kanunu kullanılmaz, hizmet sözleşmesi yazılır. */
    engagementType?: EngagementType | null;
    sourceHtml?: string;
    sampleText?: string;
    instructions?: string;
    includeBonusClause?: boolean;
    kpiConfig?: HrKpiConfig | null;
}

export interface HrContractAiResult {
    title: string;
    body_html: string;
    /** Metinde kalan {{token}} sayısı. 0 ise model yer tutucuları doldurmuş olabilir. */
    placeholder_count: number;
    mode: HrContractAiMode;
}

/** KPI yapısını prompt'a uygun metne çevirir — kişisel veri İÇERMEZ. */
function buildKpiStructure(cfg: HrKpiConfig) {
    const components = [
        ['Lead → Satış Dönüşümü', cfg.weight_conversion],
        ['Takip Uyumu', cfg.weight_followup],
        ['Öncelikli Lead Kapsamı', cfg.weight_priority],
        ['İlk Temas SLA', cfg.weight_sla],
        ['CRM Bütünlüğü', cfg.weight_crm],
        ['Mesai Doluluğu', cfg.weight_activity],
    ].filter(([, w]) => Number(w) > 0)
        .map(([label, w]) => `${label} (${w} puan)`)
        .join(', ');

    const scale = [...(cfg.bonus_scale ?? [])]
        .sort((a, b) => a.min - b.min)
        .map(b => `${b.min}–${b.max} puan → %${b.pct}`)
        .join('; ');

    return { components, scale, premium_gate: true };
}

export const HrContractAiService = {
    async generate(req: HrContractAiRequest): Promise<HrContractAiResult> {
        const { data: { session } } = await supabase.auth.getSession();

        const payload = {
            mode: req.mode,
            contract_type: req.contractType,
            language_code: req.languageCode || 'tr',
            country_code: req.countryCode || undefined,
            engagement_type: req.engagementType || undefined,
            source_html: req.sourceHtml || undefined,
            sample_text: req.sampleText || undefined,
            instructions: req.instructions || undefined,
            include_bonus_clause: !!req.includeBonusClause,
            kpi: req.includeBonusClause && req.kpiConfig ? buildKpiStructure(req.kpiConfig) : undefined,
            placeholders: HR_CONTRACT_PLACEHOLDERS.map(p => ({ token: p.token, description: p.description })),
        };

        const res = await fetch('/api/internal/ai/hr-contract/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify(payload),
        });

        const rawText = await res.text();
        if (!res.ok) {
            let detail = rawText;
            try { detail = JSON.parse(rawText).error || rawText; } catch { /* ignore */ }
            if (res.status === 405 || res.status === 404) {
                throw new Error('Uç henüz yayında değil. Cloudflare Pages derlemesinin bitmesini bekleyip sayfayı Ctrl+Shift+R ile yenileyin.');
            }
            if (res.status === 401 || res.status === 403) {
                throw new Error(`Yetki hatası (${res.status}). Çıkış yapıp tekrar giriş yapmayı deneyin.`);
            }
            if (res.status === 502) {
                throw new Error(`AI sağlayıcı yanıt vermedi (502). Cloudflare ortamında ANTHROPIC_API_KEY veya OPENAI_API_KEY tanımlı mı? Detay: ${detail}`);
            }
            throw new Error(`AI üretimi başarısız (${res.status}): ${detail}`);
        }

        let data: HrContractAiResult;
        try {
            data = JSON.parse(rawText);
        } catch {
            throw new Error('AI cevabı JSON değil: ' + rawText.slice(0, 200));
        }
        if (!data.body_html) throw new Error('AI boş metin döndürdü.');
        return data;
    },
};
