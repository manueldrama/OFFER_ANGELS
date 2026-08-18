import { supabase } from '../../lib/supabase/client';

// Terim sözlüğü — marka/teknik terimlerin diller arası TUTARLI çevirisini
// garanti eder. `aiTranslationService.translateBatch` çeviri prompt'una bu
// terimleri enjekte eder; admin /admin/languages "Terim Sözlüğü" sekmesinden
// düzenlenir. Kaynak tablo: translation_glossary (migration 20260605).

export interface GlossaryTerm {
    id: string;
    term_tr: string;
    translations: Record<string, string>; // { en: "Beverage Art Creator", ... }
    do_not_translate: boolean;
    notes: string | null;
    is_active: boolean;
    updated_at: string;
}

// Çeviri sırasında her chunk için DB'ye gitmemek adına modül içi cache.
let cache: GlossaryTerm[] | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 60_000; // 1 dk — admin düzenlemesi sonrası invalidateGlossaryCache çağrılır.

// Serbest metin çeviri talimatları (app_settings.key = 'translation_instructions').
// İki katman: general (tüm diller) + perLang (sadece o dile özel). Çeviride o dil
// için ikisi birleştirilir. Terim sözlüğünden ayrı, genel kural alanı.
const INSTRUCTIONS_KEY = 'translation_instructions';

export interface TranslationInstructions {
    general: string;
    perLang: Record<string, string>; // { es: "Avrupa İspanyolcası...", de: "Sie kullan", ... }
}

let instrCache: TranslationInstructions | null = null;
let instrCacheAt = 0;

const EMPTY_INSTR: TranslationInstructions = { general: '', perLang: {} };

export function invalidateGlossaryCache() {
    cache = null;
    cacheAt = 0;
    instrCache = null;
    instrCacheAt = 0;
}

/** Genel + dile-özel çeviri talimatlarını döndürür (cache'li). Yoksa boş yapı. */
export async function getTranslationInstructions(): Promise<TranslationInstructions> {
    const now = Date.now();
    if (instrCache && now - instrCacheAt < CACHE_TTL_MS) return instrCache;
    try {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', INSTRUCTIONS_KEY)
            .single();
        const raw = data?.value;
        let parsed: TranslationInstructions = { ...EMPTY_INSTR };
        if (raw) {
            try {
                const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
                parsed = {
                    general: (obj?.general || '').toString(),
                    perLang: (obj && typeof obj.perLang === 'object' && obj.perLang) || {},
                };
            } catch {
                // Eski düz-metin değer varsa onu general olarak al.
                parsed = { general: raw.toString(), perLang: {} };
            }
        }
        instrCache = parsed;
        instrCacheAt = now;
        return parsed;
    } catch {
        return { ...EMPTY_INSTR };
    }
}

export async function setTranslationInstructions(data: TranslationInstructions): Promise<void> {
    const value = JSON.stringify({ general: data.general || '', perLang: data.perLang || {} });
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: INSTRUCTIONS_KEY, value }, { onConflict: 'key' });
    if (error) throw error;
    instrCache = { general: data.general || '', perLang: data.perLang || {} };
    instrCacheAt = Date.now();
}

/** Genel + dile-özel talimatları tek prompt bloğunda birleştirir. Boşsa ''. */
export function buildInstructionsPrompt(data: TranslationInstructions, lang: string): string {
    const general = (data?.general || '').trim();
    const perLang = (data?.perLang?.[lang.toLowerCase()] || '').trim();
    if (!general && !perLang) return '';
    const lines = ['', 'TRANSLATION INSTRUCTIONS (apply to every translation):'];
    if (general) lines.push(general);
    if (perLang) lines.push(`For this language specifically: ${perLang}`);
    return lines.join('\n');
}

/** Tüm aktif terimleri döndürür (cache'li). Tablo yoksa/erişilemezse [] döner —
 *  çeviri akışı asla bu yüzden kırılmaz. */
export async function getGlossary(): Promise<GlossaryTerm[]> {
    const now = Date.now();
    if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
    try {
        const { data, error } = await supabase
            .from('translation_glossary')
            .select('*')
            .eq('is_active', true)
            .order('term_tr');
        if (error) throw error;
        cache = (data || []) as GlossaryTerm[];
        cacheAt = now;
        return cache;
    } catch (e: any) {
        console.warn('[glossary] yüklenemedi, boş sözlükle devam:', e?.message || e);
        return [];
    }
}

export interface GlossaryForLang {
    /** Bu dilde belirli karşılığı olan terimler. */
    translate: { tr: string; target: string }[];
    /** Hiç çevrilmeyecek terimler (do_not_translate). */
    keep: string[];
}

/** Hedef dile filtreli, prompt'a hazır sözlük. */
export async function getGlossaryForLang(lang: string): Promise<GlossaryForLang> {
    const code = lang.toLowerCase();
    const terms = await getGlossary();
    const translate: { tr: string; target: string }[] = [];
    const keep: string[] = [];
    for (const t of terms) {
        if (t.do_not_translate) {
            keep.push(t.term_tr);
            continue;
        }
        const target = t.translations?.[code];
        if (target && target.trim()) {
            translate.push({ tr: t.term_tr, target: target.trim() });
        }
    }
    return { translate, keep };
}

/** Sözlüğü, çeviri prompt'una eklenecek metin bloğuna çevirir. Boşsa '' döner. */
export function buildGlossaryPrompt(g: GlossaryForLang, targetLangName: string): string {
    if (g.translate.length === 0 && g.keep.length === 0) return '';
    const lines: string[] = [
        '',
        'GLOSSARY — these rules OVERRIDE normal translation:',
    ];
    if (g.translate.length) {
        lines.push(`[TRANSLATE EXACTLY] In ${targetLangName}, always render these terms as:`);
        for (const { tr, target } of g.translate) {
            lines.push(`- "${tr}" => "${target}"`);
        }
    }
    if (g.keep.length) {
        lines.push('[NEVER TRANSLATE — keep verbatim]: ' + g.keep.join(', '));
    }
    lines.push(
        `If a glossary term appears, you MUST use the exact mapping above even if a more literal translation exists. Adapt inflection/case to ${targetLangName} grammar; keep the core term wording from the mapping.`
    );
    return lines.join('\n');
}

// ---- Admin CRUD ----------------------------------------------------------

export async function listTerms(): Promise<GlossaryTerm[]> {
    const { data, error } = await supabase
        .from('translation_glossary')
        .select('*')
        .order('term_tr');
    if (error) throw error;
    return (data || []) as GlossaryTerm[];
}

export async function upsertTerm(term: {
    id?: string;
    term_tr: string;
    translations: Record<string, string>;
    do_not_translate: boolean;
    notes?: string | null;
    is_active?: boolean;
}): Promise<GlossaryTerm> {
    const row = {
        ...(term.id ? { id: term.id } : {}),
        term_tr: term.term_tr.trim(),
        translations: term.translations || {},
        do_not_translate: term.do_not_translate,
        notes: term.notes ?? null,
        is_active: term.is_active ?? true,
        updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
        .from('translation_glossary')
        .upsert(row, { onConflict: 'term_tr' })
        .select()
        .single();
    if (error) throw error;
    invalidateGlossaryCache();
    return data as GlossaryTerm;
}

export async function deleteTerm(id: string): Promise<void> {
    const { error } = await supabase.from('translation_glossary').delete().eq('id', id);
    if (error) throw error;
    invalidateGlossaryCache();
}
