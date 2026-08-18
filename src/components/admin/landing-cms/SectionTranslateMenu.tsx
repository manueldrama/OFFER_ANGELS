import React, { useEffect, useRef, useState } from 'react';
import { Languages, Loader2, Sparkles, Check, Copy } from 'lucide-react';
import { getSupportedLanguages, getLanguageFlags, getLanguageLabels } from '../../../i18n';
import { LandingPageCmsService } from '../../../services/admin/landingPageCmsService';
import { useToast } from '../../../contexts/ToastContext';

type Mode = 'translate' | 'copy';

interface SectionTranslateMenuProps {
    sectionId: string;
    sectionTitle: string;
    /** Editorde su an aktif olan dil — kaynak olarak kullanilir */
    sourceLang: string;
    /** Hangi dillerde bu bolumun config_i18n verisi var */
    hasTranslation: (lang: string) => boolean;
    onComplete: () => void;
}

export function SectionTranslateMenu({ sectionId, sectionTitle, sourceLang, hasTranslation, onComplete }: SectionTranslateMenuProps) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState<{ lang: string; mode: Mode } | null>(null);
    const [progress, setProgress] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const { success, error: toastError } = useToast();

    const languages = getSupportedLanguages();
    const flags = getLanguageFlags();
    const labels = getLanguageLabels();
    const targets = languages.filter(l => l !== sourceLang);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const runOne = async (target: string, mode: Mode) => {
        if (busy) return;
        if (hasTranslation(target)) {
            const verb = mode === 'translate' ? 'cevirisi' : 'kopyasi';
            const ok = confirm(`${labels[target] || target} icin mevcut ${verb} var. Uzerine yazilsin mi?`);
            if (!ok) return;
        }
        setBusy({ lang: target, mode });
        setProgress(mode === 'copy' ? 'Kopyalaniyor...' : '');
        try {
            if (mode === 'translate') {
                const res = await LandingPageCmsService.translateSectionToLanguage(
                    sectionId, sourceLang, target, setProgress
                );
                success('Cevrildi', `"${sectionTitle}" → ${labels[target] || target}: ${res.savedConfigFields} alan + ${res.savedItems} oge.`);
            } else {
                const res = await LandingPageCmsService.copySectionToLanguage(
                    sectionId, sourceLang, target
                );
                success('Kopyalandi', `"${sectionTitle}" → ${labels[target] || target}: ${res.copiedConfigFields} alan + ${res.copiedItems} oge.`);
            }
            onComplete();
        } catch (e: any) {
            toastError('Hata', e?.message || 'Islem basarisiz.');
        } finally {
            setBusy(null);
            setProgress('');
        }
    };

    const runAll = async (mode: Mode) => {
        if (busy) return;
        const overwriteList = targets.filter(t => hasTranslation(t));
        if (overwriteList.length > 0) {
            const verb = mode === 'translate' ? 'ceviri' : 'kopya';
            const ok = confirm(`${overwriteList.length} dilde mevcut ${verb} var. Hepsi yeniden ${mode === 'translate' ? 'cevrilip' : 'kopyalanip'} uzerine yazilsin mi?`);
            if (!ok) return;
        }
        for (const target of targets) {
            setBusy({ lang: target, mode });
            setProgress(mode === 'copy' ? 'Kopyalaniyor...' : '');
            try {
                if (mode === 'translate') {
                    await LandingPageCmsService.translateSectionToLanguage(
                        sectionId, sourceLang, target, setProgress
                    );
                } else {
                    await LandingPageCmsService.copySectionToLanguage(
                        sectionId, sourceLang, target
                    );
                }
            } catch (e: any) {
                toastError('Hata', `${labels[target] || target}: ${e?.message || 'islem hatasi'}`);
            }
        }
        setBusy(null);
        setProgress('');
        success('Tamamlandi', `"${sectionTitle}" tum dillere ${mode === 'translate' ? 'cevrildi' : 'kopyalandi'}.`);
        onComplete();
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
            <button
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                disabled={!!busy}
                className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50 transition-colors disabled:opacity-50"
                title="Bu bolumu baska dillere cevir veya kopyala"
            >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 max-h-[70vh] overflow-y-auto">
                    <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Kaynak</p>
                        <p className="text-xs font-medium text-slate-700 mt-0.5">
                            {flags[sourceLang] ?? ''} {labels[sourceLang] || sourceLang.toUpperCase()}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
                            <span className="inline-flex items-center gap-1"><Sparkles size={9} className="text-violet-500" /> AI cevir</span>
                            {' · '}
                            <span className="inline-flex items-center gap-1"><Copy size={9} className="text-slate-500" /> Birebir kopyala</span>
                        </p>
                    </div>

                    {targets.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-slate-400">Hedef dil yok.</p>
                    ) : (
                        <>
                            <div className="py-1">
                                {targets.map(lang => {
                                    const has = hasTranslation(lang);
                                    const isBusyTr = busy?.lang === lang && busy?.mode === 'translate';
                                    const isBusyCp = busy?.lang === lang && busy?.mode === 'copy';
                                    return (
                                        <div
                                            key={lang}
                                            className="flex items-center gap-1 px-2 py-1 hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0 px-1">
                                                <span className="text-sm shrink-0">{flags[lang] ?? ''}</span>
                                                <span className="text-xs font-semibold text-slate-700 uppercase shrink-0">{lang}</span>
                                                <span className="text-[11px] text-slate-400 truncate">{labels[lang] || ''}</span>
                                                {has ? (
                                                    <Check size={11} className="text-emerald-500 shrink-0" />
                                                ) : (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Ceviri yok" />
                                                )}
                                            </div>
                                            <button
                                                onClick={() => runOne(lang, 'translate')}
                                                disabled={!!busy}
                                                className="p-1.5 rounded-md text-violet-600 hover:bg-violet-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                title="AI ile cevir"
                                            >
                                                {isBusyTr ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                            </button>
                                            <button
                                                onClick={() => runOne(lang, 'copy')}
                                                disabled={!!busy}
                                                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                title="Birebir kopyala (ceviri yok)"
                                            >
                                                {isBusyCp ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="border-t border-slate-100 mt-1 pt-2 px-2 pb-2 space-y-1">
                                <button
                                    onClick={() => runAll('translate')}
                                    disabled={!!busy}
                                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-50 text-violet-700 border border-violet-200 rounded-md text-xs font-semibold hover:bg-violet-100 transition-colors disabled:opacity-50"
                                >
                                    <Sparkles size={12} />
                                    Tum dillere AI cevir
                                </button>
                                <button
                                    onClick={() => runAll('copy')}
                                    disabled={!!busy}
                                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50"
                                >
                                    <Copy size={12} />
                                    Tum dillere kopyala
                                </button>
                                {busy && progress && (
                                    <p className="text-[10px] text-slate-400 truncate text-center pt-1">
                                        {labels[busy.lang] || busy.lang}: {progress}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
