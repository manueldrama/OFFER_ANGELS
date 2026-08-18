import OpenAI from 'openai';
import { supabase } from '../../lib/supabase/client';
import { getGlossaryForLang, buildGlossaryPrompt, getTranslationInstructions, buildInstructionsPrompt } from './translationGlossary';

// Çeviri Denetimi (QA) — çevrilmiş metinleri insan editör gibi denetler:
// gramer, anlam sadakati, terim tutarlılığı (sözlüğe göre), ton, çevrilmemiş
// kalıntı ve bozuk {{değişken}}/HTML. Bulguları TR açıklama + önerilen düzeltme
// ile döndürür. Elle (butonla) tetiklenir; model gpt-4o (titiz muhakeme).

const LANG_NAMES: Record<string, string> = {
    en: 'English', tr: 'Turkish', it: 'Italian', de: 'German', fr: 'French',
    es: 'Spanish', pt: 'Portuguese', nl: 'Dutch', ru: 'Russian', pl: 'Polish',
    ro: 'Romanian', el: 'Greek', sv: 'Swedish', da: 'Danish', no: 'Norwegian',
    fi: 'Finnish', cs: 'Czech', sk: 'Slovak', hu: 'Hungarian', bg: 'Bulgarian',
    hr: 'Croatian', sr: 'Serbian', sl: 'Slovenian', uk: 'Ukrainian', ar: 'Arabic',
    he: 'Hebrew', fa: 'Persian', hi: 'Hindi', ja: 'Japanese', ko: 'Korean',
    zh: 'Chinese (Simplified)', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
    ms: 'Malay', az: 'Azerbaijani', kk: 'Kazakh', uz: 'Uzbek', ka: 'Georgian',
    hy: 'Armenian', sq: 'Albanian', bs: 'Bosnian', mk: 'Macedonian', et: 'Estonian',
    lv: 'Latvian', lt: 'Lithuanian', is: 'Icelandic', ga: 'Irish', mt: 'Maltese',
};

let openaiClient: OpenAI | null = null;
async function getOpenAI(): Promise<OpenAI> {
    if (openaiClient) return openaiClient;
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'openai_api_key').single();
    const key = data?.value || import.meta.env.VITE_OPENAI_API_KEY || '';
    if (!key) {
        throw new Error('OpenAI API anahtarı bulunamadı. Lütfen AI Ayarları sayfasından API anahtarınızı girin.');
    }
    openaiClient = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
    return openaiClient;
}

export type QaSeverity = 'error' | 'warning' | 'info';
export type QaIssueType =
    | 'grammar' | 'meaning' | 'terminology' | 'tone' | 'untranslated' | 'placeholder';

export interface QaIssue {
    key: string;
    severity: QaSeverity;
    type: QaIssueType;
    description: string; // TÜRKÇE açıklama (admin TR okur)
    suggestion: string;  // önerilen düzeltilmiş çeviri (tek tıkla uygula)
}

export const TranslationQaService = {
    /**
     * Kaynak (TR) + hedef dil çevirisi çiftlerini denetler. Sorun yoksa [] döner.
     * Index tabanlı eşleme; key'ler translateBatch ile aynı.
     */
    async reviewBatch(
        items: { key: string; source: string; translated: string }[],
        targetLang: string,
        onProgress?: (done: number, total: number) => void,
    ): Promise<QaIssue[]> {
        if (items.length === 0) return [];

        const ai = await getOpenAI();
        const targetLangName = LANG_NAMES[targetLang.toLowerCase()] || targetLang;
        const glossary = await getGlossaryForLang(targetLang);
        const glossaryBlock = buildGlossaryPrompt(glossary, targetLangName);
        const instructionsBlock = buildInstructionsPrompt(await getTranslationInstructions(), targetLang);

        const issues: QaIssue[] = [];
        const CHUNK_SIZE = 8; // uzun prompt (kaynak + hedef çifti)

        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);

            const pairs = chunk
                .map((it, idx) => `${idx}:\n  SOURCE (Turkish): "${it.source}"\n  TRANSLATION (${targetLangName}): "${it.translated}"`)
                .join('\n');

            const prompt = `You are a professional native ${targetLangName} editor reviewing translations of CAFEPASTE marketing copy (a premium B2B brand selling Beverage Art Creator machines — devices that turn beverage surfaces into art; "Beverage Art Creator" is a brand term, never translated). The source language is Turkish.

For each numbered item, compare SOURCE and TRANSLATION and find real problems only. Check:
- grammar: wrong grammar, gender, agreement, awkward phrasing in ${targetLangName}
- meaning: mistranslation, omitted or added meaning, wrong sense
- terminology: violates the GLOSSARY below, or inconsistent technical term
- tone: not premium/professional brand tone
- untranslated: text left in Turkish that should be ${targetLangName}
- placeholder: broken or missing {{variables}} or HTML tags vs. the source
${instructionsBlock}
${glossaryBlock}

Items:
${pairs}

Return ONLY a JSON object of this exact shape:
{"issues": [{"index": 0, "severity": "error|warning|info", "type": "grammar|meaning|terminology|tone|untranslated|placeholder", "description": "<açıklama TÜRKÇE>", "suggestion": "<corrected full translation in ${targetLangName}>"}]}

Rules:
- description MUST be written in Turkish (the admin reads Turkish).
- suggestion MUST be the full corrected translation string in ${targetLangName}, ready to save (not a diff, not a note).
- Keep {{variables}} and HTML tags intact in suggestion.
- If an item is correct, DO NOT include it. If everything is fine, return {"issues": []}.
- Be strict but do not invent problems; no nitpicking of valid stylistic choices.`;

            try {
                const resp = await ai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                    temperature: 0.1,
                });
                const content = resp.choices[0]?.message?.content || '{}';
                const parsed = JSON.parse(content);
                const arr = Array.isArray(parsed.issues) ? parsed.issues : [];
                for (const it of arr) {
                    const idx = typeof it.index === 'number' ? it.index : Number(it.index);
                    const row = chunk[idx];
                    if (!row) continue;
                    const suggestion = String(it.suggestion ?? '').trim();
                    if (!suggestion) continue;
                    issues.push({
                        key: row.key,
                        severity: (['error', 'warning', 'info'].includes(it.severity) ? it.severity : 'warning') as QaSeverity,
                        type: (['grammar', 'meaning', 'terminology', 'tone', 'untranslated', 'placeholder'].includes(it.type) ? it.type : 'meaning') as QaIssueType,
                        description: String(it.description ?? '').trim() || 'Olası çeviri sorunu.',
                        suggestion,
                    });
                }
            } catch (e: any) {
                console.error('[TranslationQa] chunk error:', e?.message || e);
            }

            onProgress?.(Math.min(i + CHUNK_SIZE, items.length), items.length);
        }

        console.log(`[TranslationQa] ${items.length} item denetlendi → ${issues.length} sorun`);
        return issues;
    },
};
