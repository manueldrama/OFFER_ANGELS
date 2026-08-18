import React, { useState } from 'react';
import { Eye, EyeOff, ChevronUp, ChevronDown, Languages, Loader2, Trash2 } from 'lucide-react';

interface SectionEditControlsProps {
    sectionType: string;
    sectionId?: string;
    isActive: boolean;
    editMode: boolean;
    activeLang?: string;
    onToggleVisibility: (sectionType: string) => void;
    onMove: (sectionType: string, direction: 'up' | 'down') => void;
    onTranslateSection?: (sectionId: string, targetLang: string) => Promise<void>;
    onRemoveSection?: (sectionId: string) => void | Promise<void>;
    isFirst?: boolean;
    isLast?: boolean;
}

export function SectionEditControls({ sectionType, sectionId, isActive, editMode, activeLang = 'tr', onToggleVisibility, onMove, onTranslateSection, onRemoveSection, isFirst, isLast }: SectionEditControlsProps) {
    const [translating, setTranslating] = useState(false);
    if (!editMode) return null;

    const showTranslate = activeLang !== 'tr' && sectionId && onTranslateSection;

    const handleTranslate = async () => {
        if (!sectionId || !onTranslateSection) return;
        setTranslating(true);
        try {
            await onTranslateSection(sectionId, activeLang);
        } finally {
            setTranslating(false);
        }
    };

    return (
        <div className="absolute top-2 right-2 z-[100] flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 px-1 py-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1.5">{sectionType.replace(/_/g, ' ')}</span>

            <div className="w-px h-4 bg-slate-200" />

            {showTranslate && (
                <button
                    onClick={handleTranslate}
                    disabled={translating}
                    className="p-1 rounded text-violet-500 hover:text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                    title={`Bu bolumu ${activeLang.toUpperCase()} diline AI ile cevir`}
                >
                    {translating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
                </button>
            )}

            {!isFirst && (
                <button onClick={() => onMove(sectionType, 'up')} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Yukari tasi">
                    <ChevronUp size={14} />
                </button>
            )}
            {!isLast && (
                <button onClick={() => onMove(sectionType, 'down')} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Asagi tasi">
                    <ChevronDown size={14} />
                </button>
            )}

            <button onClick={() => onToggleVisibility(sectionType)} className={`p-1 rounded transition-colors ${isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`} title={isActive ? 'Gizle' : 'Goster'}>
                {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>

            {sectionId && onRemoveSection && (
                <button
                    onClick={() => {
                        if (confirm('Bu bölümü gizlemek istediğine emin misin? (Geri alınabilir)')) {
                            onRemoveSection(sectionId);
                        }
                    }}
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Bölümü sil (gizle)"
                >
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    );
}
