import React from 'react';
import { GripVertical, Eye, EyeOff, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LandingPageSection } from '../../../types';
import { SECTION_TEMPLATES, LANGUAGE_COLORS } from './constants';
import { SectionEditor } from './SectionEditor';
import { SectionTranslateMenu } from './SectionTranslateMenu';
import { getLanguageFlags } from '../../../i18n';

interface SortableSectionCardProps {
    section: LandingPageSection;
    isExpanded: boolean;
    onToggle: () => void;
    onDelete: () => void;
    onToggleActive: () => void;
    onUpdate: (updates: Partial<LandingPageSection>) => void;
    onItemsChange: () => void;
    showLanguageBadge?: boolean;
    activeLang?: string;
    onTranslateComplete?: () => void;
}

export function SortableSectionCard({ section, isExpanded, onToggle, onDelete, onToggleActive, onUpdate, onItemsChange, showLanguageBadge = false, activeLang = 'tr', onTranslateComplete }: SortableSectionCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.5 : 1,
    };

    const template = SECTION_TEMPLATES.find(t => t.type === section.section_type);
    const Icon = template?.icon ?? SECTION_TEMPLATES[0].icon;
    const langCode = section.language_code ?? 'tr';
    const flags = getLanguageFlags();
    const borderColor = LANGUAGE_COLORS[langCode] ?? 'border-l-slate-300';

    // Determine visibility for current language
    const isActiveForLang = activeLang === 'tr'
        ? section.is_active
        : section.is_active && section.config_i18n?.[activeLang]?._active !== false;

    return (
        <div ref={setNodeRef} id={`cms-card-${section.id}`} style={style} className={`bg-white rounded-lg border overflow-hidden border-l-[3px] ${borderColor} ${isExpanded ? 'border-indigo-300 shadow-md' : 'border-slate-100'} ${!isActiveForLang ? 'opacity-50' : ''} transition-all duration-200`}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggle}>
                <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600" onClick={e => e.stopPropagation()} aria-label="Surukle">
                    <GripVertical size={16} />
                </button>

                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${isActiveForLang ? 'bg-emerald-500' : 'bg-slate-300'}`} />

                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Icon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-slate-800 truncate">{section.title ?? template?.label ?? section.section_type}</p>
                        {showLanguageBadge && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 shrink-0">
                                {flags[langCode] ?? ''} {langCode}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-400">{template?.label}</p>
                </div>

                <button onClick={e => { e.stopPropagation(); onToggleActive(); }} className={`p-1.5 rounded-lg transition-colors ${isActiveForLang ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-50'}`} title={isActiveForLang ? 'Aktif' : 'Pasif'}>
                    {isActiveForLang ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <SectionTranslateMenu
                    sectionId={section.id}
                    sectionTitle={section.title ?? template?.label ?? section.section_type}
                    sourceLang={activeLang}
                    hasTranslation={(lang) => {
                        if (lang === 'tr') return true;
                        const cfg = section.config_i18n?.[lang];
                        return !!cfg && Object.keys(cfg).some(k => k !== '_active');
                    }}
                    onComplete={() => onTranslateComplete?.()}
                />
                <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Sil">
                    <Trash2 size={16} />
                </button>
                {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </div>

            {/* Expanded editor */}
            {isExpanded && (
                <SectionEditor section={section} onUpdate={onUpdate} onItemsChange={onItemsChange} />
            )}
        </div>
    );
}
