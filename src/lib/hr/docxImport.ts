// Örnek sözleşme içe aktarma.
//
// GİZLİLİK: Dosya SUNUCUYA GİTMEZ. mammoth tarayıcıda çalışır; yalnızca
// çıkarılan metin, kullanıcı "AI ile üret" derse isteğe eklenir.
//
// Bağımlılık lazy import ile yüklenir — mammoth ~200 KB'dir ve yalnız örnek
// yükleyen kullanıcı bedelini ödemeli.

const MAX_BYTES = 5 * 1024 * 1024;

/** AI istek gövdesini şişirmemek için örnek metin kırpılır. */
export const SAMPLE_MAX_CHARS = 40_000;

export interface ImportedSample {
    html: string;
    text: string;
    /** mammoth'un dönüştüremediği öğeler (gömülü resim, karmaşık nesne vb.). */
    warnings: string[];
    truncated: boolean;
}

function stripHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

export async function importDocx(file: File): Promise<ImportedSample> {
    if (file.size > MAX_BYTES) {
        throw new Error('Dosya 5 MB sınırını aşıyor.');
    }
    if (!/\.docx$/i.test(file.name)) {
        // .doc (eski ikili biçim) mammoth tarafından okunamaz; kullanıcı
        // dosyayı Word'de "farklı kaydet" ile .docx'e çevirmeli.
        throw new Error('Yalnızca .docx desteklenir. Eski .doc dosyasını Word\'den .docx olarak kaydedin.');
    }

    const mammoth = await import('mammoth');
    const buffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });

    const html = result.value || '';
    const fullText = stripHtml(html);
    if (!fullText) {
        throw new Error('Dosyadan metin çıkarılamadı. Sözleşme taranmış görüntü olabilir.');
    }

    const truncated = fullText.length > SAMPLE_MAX_CHARS;
    return {
        html,
        text: truncated ? fullText.slice(0, SAMPLE_MAX_CHARS) : fullText,
        warnings: (result.messages || []).map(m => m.message).filter(Boolean),
        truncated,
    };
}

/** Yapıştırılan düz metni örnek olarak normalize eder. */
export function normalizeSampleText(raw: string): { text: string; truncated: boolean } {
    const text = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return {
        text: text.length > SAMPLE_MAX_CHARS ? text.slice(0, SAMPLE_MAX_CHARS) : text,
        truncated: text.length > SAMPLE_MAX_CHARS,
    };
}

/** Düz metni editöre basılabilir basit HTML'e çevirir. */
export function textToHtml(text: string): string {
    const esc = (s: string) => s
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return text
        .split(/\n{2,}/)
        .map(block => `<p>${esc(block).replace(/\n/g, '<br>')}</p>`)
        .join('\n');
}
