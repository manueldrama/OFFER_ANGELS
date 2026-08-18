import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { X, LifeBuoy, Phone, MessageCircle, Wrench, CheckCheck, Inbox, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { useSupportInbox } from '../../../contexts/SupportInboxContext';
import { SupportInboxItem, SupportInboxSource } from '../../../services/admin/supportInboxService';

const HIDDEN_PATHS = ['/admin/sales-support', '/admin/service/requests'];

function formatRelative(iso: string): string {
    try {
        const d = new Date(iso);
        const now = new Date();
        const diffSec = Math.max(0, (now.getTime() - d.getTime()) / 1000);
        if (diffSec < 60) return 'şimdi';
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dk`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} sa`;
        if (diffSec < 172800) return 'dün';
        const days = Math.floor(diffSec / 86400);
        if (days < 7) return `${days} gün`;
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
    } catch { return ''; }
}

const sourceMeta: Record<SupportInboxSource, { label: string; dot: string; badge: string; icon: React.ReactNode }> = {
    sales: {
        label: 'Satış',
        dot: 'bg-indigo-500',
        badge: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
        icon: <MessageCircle size={13} />,
    },
    service: {
        label: 'Servis',
        dot: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-700 border border-amber-100',
        icon: <Wrench size={13} />,
    },
};

type Tab = 'all' | 'sales' | 'service';

export const SupportInboxPanel: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const {
        items, loading, isPanelOpen, salesCount, serviceCount,
        closePanel, markSeen, markAllSeen, refresh, isUnread,
    } = useSupportInbox();

    const [tab, setTab] = useState<Tab>('all');

    const filtered = useMemo(() => {
        if (tab === 'all') return items;
        return items.filter(i => i.source === tab);
    }, [items, tab]);

    if (!isPanelOpen) return null;
    if (HIDDEN_PATHS.some(p => location.pathname.startsWith(p))) return null;

    const handleOpen = (item: SupportInboxItem) => {
        markSeen(item);
        closePanel();
        navigate(item.link);
    };

    return (
        <div
            className="fixed z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden
                       bottom-6 right-6 w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-3rem)]
                       max-[640px]:bottom-20 max-[640px]:right-3 max-[640px]:left-3 max-[640px]:w-auto max-[640px]:h-[70vh] max-[640px]:max-h-none"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-br from-indigo-600 to-violet-700 text-white">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                        <LifeBuoy size={17} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-200">Gelen Kutusu</p>
                        <p className="text-sm font-semibold truncate">Destek Talepleri</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => refresh()}
                        className="p-1.5 rounded hover:bg-white/10"
                        aria-label="Yenile"
                        title="Yenile"
                    >
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    </button>
                    <button
                        onClick={closePanel}
                        className="p-1.5 rounded hover:bg-white/10"
                        aria-label="Kapat"
                    >
                        <X size={17} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-3 pt-2.5 pb-2 border-b border-slate-100">
                {([
                    { key: 'all' as Tab, label: 'Tümü', count: items.length },
                    { key: 'sales' as Tab, label: 'Satış', count: salesCount },
                    { key: 'service' as Tab, label: 'Servis', count: serviceCount },
                ]).map(t => {
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                                active
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                            }`}
                        >
                            {t.label}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                {t.count}
                            </span>
                        </button>
                    );
                })}
                <div className="flex-1" />
                <button
                    onClick={markAllSeen}
                    className="text-[11px] font-medium text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-50"
                    title="Tümünü okundu işaretle"
                >
                    <CheckCheck size={13} />
                    Okundu
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto bg-slate-50/40">
                {loading && filtered.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                        <Loader2 size={22} className="animate-spin" />
                        <p className="text-xs">Yükleniyor...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 px-6 text-center">
                        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                            <Inbox size={24} className="text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">Bekleyen talep yok</p>
                        <p className="text-xs">Yeni bir talep geldiğinde anında burada görürsün.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {filtered.map(item => {
                            const meta = sourceMeta[item.source];
                            const unread = isUnread(item);
                            return (
                                <li key={`${item.source}:${item.id}`}>
                                    <button
                                        onClick={() => handleOpen(item)}
                                        className={`w-full text-left px-3.5 py-3 hover:bg-white transition-colors group flex gap-3 items-start ${unread ? 'bg-white' : 'bg-transparent'}`}
                                    >
                                        <div className="relative shrink-0">
                                            <div className={`w-9 h-9 rounded-full ${meta.badge} flex items-center justify-center`}>
                                                {meta.icon}
                                            </div>
                                            {unread && (
                                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.badge}`}>
                                                    {meta.label}
                                                </span>
                                                <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap">
                                                    {formatRelative(item.created_at)}
                                                </span>
                                            </div>
                                            <p className={`text-sm mt-1 truncate ${unread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                                {item.title}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5 truncate">{item.subtitle}</p>
                                            {item.customer_phone && (
                                                <p className="text-[11px] text-slate-400 mt-1 inline-flex items-center gap-1">
                                                    <Phone size={10} />
                                                    {item.customer_phone}
                                                </p>
                                            )}
                                        </div>
                                        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 mt-1 shrink-0" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-3 py-2 bg-white flex items-center justify-between gap-2">
                <Link
                    to="/admin/sales-support"
                    onClick={closePanel}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1"
                >
                    Satış destek →
                </Link>
                <Link
                    to="/admin/service/requests"
                    onClick={closePanel}
                    className="text-xs font-semibold text-amber-600 hover:text-amber-700 px-2 py-1"
                >
                    Servis talepleri →
                </Link>
            </div>
        </div>
    );
};

export default SupportInboxPanel;
