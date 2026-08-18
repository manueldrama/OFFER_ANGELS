import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Link2, Loader2, Sparkles, Film, Image as ImageIcon, Pencil, GripVertical, Layers, Play, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { useToast } from '../../../contexts/ToastContext';
import AiImageGenerator from './AiImageGenerator';
import SocialImageEditor from './SocialImageEditor';

interface MediaUploaderProps {
    mediaUrls: string[];
    onChange: (urls: string[]) => void;
    disabled?: boolean;
}

interface UploadingFile {
    id: string;
    name: string;
    progress: number;
    preview: string;
}

export default function MediaUploader({ mediaUrls, onChange, disabled }: MediaUploaderProps) {
    const { addToast } = useToast();
    const [uploading, setUploading] = useState<UploadingFile[]>([]);
    const [uploadError, setUploadError] = useState('');
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [showAiGenerator, setShowAiGenerator] = useState(false);
    const [urlValue, setUrlValue] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [dragItemIndex, setDragItemIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadFile = useCallback(async (file: File) => {
        const id = Math.random().toString(36).substring(7);
        const preview = URL.createObjectURL(file);

        setUploadError('');
        setUploading(prev => [...prev, { id, name: file.name, progress: 0, preview }]);

        try {
            const ext = file.name.split('.').pop() || 'jpg';
            const fileName = `social/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

            setUploading(prev => prev.map(u => u.id === id ? { ...u, progress: 30 } : u));

            const { error } = await supabase.storage
                .from('media')
                .upload(fileName, file, {
                    contentType: file.type,
                    cacheControl: '3600',
                    upsert: false,
                });

            if (error) throw error;

            setUploading(prev => prev.map(u => u.id === id ? { ...u, progress: 80 } : u));

            const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
            const publicUrl = urlData.publicUrl;

            setUploading(prev => prev.map(u => u.id === id ? { ...u, progress: 100 } : u));

            setTimeout(() => {
                setUploading(prev => prev.filter(u => u.id !== id));
                onChange([...mediaUrls, publicUrl]);
            }, 300);
        } catch (err: any) {
            console.error('Upload error:', err);
            const msg = err?.message || 'Yükleme başarısız oldu.';
            const hint = msg.includes('Bucket not found') || msg.includes('not found')
                ? ' — Supabase Storage\'da "media" bucket oluşturulmalı.'
                : msg.includes('security') || msg.includes('policy') || msg.includes('permission')
                    ? ' — Storage bucket izinlerini (RLS) kontrol edin.'
                    : '';
            setUploadError(`Yükleme hatası: ${msg}${hint}`);
            addToast({ type: 'error', title: `Dosya yüklenemedi: ${file.name}`, message: msg });
            setUploading(prev => prev.filter(u => u.id !== id));
        }
    }, [mediaUrls, onChange, addToast]);

    const handleFiles = useCallback((files: FileList | File[]) => {
        const arr = Array.from(files);
        const valid = arr.filter(f => {
            if (f.size > 50 * 1024 * 1024) return false;
            return /^(image|video)\//.test(f.type);
        });
        valid.forEach(uploadFile);
    }, [uploadFile]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled) return;
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles, disabled]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
    }, [disabled]);

    const handleDragLeave = useCallback(() => setIsDragging(false), []);

    const addUrl = () => {
        const url = urlValue.trim();
        if (url && !mediaUrls.includes(url)) {
            onChange([...mediaUrls, url]);
            setUrlValue('');
            setShowUrlInput(false);
        }
    };

    const removeMedia = (index: number) => {
        onChange(mediaUrls.filter((_, i) => i !== index));
    };

    const handleAiImageSelect = (imageUrl: string) => {
        onChange([...mediaUrls, imageUrl]);
        setShowAiGenerator(false);
    };

    const handleEditSave = (newUrl: string) => {
        if (editingIndex !== null) {
            const updated = [...mediaUrls];
            updated[editingIndex] = newUrl;
            onChange(updated);
            setEditingIndex(null);
        }
    };

    // ─── Drag-to-reorder handlers ───
    const handleReorderDragStart = (index: number) => {
        setDragItemIndex(index);
    };

    const handleReorderDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleReorderDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (dragItemIndex === null || dragItemIndex === dropIndex) {
            setDragItemIndex(null);
            setDragOverIndex(null);
            return;
        }
        const updated = [...mediaUrls];
        const [moved] = updated.splice(dragItemIndex, 1);
        updated.splice(dropIndex, 0, moved);
        onChange(updated);
        setDragItemIndex(null);
        setDragOverIndex(null);
    };

    const handleReorderDragEnd = () => {
        setDragItemIndex(null);
        setDragOverIndex(null);
    };

    const isVideo = (url: string) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);

    return (
        <div className="space-y-3">
            {/* Carousel indicator */}
            {mediaUrls.length > 1 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100">
                    <Layers size={13} className="text-indigo-600" />
                    <span className="text-[11px] font-semibold text-indigo-700">Carousel — {mediaUrls.length} medya</span>
                    <span className="text-[10px] text-indigo-400 ml-1">Sıralamayı değiştirmek için sürükleyin</span>
                </div>
            )}

            {/* Uploaded media grid */}
            {mediaUrls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {mediaUrls.map((url, i) => (
                        <div
                            key={`${url}-${i}`}
                            draggable
                            onDragStart={() => handleReorderDragStart(i)}
                            onDragOver={e => handleReorderDragOver(e, i)}
                            onDrop={e => handleReorderDrop(e, i)}
                            onDragEnd={handleReorderDragEnd}
                            className={`relative group aspect-square rounded-xl overflow-hidden border bg-slate-50 transition-all cursor-grab active:cursor-grabbing ${
                                dragOverIndex === i ? 'border-indigo-400 ring-2 ring-indigo-200 scale-[1.03]' :
                                dragItemIndex === i ? 'opacity-40 border-slate-200' : 'border-slate-200'
                            }`}
                        >
                            {isVideo(url) ? (
                                <div className="w-full h-full relative bg-black">
                                    <video src={url} className="w-full h-full object-cover" muted preload="metadata" />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                                            <Play size={14} className="text-white ml-0.5" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <img src={url} alt="" className="w-full h-full object-cover" />
                            )}

                            {/* Grip handle */}
                            <div className="absolute top-1 left-1 p-0.5 rounded bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical size={10} />
                            </div>

                            {/* Index badge */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1.5">
                                <span className="text-[9px] text-white font-bold">{i + 1}</span>
                            </div>

                            {/* Action buttons */}
                            <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!isVideo(url) && (
                                    <button
                                        type="button"
                                        onClick={() => setEditingIndex(i)}
                                        disabled={disabled}
                                        className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:bg-indigo-500 transition-colors"
                                        title="Düzenle"
                                    >
                                        <Pencil size={10} />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => removeMedia(i)}
                                    disabled={disabled}
                                    className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:bg-red-500 transition-colors"
                                    title="Kaldır"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Uploading progress */}
            {uploading.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                        <img src={u.preview} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-700 truncate">{u.name}</div>
                        <div className="mt-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                style={{ width: `${u.progress}%` }}
                            />
                        </div>
                    </div>
                    <Loader2 size={14} className="animate-spin text-indigo-500 shrink-0" />
                </div>
            ))}

            {/* Upload error */}
            {uploadError && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
                    <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-xs text-red-700 font-medium">{uploadError}</p>
                    </div>
                    <button type="button" onClick={() => setUploadError('')} className="text-red-400 hover:text-red-600 cursor-pointer">
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* Drop zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`relative rounded-xl border-2 border-dashed transition-all duration-200 ${
                    isDragging
                        ? 'border-indigo-400 bg-indigo-50 scale-[1.01]'
                        : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
            >
                <div className="flex flex-col items-center justify-center py-5 px-4">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center mb-2.5">
                        <Upload size={16} className="text-indigo-600" />
                    </div>
                    <p className="text-xs font-medium text-slate-700 mb-0.5">
                        {isDragging ? 'Bırakın...' : 'Görsel veya video yükleyin'}
                    </p>
                    <p className="text-[10px] text-slate-400 mb-2.5">
                        Sürükle-bırak veya dosya seçin · JPG, PNG, WebP, GIF, MP4 · Max 50MB
                    </p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                            <ImageIcon size={12} />
                            Dosya Seç
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowUrlInput(!showUrlInput)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            <Link2 size={12} />
                            URL Ekle
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAiGenerator(!showAiGenerator)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 transition-colors cursor-pointer"
                        >
                            <Sparkles size={12} />
                            AI Görsel
                        </button>
                    </div>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={e => e.target.files && handleFiles(e.target.files)}
                    className="hidden"
                />
            </div>

            {/* URL input */}
            {showUrlInput && (
                <div className="flex gap-2">
                    <input
                        type="url"
                        value={urlValue}
                        onChange={e => setUrlValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUrl())}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                        autoFocus
                    />
                    <button
                        type="button"
                        onClick={addUrl}
                        disabled={!urlValue.trim()}
                        className="px-3 py-2 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        Ekle
                    </button>
                    <button
                        type="button"
                        onClick={() => { setShowUrlInput(false); setUrlValue(''); }}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <X size={14} className="text-slate-400" />
                    </button>
                </div>
            )}

            {/* AI Image Generator */}
            {showAiGenerator && (
                <AiImageGenerator onSelect={handleAiImageSelect} />
            )}

            {/* Image Editor Modal */}
            {editingIndex !== null && mediaUrls[editingIndex] && (
                <SocialImageEditor
                    imageUrl={mediaUrls[editingIndex]}
                    onSave={handleEditSave}
                    onClose={() => setEditingIndex(null)}
                />
            )}
        </div>
    );
}
