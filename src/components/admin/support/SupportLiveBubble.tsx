// Global admin balonu — Canlı Destek. Her admin sayfasında sağ altta görünür;
// bekleyen konuşma sayısını gösterir, yeni konuşma gelince ses çalar, tıklayınca
// açık konuşmaları listeler → tıklanan sohbet /admin/support-live'da açılır.
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Headset, X, ChevronRight } from 'lucide-react';
import { SupportLiveService, SupportConversation } from '../../../services/admin/supportLiveService';
import { playPing } from '../../../lib/notificationSound';

const POLL_MS = 8000;

export const SupportLiveBubble: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [inbox, setInbox] = React.useState<SupportConversation[]>([]);
    const [open, setOpen] = React.useState(false);
    const seen = React.useRef<Set<string> | null>(null);

    const onLivePage = location.pathname.startsWith('/admin/support-live');

    const load = React.useCallback(() => {
        SupportLiveService.listInbox().then(({ conversations: rows }) => {
            const waitingIds = rows.filter((c) => c.needs_agent).map((c) => c.id);
            if (seen.current === null) {
                seen.current = new Set(waitingIds);
            } else {
                const fresh = waitingIds.some((id) => !seen.current!.has(id));
                seen.current = new Set(waitingIds);
                // Ses: support-live sayfası kendi sesini çalıyor → orada çalma (çift olmasın)
                if (fresh && !onLivePage && localStorage.getItem('cp_support_sound') !== 'off') playPing();
            }
            setInbox(rows);
        }).catch(() => {});
    }, [onLivePage]);

    React.useEffect(() => {
        load();
        const id = setInterval(load, POLL_MS);
        return () => clearInterval(id);
    }, [load]);

    // Tam sayfadayken balonu gizle (zaten orada yönetiliyor)
    if (onLivePage) return null;

    const waiting = inbox.filter((c) => c.needs_agent).length;
    const openCount = inbox.length;

    const goto = (id?: string) => {
        setOpen(false);
        navigate(id ? `/admin/support-live?c=${id}` : '/admin/support-live');
    };

    return (
        <>
            {/* Panel */}
            {open && (
                <div className="fixed z-40 w-[320px] max-h-[60vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden
                                bottom-[5.5rem] right-[10.5rem]
                                max-[640px]:bottom-[16rem] max-[640px]:right-4">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
                        <div className="flex items-center gap-2 text-sm font-semibold"><Headset size={16} /> Canlı Destek</div>
                        <button onClick={() => setOpen(false)} className="hover:bg-white/10 rounded-full p-1"><X size={16} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                        {inbox.length === 0 ? (
                            <div className="px-4 py-10 text-center text-sm text-slate-400">Açık konuşma yok</div>
                        ) : inbox.map((c) => (
                            <button key={c.id} onClick={() => goto(c.id)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-[13px] text-slate-800 truncate">{c.customer_name || 'Müşteri'}</span>
                                        {c.needs_agent && <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">BEKLİYOR</span>}
                                        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${c.mode === 'live' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{c.mode === 'live' ? 'CANLI' : 'BOT'}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{c.last_message_at ? new Date(c.last_message_at).toLocaleString('tr-TR') : ''}</div>
                                </div>
                                <ChevronRight size={15} className="text-slate-300 shrink-0" />
                            </button>
                        ))}
                    </div>
                    <button onClick={() => goto()} className="px-4 py-2.5 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 border-t border-slate-100 text-center">
                        Tümünü yönet →
                    </button>
                </div>
            )}

            {/* Balon */}
            <button
                onClick={() => setOpen((o) => !o)}
                aria-label="Canlı Destek"
                className="fixed z-40 flex items-center justify-center w-14 h-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/30 transition-all hover:scale-105 active:scale-95
                           bottom-6 right-[10.5rem]
                           max-[640px]:bottom-[10.5rem] max-[640px]:right-4"
            >
                <Headset size={24} strokeWidth={2.2} />
                {waiting > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white animate-pulse">
                        {waiting > 99 ? '99+' : waiting}
                    </span>
                ) : openCount > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
                        {openCount > 99 ? '99+' : openCount}
                    </span>
                ) : null}
            </button>
        </>
    );
};

export default SupportLiveBubble;
