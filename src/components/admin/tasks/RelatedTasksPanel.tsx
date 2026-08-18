import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Circle, Loader2 } from 'lucide-react';
import { AuthContext } from '../../auth/AuthProvider';
import { HrTaskService } from '../../../services/admin/hr/hrTaskService';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRealtime } from '../../../hooks/useAdminRealtime';
import { TaskDueLabel } from './TaskStatusChip';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import { ContextTaskButton, type TaskContext } from './ContextTaskButton';
import { avatarColor, isTaskOpen } from '../../../types/hrTasks';
import type { HrTask } from '../../../types/hrTasks';

// İLİŞKİLİ GÖREVLER PANELİ — bir varlığın (lead/WhatsApp/servis) yanında
// duran görev listesi (spec §28/§30): açık görevler checkbox'la OLDUĞU
// EKRANDAN tamamlanır, detay çekmece olarak üstte açılır (sayfa değişmez,
// bağlam korunur — spec §32), altta bağlamsal "+ Görev".
//
// RLS notu: temsilci burada yalnız kendi görebildiği görevleri görür
// (hr_task_links parent-türevli SELECT) — sayı "ekibin tümü" iddiası taşımaz.

function initials(name: string | null | undefined): string {
    if (!name) return '?';
    return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toLocaleUpperCase('tr');
}

export function RelatedTasksPanel({ context, variant = 'card', maxRows = 6 }: {
    context: TaskContext;
    /** 'card' = beyaz çerçeveli bölüm; 'plain' = çerçevesiz (popover içine gömülür). */
    variant?: 'card' | 'plain';
    maxRows?: number;
}) {
    const { session, role } = useContext(AuthContext);
    const toast = useToast();
    const canManage = !!role && role !== 'employee';
    const currentUserId = session?.user?.id ?? null;

    const [tasks, setTasks] = useState<HrTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [showClosed, setShowClosed] = useState(false);
    const [detailId, setDetailId] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(() => {
        HrTaskService.listTasksForEntity(context.entityType, context.entityId)
            .then(setTasks)
            .catch(e => console.error('[RelatedTasksPanel] load error:', e))
            .finally(() => setLoading(false));
    }, [context.entityType, context.entityId]);

    useEffect(() => { load(); }, [load]);
    useAdminRealtime(['hr_tasks'], load);

    const open = useMemo(() => tasks.filter(isTaskOpen), [tasks]);
    const closed = useMemo(() => tasks.filter(t => !isTaskOpen(t)), [tasks]);
    const detailTask = useMemo(() => tasks.find(t => t.id === detailId) ?? null, [tasks, detailId]);

    const complete = async (t: HrTask) => {
        setBusyId(t.id);
        try {
            await HrTaskService.setStatus(t.id, 'done');
            load();
        } catch (e: any) {
            toast.error(e?.message || 'Tamamlanamadı');
        } finally {
            setBusyId(null);
        }
    };

    const row = (t: HrTask, isOpen: boolean) => {
        const assigneeName = t.assignee?.full_name || t.assignee?.email;
        return (
            <li key={t.id} className="flex items-center gap-2 py-1.5 group">
                <button
                    onClick={() => isOpen && void complete(t)}
                    disabled={!isOpen || busyId === t.id}
                    title={isOpen ? 'Tamamla' : undefined}
                    className={`shrink-0 ${isOpen ? 'text-slate-300 hover:text-emerald-600 cursor-pointer' : 'text-emerald-600'}`}
                    aria-label={isOpen ? `${t.title} görevini tamamla` : t.title}
                >
                    {busyId === t.id
                        ? <Loader2 size={15} className="animate-spin" />
                        : isOpen ? <Circle size={15} /> : <CheckCircle2 size={15} />}
                </button>
                <button
                    onClick={() => setDetailId(t.id)}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                >
                    <span className={`block text-[12.5px] font-medium truncate ${isOpen ? 'text-slate-800 group-hover:text-slate-900' : 'text-slate-400 line-through'}`}>
                        {t.title}
                    </span>
                </button>
                {isOpen && <TaskDueLabel task={t} />}
                <span
                    title={assigneeName || ''}
                    className={`w-5 h-5 rounded-full text-white text-[9px] font-bold inline-flex items-center justify-center shrink-0 ${avatarColor(assigneeName || '?')}`}
                >
                    {initials(assigneeName)}
                </span>
            </li>
        );
    };

    const body = (
        <>
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ClipboardList size={12} /> Görevler
                    {open.length > 0 && (
                        <span className="min-w-[18px] h-[16px] px-1 inline-flex items-center justify-center rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold tabular-nums">
                            {open.length}
                        </span>
                    )}
                </p>
                <ContextTaskButton context={context} variant="compact" onCreated={() => load()} />
            </div>

            {loading ? (
                <div className="py-3 flex justify-center"><Loader2 size={14} className="animate-spin text-slate-400" /></div>
            ) : (
                <>
                    {open.length === 0 && closed.length === 0 && (
                        <p className="text-[12px] text-slate-400 py-2">Bağlı görev yok</p>
                    )}
                    <ul className="divide-y divide-slate-100 mt-1">
                        {open.slice(0, maxRows).map(t => row(t, true))}
                    </ul>
                    {open.length > maxRows && (
                        <p className="text-[11px] text-slate-400 mt-1">+{open.length - maxRows} açık görev daha</p>
                    )}
                    {closed.length > 0 && (
                        <div className="mt-1">
                            <button
                                onClick={() => setShowClosed(v => !v)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                {showClosed ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                Kapananlar · {closed.length}
                            </button>
                            {showClosed && (
                                <ul className="divide-y divide-slate-100">
                                    {closed.slice(0, maxRows).map(t => row(t, false))}
                                </ul>
                            )}
                        </div>
                    )}
                </>
            )}

            {detailTask && (
                <TaskDetailDrawer
                    task={detailTask}
                    canManage={canManage}
                    currentUserId={currentUserId}
                    onClose={() => setDetailId(null)}
                    onChanged={() => load()}
                    onDeleted={() => load()}
                />
            )}
        </>
    );

    if (variant === 'plain') return <div>{body}</div>;
    return <div className="bg-white rounded-xl border border-slate-200 p-4">{body}</div>;
}
