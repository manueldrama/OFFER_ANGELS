import React from 'react';
import { Link } from 'react-router-dom';
import { formatTime } from '../../../../hooks/useAppSettings';
import { useLiveActivityFeed } from '../../../../hooks/useLiveActivityFeed';
import { eventLabel, eventDotColor } from '../../../../lib/activityEvents';
import { WidgetState } from '../WidgetState';

/**
 * Son Sistem Olayları — artık kendi kendine GERÇEK ANLIK güncellenir.
 * useLiveActivityFeed lead_events realtime aboneliğiyle yeni olayları tepeye
 * düşürür; üstte "şu an aktif" sayacı gösterilir. Detay için /admin/live.
 */
export function ActivityWidget() {
    const { feed, liveNow, error } = useLiveActivityFeed({ limit: 12 });

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:p-6 flex flex-col h-full" style={{ maxHeight: 420 }}>
            <div className="flex items-center justify-between mb-3 shrink-0">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Son Sistem Olayları</h3>
                <Link to="/admin/live" className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors min-h-[44px] flex items-center">
                    Tümünü Gör →
                </Link>
            </div>

            {liveNow.length > 0 && (
                <div className="flex items-center gap-2 mb-3 shrink-0 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700">
                        Şu an aktif: {liveNow.length} müşteri
                    </span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                {feed.map((event) => (
                    <div key={event.id} className="flex gap-3 items-start px-3 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-colors cursor-default min-h-[52px]">
                        <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${eventDotColor(event.event_type)}`} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-700 truncate">{event.customer_name || 'Bilinmiyor'}</p>
                                <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                    {formatTime(event.created_at)}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{eventLabel(event.event_type)}</p>
                        </div>
                    </div>
                ))}
                {feed.length === 0 && (
                    error
                        ? <WidgetState kind="error" detail={error} />
                        : <div className="text-center py-12 text-slate-400 text-sm">Yakın zamanda kayıtlı olay yok.</div>
                )}
            </div>
        </div>
    );
}
