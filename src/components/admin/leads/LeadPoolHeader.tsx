import React from 'react';
import { Search, UserPlus, LayoutGrid, UserCheck, RefreshCw, Sparkles, Radio, Store } from 'lucide-react';
import { SOURCE_FILTER_OPTIONS } from '../../../utils/leadChannel';

interface LeadPoolHeaderProps {
    total: number;
    search: string;
    setSearch: (v: string) => void;
    statusFilter: string;
    setStatusFilter: (v: string) => void;
    sourceFilter: string;
    setSourceFilter: (v: string) => void;
    assignedToFilter: string;
    setAssignedToFilter: (v: string) => void;
    businessTypeFilter: string;
    setBusinessTypeFilter: (v: string) => void;
    businessTypeOptions: string[];
    salesReps: { id: string; full_name: string; email: string }[];
    isSalesRole: boolean;
    onCreateLead: () => void;
    onBulkScore: () => void;
    bulkScoring: boolean;
    setPage: (p: number) => void;
}

const StatusLabels: Record<string, string> = {
    all: 'Tüm Durumlar',
    new: 'Yeni',
    contacted: 'İletişime Geçildi',
    hot: 'Sıcak',
    warm: 'Ilık',
    follow_up: 'Takipte',
    offer_sent: 'Teklif Gönderildi',
    payment_started: 'Ödeme Bekleniyor',
    won: 'Kazanıldı',
    lost: 'Kaybedildi',
};

export function LeadPoolHeader({
    total, search, setSearch, statusFilter, setStatusFilter,
    sourceFilter, setSourceFilter,
    assignedToFilter, setAssignedToFilter,
    businessTypeFilter, setBusinessTypeFilter, businessTypeOptions,
    salesReps, isSalesRole,
    onCreateLead, onBulkScore, bulkScoring, setPage,
}: LeadPoolHeaderProps) {
    return (
        <div className="space-y-4">
            {/* Title Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <LayoutGrid size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Lead Havuzu Dağılımı</h1>
                        <p className="text-sm text-slate-500">
                            {total} lead içindeki sıcak, warm, karar aşaması ve yeni kayıt segmentlerini detaylı olarak inceleyin.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isSalesRole && (
                        <button
                            onClick={onBulkScore}
                            disabled={bulkScoring}
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-md hover:bg-slate-50 transition-all whitespace-nowrap disabled:opacity-50 cursor-pointer"
                        >
                            {bulkScoring ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} className="text-violet-500" />}
                            {bulkScoring ? 'Skorlanıyor...' : 'Tümünü Skorla'}
                        </button>
                    )}
                    <button
                        onClick={onCreateLead}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <UserPlus size={16} />
                        <span className="hidden sm:inline">Yeni Lead Ekle</span>
                        <span className="sm:hidden">Yeni</span>
                    </button>
                </div>
            </div>

            {/* Filter Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Segment, temsilci veya lead ara..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder:text-slate-400"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[150px]"
                >
                    {Object.entries(StatusLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                    ))}
                </select>
                <div className="relative">
                    <Radio className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <select
                        value={sourceFilter}
                        onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
                        className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[160px]"
                    >
                        {SOURCE_FILTER_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                {businessTypeOptions.length > 0 && (
                    <div className="relative">
                        <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <select
                            value={businessTypeFilter}
                            onChange={e => { setBusinessTypeFilter(e.target.value); setPage(1); }}
                            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[170px]"
                        >
                            <option value="all">Tüm İşletme Türleri</option>
                            {businessTypeOptions.map(bt => (
                                <option key={bt} value={bt}>{bt}</option>
                            ))}
                        </select>
                    </div>
                )}
                {!isSalesRole && (
                    <div className="relative">
                        <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <select
                            value={assignedToFilter}
                            onChange={e => { setAssignedToFilter(e.target.value); setPage(1); }}
                            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[170px]"
                        >
                            <option value="all">Tüm Temsilciler</option>
                            <option value="unassigned">Atanmamış</option>
                            {salesReps.map(rep => (
                                <option key={rep.id} value={rep.id}>{rep.full_name || rep.email}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}
