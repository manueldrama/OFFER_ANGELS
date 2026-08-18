// MediaLibraryModal — WordPress-style media picker (Faz 3).
//
// Reusable across the SEO blog editor: image block, hero image, gallery block,
// and inline image insertion. Backed by MediaLibraryService (shared
// `whatsapp_media` bucket). Supports single-select (returns one URL) and
// multi-select (returns URL[]) for gallery blocks.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Trash2, X, Check, ImageOff, Loader2 } from 'lucide-react';
import { MediaLibraryService, type MediaItem } from '../../services/admin/mediaLibraryService';
import { useToast } from '../../contexts/ToastContext';

interface MediaLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Single-select callback. Fired when the user picks one item. */
    onSelect?: (url: string) => void;
    /** Multi-select callback. When provided, the modal renders in multi mode. */
    onSelectMany?: (urls: string[]) => void;
}

export function MediaLibraryModal({ isOpen, onClose, onSelect, onSelectMany }: MediaLibraryModalProps) {
    const { success, error: toastError } = useToast();
    const multi = typeof onSelectMany === 'function';
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setItems(await MediaLibraryService.list());
        } catch (e) {
            toastError('Medya yüklenemedi', (e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [toastError]);

    useEffect(() => {
        if (isOpen) {
            setSelected(new Set());
            load();
        }
    }, [isOpen, load]);

    const handleUpload = useCallback(
        async (files: FileList | null) => {
            if (!files || files.length === 0) return;
            setUploading(true);
            try {
                const urls: string[] = [];
                for (const file of Array.from(files)) {
                    urls.push(await MediaLibraryService.upload(file));
                }
                success('Yüklendi', `${urls.length} dosya eklendi.`);
                await load();
                // Single mode: immediately pick the first freshly uploaded file.
                if (!multi && urls[0] && onSelect) {
                    onSelect(urls[0]);
                    onClose();
                }
            } catch (e) {
                toastError('Yükleme hatası', (e as Error).message);
            } finally {
                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        },
        [load, multi, onClose, onSelect, success, toastError],
    );

    const handleDelete = useCallback(
        async (item: MediaItem, e: React.MouseEvent) => {
            e.stopPropagation();
            if (!window.confirm(`"${item.name}" silinsin mi? Bu işlem geri alınamaz.`)) return;
            try {
                await MediaLibraryService.remove(item.name);
                setItems((prev) => prev.filter((x) => x.name !== item.name));
                success('Silindi', 'Medya kaldırıldı.');
            } catch (err) {
                toastError('Silme hatası', (err as Error).message);
            }
        },
        [success, toastError],
    );

    const pick = useCallback(
        (item: MediaItem) => {
            if (multi) {
                setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.url)) next.delete(item.url);
                    else next.add(item.url);
                    return next;
                });
            } else {
                onSelect?.(item.url);
                onClose();
            }
        },
        [multi, onClose, onSelect],
    );

    const confirmMulti = useCallback(() => {
        onSelectMany?.(Array.from(selected));
        onClose();
    }, [onClose, onSelectMany, selected]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
                    <h3 className="text-sm font-semibold text-neutral-800">Medya Kütüphanesi</h3>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            {uploading ? 'Yükleniyor…' : 'Yükle'}
                        </button>
                        <button type="button" onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/mp4"
                    multiple={multi}
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                />

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-neutral-400">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yükleniyor…
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
                            <ImageOff className="w-8 h-8 mb-2" />
                            <p className="text-sm">Henüz medya yok. Yükle ile ekleyin.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {items.map((item) => {
                                const isSel = selected.has(item.url);
                                return (
                                    <button
                                        key={item.name}
                                        type="button"
                                        onClick={() => pick(item)}
                                        className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                            isSel ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-neutral-200 hover:border-neutral-400'
                                        }`}
                                    >
                                        {item.kind === 'video' ? (
                                            <video src={item.url} className="w-full h-full object-cover" muted />
                                        ) : (
                                            <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                        )}
                                        {isSel && (
                                            <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                                <Check className="w-3 h-3" />
                                            </span>
                                        )}
                                        <span
                                            onClick={(e) => handleDelete(item, e)}
                                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-red-600 transition-opacity"
                                            title="Sil"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer (multi mode only) */}
                {multi && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100">
                        <span className="text-xs text-neutral-500">{selected.size} seçili</span>
                        <button
                            type="button"
                            onClick={confirmMulti}
                            disabled={selected.size === 0}
                            className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                            Seç ({selected.size})
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
