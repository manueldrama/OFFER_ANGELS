import { RotateCcw, BellRing, CalendarX, Check } from 'lucide-react';
import type { WinbackQueueItem } from '../../../services/admin/callAssistantService';
import { WINBACK_BUCKET_META, WINBACK_STATUS_META } from '../../../lib/winbackScore';

interface WinbackQueueRailProps {
    items: WinbackQueueItem[];
    currentIndex: number;
    onSelect: (index: number) => void;
}

/** Geri Kazanım sırasının mini listesi — şans skoru (kova renkli) + takip/süre rozetleri. */
export function WinbackQueueRail({ items, currentIndex, onSelect }: WinbackQueueRailProps) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                    <RotateCcw size={14} className="text-violet-500" />
                    Geri Kazanım Sırası
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {items.length}
                </span>
            </div>

            <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
                {items.map((item, i) => {
                    const active = i === currentIndex;
                    const bucket = WINBACK_BUCKET_META[item.bucket];
                    const expired = !!item.candidate.offerValidUntil
                        && new Date(item.candidate.offerValidUntil).getTime() < Date.now();
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
                                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${active ? 'text-violet-300' : 'text-violet-600'}`}>
                                        %{item.score} şans
                                    </span>
                                    {item.reminderDue && (
                                        <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${active ? 'text-amber-300' : 'text-amber-600'}`}>
                                            <BellRing size={10} /> hatırlatma
                                        </span>
                                    )}
                                    {expired && (
                                        <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${active ? 'text-rose-300' : 'text-rose-500'}`}>
                                            <CalendarX size={10} /> süresi geçti
                                        </span>
                                    )}
                                    {item.winbackStatus && (
                                        <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${active ? 'text-emerald-300' : 'text-emerald-600'}`}>
                                            <Check size={10} /> {WINBACK_STATUS_META[item.winbackStatus].label}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {!active && (
                                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${bucket.tone}`}>
                                    {bucket.label}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
