// CV girdi çıkarma — Word, PDF, ekran görüntüsü ve taranmış PDF.
//
// TARAYICIDA ÇALIŞIR. Dosyanın kendisi sunucuya GİTMEZ; AI'ya yalnızca çıkarılan
// metin veya küçültülmüş görsel gönderilir.
//
// İKİ YOL:
//   metin  → .docx, metin katmanı olan .pdf, .txt
//   görsel → .png/.jpg/.webp ve METİN KATMANI OLMAYAN .pdf (taranmış belge)
//
// Taranmış PDF'in görsel yoluna düşmesi kasıtlıdır: aksi hâlde "metin
// çıkarılamadı" deyip boş aday üretirdik. Sayfa canvas'a çizilip modele
// gösterilir.
//
// Ağır bağımlılıklar (mammoth, pdfjs-dist) lazy import edilir — CV modalı
// açılmayan kullanıcı bedelini ödemez.

export type CvKind = 'text' | 'image' | 'empty';

export interface CvImage {
    mime: string;
    /** base64, "data:" ÖNEKİ YOK — AI katmanı onu kendi ekler. */
    dataB64: string;
}

export interface ExtractedCv {
    kind: CvKind;
    text: string;
    images: CvImage[];
    /** Kullanıcıya gösterilecek uyarı; null ise sorun yok. */
    warning: string | null;
}

export const CV_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const CV_MAX_FILES = 20;
export const CV_MAX_TEXT_CHARS = 25_000;
/** Aday başına görsel sınırı — maliyet ve istek boyutu için. */
export const CV_MAX_IMAGES = 4;
/** Taranmış PDF'te işlenecek sayfa sayısı. */
const PDF_MAX_RENDER_PAGES = 3;
/** Küçültme hedefi: bu boyutta CV metni okunur kalıyor, istek şişmiyor. */
const IMAGE_MAX_EDGE = 1600;
const IMAGE_JPEG_QUALITY = 0.8;

const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;
const DOCX_EXT = /\.docx$/i;
const PDF_EXT = /\.pdf$/i;
const TXT_EXT = /\.(txt|md)$/i;

export function isSupportedCvFile(file: File): boolean {
    return IMAGE_EXT.test(file.name) || DOCX_EXT.test(file.name)
        || PDF_EXT.test(file.name) || TXT_EXT.test(file.name)
        || file.type.startsWith('image/');
}

/**
 * Metin katmanı "gerçekten var mı" eşiği.
 *
 * Taranmış PDF'ler çoğu zaman bomboş dönmez — kenarda birkaç karakterlik çöp
 * OCR katmanı bulunur. 120 karakterin altı bir CV için anlamsızdır; o dosyayı
 * metin sanıp AI'ya göndermek boş sonuç üretirdi.
 */
const MIN_MEANINGFUL_CHARS = 120;

function normalize(raw: string): string {
    const t = raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    return t.length > CV_MAX_TEXT_CHARS ? t.slice(0, CV_MAX_TEXT_CHARS) : t;
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Görsel okunamadı.'));
        reader.onload = () => {
            const result = String(reader.result || '');
            // "data:image/jpeg;base64,XXXX" → sadece XXXX
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.readAsDataURL(blob);
    });
}

function canvasToImage(canvas: HTMLCanvasElement): Promise<CvImage> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => {
                if (!blob) { reject(new Error('Görsel dönüştürülemedi.')); return; }
                blobToBase64(blob).then(dataB64 => resolve({ mime: 'image/jpeg', dataB64 })).catch(reject);
            },
            'image/jpeg', IMAGE_JPEG_QUALITY,
        );
    });
}

/** Görseli uzun kenarı IMAGE_MAX_EDGE olacak şekilde küçültüp JPEG'e çevirir. */
async function downscaleImage(file: File | Blob): Promise<CvImage> {
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas kullanılamıyor.');
        // JPEG'in saydamlık desteği yok; beyaz zemin olmazsa saydam alanlar
        // siyaha döner ve koyu temalı ekran görüntüleri okunamaz hâle gelir.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(bitmap, 0, 0, w, h);

        return await canvasToImage(canvas);
    } finally {
        bitmap.close();
    }
}

async function extractDocx(file: File): Promise<ExtractedCv> {
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const doc = new DOMParser().parseFromString(result.value || '', 'text/html');
    const text = normalize(doc.body.textContent || '');
    if (text.length < MIN_MEANINGFUL_CHARS) {
        return {
            kind: 'empty', text: '', images: [],
            warning: 'Word dosyasından anlamlı metin çıkarılamadı. Alanları elle doldurun.',
        };
    }
    return { kind: 'text', text, images: [], warning: null };
}

