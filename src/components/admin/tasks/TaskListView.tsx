import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, ListTodo, Loader2, MessageSquare, Paperclip } from 'lucide-react';
import { Chip } from '../../../pages/admin/hr/_shared';
import { LabelChip } from './LabelPicker';
import {
    STATUS_DOT, TASK_PRIORITY_META, TASK_STATUS_META,
    avatarColor, isTaskOpen, isTaskOverdue,
} from '../../../types/hrTasks';
import type { HrTask, TaskGroupBy, TaskPriority, TaskStatus } from '../../../types/hrTasks';

// Liste görünümü — MOCKUP DÜZENİ: renkli noktalı bölüm başlıkları
// ("● Yapılacak 2") altında gerçek tablo kolonları:
// GÖREV | ATANAN | SON TARİH | ÖNCELİK | DURUM.
// Görev hücresi: durum-checkbox (○ tıkla=Tamamla) + başlık + çipler +
// checklist ilerleme rozeti. Gruplama modları aynı tabloyu kullanır.

const STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'waiting', 'done', 'approved', 'cancelled'];
const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

interface Section {
    key: string;
    label: string;
    status?: TaskStatus;
    rows: HrTask[];
    startCollapsed?: boolean;
}

function isToday(iso: string): boolean {
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function initials(name: string): string {
    return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toLocaleUpperCase('tr');
}

/** "27 Ağu 19:57" / "Bugün 18:00"; bugün+geciken kırmızı. */
function dueCell(t: HrTask): React.ReactNode {
    if (!t.due_at) return <span className="text-[12.5px] text-slate-300">—</span>;
    const d = new Date(t.due_at);
    const hm = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const today = isToday(t.due_at);
    const overdue = isTaskOverdue(t);
    const label = today
        ? `Bugün ${hm}`
        : `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}${hm !== '00:00' ? ` ${hm}` : ''}`;
    return (
        <span className={`text-[12.5px] font-medium tabular-nums ${overdue || today ? 'text-rose-600' : 'text-slate-600'}`}>
            {label}
        </span>
    );
}

function buildSections(tasks: HrTask[], groupBy: TaskGroupBy): Section[] {
    const sorted = [...tasks].sort((a, b) => a.board_position - b.board_position);

    if (groupBy === 'date') {
        const open = sorted.filter(isTaskOpen);
        return [
            { key: 'overdue', label: 'Geciken', status: 'done', rows: open.filter(isTaskOverdue) },
            { key: 'today', label: 'Bugün', status: 'waiting', rows: open.filter(t => t.due_at && isToday(t.due_at) && !isTaskOverdue(t)) },
            { key: 'upcoming', label: 'Yaklaşan', status: 'pending', rows: open.filter(t => t.due_at && !isToday(t.due_at) && !isTaskOverdue(t)) },
            { key: 'nodate', label: 'Tarihsiz', status: 'cancelled', rows: open.filter(t => !t.due_at) },
            { key: 'closed', label: 'Kapanan', status: 'approved', rows: sorted.filter(t => !isTaskOpen(t)), startCollapsed: true },
        ];
    }
    if (groupBy === 'priority') {
        return PRIORITY_ORDER.map(p => ({ key: p, label: TASK_PRIORITY_META[p].label, rows: sorted.filter(t => t.priority === p) }));
    }
    if (groupBy === 'project') {
        const map = new Map<string, Section>();
        for (const t of sorted) {
            const key = t.project?.id ?? 'none';
            if (!map.has(key)) map.set(key, { key, label: t.project?.name ?? 'Projesiz', rows: [] });
            map.get(key)!.rows.push(t);
        }
        return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'tr'));
    }
    if (groupBy === 'assignee') {
        const map = new Map<string, Section>();
        for (const t of sorted) {
            const key = t.assigned_to;
            if (!map.has(key)) map.set(key, { key, label: t.assignee?.full_name || t.assignee?.email || '—', rows: [] });
            map.get(key)!.rows.push(t);
        }
        return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'tr'));
    }
    return STATUS_ORDER.map(s => ({
        key: s, label: TASK_STATUS_META[s].label, status: s,
        rows: sorted.filter(t => t.status === s),
        startCollapsed: s === 'cancelled',
    }));
}

