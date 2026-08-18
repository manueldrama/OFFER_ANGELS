import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { supabase } from '../../../lib/supabase/client';
import { X, Upload, Check, Loader2, Image as ImageIcon, FolderOpen, Search, RefreshCw, PlayCircle, Video } from 'lucide-react';

const VIDEO_EXT_REGEX = /\.(mp4|webm|mov|m4v|ogg)$/i;
const IMAGE_EXT_REGEX = /\.(jpg|jpeg|png|webp|gif|svg)$/i;
const ANY_MEDIA_EXT_REGEX = /\.(jpg|jpeg|png|webp|gif|svg|mp4|webm|mov|m4v|ogg)$/i;
const isVideoUrl = (url: string) => VIDEO_EXT_REGEX.test(url);
import { useToast } from '../../../contexts/ToastContext';

interface ImageCropperProps {
    onClose: () => void;
    onUploadSuccess: (url: string) => void;
    aspectRatio?: number; // E.g., 1 or 16/9
}

type TabMode = 'upload' | 'gallery';

interface GalleryImage {
    name: string;
    url: string;
    created_at: string;
    isVideo: boolean;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            aspect,
            mediaWidth,
            mediaHeight
        ),
        mediaWidth,
        mediaHeight
    )
}

export function ImageCropper({ onClose, onUploadSuccess, aspectRatio = 1 }: ImageCropperProps) {
    const [activeTab, setActiveTab] = useState<TabMode>('upload');
    const [imgSrc, setImgSrc] = useState('');
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isUploading, setIsUploading] = useState(false);
    const toast = useToast();

    // Gallery state
    const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [gallerySearch, setGallerySearch] = useState('');
    const [selectedGalleryUrl, setSelectedGalleryUrl] = useState<string | null>(null);

    const loadGalleryImages = async () => {
        setGalleryLoading(true);
        try {
            const { data, error } = await supabase.storage
                .from('products')
                .list('images', {
                    limit: 100,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) throw error;

            const images: GalleryImage[] = (data || [])
                .filter(f => f.name && ANY_MEDIA_EXT_REGEX.test(f.name))
                .map(f => {
                    const { data: urlData } = supabase.storage
                        .from('products')
                        .getPublicUrl(`images/${f.name}`);
                    return {
                        name: f.name,
                        url: urlData.publicUrl,
                        created_at: f.created_at || '',
                        isVideo: VIDEO_EXT_REGEX.test(f.name),
                    };
                });

            setGalleryImages(images);
        } catch (error: any) {
            console.error('Gallery load error:', error);
            toast.error('Galeri Hatası', 'Görseller yüklenirken bir hata oluştu');
        } finally {
            setGalleryLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'gallery' && galleryImages.length === 0) {
            loadGalleryImages();
        }
    }, [activeTab]);

    const filteredGalleryImages = gallerySearch
        ? galleryImages.filter(img => img.name.toLowerCase().includes(gallerySearch.toLowerCase()))
        : galleryImages;

    async function uploadVideoFile(file: File) {
        setIsUploading(true);
        try {
            const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
            const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const filePath = `images/${fileName}`;

            const { error } = await supabase.storage
                .from('products')
                .upload(filePath, file, {
                    contentType: file.type || `video/${ext}`,
                    cacheControl: '3600',
                    upsert: false,
                });
            if (error) throw error;

            const { data: publicUrlData } = supabase.storage
                .from('products')
                .getPublicUrl(filePath);

            onUploadSuccess(publicUrlData.publicUrl);
        } catch (error: any) {
            console.error('Video upload error:', error);
            toast.error('Yükleme Hatası', error?.message || 'Video yüklenirken bir hata oluştu');
        } finally {
            setIsUploading(false);
        }
    }

    function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            // Video ise kırpma adımını atla, doğrudan yükle.
            if (file.type.startsWith('video/') || VIDEO_EXT_REGEX.test(file.name)) {
                void uploadVideoFile(file);
                return;
            }
            setCrop(undefined);
            const reader = new FileReader();
            reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
            reader.readAsDataURL(file);
        }
    }

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        if (aspectRatio) {
            const { width, height } = e.currentTarget;
            setCrop(centerAspectCrop(width, height, aspectRatio));
        }
    }

    const generateCroppedImageBlob = async (image: HTMLImageElement, pixelCrop: PixelCrop): Promise<Blob | null> => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Scale factor between displayed size and natural size
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        // Output canvas uses natural (full-res) dimensions
        const cropWidth = Math.floor(pixelCrop.width * scaleX);
        const cropHeight = Math.floor(pixelCrop.height * scaleY);

        canvas.width = cropWidth;
        canvas.height = cropHeight;

        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
            image,
            Math.floor(pixelCrop.x * scaleX),
            Math.floor(pixelCrop.y * scaleY),
            cropWidth,
            cropHeight,
            0,
            0,
            cropWidth,
            cropHeight
        );

        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
        });
    };

    const handleUpload = async () => {
        if (!completedCrop || !imgRef.current) return;
        setIsUploading(true);

        try {
            const blob = await generateCroppedImageBlob(imgRef.current, completedCrop);
            if (!blob) throw new Error('Could not crop image');

            const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const filePath = `images/${fileName}`;

            const { data, error } = await supabase.storage
                .from('products')
                .upload(filePath, blob, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: publicUrlData } = supabase.storage
                .from('products')
                .getPublicUrl(filePath);

            onUploadSuccess(publicUrlData.publicUrl);
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('Yükleme Hatası', error?.message || 'Görsel yüklenirken bir hata oluştu');
        } finally {
            setIsUploading(false);
        }
    };

    const handleGallerySelect = () => {
        if (selectedGalleryUrl) {
            onUploadSuccess(selectedGalleryUrl);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40">
            <div className="bg-white rounded-lg w-full max-w-2xl overflow-hidden flex flex-col shadow-lg">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <ImageIcon size={18} className="text-indigo-500" />
                        Ürün Görseli / Video
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
                            activeTab === 'upload'
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        <Upload size={16} />
                        Bilgisayardan Yükle
                    </button>
                    <button
                        onClick={() => setActiveTab('gallery')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
                            activeTab === 'gallery'
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        <FolderOpen size={16} />
                        Galeriden Seç
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">
                    {/* === UPLOAD TAB === */}
                    {activeTab === 'upload' && (
                        <>
                            {!imgSrc ? (
                                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-12 bg-slate-50">
                                    <Upload size={48} className="text-slate-400 mb-4" />
                                    <p className="text-sm text-slate-600 mb-1 font-medium">Bilgisayarınızdan bir görsel veya video seçin</p>
                                    <p className="text-[11px] text-slate-400 mb-4">Görseller kırpılır · videolar doğrudan yüklenir</p>
                                    <label className="cursor-pointer bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition-colors flex items-center gap-2">
                                        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                        {isUploading ? 'Yükleniyor…' : 'Dosya Seç'}
                                        <input type="file" accept="image/*,video/*" onChange={onSelectFile} className="hidden" disabled={isUploading} />
                                    </label>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-full max-h-[60vh] overflow-y-auto bg-slate-100 rounded-lg p-2 border border-slate-200 flex justify-center custom-scrollbar">
                                        <ReactCrop
                                            crop={crop}
                                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                                            onComplete={(c) => setCompletedCrop(c)}
                                            aspect={aspectRatio}
                                            className="max-h-full"
                                        >
                                            <img
                                                ref={imgRef}
                                                alt="Crop me"
                                                src={imgSrc}
                                                onLoad={onImageLoad}
                                                className="max-w-full h-auto max-h-[55vh]"
                                                crossOrigin="anonymous"
                                            />
                                        </ReactCrop>
                                    </div>

                                    <div className="flex justify-end w-full gap-3 pt-4">
                                        <button
                                            onClick={() => setImgSrc('')}
                                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                                            disabled={isUploading}
                                        >
                                            Farklı Seç
                                        </button>
                                        <button
                                            onClick={handleUpload}
                                            disabled={!completedCrop || isUploading}
                                            className="px-6 py-2 bg-slate-900 text-white rounded-md text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                            Kırp ve Yükle
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* === GALLERY TAB === */}
                    {activeTab === 'gallery' && (
                        <div className="flex flex-col gap-4">
                            {/* Search & Refresh */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Görsel veya video ara..."
                                        value={gallerySearch}
                                        onChange={e => setGallerySearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                                    />
                                </div>
                                <button
                                    onClick={loadGalleryImages}
                                    disabled={galleryLoading}
                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Yenile"
                                >
                                    <RefreshCw size={18} className={galleryLoading ? 'animate-spin' : ''} />
                                </button>
                            </div>

                            {/* Gallery Grid */}
                            {galleryLoading ? (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <Loader2 size={32} className="text-indigo-400 animate-spin mb-3" />
                                    <p className="text-sm text-slate-500">Medya yükleniyor…</p>
                                </div>
                            ) : filteredGalleryImages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <ImageIcon size={40} className="text-slate-300 mb-3" />
                                    <p className="text-sm text-slate-500 font-medium">
                                        {gallerySearch ? 'Aramanızla eşleşen medya bulunamadı' : 'Galeride henüz medya yok'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {gallerySearch ? 'Farklı bir arama terimi deneyin' : '"Bilgisayardan Yükle" sekmesiyle görsel veya video ekleyebilirsiniz'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                                    {filteredGalleryImages.map((img) => (
                                        <button
                                            key={img.name}
                                            onClick={() => setSelectedGalleryUrl(img.url === selectedGalleryUrl ? null : img.url)}
                                            className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                                selectedGalleryUrl === img.url
                                                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
                                                    : 'border-slate-200 hover:border-indigo-300 hover:border-slate-300'
                                            }`}
                                        >
                                            {img.isVideo ? (
                                                <>
                                                    <video
                                                        src={img.url}
                                                        className="w-full h-full object-cover bg-slate-900"
                                                        muted
                                                        playsInline
                                                        preload="metadata"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                                        <PlayCircle size={28} className="text-white drop-shadow-lg" />
                                                    </div>
                                                    <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                                                        <Video size={9} /> VIDEO
                                                    </span>
                                                </>
                                            ) : (
                                                <img
                                                    src={img.url}
                                                    alt={img.name}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            )}
                                            {selectedGalleryUrl === img.url && (
                                                <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                                                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                                                        <Check size={16} className="text-white" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-[10px] text-white truncate">{img.name}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Gallery Action */}
                            {filteredGalleryImages.length > 0 && (
                                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                    <p className="text-xs text-slate-400">
                                        {filteredGalleryImages.length} medya{selectedGalleryUrl ? ' · 1 seçili' : ''}
                                    </p>
                                    <button
                                        onClick={handleGallerySelect}
                                        disabled={!selectedGalleryUrl}
                                        className="px-6 py-2 bg-slate-900 text-white rounded-md text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Check size={16} />
                                        Görseli Kullan
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
