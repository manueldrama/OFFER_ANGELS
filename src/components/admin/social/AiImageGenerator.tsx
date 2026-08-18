import React, { useState } from 'react';
import { ImagePlus, Sparkles, Loader2, Check, RotateCw, Maximize2 } from 'lucide-react';
import { SocialMediaAiService } from '../../../services/admin/socialMediaAiService';

interface AiImageGeneratorProps {
    onSelect: (imageUrl: string) => void;
}

const STYLES = [
    { key: 'professional', label: 'Profesyonel', desc: 'Temiz, kurumsal' },
    { key: 'minimalist', label: 'Minimalist', desc: 'Sade, az detay' },
    { key: 'colorful', label: 'Renkli', desc: 'Canlı renkler' },
    { key: 'photorealistic', label: 'Fotorealistik', desc: 'Gerçek fotoğraf' },
    { key: 'artistic', label: 'Sanatsal', desc: 'Yaratıcı, sanat' },
    { key: 'vintage', label: 'Vintage', desc: 'Retro, nostaljik' },
];

const ASPECT_RATIOS = [
    { key: '1:1', label: '1:1 Kare', desc: 'Instagram Feed' },
    { key: '4:5', label: '4:5 Portre', desc: 'Instagram Portre' },
    { key: '16:9', label: '16:9 Yatay', desc: 'Twitter, LinkedIn' },
    { key: '9:16', label: '9:16 Dikey', desc: 'Story, Reel' },
];

export default function AiImageGenerator({ onSelect }: AiImageGeneratorProps) {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('professional');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ imageUrl: string; revisedPrompt: string } | null>(null);
    const [error, setError] = useState('');

    const generate = async () => {
        if (!prompt.trim()) { setError('Görsel için bir açıklama yazın.'); return; }
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const aspectPrompt = aspectRatio !== '1:1' ? `, ${aspectRatio} aspect ratio` : '';
            const res = await SocialMediaAiService.generateImage(prompt + aspectPrompt, style);
            setResult(res);
        } catch (e: any) {
            setError(e.message || 'Görsel oluşturulamadı.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-3.5 p-4 bg-gradient-to-b from-indigo-50/50 to-white rounded-xl border border-indigo-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                <ImagePlus size={16} />
                AI Görsel Oluşturucu (NanoBanana 2)
            </div>

            {/* Prompt */}
            <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Görsel açıklaması... Örn: 'Profesyonel kahve makinesi ofis ortamında, modern dekorasyon'"
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none"
            />

            {/* Style presets */}
            <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Stil</label>
                <div className="grid grid-cols-3 gap-1.5">
                    {STYLES.map(s => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => setStyle(s.key)}
                            className={`px-2 py-1.5 rounded-lg text-center transition-all cursor-pointer border ${
                                style === s.key
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                            }`}
                        >
                            <div className="text-[11px] font-semibold">{s.label}</div>
                            <div className="text-[9px] text-slate-400">{s.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Aspect Ratio */}
            <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <Maximize2 size={10} /> Oran
                </label>
                <div className="flex gap-1.5">
                    {ASPECT_RATIOS.map(ar => (
                        <button
                            key={ar.key}
                            type="button"
                            onClick={() => setAspectRatio(ar.key)}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-center transition-all cursor-pointer border ${
                                aspectRatio === ar.key
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                            }`}
                        >
                            <div className="text-[11px] font-semibold">{ar.label}</div>
                            <div className="text-[8px] text-slate-400">{ar.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Generate button */}
            <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
            >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? 'Oluşturuluyor...' : 'Görsel Oluştur'}
            </button>

            {error && <p className="text-xs text-red-500">{error}</p>}

            {/* Preview */}
            {result && (
                <div className="space-y-2.5">
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        <img src={result.imageUrl} alt="AI Generated" className="w-full max-h-[280px] object-contain" />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => onSelect(result.imageUrl)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                        >
                            <Check size={14} />
                            Kullan
                        </button>
                        <button
                            type="button"
                            onClick={generate}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <RotateCw size={14} />
                            Yeniden
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
