import React from 'react';

interface FilterBarProps {
    dateRange: string;
    setDateRange: (val: string) => void;
    onRefresh: () => void;
    loading?: boolean;
    children?: React.ReactNode;
}

export function FilterBar({ dateRange, setDateRange, onRefresh, loading, children }: FilterBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 cursor-pointer"
            >
                <option value="today">Bugün</option>
                <option value="7d">Son 7 Gün</option>
                <option value="30d">Son 30 Gün</option>
                <option value="all">Tüm Zamanlar</option>
            </select>

            {children}

            <button
                onClick={onRefresh}
                disabled={loading}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 font-medium text-xs rounded-lg shadow-sm hover:bg-indigo-600 hover:text-white hover:border-indigo-600 disabled:opacity-50 transition-all duration-150 cursor-pointer"
            >
                {loading ? 'Yükleniyor...' : 'Yenile'}
            </button>
        </div>
    );
}