/** pdfjs worker'ı Vite ile paketlenmiş sürümden bağlanır (CDN yasak — CSP). */
async function loadPdfjs() {
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
}

async function extractPdf(file: File): Promise<ExtractedCv> {
    const pdfjs = await loadPdfjs();
    // destroy() belge nesnesinde değil, YÜKLEME GÖREVİNDE. 20 CV işlerken
    // temizlemezsek worker'lar birikir.
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const doc = await task.promise;

    try {
        // 1) Önce metin katmanını dene — ucuz ve daha doğru.
        let collected = '';
        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p);
            const content = await page.getTextContent();
            collected += content.items.map((i: any) => (typeof i.str === 'string' ? i.str : '')).join(' ') + '\n';
            if (collected.length > CV_MAX_TEXT_CHARS) break;
        }
        const text = normalize(collected);
        if (text.length >= MIN_MEANINGFUL_CHARS) {
            return { kind: 'text', text, images: [], warning: null };
        }

        // 2) Metin yok → taranmış belge. Sayfaları görsele çevirip modele göster.
        const images: CvImage[] = [];
        const pageCount = Math.min(doc.numPages, PDF_MAX_RENDER_PAGES, CV_MAX_IMAGES);
        for (let p = 1; p <= pageCount; p++) {
            const page = await doc.getPage(p);
            const base = page.getViewport({ scale: 1 });
            const scale = Math.min(2, IMAGE_MAX_EDGE / Math.max(base.width, base.height));
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) break;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
            images.push(await canvasToImage(canvas));
        }

        if (!images.length) {
            return { kind: 'empty', text: '', images: [], warning: 'PDF okunamadı. Alanları elle doldurun.' };
        }
        return {
            kind: 'image', text: '', images,
            warning: doc.numPages > pageCount
                ? `Taranmış PDF — ilk ${pageCount} sayfa okundu (${doc.numPages} sayfadan).`
                : 'Taranmış PDF — görüntüden okundu, sonuçları kontrol edin.',
        };
    } finally {
        await task.destroy();
    }
}

/**
 * Tek dosyadan CV girdisi çıkarır. HATA FIRLATMAZ; okunamayan dosya için
 * `kind: 'empty'` ve uyarı döner — bir bozuk dosya toplu yüklemeyi durdurmamalı.
 */
export async function extractCv(file: File): Promise<ExtractedCv> {
    if (file.size > CV_MAX_FILE_BYTES) {
        return {
            kind: 'empty', text: '', images: [],
            warning: `Dosya ${Math.round(CV_MAX_FILE_BYTES / 1024 / 1024)} MB sınırını aşıyor.`,
        };
    }

    try {
        if (DOCX_EXT.test(file.name)) return await extractDocx(file);
        if (PDF_EXT.test(file.name)) return await extractPdf(file);
        if (TXT_EXT.test(file.name)) {
            const text = normalize(await file.text());
            return text.length >= MIN_MEANINGFUL_CHARS
                ? { kind: 'text', text, images: [], warning: null }
                : { kind: 'empty', text: '', images: [], warning: 'Dosya boş görünüyor.' };
        }
        if (IMAGE_EXT.test(file.name) || file.type.startsWith('image/')) {
            return { kind: 'image', text: '', images: [await downscaleImage(file)], warning: null };
        }
        if (/\.doc$/i.test(file.name)) {
            // Eski ikili Word biçimi mammoth ile okunamaz.
            return {
                kind: 'empty', text: '', images: [],
                warning: 'Eski .doc biçimi okunamıyor. Word\'de "farklı kaydet" ile .docx yapın.',
            };
        }
        return { kind: 'empty', text: '', images: [], warning: 'Desteklenmeyen dosya türü.' };
    } catch (e: any) {
        return { kind: 'empty', text: '', images: [], warning: e?.message || 'Dosya okunamadı.' };
    }
}

// ── Vesikalık fotoğraf çıkarma ───────────────────────────────────────────────
//
// CV'deki gömülü görselden adayın fotoğrafını bulur. Sistemde 'photo'
// (Vesikalık Fotoğraf) evrak türü zaten var; çıkarılan görsel oraya yazılır.
//
// AI'YA GÖNDERİLMEZ. Ayrımcılık kuralı gereği model fotoğraftan hiçbir çıkarım
// yapmaz; bu görsel yalnızca İK'nın adayı tanıması için saklanır.

