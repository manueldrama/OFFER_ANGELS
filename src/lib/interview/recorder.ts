// Tarayıcıdan video kaydı — MediaRecorder soyutlaması.
//
// Tarayıcı farklılıkları BURADA toplanır; bileşenler bunları bilmez.
//
// TEK ÇEKİM BAĞLAMI: aday her soruyu bir kez cevaplar. Bu yüzden buradaki her
// hata telafi edilemez bir kayıptır ve sessizce yutulamaz — hepsi çağırana
// açık bir sebep koduyla döner.

export type RecorderErrorCode =
    | 'unsupported'        // MediaRecorder / getUserMedia yok
    | 'permission_denied'  // kullanıcı reddetti
    | 'no_device'          // kamera veya mikrofon bulunamadı
    | 'device_busy'        // başka uygulama kullanıyor
    | 'empty'              // kayıt boş çıktı
    | 'too_large'          // boyut sınırı aşıldı
    | 'unknown';

export class RecorderError extends Error {
    code: RecorderErrorCode;
    constructor(code: RecorderErrorCode, message?: string) {
        super(message || code);
        this.code = code;
        this.name = 'RecorderError';
    }
}

/**
 * Tercih sırası. Chrome/Edge/Android VP9'u, Firefox VP8'i, Safari/iOS mp4'ü
 * destekler. İlk desteklenen kazanır.
 */
const CANDIDATE_MIMES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
];

/** 640×480 @ ~664 kbps ≈ 83 KB/sn → 90 sn ≈ 7,5 MB. 720p'de ~19 MB olurdu. */
export const VIDEO_BITS_PER_SECOND = 600_000;
export const AUDIO_BITS_PER_SECOND = 64_000;
export const MAX_INTERVIEW_BYTES = 25 * 1024 * 1024;
/** Yanlışlıkla sıfır uzunlukta kayıt gönderilmesin. */
export const MIN_RECORD_SECONDS = 3;

export function pickMimeType(): string | null {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return null;
    }
    for (const mime of CANDIDATE_MIMES) {
        try {
            if (MediaRecorder.isTypeSupported(mime)) return mime;
        } catch {
            /* isTypeSupported bazı tarayıcılarda atabiliyor */
        }
    }
    return null;
}

/** MediaRecorder yolu kullanılabilir mi? Değilse cihazın kendi kamerasına düşeriz. */
export function isRecordingSupported(): boolean {
    return !!navigator.mediaDevices?.getUserMedia
        && typeof MediaRecorder !== 'undefined'
        && pickMimeType() !== null;
}

/** getUserMedia hatalarını konuşulabilir sebep koduna çevirir. */
function toRecorderError(err: unknown): RecorderError {
    const name = (err as { name?: string })?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return new RecorderError('permission_denied');
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        return new RecorderError('no_device');
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
        return new RecorderError('device_busy');
    }
    return new RecorderError('unknown', (err as Error)?.message);
}

/**
 * Kamera+mikrofon akışını açar.
 *
 * iOS: bu çağrı KULLANICI DOKUNUŞU içinde olmalı ve sayfa HTTPS olmalıdır.
 * Akış sorular boyunca canlı tutulur; her soruda yeniden izin istemek iOS'ta
 * güvenilmez ve tek çekimde izin istemi kaydı yakabilir.
 */
export async function openStream(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) throw new RecorderError('unsupported');
    try {
        return await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 24, max: 30 },
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
            },
        });
    } catch (err) {
        throw toRecorderError(err);
    }
}

export function closeStream(stream: MediaStream | null): void {
    stream?.getTracks().forEach(t => { try { t.stop(); } catch { /* yok say */ } });
}

export interface RecordingResult {
    blob: Blob;
    mimeType: string;
    /** performance.now() farkıyla ölçülür — konteyner süresine GÜVENİLMEZ. */
    durationSeconds: number;
}

export interface ActiveRecording {
    /** Kaydı bitirir ve sonucu verir. İki kez çağrılırsa aynı sözü döndürür. */
    stop: () => Promise<RecordingResult>;
    /** Kaydın başladığı an — geri sayım bunun üzerinden hesaplanır. */
    startedAt: number;
}

