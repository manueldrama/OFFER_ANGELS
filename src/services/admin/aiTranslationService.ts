import OpenAI from 'openai';
import { supabase } from '../../lib/supabase/client';
import { getGlossaryForLang, buildGlossaryPrompt, getTranslationInstructions, buildInstructionsPrompt } from './translationGlossary';

let openaiClient: OpenAI | null = null;

// ISO 639-1 → human language name. The 2-letter code "it" was being interpreted
// by the model as the English pronoun, so translations came out in English.
// Always pass the full language name to the prompt.
const LANG_NAMES: Record<string, string> = {
    en: 'English',
    tr: 'Turkish',
    it: 'Italian',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    pt: 'Portuguese',
    nl: 'Dutch',
    ru: 'Russian',
    pl: 'Polish',
    ro: 'Romanian',
    el: 'Greek',
    sv: 'Swedish',
    da: 'Danish',
    no: 'Norwegian',
    fi: 'Finnish',
    cs: 'Czech',
    sk: 'Slovak',
    hu: 'Hungarian',
    bg: 'Bulgarian',
    hr: 'Croatian',
    sr: 'Serbian',
    sl: 'Slovenian',
    uk: 'Ukrainian',
    ar: 'Arabic',
    he: 'Hebrew',
    fa: 'Persian',
    hi: 'Hindi',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese (Simplified)',
    th: 'Thai',
    vi: 'Vietnamese',
    id: 'Indonesian',
    ms: 'Malay',
    az: 'Azerbaijani',
    kk: 'Kazakh',
    uz: 'Uzbek',
    ka: 'Georgian',
    hy: 'Armenian',
    sq: 'Albanian',
    bs: 'Bosnian',
    mk: 'Macedonian',
    et: 'Estonian',
    lv: 'Latvian',
    lt: 'Lithuanian',
    is: 'Icelandic',
    ga: 'Irish',
    mt: 'Maltese',
};

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

// Reset client when API key changes
export function resetOpenAIClient() {
    openaiClient = null;
}

export const AiTranslationService = {
    /**
     * Translates a list of strings from the source language (default Turkish)
     * to the target languages. Uses index-based matching for reliability.
     * Angels content passes sourceLang 'en' (its base copy is English).
     */
    async translateBatch(
        items: { key: string; value: string }[],
        targetLanguages: string[],
        sourceLang: string = 'tr'
    ): Promise<{ key: string; language: string; value: string }[]> {
        if (items.length === 0 || targetLanguages.length === 0) return [];

        const ai = await getOpenAI();
        const results: { key: string; language: string; value: string }[] = [];

        // Çeviri talimatları (genel + dile-özel) — yapıyı bir kez çek.
        const instructions = await getTranslationInstructions();

        for (const targetLang of targetLanguages) {
        const targetLangName = LANG_NAMES[targetLang.toLowerCase()] || targetLang;

        // Hedef dile filtreli terim sözlüğü + dile-özel talimatlar — bir kez hesapla.
        const glossary = await getGlossaryForLang(targetLang);
        const glossaryBlock = buildGlossaryPrompt(glossary, targetLangName);
        const instructionsBlock = buildInstructionsPrompt(instructions, targetLang);

        const CHUNK_SIZE = 15;
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);

            const prompt = `Translate these ${LANG_NAMES[sourceLang.toLowerCase()] || sourceLang} texts into ${targetLangName} (ISO code: ${targetLang}). Return a JSON object.

IMPORTANT: The output MUST be in ${targetLangName}. Do NOT translate to English unless ${targetLangName} is English.

${chunk.map((item, idx) => `${idx}: "${item.value}"`).join('\n')}

Return exactly this format:
{"results": {"0": "translation for 0 in ${targetLangName}", "1": "translation for 1 in ${targetLangName}", ...}}
${instructionsBlock}
${glossaryBlock}

Rules:
- Translate ALL items into ${targetLangName}, do not skip any
- Keep {{variables}} and HTML tags as-is
- Apply the GLOSSARY mappings above with priority over literal translation
- Professional, premium brand tone
- Return ONLY the JSON, nothing else`;

            try {
                const resp = await ai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.3,
                });

                const content = resp.choices[0]?.message?.content || '{}';
                console.log(`[AiTranslation] Chunk ${Math.floor(i / CHUNK_SIZE) + 1} raw response:`, content.substring(0, 200));

                const parsed = JSON.parse(content);

                // Handle {"results": {"0": "...", "1": "..."}} format
                const resultsObj = parsed.results || parsed.translations || parsed;

                const beforeCount = results.length;

                if (typeof resultsObj === 'object' && !Array.isArray(resultsObj)) {
                    for (let idx = 0; idx < chunk.length; idx++) {
                        let translated = resultsObj[String(idx)] ?? resultsObj[idx];
                        // AI sometimes returns {"0": {"text": "..."}} or similar nested objects
                        if (translated && typeof translated === 'object') {
                            translated = translated.value || translated.text || translated.translation || JSON.stringify(translated);
                        }
                        if (translated && typeof translated === 'string' && translated.trim()) {
                            results.push({
                                key: chunk[idx].key,
                                language: targetLang,
                                value: translated.trim(),
                            });
                        }
                    }
                } else if (Array.isArray(resultsObj)) {
                    for (const item of resultsObj) {
                        const idx = typeof item.index === 'number' ? item.index : undefined;
                        if (idx !== undefined && chunk[idx]) {
                            results.push({
                                key: chunk[idx].key,
                                language: item.lang || targetLang,
                                value: String(item.value || item.text || '').trim(),
                            });
                        }
                    }
                }

                console.log(`[AiTranslation] Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${chunk.length} sent, ${results.length - beforeCount} received`);
            } catch (e: any) {
                console.error('[AiTranslation] Chunk error:', e?.message || e);
            }
        }
        }

        console.log(`[AiTranslation] Total: ${items.length} items → ${results.length} translations`);
        return results;
    }
};
