import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowRight, CheckCheck, CheckCircle2, ClipboardList, Clock,
    ListTodo, Loader2, MessageCircle, RefreshCw,
} from 'lucide-react';
import type { TaskNotificationsState } from '../../../hooks/useTaskNotifications';
import type { HrTaskNotification, TaskNotificationType } from '../../../types/hrTasks';
import { withBase } from '../nav/navConfig';
import { usePanelBase } from '../../../contexts/PanelBaseContext';

// Kabuktaki görev zili. İKİ yerde render edilir (masaüstü sidebar marka bloğu
// + mobil üst bar) ama veri TEK useTaskNotifications örneğinden prop'la gelir —
// bileşen kendi poll'unu KURMAZ.
//
// Linkler withBase ile üretilir: sabit '/admin/...' yazılsaydı /team
// tabanındaki temsilci her tıkta kabuktan atılıp geri yönlendirilirdi
// (RemindersBell'deki bilinen kusur; burada tekrarlanmadı).

export const TYPE_META: Record<TaskNotificationType, { icon: React.ElementType; cls: string }> = {
    task_assigned: { icon: ClipboardList, cls: 'text-blue-600 bg-blue-50' },
    task_comment: { icon: MessageCircle, cls: 'text-violet-600 bg-violet-50' },
    task_status: { icon: RefreshCw, cls: 'text-slate-600 bg-slate-100' },
    task_approved: { icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' },
    task_due_soon: { icon: Clock, cls: 'text-amber-600 bg-amber-50' },
    task_overdue: { icon: Clock, cls: 'text-rose-600 bg-rose-50' },
};

export function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Az önce';
    if (min < 60) return `${min} dk önce`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} sa önce`;
    return `${Math.floor(h / 24)} gün önce`;
}

export function TaskBell({ state, align = 'left' }: {
    state: TaskNotificationsState;
    /** Popover hizası: sidebar'da 'left', mobil üst barda 'right'. */
    align?: 'left' | 'right';
}) {
    const { unreadCount, items, listLoading, loadList, markAsRead, markAllRead } = state;
    const [open, setOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const base = usePanelBase();

    // Tek Görevler sayfası var; sayfa kapsamı (Panom/Ekip) role göre kendisi çözer.
    const tasksPath = withBase('/admin/tasks', base);

    useEffect(() => {
        if (!open) return;
        void loadList();
        const onClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open, loadList]);

    const handleItemClick = (n: HrTaskNotification) => {
        if (!n.is_read) void markAsRead(n.id);
        setOpen(false);
        navigate(tasksPath);
    };

    const hasBadge = unreadCount > 0;

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                title={hasBadge ? `${unreadCount} okunmamış görev bildirimi` : 'Görev bildirimleri'}
                aria-label="Görev bildirimleri"
                className={`relative inline-flex items-center justify-center p-1.5 rounded-md transition-colors cursor-pointer ${
                    hasBadge
                        ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
            >
                <ListTodo size={15} />
                {hasBadge && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white bg-blue-500">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    ref={popoverRef}
                    className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-1.5 z-40 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden`}
                >
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                            Görev Bildirimleri
                        </p>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => void markAllRead()}
                                title="Tümünü okundu işaretle"
                                className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                                <CheckCheck size={13} />
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {listLoading && items.length === 0 ? (
                            <div className="p-6 flex justify-center">
                                <Loader2 size={16} className="animate-spin text-slate-400" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-400">Bildirim yok</div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {items.map(n => {
                                    const meta = TYPE_META[n.type] ?? TYPE_META.task_status;
                                    const Icon = meta.icon;
                                    return (
                                        <li key={n.id}>
                                            <button
                                                onClick={() => handleItemClick(n)}
                                                className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-slate-50 transition-colors ${
                                                    n.is_read ? 'opacity-60' : ''
                                                }`}
                                            >
                                                <span className={`mt-0.5 p-1.5 rounded-md shrink-0 ${meta.cls}`}>
                                                    <Icon size={13} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-[13px] font-medium text-slate-800 truncate">
                                                        {n.title}
                                                    </span>
                                                    {n.message && (
                                                        <span className="block text-[11px] text-slate-500 mt-0.5 break-words line-clamp-2">
                                                            {n.message}
                                                        </span>
                                                    )}
                                                    <span className="block text-[10px] text-slate-400 mt-0.5">
                                                        {timeAgo(n.created_at)}
                                                    </span>
                                                </span>
                                                {!n.is_read && (
                                                    <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <Link
                        to={tasksPath}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-center gap-1 px-3 py-2 border-t border-slate-100 text-[12px] font-semibold text-primary hover:bg-slate-50 transition-colors"
                    >
                        Görevlere git <ArrowRight size={13} />
                    </Link>
                </div>
            )}
        </div>
    );
}