/**
 * Kaydı başlatır.
 *
 * NEDEN performance.now(): kaydedilen webm/mp4 çoğu zaman süre bilgisi
 * taşımaz (videoEl.duration === Infinity). Konteynıra güvenmek yerine
 * geçen süre ölçülür.
 *
 * NEDEN start(1000): iOS'ta ondataavailable sadece stop()'ta tetiklenebilir;
 * parça temposuna hiçbir mantık bağlanmaz, bu yalnızca bellek baskısını azaltır.
 */
export function startRecording(stream: MediaStream): ActiveRecording {
    const mimeType = pickMimeType();
    if (!mimeType) throw new RecorderError('unsupported');

    let recorder: MediaRecorder;
    try {
        recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
            audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        });
    } catch {
        // Bit hızı ipuçlarını reddeden tarayıcılar için sade deneme.
        recorder = new MediaRecorder(stream, { mimeType });
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const startedAt = performance.now();
    recorder.start(1000);

    let settled: Promise<RecordingResult> | null = null;

    const stop = (): Promise<RecordingResult> => {
        if (settled) return settled;
        settled = new Promise<RecordingResult>((resolve, reject) => {
            const finish = () => {
                const durationSeconds = Math.max(0, Math.round((performance.now() - startedAt) / 1000));
                const blob = new Blob(chunks, { type: mimeType });
                if (!blob.size) { reject(new RecorderError('empty')); return; }
                if (blob.size > MAX_INTERVIEW_BYTES) { reject(new RecorderError('too_large')); return; }
                resolve({ blob, mimeType, durationSeconds });
            };
            recorder.onstop = finish;
            recorder.onerror = () => reject(new RecorderError('unknown'));
            try {
                if (recorder.state !== 'inactive') recorder.stop();
                else finish();
            } catch (err) {
                reject(toRecorderError(err));
            }
        });
        return settled;
    };

    return { stop, startedAt };
}

/**
 * Mikrofon seviye ölçer — cihaz kontrolü ekranı için.
 *
 * Tek çekimde "mikrofonum kapalıymış" telafi edilemez; aday kaydı başlatmadan
 * önce sesinin geldiğini GÖRMELİ.
 */
export function createLevelMeter(stream: MediaStream): { level: () => number; close: () => void } {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return { level: () => 0, close: () => {} };

    const ctx = new Ctor();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    return {
        level: () => {
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            for (let i = 0; i < data.length; i++) {
                peak = Math.max(peak, Math.abs(data[i] - 128));
            }
            return Math.min(1, peak / 96);   // 0..1
        },
        /**
         * İki kez çağrılabilir (_DeviceCheck hem yeniden istekte hem unmount'ta
         * kapatıyor). ctx.close() PROMISE döndürür; ikinci çağrıda
         * "InvalidStateError: Cannot close a closed AudioContext" ile REDDEDİLİR
         * ve senkron try/catch bunu YAKALAMAZ — konsola "Uncaught (in promise)"
         * olarak düşer. Bu yüzden ayrıca .catch() gerekir; idempotent olmalı.
         */
        close: () => {
            try { source.disconnect(); } catch { /* yok say */ }
            try {
                if (ctx.state !== 'closed') void ctx.close().catch(() => { /* yok say */ });
            } catch { /* yok say */ }
        },
    };
}

/**
 * Blob'u imzalı adrese yükler ve GERÇEK ilerleme bildirir.
 *
 * fetch'te yükleme ilerlemesi yoktur; XHR şart. 3G'de 7 MB ~40 sn sürer ve
 * çubuk olmadan aday donduğunu sanıp sayfayı yeniler — tek çekimde bu, cevabın
 * kaybolması demektir.
 */
export function uploadBlob(
    url: string,
    blob: Blob,
    mimeType: string,
    onProgress?: (ratio: number) => void,
    signal?: AbortSignal,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', mimeType);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`upload_${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('upload_network'));
        xhr.ontimeout = () => reject(new Error('upload_timeout'));
        xhr.timeout = 5 * 60 * 1000;

        signal?.addEventListener('abort', () => { try { xhr.abort(); } catch { /* yok say */ } });
        xhr.send(blob);
    });
}

/** Üstel geri çekilme — 2 / 6 / 15 sn. */
export const UPLOAD_RETRY_DELAYS_MS = [2000, 6000, 15000];

export function formatSeconds(total: number): string {
    const s = Math.max(0, Math.round(total));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
