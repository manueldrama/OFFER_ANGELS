import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { supabase } from '../../../lib/supabase/client';
import { X, Check, Loader2, RotateCw, RotateCcw, Crop as CropIcon, Sun, Contrast, Droplets, Maximize2 } from 'lucide-react';

interface SocialImageEditorProps {
    imageUrl: string;
    onSave: (newUrl: string) => void;
    onClose: () => void;
}

const ASPECT_PRESETS = [
    { label: 'Serbest', value: 0, icon: '⬜' },
    { label: '1:1 Kare', value: 1, icon: '◻️' },
    { label: '4:5 Portre', value: 4 / 5, icon: '📱' },
    { label: '9:16 Story', value: 9 / 16, icon: '📲' },
    { label: '16:9 Yatay', value: 16 / 9, icon: '🖥️' },
    { label: '4:3', value: 4 / 3, icon: '📺' },
];

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
    return centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
        mediaWidth,
        mediaHeight
    );
}

export default function SocialImageEditor({ imageUrl, onSave, onClose }: SocialImageEditorProps) {
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [aspectRatio, setAspectRatio] = useState(0); // 0 = free
    const [rotation, setRotation] = useState(0);
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [saturation, setSaturation] = useState(100);
    const [saving, setSaving] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    const filterStyle = {
        filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
        transform: `rotate(${rotation}deg)`,
    };

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        if (aspectRatio > 0) {
            const { width, height } = e.currentTarget;
            setCrop(centerAspectCrop(width, height, aspectRatio));
        }
    }, [aspectRatio]);

    const handleAspectChange = (ratio: number) => {
        setAspectRatio(ratio);
        if (ratio > 0 && imgRef.current) {
            const { width, height } = imgRef.current;
            setCrop(centerAspectCrop(width, height, ratio));
        } else {
            setCrop(undefined);
        }
    };

    const handleRotate = (degrees: number) => {
        setRotation(prev => (prev + degrees) % 360);
    };

    const resetFilters = () => {
        setBrightness(100);
        setContrast(100);
        setSaturation(100);
        setRotation(0);
    };

    const handleSave = async () => {
        if (!imgRef.current) return;
        setSaving(true);

        try {
            const image = imgRef.current;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context not available');

            const natW = image.naturalWidth;
            const natH = image.naturalHeight;

            // Handle rotation
            const isRotated90 = rotation === 90 || rotation === 270;
            const canvasW = isRotated90 ? natH : natW;
            const canvasH = isRotated90 ? natW : natH;

            // If crop is set, calculate real crop area
            let sx = 0, sy = 0, sw = natW, sh = natH;
            if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
                const scaleX = natW / image.width;
                const scaleY = natH / image.height;
                sx = Math.floor(completedCrop.x * scaleX);
                sy = Math.floor(completedCrop.y * scaleY);
                sw = Math.floor(completedCrop.width * scaleX);
                sh = Math.floor(completedCrop.height * scaleY);
            }

            // Set canvas size based on crop + rotation
            const outW = isRotated90 ? sh : sw;
            const outH = isRotated90 ? sw : sh;
            canvas.width = outW;
            canvas.height = outH;

            // Apply filters
            ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

            // Apply rotation
            ctx.save();
            ctx.translate(outW / 2, outH / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            if (isRotated90) {
                ctx.drawImage(image, sx, sy, sw, sh, -sh / 2, -sw / 2, sh, sw);
            } else {
                ctx.drawImage(image, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
            }
            ctx.restore();

            // Convert to blob
            const blob = await new Promise<Blob | null>(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', 0.92);
            });
            if (!blob) throw new Error('Failed to create image blob');

            // Upload to Supabase
            const fileName = `social/edited_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const { error } = await supabase.storage
                .from('media')
                .upload(fileName, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
            if (error) throw error;

            const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
            onSave(urlData.publicUrl);
        } catch (err: any) {
            console.error('[ImageEditor] Save error:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2">
                        <CropIcon size={16} className="text-indigo-600" />
                        <h3 className="text-sm font-bold text-slate-800">Görsel Düzenleyici</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                        <X size={16} className="text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex min-h-0">
                    {/* Image area */}
                    <div className="flex-[65] bg-slate-900 flex items-center justify-center p-4 overflow-auto">
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={c => setCompletedCrop(c)}
                            aspect={aspectRatio || undefined}
                        >
                            <img
                                ref={imgRef}
                                src={imageUrl}
                                alt="Düzenle"
                                onLoad={onImageLoad}
                                className="max-w-full max-h-[70vh]"
                                style={filterStyle}
                                crossOrigin="anonymous"
                            />
                        </ReactCrop>
                    </div>

                    {/* Tools panel */}
                    <div className="flex-[35] bg-white border-l border-slate-100 overflow-y-auto p-4 space-y-5">
                        {/* Aspect Ratio */}
                        <div>
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Kırpma Oranı</label>
                            <div className="grid grid-cols-3 gap-1.5">
                                {ASPECT_PRESETS.map(p => (
                                    <button
                                        key={p.label}
                                        onClick={() => handleAspectChange(p.value)}
                                        className={`px-2 py-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                                            aspectRatio === p.value
                                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span className="text-sm">{p.icon}</span>
                                        <div className="mt-0.5">{p.label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Rotation */}
                        <div>
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Döndürme</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleRotate(-90)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    <RotateCcw size={14} />
                                    -90°
                                </button>
                                <button
                                    onClick={() => handleRotate(90)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    <RotateCw size={14} />
                                    +90°
                                </button>
                            </div>
                            {rotation !== 0 && (
                                <div className="text-[10px] text-indigo-600 mt-1 font-medium">{rotation}° döndürüldü</div>
                            )}
                        </div>

                        {/* Brightness */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                    <Sun size={12} /> Parlaklık
                                </label>
                                <span className="text-[11px] text-slate-400 font-mono">{brightness}%</span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="200"
                                value={brightness}
                                onChange={e => setBrightness(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>

                        {/* Contrast */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                    <Contrast size={12} /> Kontrast
                                </label>
                                <span className="text-[11px] text-slate-400 font-mono">{contrast}%</span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="200"
                                value={contrast}
                                onChange={e => setContrast(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>

                        {/* Saturation */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                    <Droplets size={12} /> Doygunluk
                                </label>
                                <span className="text-[11px] text-slate-400 font-mono">{saturation}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="200"
                                value={saturation}
                                onChange={e => setSaturation(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>

                        {/* Reset */}
                        <button
                            onClick={resetFilters}
                            className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            Filtreleri Sıfırla
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-5 py-3.5 border-t border-slate-100 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {saving ? 'Kaydediliyor...' : 'Kaydet & Kullan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
