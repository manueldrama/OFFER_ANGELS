import { useEffect, useState } from 'react';
import { PhoneOff, PhoneMissed, Clock, ThumbsDown, Trophy, StickyNote, History } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';

interface EventRow {
    id: string;
    event_type: string;
    metadata: any;
    created_at: string;
}

const EVENT_TYPES = ['call_logged', 'call_outcome', 'call_snooze', 'call_note'];

/** Olay satırını okunur etikete + ikona çevirir. */
function describe(ev: EventRow): { icon: typeof History; label: string; tone: string; detail?: string } {
    const m = ev.metadata || {};
    if (ev.event_type === 'call_logged') {
        return m.outcome === 'no_answer'
            ? { icon: PhoneMissed, label: 'Cevapsız arama', tone: 'text-amber-500', detail: m.note || undefined }
            : { icon: PhoneOff, label: 'Ulaşıldı', tone: 'text-emerald-600', detail: m.note || undefined };
    }
    if (ev.event_type === 'call_outcome') {
        if (m.outcome === 'won') return { icon: Trophy, label: 'Kazanıldı', tone: 'text-green-700', detail: m.note || undefined };
        return { icon: ThumbsDown, label: 'İlgilenmiyor', tone: 'text-rose-600', detail: m.reason ? `Neden: ${m.reason}` : (m.note || undefined) };
    }
    if (ev.event_type === 'call_snooze') {
        return { icon: Clock, label: 'Sonraya ertelendi', tone: 'text-indigo-500', detail: m.until ? `→ ${fmtDate(m.until)}` : undefined };
    }
    return { icon: StickyNote, label: 'Not', tone: 'text-slate-500', detail: m.note || undefined };
}

function fmtDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function rel(iso: string): string {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    if (h < 1) return 'az önce';
    if (h < 24) return `${h} saat önce`;
    return `${Math.floor(h / 24)} gün önce`;
}

/** Lead'in son arama/sonuç/erteleme/not olaylarını okunur mini zaman çizelgesi. */
export function FollowUpTimeline({ leadId }: { leadId: string }) {
    const [rows, setRows] = useState<EventRow[] | null>(null);

    useEffect(() => {
        let alive = true;
        setRows(null);
        (async () => {
            const { data } = await supabase
                .from('lead_events')
                .select('id, event_type, metadata, created_at')
                .eq('lead_id', leadId)
                .in('event_type', EVENT_TYPES)
                .order('created_at', { ascending: false })
                .limit(8);
            if (alive) setRows((data || []) as EventRow[]);
        })();
        return () => { alive = false; };
    }, [leadId]);

    if (rows !== null && rows.length === 0) return null; // takip geçmişi yoksa gösterme

    return (
        <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2.5">
                <History size={14} className="text-slate-400" />
                <span className="text-[13px] font-semibold text-slate-700">Takip geçmişi</span>
            </div>
            <div className="p-3">
                {rows === null ? (
                    <p className="px-1 py-2 text-[12px] text-slate-400">Yükleniyor…</p>
                ) : (
                    <ol className="space-y-2.5">
                        {rows.map((ev) => {
                            const { icon: Icon, label, tone, detail } = describe(ev);
                            return (
                                <li key={ev.id} className="flex items-start gap-2.5">
                                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-50">
                                        <Icon size={13} className={tone} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-[13px] font-medium text-slate-700">{label}</span>
                                            <span className="shrink-0 text-[11px] text-slate-400">{rel(ev.created_at)}</span>
                                        </div>
                                        {detail && <p className="truncate text-[12px] text-slate-500">{detail}</p>}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>
        </div>
    );
}
