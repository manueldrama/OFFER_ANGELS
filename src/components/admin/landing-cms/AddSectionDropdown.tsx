import React, { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { SECTION_TEMPLATES } from './constants';
import { getLanguageFlags } from '../../../i18n';
import { LandingPageSection } from '../../../types';

interface AddSectionDropdownProps {
    activeLanguage: string;
    onAdd: (type: string, label: string) => void;
    existingSections: LandingPageSection[];
}

export function AddSectionDropdown({ activeLanguage, onAdd, existingSections }: AddSectionDropdownProps) {
    const [open, setOpen] = useState(false);
    const flags = getLanguageFlags();
    const lang = activeLanguage === 'all' ? 'tr' : activeLanguage;

    const existingTypes = new Set(
        existingSections
            .filter(s => (s.language_code ?? 'tr') === lang)
            .map(s => s.section_type)
    );

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
                <Plus size={14} /> Bolum Ekle
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-20">
                        <div className="px-3 pb-2 mb-1 border-b border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                Dil: {flags[lang] ?? ''} {lang.toUpperCase()}
                            </span>
                        </div>
                        {SECTION_TEMPLATES.map(t => {
                            const exists = existingTypes.has(t.type);
                            return (
                                <button
                                    key={t.type}
                                    onClick={() => { onAdd(t.type, t.label); setOpen(false); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                                        exists
                                            ? 'text-slate-400 hover:bg-slate-50'
                                            : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                                    }`}
                                >
                                    <t.icon size={16} className={exists ? 'text-slate-300' : 'text-slate-400'} />
                                    <span className="flex-1">{t.label}</span>
                                    {exists && <Check size={14} className="text-emerald-500" />}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