/** Vesikalık en fazla bu boyutta saklanır — 512 px bir avatar için fazlasıyla yeter. */
const PHOTO_MAX_EDGE = 512;
/** Bundan küçük görseller ikon/çizgi; vesikalık değildir. */
const PHOTO_MIN_EDGE = 80;

/**
 * Görselin vesikalık olma ihtimali.
 *
 * CV'lerde logo da gömülü gelir (Kariyer.net, şirket amblemi…). Ayırt edici
 * özellik en-boy oranı: logo geniştir (yatay), vesikalık kare veya dikeydir.
 */
function looksLikePortrait(w: number, h: number): boolean {
    if (w < PHOTO_MIN_EDGE || h < PHOTO_MIN_EDGE) return false;
    const ratio = w / h;
    return ratio >= 0.5 && ratio <= 1.35;
}

/**
 * Gevşek eleme — sıkı turda hiçbir şey bulunamazsa.
 *
 * Bazı CV'lerde fotoğraf dairesel kırpılır ve çerçevesi daha geniş kalır.
 * Yine de bariz yatay bantları (banner, logo şeridi) dışarıda tutar.
 */
function couldBePhoto(w: number, h: number): boolean {
    if (w < 100 || h < 100) return false;
    const ratio = w / h;
    return ratio >= 0.4 && ratio <= 2;
}

/**
 * pdfjs görsel nesnesini JPEG'e çevirir.
 *
 * İKİ BİÇİM: modern tarayıcılarda pdfjs OffscreenCanvas kullanır ve görseli
 * `bitmap` (ImageBitmap) olarak verir; ham piksel (`data` + `kind`) yalnızca
 * bu desteklenmediğinde gelir. İlk sürüm yalnız `data` arıyordu ve bu yüzden
 * hiçbir fotoğraf bulunamıyordu.
 */
async function pdfImageToCvImage(img: any): Promise<CvImage | null> {
    const { width, height } = img;
    if (!width || !height) return null;

    const src = document.createElement('canvas');
    src.width = width;
    src.height = height;
    const sctx = src.getContext('2d');
    if (!sctx) return null;

    if (img.bitmap) {
        sctx.drawImage(img.bitmap, 0, 0);
    } else if (img.data) {
        // pdfjs kind: 1 = gri 1bpp, 2 = RGB 24bpp, 3 = RGBA 32bpp
        const data = img.data as Uint8Array;
        let rgba: Uint8ClampedArray;
        if (img.kind === 3) {
            rgba = new Uint8ClampedArray(data.buffer.slice(0) as ArrayBuffer);
        } else if (img.kind === 2) {
            rgba = new Uint8ClampedArray(width * height * 4);
            for (let i = 0, j = 0; i < width * height; i++, j += 3) {
                rgba[i * 4] = data[j];
                rgba[i * 4 + 1] = data[j + 1];
                rgba[i * 4 + 2] = data[j + 2];
                rgba[i * 4 + 3] = 255;
            }
        } else {
            return null;   // 1bpp gri — vesikalık değil, tarama artefaktı
        }
        sctx.putImageData(new ImageData(rgba, width, height), 0, 0);
    } else {
        return null;
    }

    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
    if (scale === 1) return canvasToImage(src);

    const out = document.createElement('canvas');
    out.width = Math.round(width * scale);
    out.height = Math.round(height * scale);
    const octx = out.getContext('2d');
    if (!octx) return null;
    octx.fillStyle = '#FFFFFF';
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(src, 0, 0, out.width, out.height);
    return canvasToImage(out);
}

/**
 * pdfjs nesne deposundan görseli çeker.
 *
 * Zaman aşımı ŞART: nesne hiç çözülmezse objs.get geri çağrısı asla tetiklenmez
 * ve toplu içe aktarma o satırda sonsuza kadar asılı kalır.
 */
function getPdfObject(objs: any, name: string, timeoutMs = 2000): Promise<any | null> {
    if (!objs) return Promise.resolve(null);
    return new Promise(resolve => {
        let done = false;
        const finish = (v: any) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(v ?? null);
        };
        const timer = setTimeout(() => finish(null), timeoutMs);
        try {
            // Nesne hazırsa senkron okumak geri çağrı beklemekten hızlı.
            if (typeof objs.has === 'function' && objs.has(name)) {
                finish(objs.get(name));
                return;
            }
            objs.get(name, finish);
        } catch {
            finish(null);
        }
    });
}

