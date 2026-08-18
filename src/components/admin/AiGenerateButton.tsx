/**
 * AiGenerateButton — inline ✨ button next to a text/textarea field that
 * asks Claude to produce content for that specific field using the
 * cafepaste-product-marketing skill pack.
 *
 * Granular by design: one button per field. Clicking opens a tiny popover
 * with optional tone/hint override; "Oluştur" calls
 * ProductContentAiService.generateField; result preview lets user
 * Use / Regenerate / Cancel.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Check, RotateCcw, X } from 'lucide-react';
import { ProductContentAiService, type AiTone, type MarketingContext } from '../../services/admin/productContentAiService';
import { useToast } from '../../contexts/ToastContext';

interface AiGenerateButtonProps {
    productId: string;
    sectionType: string;
    fieldKey: string;
    targetLang: string;
    /** Default marketing context from product.marketing_context (admin can override per-click). */
    marketingContext?: MarketingContext;
    /** Context of the item being edited (other field values, for AI to avoid repeat/conflict). */
    itemContext?: Record<string, any>;
    /** Called with the accepted generation. */
    onGenerated: (text: string) => void;
    /** Optional size override. */
    size?: 'sm' | 'md';
    /** Optional CSS class for the button. */
    className?: string;
}

const TONE_OPTIONS: { value: AiTone; label: string }[] = [
    { value: 'aggressive', label: 'Agresif' },
    { value: 'premium', label: 'Premium' },
    { value: 'urgency', label: 'Aciliyet' },
    { value: 'educational', label: 'Eğitici' },
];

export function AiGenerateButton({
    productId, sectionType, fieldKey, targetLang,
    marketingContext, itemContext, onGenerated,
    size = 'sm', className = '',
}: AiGenerateButtonProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [tone, setTone] = useState<AiTone | ''>(marketingContext?.tone ?? '');
    const [customHint, setCustomHint] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);
    const { error: toastError } = useToast();

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleGenerate = async () => {
        if (!productId) {
            toastError('Hata', 'Önce ürünü kaydedin (productId gerekli).');
            return;
        }
        setLoading(true);
        setResult(null);
        try {
            const mc: MarketingContext = {
                ...(marketingContext || {}),
                ...(tone ? { tone: tone as AiTone } : {}),
                ...(customHint.trim() ? { customHint: customHint.trim() } : {}),
            };
            const { text } = await ProductContentAiService.generateField({
                productId, sectionType, fieldKey, targetLang,
                itemContext, marketingContext: mc,
            });
            setResult(text);
        } catch (e: any) {
            toastError('AI Hatası', e?.message || 'Üretilemedi.');
        } finally {
            setLoading(false);
        }
    };

    const handleUse = () => {
        if (result) onGenerated(result);
        setOpen(false);
        setResult(null);
        setCustomHint('');
    };

    const handleClose = () => {
        setOpen(false);
        setResult(null);
    };

    const btnSize = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';
    const iconSize = size === 'sm' ? 12 : 14;

    return (
        <div className="relative inline-block">
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={`${btnSize} flex items-center justify-center rounded-md bg-violet-50 text-violet-600 hover:bg-violet-100 hover:text-violet-700 border border-violet-200 transition-colors ${className}`}
                title="AI ile içerik oluştur"
            >
                <Sparkles size={iconSize} />
            </button>

            {open && (
                <div
                    ref={popoverRef}
                    className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white border border-slate-200 rounded-lg shadow-xl p-3 text-xs"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Sparkles size={12} className="text-violet-600" />
                            AI ile Oluştur
                        </div>
                        <button onClick={handleClose} className="text-slate-400 hover:text-slate-700">
                            <X size={12} />
                        </button>
                    </div>

                    <div className="text-[10px] text-slate-500 mb-2">
                        Alan: <span className="font-mono">{sectionType}.{fieldKey}</span> · Dil: {targetLang.toUpperCase()}
                    </div>

                    {!result && (
                        <>
                            <label className="block text-[11px] text-slate-600 mb-1">Ton (opsiyonel)</label>
                            <select
                                value={tone}
                                onChange={(e) => setTone(e.target.value as AiTone | '')}
                                className="w-full mb-2 rounded-md border border-slate-200 px-2 py-1 text-xs focus:ring-2 focus:ring-violet-200 outline-none"
                                disabled={loading}
                            >
                                <option value="">Default (master-style)</option>
                                {TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>

                            <label className="block text-[11px] text-slate-600 mb-1">Özel not (opsiyonel)</label>
                            <textarea
                                value={customHint}
                                onChange={(e) => setCustomHint(e.target.value)}
                                placeholder="ör. lüks otel zincirleri için, kısa tut"
                                rows={2}
                                className="w-full mb-2 rounded-md border border-slate-200 px-2 py-1 text-xs focus:ring-2 focus:ring-violet-200 outline-none resize-none"
                                disabled={loading}
                            />

                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="w-full inline-flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-md px-2.5 py-1.5 text-xs font-medium"
                            >
                                {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                {loading ? 'Üretiliyor...' : 'Oluştur'}
                            </button>
                        </>
                    )}

                    {result && (
                        <>
                            <div className="bg-slate-50 border border-slate-200 rounded-md p-2 mb-2 text-xs text-slate-800 max-h-48 overflow-y-auto whitespace-pre-wrap">
                                {result}
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={handleUse}
                                    className="flex-1 inline-flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-2 py-1.5 text-xs font-medium"
                                >
                                    <Check size={12} /> Kullan
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="inline-flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md px-2 py-1.5 text-xs font-medium"
                                    title="Tekrar üret"
                                >
                                    <RotateCcw size={12} />
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="inline-flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md px-2 py-1.5 text-xs font-medium"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