export function TaskListView({ tasks, showAssignee, groupBy = 'status', onRowClick, onComplete, completingId }: {
    tasks: HrTask[];
    showAssignee: boolean;
    groupBy?: TaskGroupBy;
    onRowClick: (task: HrTask) => void;
    /** ○ checkbox — açık görevi Tamamla'ya (done) taşır. */
    onComplete: (task: HrTask) => void;
    completingId?: string | null;
}) {
    const sections = useMemo(() => buildSections(tasks, groupBy).filter(s => s.rows.length > 0), [tasks, groupBy]);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    if (tasks.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <ListTodo size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[13px] text-slate-400">Bu filtrelerde görev yok</p>
            </div>
        );
    }

    const colCount = showAssignee ? 5 : 4;

    return (
        <div className="space-y-5">
            {sections.map(section => {
                const dot = section.status ? STATUS_DOT[section.status] : { dot: 'bg-slate-400', text: 'text-slate-700' };
                const cKey = `${groupBy}:${section.key}`;
                const isCollapsed = collapsed[cKey] ?? section.startCollapsed ?? false;
                return (
                    <div key={section.key}>
                        {/* Bölüm başlığı — nokta + ad + gri sayı (mockup) */}
                        <button
                            onClick={() => setCollapsed(prev => ({ ...prev, [cKey]: !isCollapsed }))}
                            className="flex items-center gap-2 mb-1.5 px-1 cursor-pointer group"
                        >
                            <span className={`w-2 h-2 rounded-sm ${dot.dot}`} />
                            <span className="text-[13.5px] font-bold text-slate-900 group-hover:text-slate-600 transition-colors">
                                {section.label}
                            </span>
                            <span className="text-[12px] font-semibold text-slate-400 tabular-nums">{section.rows.length}</span>
                        </button>

                        {!isCollapsed && (
                            <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
                                <table className="w-full min-w-[720px]">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="text-left px-4 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Görev</th>
                                            {showAssignee && <th className="text-left px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 w-[160px]">Atanan</th>}
                                            <th className="text-left px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 w-[130px]">Son Tarih</th>
                                            <th className="text-left px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 w-[100px]">Öncelik</th>
                                            <th className="text-left px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 w-[130px]">Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {section.rows.map(t => {
                                            const open = isTaskOpen(t);
                                            const sDot = STATUS_DOT[t.status];
                                            const assigneeName = t.assignee?.full_name || t.assignee?.email || '—';
                                            const itemsTotal = t.items?.length ?? 0;
                                            const itemsDone = t.items?.filter(i => i.is_done).length ?? 0;
                                            return (
                                                <tr
                                                    key={t.id}
                                                    onClick={() => onRowClick(t)}
                                                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                                                >
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <button
                                                                onClick={e => { e.stopPropagation(); if (open) onComplete(t); }}
                                                                disabled={!open || completingId === t.id}
                                                                title={open ? 'Tamamla' : undefined}
                                                                className={`shrink-0 ${open ? 'text-slate-300 hover:text-emerald-600 cursor-pointer' : 'text-emerald-500'}`}
                                                                aria-label={open ? `${t.title} görevini tamamla` : t.title}
                                                            >
                                                                {completingId === t.id
                                                                    ? <Loader2 size={16} className="animate-spin" />
                                                                    : open ? <Circle size={16} /> : <CheckCircle2 size={16} />}
                                                            </button>
                                                            <span className={`text-[13px] font-semibold truncate ${open ? 'text-slate-900' : 'text-slate-500'}`}>
                                                                {t.title}
                                                            </span>
                                                            {t.project && (
                                                                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 shrink-0">
                                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.project.color }} />
                                                                    {t.project.name}
                                                                </span>
                                                            )}
                                                            {t.labels.slice(0, 3).map(l => <LabelChip key={l} label={l} />)}
                                                            {itemsTotal > 0 && (
                                                                <span className="text-[10.5px] font-semibold text-slate-400 shrink-0 tabular-nums">≡ {itemsDone}/{itemsTotal}</span>
                                                            )}
                                                            {(t.comments_count ?? 0) > 0 && (
                                                                <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-slate-400 shrink-0">
                                                                    <MessageSquare size={10} /> {t.comments_count}
                                                                </span>
                                                            )}
                                                            {(t.attachments_count ?? 0) > 0 && (
                                                                <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-slate-400 shrink-0">
                                                                    <Paperclip size={10} /> {t.attachments_count}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {showAssignee && (
                                                        <td className="px-3 py-2.5">
                                                            <span className="inline-flex items-center gap-1.5 min-w-0">
                                                                <span className={`w-6 h-6 rounded-full text-white text-[9.5px] font-bold inline-flex items-center justify-center shrink-0 ${avatarColor(assigneeName)}`}>
                                                                    {initials(assigneeName)}
                                                                </span>
                                                                <span className="text-[12.5px] text-slate-600 truncate">{assigneeName}</span>
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2.5">{dueCell(t)}</td>
                                                    <td className="px-3 py-2.5"><Chip meta={TASK_PRIORITY_META[t.priority]} /></td>
                                                    <td className="px-3 py-2.5">
                                                        <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${sDot.text}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${sDot.dot}`} />
                                                            {TASK_STATUS_META[t.status].label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {section.rows.length === 0 && (
                                            <tr><td colSpan={colCount} className="px-4 py-4 text-center text-[12px] text-slate-400">Görev yok</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