/**
 * CV'nin ilk sayfasındaki en olası vesikalık fotoğrafı çıkarır.
 *
 * HATA FIRLATMAZ — fotoğraf bulunamaması normaldir (her CV'de yok) ve toplu
 * içe aktarmayı durdurmamalıdır.
 */
export async function extractCvPhoto(file: File): Promise<CvImage | null> {
    try {
        if (DOCX_EXT.test(file.name)) {
            // mammoth gömülü görselleri base64 data URI olarak inline bırakır.
            const mammoth = await import('mammoth');
            const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
            const doc = new DOMParser().parseFromString(result.value || '', 'text/html');
            for (const img of Array.from(doc.querySelectorAll('img'))) {
                const src = img.getAttribute('src') || '';
                const m = src.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
                if (m) return { mime: m[1], dataB64: m[2] };
            }
            return null;
        }

        if (!PDF_EXT.test(file.name)) return null;

        const pdfjs = await loadPdfjs();
        const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
        const doc = await task.promise;
        try {
            const page = await doc.getPage(1);

            // SAYFA ÖNCE RENDER EDİLİR. getOperatorList tek başına görsel
            // nesnelerini page.objs'a YÜKLEMEZ; render sırasında çözülürler.
            // Bu adım atlanınca objs.get sonsuza kadar bekliyor ve fotoğraf
            // hiç bulunamıyordu.
            const viewport = page.getViewport({ scale: 0.6 });
            const warm = document.createElement('canvas');
            warm.width = Math.max(1, Math.round(viewport.width));
            warm.height = Math.max(1, Math.round(viewport.height));
            const wctx = warm.getContext('2d');
            if (wctx) {
                await page.render({ canvas: warm, canvasContext: wctx, viewport } as any).promise
                    .catch(() => { /* render patlasa bile operatör listesini deneriz */ });
            }

            const ops = await page.getOperatorList();

            // Önce tüm görseller toplanır, eleme sonra yapılır: sıkı tur boş
            // çıkarsa aynı listeyi gevşek ölçütle bir kez daha tarayabilelim.
            const found: any[] = [];
            for (let i = 0; i < ops.fnArray.length; i++) {
                const fn = ops.fnArray[i];
                let img: any = null;

                if (fn === pdfjs.OPS.paintImageXObject) {
                    const name = ops.argsArray[i]?.[0];
                    if (typeof name !== 'string') continue;
                    // Görsel sayfaya özel objs'ta ya da belge genelindeki
                    // commonObjs'ta olabilir; ikisi de denenir.
                    img = await getPdfObject(page.objs, name)
                        ?? await getPdfObject((page as any).commonObjs, name);
                } else if (fn === pdfjs.OPS.paintInlineImageXObject) {
                    // Satır içi görselde nesne doğrudan argümanda gelir.
                    img = ops.argsArray[i]?.[0];
                }

                if (!img?.width || !img?.height) continue;
                if (!img.bitmap && !img.data) continue;
                found.push(img);
            }

            const pick = (test: (w: number, h: number) => boolean) =>
                found.filter(i => test(i.width, i.height))
                    .sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;

            const best = pick(looksLikePortrait) ?? pick(couldBePhoto);
            if (!best) return null;
            return await pdfImageToCvImage(best);
        } finally {
            await task.destroy();
        }
    } catch {
        // Fotoğraf çıkarma en iyi çabadır; başarısızlığı akışı durdurmaz.
        return null;
    }
}

/**
 * Birden çok çıkarımı tek adayda birleştirir — uzun bir CV birkaç ekran
 * görüntüsü olarak gelmiş olabilir. Metin varsa metin kazanır (daha doğru);
 * görseller CV_MAX_IMAGES'a kadar toplanır.
 */
export function mergeExtractions(parts: ExtractedCv[]): ExtractedCv {
    const texts = parts.filter(p => p.kind === 'text').map(p => p.text);
    const images = parts.flatMap(p => p.images).slice(0, CV_MAX_IMAGES);
    const warnings = parts.map(p => p.warning).filter(Boolean) as string[];

    if (texts.length) {
        return {
            kind: 'text',
            text: normalize(texts.join('\n\n')),
            // Metin varken görsel de göndermek gereksiz maliyet.
            images: [],
            warning: warnings[0] ?? null,
        };
    }
    if (images.length) {
        return { kind: 'image', text: '', images, warning: warnings[0] ?? null };
    }
    return { kind: 'empty', text: '', images: [], warning: warnings[0] ?? 'İçerik okunamadı.' };
}
