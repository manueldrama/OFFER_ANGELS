import { useCallback, useEffect, useRef, useState } from 'react';
import {
    UploadCloud, FileText, FileSpreadsheet, FileArchive, Film, File as FileIcon,
    Download, Trash2, Loader2,
} from 'lucide-react';
import { HrTaskService } from '../../../services/admin/hr/hrTaskService';
import { useToast } from '../../../contexts/ToastContext';
import { Lightbox } from '../../ui/Lightbox';
import type { HrTaskAttachment } from '../../../types/hrTasks';

// Görev ekleri bölümü: sürükle-bırak + tıkla + PANO YAPIŞTIR (ekran görüntüsü
// akışı — _CvImportModal deseni). Görseller imzalı URL'le grid önizleme +
// Lightbox; diğer dosyalar ikonlu satır. Bucket özel: URL'ler 10 dakikalık,
// sayfa açıkken toplu üretilir.

const MAX_FILES_PER_BATCH = 10;

function isImage(a: HrTaskAttachment): boolean {
    return !!a.mime_type?.startsWith('image/');
}

function fileIcon(mime: string | null) {
    if (!mime) return FileIcon;
    if (mime.includes('pdf') || mime.includes('word')) return FileText;
    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return FileSpreadsheet;
    if (mime.includes('zip')) return FileArchive;
    if (mime.startsWith('video/')) return Film;
    return FileIcon;
}

function sizeLabel(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskAttachments({ taskId, attachments, onChanged, readOnly }: {
    taskId: string;
    attachments: HrTaskAttachment[];
    onChanged: () => void;
    readOnly?: boolean;
}) {
    const toast = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<string[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    const images = attachments.filter(isImage);
    const files = attachments.filter(a => !isImage(a));

    // Görsel önizlemeleri için imzalı URL'ler — ekler değişince tazelenir.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const next: Record<string, string> = {};
            for (const a of images) {
                try {
                    next[a.id] = await HrTaskService.getAttachmentUrl(a.storage_path);
                } catch { /* tek görselin URL hatası galeriyi düşürmesin */ }
            }
            if (!cancelled) setUrls(next);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attachments.map(a => a.id).join(',')]);

    const addFiles = useCallback(async (list: FileList | File[]) => {
        const batch = Array.from(list).slice(0, MAX_FILES_PER_BATCH);
        if (batch.length === 0) return;
        setUploading(prev => [...prev, ...batch.map(f => f.name)]);
        for (const file of batch) {
            try {
                await HrTaskService.uploadAttachment(taskId, file);
            } catch (e: any) {
                console.error('[TaskAttachments] upload error:', e);
                // Bucket limitleri (boyut/MIME) buradan döner — kullanıcı görsün.
                toast.error(`${file.name}: ${e?.message || 'yüklenemedi'}`);
            } finally {
                setUploading(prev => {
                    const i = prev.indexOf(file.name);
                    return i === -1 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
                });
            }
        }
        onChanged();
    }, [taskId, onChanged, toast]);

    // Pano yapıştır — ekran görüntüsü doğrudan eklensin (_CvImportModal deseni).
    useEffect(() => {
        if (readOnly) return;
        const onPaste = (e: ClipboardEvent) => {
            const files = Array.from(e.clipboardData?.files ?? []);
            if (files.length > 0) void addFiles(files);
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [addFiles, readOnly]);

    const download = async (a: HrTaskAttachment) => {
        try {
            const url = await HrTaskService.getAttachmentUrl(a.storage_path);
            window.open(url, '_blank', 'noopener');
        } catch (e: any) {
            toast.error(e?.message || 'Dosya açılamadı');
        }
    };

    const remove = async (a: HrTaskAttachment) => {
        if (!window.confirm(`"${a.file_name}" silinsin mi?`)) return;
        try {
            await HrTaskService.deleteAttachment(a.id, a.storage_path);
            onChanged();
        } catch (e: any) {
            toast.error(e?.message || 'Silinemedi');
        }
    };

    return (
        <div>
            {!readOnly && (
                <button
                    onClick={() => inputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                        e.preventDefault();
                        setDragOver(false);
                        void addFiles(e.dataTransfer.files);
                    }}
                    className={`w-full border-2 border-dashed rounded-xl px-4 py-4 text-center transition-colors cursor-pointer ${
                        dragOver ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                >
                    <UploadCloud size={18} className="mx-auto text-slate-400 mb-1" />
                    <p className="text-[12px] font-semibold text-slate-500">
                        Dosya bırak, tıkla veya <span className="text-sky-600">ekran görüntüsünü yapıştır</span>
                    </p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">Görsel, PDF, Office, ZIP, MP4 · en çok 15MB</p>
                </button>
            )}
            <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => {
                    if (e.target.files) void addFiles(e.target.files);
                    e.target.value = '';
                }}
            />

            {uploading.length > 0 && (
                <ul className="mt-2 space-y-1">
                    {uploading.map((name, i) => (
                        <li key={`${name}-${i}`} className="flex items-center gap-2 text-[12px] text-slate-500 px-1">
                            <Loader2 size={12} className="animate-spin shrink-0" />
                            <span className="truncate">{name} yükleniyor…</span>
                        </li>
                    ))}
                </ul>
            )}

            {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                    {images.map((a, i) => (
                        <div key={a.id} className="relative group aspect-square">
                            {urls[a.id] ? (
                                <button
                                    onClick={() => setLightboxIndex(i)}
                                    className="w-full h-full cursor-zoom-in"
                                    title={a.file_name}
                                >
                                    <img
                                        src={urls[a.id]}
                                        alt={a.file_name}
                                        className="w-full h-full object-cover rounded-lg border border-slate-200"
                                    />
                                </button>
                            ) : (
                                <div className="w-full h-full rounded-lg bg-slate-100 animate-pulse" />
                            )}
                            {!readOnly && (
                                <button
                                    onClick={() => void remove(a)}
                                    className="absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Görseli sil"
                                >
                                    <Trash2 size={11} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {files.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                    {files.map(a => {
                        const ext = (a.file_name.split('.').pop() || 'DOSYA').toUpperCase().slice(0, 5);
                        const tone = /PDF/.test(ext) ? 'bg-rose-50 text-rose-600 border-rose-100'
                            : /XLSX?|CSV/.test(ext) ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : /DOCX?/.test(ext) ? 'bg-sky-50 text-sky-600 border-sky-100'
                            : /ZIP/.test(ext) ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : /MP4/.test(ext) ? 'bg-violet-50 text-violet-600 border-violet-100'
                            : 'bg-indigo-50 text-indigo-600 border-indigo-100';
                        return (
                            <div key={a.id} className={`relative group rounded-xl border p-3 cursor-pointer hover:shadow-sm transition-all ${tone}`}
                                onClick={() => void download(a)} title="İndir / aç">
                                <p className="text-[13px] font-bold tracking-wide">{ext}</p>
                                <p className="text-[11.5px] font-medium text-slate-700 truncate mt-1.5">{a.file_name}</p>
                                <p className="text-[10px] text-slate-400">{sizeLabel(a.size_bytes)}</p>
                                {!readOnly && (
                                    <button
                                        onClick={e => { e.stopPropagation(); void remove(a); }}
                                        title="Sil"
                                        className="absolute top-1.5 right-1.5 p-1 rounded-md bg-white/70 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={11} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {lightboxIndex !== null && (
                <Lightbox
                    items={images.map(a => ({ url: urls[a.id] || '', name: a.file_name }))}
                    index={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onNavigate={setLightboxIndex}
                />
            )}
        </div>
    );
}
