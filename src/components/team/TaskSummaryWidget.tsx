import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { AuthContext } from '../auth/AuthProvider';
import { HrTaskService } from '../../services/admin/hr/hrTaskService';
import { useAdminRealtime } from '../../hooks/useAdminRealtime';
import { TaskDueLabel, TaskStatusChip } from '../admin/tasks/TaskStatusChip';
import { isTaskOverdue } from '../../types/hrTasks';
import type { HrTask } from '../../types/hrTasks';

// Özet sekmesindeki "Görevlerim" kutusu — 3 sayaç + yaklaşan ilk 3 görev.
// Yalnız overview sekmesi render edilirken mount olur. Poll yok ama realtime
// var: hr_tasks değişince tazelenir (silinen görev kutuda bayat kalmasın).

export function TaskSummaryWidget({ onOpenTasks }: { onOpenTasks: () => void }) {
    const { session } = useContext(AuthContext);
    const userId = session?.user?.id ?? null;
    const [tasks, setTasks] = useState<HrTask[]>([]);
    const [loaded, setLoaded] = useState(false);

    const load = useCallback(() => {
        if (!userId) return;
        HrTaskService.myTasks(userId)
            .then(setTasks)
            .catch(e => console.error('[TaskSummaryWidget] load error:', e))
            .finally(() => setLoaded(true));
    }, [userId]);

    useEffect(() => { load(); }, [load]);
    useAdminRealtime(userId ? ['hr_tasks'] : [], load);

    const open = useMemo(() => tasks.filter(t => t.status === 'pending' || t.status === 'in_progress'), [tasks]);
    const dueToday = useMemo(() => {
        const now = new Date();
        return open.filter(t => {
            if (!t.due_at) return false;
            const d = new Date(t.due_at);
            return d.getFullYear() === now.getFullYear()
                && d.getMonth() === now.getMonth()
                && d.getDate() === now.getDate();
        });
    }, [open]);
    const overdue = useMemo(() => open.filter(isTaskOverdue), [open]);
    const upcoming = useMemo(() => open.slice(0, 3), [open]);

    // Yüklenene kadar hiç çizilmez (bir anlık boş kutu titremesin); yüklendikten
    // sonra HER ZAMAN görünür. Eskiden görev yokken kutu tamamen gizleniyordu —
    // kullanıcı "widget görünmüyor" diye haklı şikayet etti: görünmeyen özellik
    // yok özelliktir.
    if (!loaded) return null;

    return (
        <section className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ClipboardList size={13} /> Görevlerim
                </p>
                <button
                    onClick={onOpenTasks}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline cursor-pointer"
                >
                    Tümü <ArrowRight size={12} />
                </button>
            </div>

            {tasks.length === 0 ? (
                <p className="text-[12.5px] text-slate-400">
                    Henüz göreviniz yok — kişisel görev eklemek için "Tümü"ne tıklayın.
                </p>
            ) : (
            <>
            <div className="grid grid-cols-3 gap-2 mb-1">
                <div className={`rounded-lg px-3 py-2.5 ${open.length > 0 ? 'bg-sky-50' : 'bg-slate-50'}`}>
                    <p className={`text-[20px] font-bold tabular-nums ${open.length > 0 ? 'text-sky-700' : 'text-slate-400'}`}>{open.length}</p>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Açık</p>
                </div>
                <div className={`rounded-lg px-3 py-2.5 ${dueToday.length > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <p className={`text-[20px] font-bold tabular-nums ${dueToday.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {dueToday.length}
                    </p>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Bugün Teslim</p>
                </div>
                <div className={`rounded-lg px-3 py-2.5 ${overdue.length > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                    <p className={`text-[20px] font-bold tabular-nums ${overdue.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {overdue.length}
                    </p>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Geciken</p>
                </div>
            </div>

            {upcoming.length > 0 && (
                <ul className="divide-y divide-slate-100 mt-2">
                    {upcoming.map(t => (
                        <li key={t.id}>
                            <button
                                onClick={onOpenTasks}
                                className="w-full text-left py-2 flex items-center gap-3 hover:bg-slate-50 rounded-lg px-1 transition-colors"
                            >
                                <span className="text-[13px] font-medium text-slate-800 truncate flex-1 min-w-0">{t.title}</span>
                                <TaskDueLabel task={t} />
                                <TaskStatusChip status={t.status} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            </>
            )}
        </section>
    );
}
