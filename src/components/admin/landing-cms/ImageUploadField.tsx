import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Upload, Images } from 'lucide-react';
import { LandingPageCmsService } from '../../../services/admin/landingPageCmsService';
import { useToast } from '../../../contexts/ToastContext';

interface ImageUploadFieldProps {
    value: string;
    onChange: (url: string) => void;
    acceptVideo?: boolean;
    circularCrop?: boolean;
}

export function ImageUploadField({ value, onChange, acceptVideo, circularCrop }: ImageUploadFieldProps) {
    const [uploading, setUploading] = useState(false);
    const [cropSrc, setCropSrc] = useState('');
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const cropImgRef = useRef<HTMLImageElement>(null);
    const { error: toastError } = useToast();
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryItems, setGalleryItems] = useState<{ name: string; url: string; created_at: string; kind: 'image' | 'video' }[]>([]);
    const [galleryLoading, setGalleryLoading] = useState(false);

    const openGallery = async () => {
        setGalleryOpen(true);
        setGalleryLoading(true);
        try {
            const list = await LandingPageCmsService.listLandingMedia();
            setGalleryItems(acceptVideo ? list : list.filter(i => i.kind === 'image'));
        } catch (err: any) {
            toastError('Hata', err?.message || 'Galeri yüklenemedi.');
        } finally { setGalleryLoading(false); }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (circularCrop && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => setCropSrc(reader.result as string);
            reader.readAsDataURL(file);
            e.target.value = '';
            return;
        }

        setUploading(true);
        try {
            const url = await LandingPageCmsService.uploadImage(file);
            onChange(url);
        } catch (err: any) {
            console.error('[LandingCMS] Upload failed:', err);
            toastError('Hata', err?.message || 'Resim yüklenemedi.');
        } finally {
            setUploading(false);
        }
    };

    const onCropImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 80 }, 1, width, height), width, height));
    };

    const handleCropUpload = async () => {
        if (!completedCrop || !cropImgRef.current) return;
        setUploading(true);
        try {
            const img = cropImgRef.current;
            const scaleX = img.naturalWidth / img.width;
            const scaleY = img.naturalHeight / img.height;
            const size = Math.floor(Math.min(completedCrop.width * scaleX, completedCrop.height * scaleY));
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d')!;
            ctx.imageSmoothingQuality = 'high';

            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            ctx.drawImage(
                img,
                Math.floor(completedCrop.x * scaleX),
                Math.floor(completedCrop.y * scaleY),
                Math.floor(completedCrop.width * scaleX),
                Math.floor(completedCrop.height * scaleY),
                0, 0, size, size,
            );

            const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png', 1));
            if (!blob) throw new Error('Crop failed');

            const file = new File([blob], `crop_${Date.now()}.png`, { type: 'image/png' });
            const url = await LandingPageCmsService.uploadImage(file);
            onChange(url);
            setCropSrc('');
        } catch (err: any) {
            console.error('[LandingCMS] Crop upload failed:', err);
            toastError('Hata', err?.message || 'Kırpılmış resim yüklenemedi.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-1.5">
            {value && (
                acceptVideo && (value.endsWith('.mp4') || value.endsWith('.webm') || value.endsWith('.mov'))
                    ? <video src={value} className="w-20 h-20 rounded-lg object-cover border border-slate-200" muted autoPlay loop playsInline />
                    : <img src={value} alt="preview" className={`w-20 h-20 object-cover border border-slate-200 ${circularCrop ? 'rounded-full' : 'rounded-lg'}`} />
            )}
            <div className="flex items-center gap-2">
                <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="URL veya yükle..." className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                <button type="button" onClick={openGallery} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors" title="Galeriden seç">
                    <Images size={12} /> Galeri
                </button>
                <label className={`inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload size={12} /> {uploading ? '...' : 'Yükle'}
                    <input type="file" accept={acceptVideo ? 'image/*,video/*' : 'image/*'} onChange={handleUpload} className="hidden" />
                </label>
            </div>
            {galleryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setGalleryOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl p-5 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-800">Galeriden Seç</h3>
                            <button onClick={() => setGalleryOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
                        </div>
                        {galleryLoading ? (
                            <p className="text-center text-xs text-slate-500 py-8">Yükleniyor...</p>
                        ) : galleryItems.length === 0 ? (
                            <p className="text-center text-xs text-slate-500 py-8">Henüz medya yüklenmemiş.</p>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                {galleryItems.map(it => (
                                    <button
                                        key={it.name}
                                        type="button"
                                        onClick={() => { onChange(it.url); setGalleryOpen(false); }}
                                        className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-indigo-500 focus:border-indigo-600 outline-none bg-slate-100"
                                        title={it.name}
                                    >
                                        {it.kind === 'video' ? (
                                            <video src={it.url} className="w-full h-full object-cover" muted playsInline />
                                        ) : (
                                            <img src={it.url} alt={it.name} className="w-full h-full object-cover" loading="lazy" />
                                        )}
                                        {it.kind === 'video' && (
                                            <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">VIDEO</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {cropSrc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCropSrc('')}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-800">Görseli Kırp</h3>
                            <button onClick={() => setCropSrc('')} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
                        </div>
                        <div className="flex justify-center">
                            <ReactCrop
                                crop={crop}
                                onChange={c => setCrop(c)}
                                onComplete={c => setCompletedCrop(c)}
                                aspect={1}
                                circularCrop
                            >
                                <img
                                    ref={cropImgRef}
                                    src={cropSrc}
                                    onLoad={onCropImageLoad}
                                    alt="Crop"
                                    style={{ maxHeight: '400px' }}
                                />
                            </ReactCrop>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setCropSrc('')} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                                İptal
                            </button>
                            <button
                                onClick={handleCropUpload}
                                disabled={uploading || !completedCrop}
                                className="px-4 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {uploading ? 'Yükleniyor...' : 'Kırp ve Yükle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
