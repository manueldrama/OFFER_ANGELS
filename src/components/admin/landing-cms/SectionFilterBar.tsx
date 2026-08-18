import React from 'react';
import { Search } from 'lucide-react';
import { SECTION_TEMPLATES } from './constants';

interface SectionFilterBarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sectionTypeFilter: string;
    onSectionTypeChange: (type: string) => void;
    statusFilter: 'all' | 'active' | 'inactive';
    onStatusChange: (status: 'all' | 'active' | 'inactive') => void;
    totalCount: number;
    activeCount: number;
}

export function SectionFilterBar({
    searchQuery, onSearchChange,
    sectionTypeFilter, onSectionTypeChange,
    statusFilter, onStatusChange,
    totalCount, activeCount,
}: SectionFilterBarProps) {
    return (
        <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4 space-y-3">
            {/* Top row: search + status + counter */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        placeholder="Bolum ara..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                </div>

                <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                    {(['all', 'active', 'inactive'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => onStatusChange(s)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                                statusFilter === s
                                    ? 'bg-white shadow-sm text-slate-800'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {s === 'all' ? 'Tumunu' : s === 'active' ? 'Aktif' : 'Pasif'}
                        </button>
                    ))}
                </div>

                <span className="text-[11px] text-slate-400 whitespace-nowrap ml-auto">
                    {totalCount} bolum / {activeCount} aktif
                </span>
            </div>

            {/* Section type pills */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <button
                    onClick={() => onSectionTypeChange('')}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                        sectionTypeFilter === ''
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                >
                    Tumunu
                </button>
                {SECTION_TEMPLATES.map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.type}
                            onClick={() => onSectionTypeChange(sectionTypeFilter === t.type ? '' : t.type)}
                            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                                sectionTypeFilter === t.type
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                        >
                            <Icon size={11} />
                            {t.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
