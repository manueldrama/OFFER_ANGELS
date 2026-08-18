import React from 'react';
import { getLanguageFlags, getLanguageLabels } from '../../../i18n';

interface LanguageTabBarProps {
    languages: string[];
    activeLanguage: string;
    onLanguageChange: (lang: string) => void;
    sectionCounts: Record<string, number>;
}

export function LanguageTabBar({ languages, activeLanguage, onLanguageChange, sectionCounts }: LanguageTabBarProps) {
    const flags = getLanguageFlags();
    const labels = getLanguageLabels();
    const totalCount = Object.values(sectionCounts).reduce((a, b) => a + b, 0);

    return (
        <div className="bg-slate-100 p-1 rounded-lg flex gap-1 overflow-x-auto no-scrollbar mb-4">
            {/* All tab */}
            <button
                onClick={() => onLanguageChange('all')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    activeLanguage === 'all'
                        ? 'bg-white shadow-sm text-slate-900 font-semibold'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
            >
                Tumunu Gor
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeLanguage === 'all'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-200 text-slate-500'
                }`}>
                    {totalCount}
                </span>
            </button>

            {languages.map(lang => {
                const count = sectionCounts[lang] ?? 0;
                const isActive = activeLanguage === lang;
                return (
                    <button
                        key={lang}
                        onClick={() => onLanguageChange(lang)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                            isActive
                                ? 'bg-white shadow-sm text-slate-900 font-semibold'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                    >
                        <span className="text-sm">{flags[lang] ?? ''}</span>
                        <span className="uppercase">{lang}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-slate-200 text-slate-500'
                        }`}>
                            {count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
