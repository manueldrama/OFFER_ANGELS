import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TASK_STATUS_META, isTaskOverdue } from '../../../types/hrTasks';
import type { HrTask } from '../../../types/hrTasks';

// Aylık takvim — kütüphanesiz, saf CSS grid (7 kolon). Görevler due_at'ın
// YEREL gününe kovalanır; tarihsiz görevler alt şeritte listelenir (takvimde
// kaybolup unutulmasınlar).

const DAY_HEADERS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MAX_PILLS = 3;

// STATUS_DOT paletiyle hizalı; waiting/cancelled eksikti → stilsiz kalıyordu.
const STATUS_PILL: Record<string, string> = {
    pending: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-violet-100 text-violet-700',
    waiting: 'bg-amber-100 text-amber-700',
    done: 'bg-orange-100 text-orange-700',
    approved: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-slate-100 text-slate-400 line-through',
};

function dateKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function TaskCalendar({ tasks, onTaskClick }: {
    tasks: HrTask[];
    onTaskClick: (task: HrTask) => void;
}) {
    const [cursor, setCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const { cells, byDay, undated } = useMemo(() => {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const firstDay = new Date(year, month, 1);
        // Pazartesi-başlangıçlı hafta: JS getDay() Pazar=0 → Pzt=0'a çevir.
        const lead = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells: (Date | null)[] = [
            ...Array.from({ length: lead }, () => null),
            ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
        ];
        while (cells.length % 7 !== 0) cells.push(null);

        const byDay = new Map<string, HrTask[]>();
        const undated: HrTask[] = [];
        for (const t of tasks) {
            if (!t.due_at) { undated.push(t); continue; }
            const k = dateKey(new Date(t.due_at));
            if (!byDay.has(k)) byDay.set(k, []);
            byDay.get(k)!.push(t);
        }
        return { cells, byDay, undated };
    }, [cursor, tasks]);

    const todayKey = dateKey(new Date());
    const monthLabel = cursor.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[14px] font-semibold text-slate-900 capitalize">{monthLabel}</p>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Önceki ay"
                    ><ChevronLeft size={15} /></button>
                    <button
                        onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }}
                        className="px-2.5 py-1 rounded-md text-[12px] font-semibold text-slate-500 hover:bg-slate-100"
                    >Bugün</button>
                    <button
                        onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Sonraki ay"
                    ><ChevronRight size={15} /></button>
                </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-100">
                {DAY_HEADERS.map(d => (
                    <div key={d} className="px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 text-center">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                    const dayTasks = day ? (byDay.get(dateKey(day)) ?? []) : [];
                    const isToday = day ? dateKey(day) === todayKey : false;
                    const isWeekend = i % 7 >= 5;
                    return (
                        <div key={i} className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 ${
                            !day ? 'bg-slate-50/50'
                                : isToday ? 'bg-sky-50/60 ring-1 ring-inset ring-sky-200'
                                : isWeekend ? 'bg-slate-50/40' : ''
                        }`}>
                            {day && (
                                <>
                                    <p className={`text-[11px] font-semibold mb-1 ${
                                        isToday
                                            ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-600 text-white'
                                            : 'text-slate-500'
                                    }`}>{day.getDate()}</p>
                                    <div className="space-y-0.5">
                                        {dayTasks.slice(0, MAX_PILLS).map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => onTaskClick(t)}
                                                title={`${t.title} · ${TASK_STATUS_META[t.status].label}`}
                                                className={`w-full text-left px-1.5 py-0.5 rounded text-[10.5px] font-medium truncate block cursor-pointer hover:opacity-80 ${
                                                    isTaskOverdue(t) ? 'bg-rose-100 text-rose-700' : STATUS_PILL[t.status]
                                                }`}
                                            >{t.title}</button>
                                        ))}
                                        {dayTasks.length > MAX_PILLS && (
                                            <p className="text-[10px] text-slate-400 px-1.5">+{dayTasks.length - MAX_PILLS} daha</p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {undated.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tarihsiz · {undated.length}</p>
                    <div className="flex flex-wrap gap-1.5">
                        {undated.slice(0, 8).map(t => (
                            <button key={t.id} onClick={() => onTaskClick(t)}
                                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer hover:opacity-80 ${STATUS_PILL[t.status]}`}>
                                {t.title}
                            </button>
                        ))}
                        {undated.length > 8 && <span className="text-[11px] text-slate-400">+{undated.length - 8}</span>}
                    </div>
                </div>
            )}
        </div>
    );
}
