/**
 * Browser-native image compression for admin uploads.
 *
 * Neden var: CMS upload pipeline'ı (landingPageCmsService.uploadImage) eskiden
 * dosyayı olduğu gibi Supabase Storage'a atıyordu. Bir hero görseli 5006 KB
 * ham PNG olarak kaldı, canlıda LCP'yi tahrip etti. Yeni upload'lar artık
 * burada WebP'ye transcode edilip Supabase'e öyle gidiyor — her CMS upload
 * doğrudan optimize, regression riski sıfır.
 *
 * Yaklaşım: createImageBitmap + OffscreenCanvas (yoksa HTMLCanvasElement)
 * + convertToBlob('image/webp'). Hiçbir paket eklenmedi; modern tarayıcıların
 * native API'leri kullanılıyor. Admin panel zaten modern Chrome/Edge/Safari
 * gerektiriyor, IE yok.
 */

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
  format: 'webp' | 'original';
}

const MAX_WIDTH = 1920;
const QUALITY_DEFAULT = 0.8;
const QUALITY_RETRY = 0.7;
const TARGET_BYTES = 250 * 1024; // 250 KB hedef; daha büyükse quality 0.7'ye düş

/** WebP'yi canvas'tan üret. OffscreenCanvas yoksa HTMLCanvasElement'e düş. */
async function canvasToWebp(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/webp', quality });
  }
  // Fallback: DOM canvas (eski Safari < 16.4)
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('toBlob returned null')),
      'image/webp',
      quality,
    );
  });
}

/**
 * Bir File'ı (image/*) WebP'ye sıkıştırır.
 *
 * - SVG ise olduğu gibi geri döner (vektör, sıkıştırma yapma).
 * - GIF ise olduğu gibi geri döner (animasyon kaybı önlemek için).
 * - createImageBitmap fail ederse (corrupt/unsupported) original ile devam.
 * - Resulting WebP > TARGET_BYTES ise quality 0.7'ye düşürüp tekrar dener.
 */
export async function compressImageToWebp(file: File): Promise<CompressResult> {
  const originalBytes = file.size;
  const type = file.type.toLowerCase();

  // Vektör + animasyon: dokunma
  if (type === 'image/svg+xml' || type === 'image/gif') {
    return {
      blob: file,
      width: 0,
      height: 0,
      originalBytes,
      compressedBytes: originalBytes,
      format: 'original',
    };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    // createImageBitmap bazı garip JPG'lerde patlıyor — orijinali bırak
    console.warn('[imageCompress] createImageBitmap failed, keeping original:', err);
    return {
      blob: file,
      width: 0,
      height: 0,
      originalBytes,
      compressedBytes: originalBytes,
      format: 'original',
    };
  }

  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const scale = srcW > MAX_WIDTH ? MAX_WIDTH / srcW : 1;
  const targetW = Math.round(srcW * scale);
  const targetH = Math.round(srcH * scale);

  let blob = await canvasToWebp(bitmap, targetW, targetH, QUALITY_DEFAULT);
  if (blob.size > TARGET_BYTES) {
    // İkinci pass: daha agresif quality
    blob = await canvasToWebp(bitmap, targetW, targetH, QUALITY_RETRY);
  }
  bitmap.close?.();

  // Çok nadir: WebP orijinalden büyük çıktı (zaten optimize bir küçük WebP'yi
  // tekrar transcode etmek gibi). O zaman orijinali döndür.
  if (blob.size >= originalBytes && /image\/webp/i.test(type)) {
    return {
      blob: file,
      width: srcW,
      height: srcH,
      originalBytes,
      compressedBytes: originalBytes,
      format: 'original',
    };
  }

  return {
    blob,
    width: targetW,
    height: targetH,
    originalBytes,
    compressedBytes: blob.size,
    format: 'webp',
  };
}

/** İnsan-okur byte formatı. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
