// AI-powered social media content generation
// OpenAI GPT: hashtags & captions  |  Google GenAI (NanoBanana 2): images

import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../../lib/supabase/client';

let openaiClient: OpenAI | null = null;
let genaiClient: GoogleGenAI | null = null;

async function getOpenAI(): Promise<OpenAI> {
    if (openaiClient) return openaiClient;
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'openai_api_key').single();
    const key = data?.value || import.meta.env.VITE_OPENAI_API_KEY || '';
    openaiClient = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
    return openaiClient;
}

async function getGenAI(): Promise<GoogleGenAI> {
    if (genaiClient) return genaiClient;
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'google_genai_api_key').single();
    const key = data?.value || import.meta.env.VITE_GOOGLE_GENAI_API_KEY || '';
    genaiClient = new GoogleGenAI({ apiKey: key });
    return genaiClient;
}

// ── Language configs ──
export const AI_LANGUAGES = [
    { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
] as const;

export type AiLanguageCode = typeof AI_LANGUAGES[number]['code'];

const LANG_NAMES: Record<string, string> = {
    tr: 'Türkçe', en: 'English', de: 'Deutsch', ar: 'Arabic', fr: 'French', es: 'Spanish', ru: 'Russian', nl: 'Dutch',
};

function getSystemPrompt(lang: string): string {
    const langName = LANG_NAMES[lang] || 'Turkish';
    if (lang === 'tr') {
        return `Sen CAFEPASTE için Türkçe sosyal medya uzmanısın. CAFEPASTE, San Francisco (ABD) merkezli, uluslararası faaliyet gösteren premium bir İçecek Art Makinesi (Beverage Art Creator) markasıdır — içecek yüzeyini sanata dönüştürür; kahve makinesi DEĞİLDİR. ÖNEMLİ: Markayı yerli/Türk üretimi gibi GÖSTERME (yanlıştır); Türkiye'de satış, kurulum ve tam servis desteği yerinde sunulur. Ürünü "yazıcı/baskı makinesi" olarak da tanımlama — kategori adı İçecek Art Makinesi. B2B ve B2C segmentlerine hitap eder. Kahve kültürü, premium deneyim ve müşteri memnuniyeti odaklı içerikler üretiyorsun. Tüm çıktıları Türkçe yaz.`;
    }
    return `You are a ${langName}-speaking social media expert for CAFEPASTE, a San Francisco (USA) based premium Beverage Art Creator brand operating internationally — it turns beverage surfaces into art; it is NOT a coffee machine, and never present it as a Turkish-made product (sales, installation and full service are delivered locally in each market). Never describe the product as a "printer"; the category name is Beverage Art Creator. You serve B2B and B2C segments. You create content focused on coffee culture, premium experience, and customer satisfaction. Write ALL outputs in ${langName}.`;
}

export const SocialMediaAiService = {
    async generateHashtags(context: { caption: string; platform: string; language?: string }): Promise<string[]> {
        const ai = await getOpenAI();
        const lang = context.language || 'tr';
        const langName = LANG_NAMES[lang] || 'Turkish';
        const resp = await ai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: getSystemPrompt(lang) },
                {
                    role: 'user',
                    content: lang === 'tr'
                        ? `Aşağıdaki sosyal medya paylaşımı için ${context.platform} platformuna uygun 12-15 adet Türkçe hashtag üret. Sadece hashtag listesi döndür, başka açıklama yazma. Her hashtag # ile başlasın, virgülle ayır.\n\nPaylaşım: ${context.caption}`
                        : `Generate 12-15 ${langName} hashtags for the following ${context.platform} social media post. Return only the hashtag list, no other text. Each hashtag starts with #, separate with commas.\n\nPost: ${context.caption}`
                }
            ],
            temperature: 0.7,
            max_tokens: 300,
        });

        const text = resp.choices[0]?.message?.content || '';
        return text.split(/[,\n]+/).map(t => t.trim()).filter(t => t.startsWith('#'));
    },

    async generateCaption(context: { topic: string; platform: string; tone?: string; language?: string }): Promise<string> {
        const ai = await getOpenAI();
        const lang = context.language || 'tr';
        const langName = LANG_NAMES[lang] || 'Turkish';
        const charLimits: Record<string, number> = { twitter: 260, instagram: 2000, linkedin: 2800, facebook: 2000, tiktok: 1500 };
        const limit = charLimits[context.platform] || 2000;
        const tone = context.tone || (lang === 'tr' ? 'profesyonel ve samimi' : 'professional and friendly');

        const resp = await ai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: getSystemPrompt(lang) },
                {
                    role: 'user',
                    content: lang === 'tr'
                        ? `${context.platform} için ${tone} tonda bir paylaşım metni yaz. Konu: "${context.topic}". Maksimum ${limit} karakter. Sadece paylaşım metnini döndür, hashtag ekleme.`
                        : `Write a ${tone} toned post for ${context.platform} in ${langName}. Topic: "${context.topic}". Maximum ${limit} characters. Return only the post text, no hashtags.`
                }
            ],
            temperature: 0.8,
            max_tokens: 500,
        });

        return resp.choices[0]?.message?.content?.trim() || '';
    },

    async improveCaption(caption: string, instruction: string, language?: string): Promise<string> {
        const ai = await getOpenAI();
        const lang = language || 'tr';
        const resp = await ai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: getSystemPrompt(lang) },
                {
                    role: 'user',
                    content: lang === 'tr'
                        ? `Aşağıdaki sosyal medya metnini bu talimata göre iyileştir: "${instruction}"\n\nMevcut metin:\n${caption}\n\nSadece iyileştirilmiş metni döndür.`
                        : `Improve the following social media text according to this instruction: "${instruction}"\n\nCurrent text:\n${caption}\n\nReturn only the improved text.`
                }
            ],
            temperature: 0.7,
            max_tokens: 500,
        });

        return resp.choices[0]?.message?.content?.trim() || caption;
    },

    async generateImage(prompt: string, style?: string): Promise<{ imageUrl: string; revisedPrompt: string }> {
        const ai = await getGenAI();
        const stylePrefix = style ? `${style} style, ` : 'Professional, clean, modern, ';
        const fullPrompt = `${stylePrefix}social media post visual for a premium Turkish coffee machine brand called CAFEPASTE: ${prompt}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{ role: 'user', parts: [{ text: `Generate an image: ${fullPrompt}` }] }],
            config: {
                responseModalities: ['TEXT', 'IMAGE'] as any,
            },
        });

        // Extract image from response parts
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if ((part as any).inlineData) {
                const { data, mimeType } = (part as any).inlineData;
                // Upload base64 image to Supabase Storage
                const fileName = `social-ai/${Date.now()}.png`;
                const buffer = Uint8Array.from(atob(data), c => c.charCodeAt(0));
                const { error } = await supabase.storage
                    .from('media')
                    .upload(fileName, buffer, { contentType: mimeType || 'image/png' });

                if (error) throw new Error(`Storage upload failed: ${error.message}`);

                const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
                return { imageUrl: urlData.publicUrl, revisedPrompt: fullPrompt };
            }
        }

        throw new Error('Görsel oluşturulamadı. Lütfen farklı bir prompt deneyin.');
    },

    async generateCaptionFromImage(imageUrl: string, platform: string, language?: string): Promise<string> {
        const ai = await getOpenAI();
        const lang = language || 'tr';
        const langName = LANG_NAMES[lang] || 'Turkish';
        const charLimits: Record<string, number> = { twitter: 260, instagram: 2000, linkedin: 2800, facebook: 2000, tiktok: 1500 };
        const limit = charLimits[platform] || 2000;

        const resp = await ai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: getSystemPrompt(lang) },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: { url: imageUrl },
                        },
                        {
                            type: 'text',
                            text: lang === 'tr'
                                ? `Bu görseli analiz et ve ${platform} platformu için profesyonel, dikkat çekici bir Türkçe paylaşım metni yaz. Görseldeki ürünü, ortamı veya konsepti açıkla. Maksimum ${limit} karakter. Sadece paylaşım metnini döndür, hashtag ekleme.`
                                : `Analyze this image and write a professional, attention-grabbing ${langName} social media caption for ${platform}. Describe the product, setting or concept in the image. Maximum ${limit} characters. Return only the post text, no hashtags.`,
                        },
                    ],
                } as any,
            ],
            temperature: 0.8,
            max_tokens: 500,
        });

        return resp.choices[0]?.message?.content?.trim() || '';
    },

    async generateFirstComment(context: { caption: string; platform: string; topic?: string; language?: string }): Promise<string> {
        const ai = await getOpenAI();
        const lang = context.language || 'tr';
        const langName = LANG_NAMES[lang] || 'Turkish';
        const resp = await ai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: getSystemPrompt(lang) },
                {
                    role: 'user',
                    content: lang === 'tr'
                        ? `Aşağıdaki ${context.platform} paylaşımı için etkileşim artırıcı bir ilk yorum yaz. Yorum samimi, soru soran veya aksiyon çağrısı içeren olsun. CTA (call-to-action) veya emoji kullanabilirsin. Maksimum 300 karakter. Sadece yorum metnini döndür.\n\nPaylaşım metni: ${context.caption}${context.topic ? `\nKonu: ${context.topic}` : ''}`
                        : `Write an engagement-boosting first comment in ${langName} for this ${context.platform} post. The comment should be friendly, ask a question or include a call-to-action. You can use CTA or emojis. Maximum 300 characters. Return only the comment text.\n\nPost text: ${context.caption}${context.topic ? `\nTopic: ${context.topic}` : ''}`
                }
            ],
            temperature: 0.8,
            max_tokens: 200,
        });

        return resp.choices[0]?.message?.content?.trim() || '';
    },

    async generatePostSuggestion(topic: string, platforms: string[], language?: string): Promise<{ caption: string; hashtags: string[] }> {
        const platform = platforms[0] || 'instagram';
        const caption = await this.generateCaption({ topic, platform, language });
        const hashtags = await this.generateHashtags({ caption, platform, language });
        return { caption, hashtags };
    },

    // Reset cached clients (e.g., when API key changes)
    resetClients() {
        openaiClient = null;
        genaiClient = null;
    },
};
