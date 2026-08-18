import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Info, AlertTriangle, CheckCircle, Wrench, ShoppingBag, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { PortalNotificationsService, PortalNotification } from '../../services/portalNotificationsService';
import { formatDate } from '../../hooks/useAppSettings';
import { supabase } from '../../lib/supabase/client';

interface NotificationBellProps {
    leadId: string;
    basePath: string;
}

const TYPE_CONFIG: Record<PortalNotification['type'], { icon: React.ElementType; color: string; bg: string }> = {
    info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50' },
    warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
    success: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    service: { icon: Wrench, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    order: { icon: ShoppingBag, color: 'text-purple-500', bg: 'bg-purple-50' },
};

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} gün önce`;
    return formatDate(dateStr);
}

export default function NotificationBell({ leadId, basePath }: NotificationBellProps) {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<PortalNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const fetchUnreadCount = useCallback(async () => {
        try {
            const count = await PortalNotificationsService.getUnreadCount(leadId);
            setUnreadCount(count);
        } catch { /* silent */ }
    }, [leadId]);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const [items, count] = await Promise.all([
                PortalNotificationsService.listNotifications(leadId, 20),
                PortalNotificationsService.getUnreadCount(leadId),
            ]);
            setNotifications(items);
            setUnreadCount(count);
        } catch { /* silent */ }
        setLoading(false);
    }, [leadId]);

    // Realtime subscription for instant notification updates
    useEffect(() => {
        fetchUnreadCount();

        const channel = supabase
            .channel(`portal-notifications-${leadId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'portal_notifications',
                filter: `lead_id=eq.${leadId}`
            }, () => {
                fetchUnreadCount();
                // If dropdown is open, refresh the full list too
                if (open) fetchNotifications();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [leadId, fetchUnreadCount]);

    // Load full list when dropdown opens
    useEffect(() => {
        if (open) fetchNotifications();
    }, [open, fetchNotifications]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleClickNotification = async (n: PortalNotification) => {
        if (!n.is_read) {
            await PortalNotificationsService.markAsRead(n.id);
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
        if (n.link) {
            // Resolve link relative to portal basePath
            // Stored links like '/portal/service' need to become '/portal/{slug}/service'
            let resolvedLink = n.link;
            if (n.link.startsWith('/portal/')) {
                const subPath = n.link.replace('/portal/', '');
                resolvedLink = `${basePath}/${subPath}`;
            } else if (!n.link.startsWith('/')) {
                resolvedLink = `${basePath}/${n.link}`;
            }
            navigate(resolvedLink);
            setOpen(false);
        }
    };

    const handleMarkAllRead = async () => {
        await PortalNotificationsService.markAllAsRead(leadId);
        setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
        setUnreadCount(0);
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors relative"
                title="Bildirimler"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full px-1 leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-x-0 top-16 mx-2 sm:mx-0 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                            <h3 className="text-sm font-black text-slate-900">Bildirimler</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    <Check size={12} />
                                    Tümünü Okundu İşaretle
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div className="max-h-[400px] overflow-y-auto">
                            {loading && notifications.length === 0 ? (
                                <div className="py-10 text-center text-slate-400 text-sm">Yükleniyor...</div>
                            ) : notifications.length === 0 ? (
                                <div className="py-10 text-center">
                                    <Bell size={28} className="mx-auto text-slate-200 mb-2" />
                                    <p className="text-slate-400 text-sm">Bildirim yok</p>
                                </div>
                            ) : (
                                notifications.map(n => {
                                    const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                                    const Icon = cfg.icon;
                                    return (
                                        <button
                                            key={n.id}
                                            onClick={() => handleClickNotification(n)}
                                            className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0 ${
                                                !n.is_read ? 'bg-indigo-50/40' : ''
                                            }`}
                                        >
                                            <div className={`shrink-0 w-8 h-8 rounded-lg ${cfg.bg} ${cfg.color} flex items-center justify-center mt-0.5`}>
                                                <Icon size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm ${!n.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'} truncate`}>
                                                        {n.title}
                                                    </p>
                                                    {!n.is_read && (
                                                        <span className="shrink-0 w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
