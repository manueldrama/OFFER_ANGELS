import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, BellRing, Check, MessageSquare, Volume2, VolumeX, ArrowRight, Loader2 } from 'lucide-react';
import { leadRemindersService } from '../../../services/admin/leadRemindersService';
import { ReminderAlertsState, isReminderSoundOn, setReminderSound } from '../../../hooks/useReminderAlerts';
import { relativeReminderLabel, absoluteReminderLabel, isOverdue, normalizePhone } from '../../../lib/reminderTime';

// Sol menü başlığındaki çan: açık hatırlatma sayısını rozetle gösterir
// (gecikmiş varsa kırmızı), tıklayınca gecikmiş + yaklaşanları listeleyen
// popover açar. Tek veri kaynağı: useReminderAlerts (AdminLayout'tan prop).

export function RemindersBell({ alerts }: { alerts: ReminderAlertsState }) {
    const { items, openCount, dueCount, refresh } = alerts;
    const [open, setOpen] = useState(false);
    const [soundOn, setSoundOn] = useState<boolean>(isReminderSoundOn);
    const [busyId, setBusyId] = useState<string | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    const toggleSound = () => {
        const next = !soundOn;
        setSoundOn(next);
        setReminderSound(next);
    };

    const handleDone = async (id: string) => {
        setBusyId(id);
        try {
            await leadRemindersService.markDone(id);
            refresh();
        } catch (e: any) {
            alert(`Güncellenemedi: ${e.message}`);
        } finally {
            setBusyId(null);
        }
    };

    const goToChat = (phone: string | null | undefined) => {
        setOpen(false);
        const p = normalizePhone(phone);
        navigate(p ? `/admin/whatsapp-chat?phone=${encodeURIComponent(p)}` : '/admin/whatsapp-chat');
    };

    const hasBadge = openCount > 0;
    const danger = dueCount > 0;

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                title={hasBadge ? `${dueCount} gecikmiş / ${openCount} açık hatırlatma` : 'Hatırlatmalar'}
                aria-label="Hatırlatmalar"
                className={`relative inline-flex items-center justify-center p-1.5 rounded-md transition-colors cursor-pointer ${
                    danger ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                        : hasBadge ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
            >
                {danger ? <BellRing size={15} /> : <Bell size={15} />}
                {hasBadge && (
                    <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white ${danger ? 'bg-rose-500' : 'bg-amber-500'}`}>
                        {openCount > 99 ? '99+' : openCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    ref={popoverRef}
                    className="absolute left-0 top-full mt-1.5 z-40 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
                >
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                            Hatırlatmalar{dueCount > 0 && <span className="ml-1 text-rose-600">· {dueCount} gecikmiş</span>}
                        </p>
                        <button
                            onClick={toggleSound}
                            title={soundOn ? 'Bip sesi açık' : 'Bip sesi kapalı'}
                            className={`p-1 rounded transition-colors ${soundOn ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                            {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
                        </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-400">Açık hatırlatma yok</div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {items.slice(0, 12).map(r => {
                                    const overdue = isOverdue(r.remind_at);
                                    const name = r.lead?.customer_name || r.lead?.phone_number || 'İsimsiz';
                                    return (
                                        <li key={r.id} className={`px-3 py-2.5 ${overdue ? 'bg-rose-50/40' : ''}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[13px] font-medium text-slate-800 truncate">{name}</p>
                                                    <p className={`text-[11px] font-medium ${overdue ? 'text-rose-600' : 'text-slate-500'}`}>
                                                        {relativeReminderLabel(r.remind_at)} · {absoluteReminderLabel(r.remind_at)}
                                                    </p>
                                                    {r.note && <p className="text-[11px] text-slate-500 mt-0.5 break-words line-clamp-2">{r.note}</p>}
                                                </div>
                                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                                    <button
                                                        onClick={() => goToChat(r.lead?.phone_number)}
                                                        title="Sohbete git"
                                                        className="p-1 text-slate-400 hover:text-primary hover:bg-slate-100 rounded transition-colors"
                                                    >
                                                        <MessageSquare size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDone(r.id)}
                                                        disabled={busyId === r.id}
                                                        title="Tamamlandı"
                                                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-40"
                                                    >
                                                        {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <Link
                        to="/admin/reminders"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-center gap-1 px-3 py-2 border-t border-slate-100 text-[12px] font-semibold text-primary hover:bg-slate-50 transition-colors"
                    >
                        Tümünü gör <ArrowRight size={13} />
                    </Link>
                </div>
            )}
        </div>
    );
}
