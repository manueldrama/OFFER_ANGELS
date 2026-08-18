import { Flame, Clock, PhoneCall, MessageCircle, BellRing, PhoneMissed } from 'lucide-react';
import type { CallQueueItem } from '../../../services/admin/callAssistantService';
import { leadStatusLabel, leadStatusColor } from '../../../lib/leadStatus';

interface CallQueueRailProps {
    items: CallQueueItem[];
    currentIndex: number;
    onSelect: (index: number) => void;
}

/** Sıradaki müşterilerin mini listesi — seçili olan vurgulu, tıkla→o kişiye geç. */
export function CallQueueRail({ items, currentIndex, onSelect }: CallQueueRailProps) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                    <PhoneCall size={14} className="text-indigo-500" />
                    Arama Sırası
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {items.length}
                </span>
            </div>

            <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
                {items.map((item, i) => {
                    const active = i === currentIndex;
                    const d = item.derived;
                    return (
                        <button
                            key={item.leadId}
                            onClick={() => onSelect(i)}
                            className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
                                active ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                            }`}
                        >
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums ${
                                active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {i + 1}
                            </span>

                            <div className="min-w-0 flex-1">
                                <p className={`truncate text-[13px] font-semibold ${active ? 'text-white' : 'text-slate-800'}`}>
                                    {item.customerName}
                                </p>
                                <div className="mt-0.5 flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${active ? 'text-white/70' : 'text-slate-400'}`}>
                                        <Flame size={11} className={active ? 'text-amber-300' : 'text-amber-500'} />
                                        {item.rankScore}
                                    </span>
                                    {item.reminderDue && (
                                        <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${active ? 'text-amber-300' : 'text-amber-600'}`}>
                                            <BellRing size={10} /> hatırlatma
                                        </span>
                                    )}
                                    {item.waAwaitingReply && (
                                        <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${active ? 'text-green-300' : 'text-green-600'}`}>
                                            <MessageCircle size={10} /> yazdı
                                        </span>
                                    )}
                                    {(item.callInfo?.noAnswerCount ?? 0) >= 2 && (
                                        <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${active ? 'text-rose-300' : 'text-rose-500'}`}>
                                            <PhoneMissed size={10} /> {item.callInfo!.noAnswerCount}× cevapsız
                                        </span>
                                    )}
                                    {item.cooled && (
                                        <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${active ? 'text-white/60' : 'text-slate-400'}`}>
                                            <Clock size={10} /> arandı
                                        </span>
                                    )}
                                </div>
                            </div>

                            {!active && (
                                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${leadStatusColor(d.status)}`}>
                                    {leadStatusLabel(d.status)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
