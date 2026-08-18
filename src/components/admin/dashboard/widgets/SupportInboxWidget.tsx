import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LifeBuoy, Phone, MessageCircle, Wrench, Inbox, ChevronRight, Loader2 } from 'lucide-react';
import { useSupportInbox } from '../../../../contexts/SupportInboxContext';
import { SupportInboxItem, SupportInboxSource } from '../../../../services/admin/supportInboxService';
import { WidgetState } from '../WidgetState';

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

const sourceMeta: Record<SupportInboxSource, { label: string; badge: string; icon: React.ReactNode }> = {
    sales: {
        label: 'Satış',
        badge: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
        icon: <MessageCircle size={13} />,
    },
    service: {
        label: 'Servis',
        badge: 'bg-amber-50 text-amber-700 border border-amber-100',
        icon: <Wrench size={13} />,
    },
};

export function SupportInboxWidget() {
    const navigate = useNavigate();
    const { items, loading, error, refresh, unreadCount, salesCount, serviceCount, markSeen, isUnread } = useSupportInbox();
    const top = items.slice(0, 8);

    return (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <LifeBuoy size={16} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bekleyen Destek Talepleri</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            Satış: <span className="font-semibold text-indigo-600">{salesCount}</span>
                            <span className="mx-1.5 text-slate-300">•</span>
                            Servis: <span className="font-semibold text-amber-600">{serviceCount}</span>
                            {unreadCount > 0 && (
                                <>
                                    <span className="mx-1.5 text-slate-300">•</span>
                                    <span className="font-semibold text-red-500">{unreadCount} yeni</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>
                <Link
                    to="/admin/sales-support"
                    className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 shrink-0"
                >
                    Tümünü Yönet →
                </Link>
            </div>

            {loading && top.length === 0 ? (
                <div className="py-12 flex items-center justify-center text-slate-400">
                    <Loader2 size={20} className="animate-spin" />
                </div>
            ) : error && top.length === 0 ? (
                <div className="py-6">
                    <WidgetState kind="error" detail={error} onRetry={() => { void refresh(); }} />
                </div>
            ) : top.length === 0 ? (
                <div className="py-10 px-6 text-center text-slate-400 flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Inbox size={20} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">Bekleyen talep yok</p>
                    <p className="text-xs">Tüm destek talepleri güncel.</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {top.map((item: SupportInboxItem) => {
                        const meta = sourceMeta[item.source];
                        const unread = isUnread(item);
                        return (
                            <button
                                key={`${item.source}:${item.id}`}
                                onClick={() => { markSeen(item); navigate(item.link); }}
                                className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors group"
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
                                        <p className={`text-sm truncate ${unread ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>
                                            {item.title}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                        <span className="truncate">{item.subtitle}</span>
                                        {item.customer_phone && (
                                            <span className="inline-flex items-center gap-1 text-slate-400 shrink-0">
                                                <Phone size={10} />
                                                {item.customer_phone}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{formatRelative(item.created_at)}</span>
                                    <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default SupportInboxWidget;
