import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { getSupportedLanguages, getLanguageFlags, getLanguageLabels } from '../../../i18n';
import { LandingPageCmsService } from '../../../services/admin/landingPageCmsService';
import { LandingPagePublicService } from '../../../services/landingPagePublicService';
import { useToast } from '../../../contexts/ToastContext';

interface EditorLanguageBarProps {
    activeLang: string;
    onLangChange: (lang: string) => void;
    onTranslateComplete?: () => void;
    hasI18nData: (lang: string) => boolean;
}

export function EditorLanguageBar({ activeLang, onLangChange, onTranslateComplete, hasI18nData }: EditorLanguageBarProps) {
    const languages = getSupportedLanguages();
    const flags = getLanguageFlags();
    const labels = getLanguageLabels();
    const { success, error: toastError } = useToast();
    const [translating, setTranslating] = useState(false);
    const [progress, setProgress] = useState('');

    const handleTranslate = async () => {
        if (activeLang === 'tr') return;
        setTranslating(true);
        try {
            const count = await LandingPageCmsService.translateAllToI18n(activeLang, setProgress);
            LandingPagePublicService.clearCache();
            success('Basarili', `${count} bolum ${labels[activeLang] || activeLang} diline cevrildi.`);
            onTranslateComplete?.();
        } catch (err: any) {
            toastError('Hata', err?.message || 'Ceviri basarisiz.');
        } finally {
            setTranslating(false);
            setProgress('');
        }
    };

    const showTranslateBtn = activeLang !== 'tr' && !hasI18nData(activeLang);

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Language pills */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
                {languages.map(lang => (
                    <button
                        key={lang}
                        onClick={() => onLangChange(lang)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                            activeLang === lang
                                ? 'bg-white shadow-sm text-slate-900 font-semibold'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <span className="text-sm">{flags[lang] ?? ''}</span>
                        <span className="uppercase">{lang}</span>
                        {lang !== 'tr' && !hasI18nData(lang) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Ceviri yok" />
                        )}
                    </button>
                ))}
            </div>

            {/* Translate button */}
            {showTranslateBtn && (
                <button
                    onClick={handleTranslate}
                    disabled={translating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-medium hover:bg-violet-100 transition-colors disabled:opacity-50"
                >
                    {translating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                    {translating ? progress || 'Cevriliyor...' : `TR → ${activeLang.toUpperCase()} AI Cevir`}
                </button>
            )}
        </div>
    );
}
