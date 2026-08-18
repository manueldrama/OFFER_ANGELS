/**
 * FieldTranslateButton — tek bir alan değerini TR'den aktif dile AI ile çevirir.
 * activeLang === 'tr' ise hiçbir şey render etmez.
 */
import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { AiTranslationService } from '../../services/admin/aiTranslationService';
import { useToast } from '../../contexts/ToastContext';

interface FieldTranslateButtonProps {
    /** Source value (genellikle TR'deki içerik). Boşsa buton disabled. */
    sourceText: string | null | undefined;
    /** Hedef dil kodu (activeLang). 'tr' ise component render edilmez. */
    targetLang: string;
    /** Çevrilen metin döndüğünde çağrılır. */
    onTranslated: (text: string) => void;
    /** Tooltip etiketi (ne çevriliyor — örn. "Kısa Açıklama"). */
    label?: string;
}

export function FieldTranslateButton({ sourceText, targetLang, onTranslated, label }: FieldTranslateButtonProps) {
    const [loading, setLoading] = useState(false);
    const { error: toastError } = useToast();

    if (targetLang === 'tr') return null;

    const handleClick = async () => {
        const text = (sourceText || '').trim();
        if (!text) {
            toastError('Çeviri Hatası', `Önce TR'de ${label || 'bu alan'} doldurun.`);
            return;
        }
        setLoading(true);
        try {
            const results = await AiTranslationService.translateBatch(
                [{ key: 'field', value: text }],
                [targetLang],
            );
            const translated = results.find(r => r.key === 'field')?.value || text;
            onTranslated(translated);
        } catch (e: any) {
            toastError('Çeviri Hatası', e?.message || 'Çevrilemedi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 border border-indigo-200 transition-colors disabled:opacity-50"
            title={`TR'den ${targetLang.toUpperCase()} diline AI ile çevir`}
        >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
        </button>
    );
}
