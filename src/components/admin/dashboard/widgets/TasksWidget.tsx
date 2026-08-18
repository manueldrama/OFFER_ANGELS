import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, SquareKanban } from 'lucide-react';
import { HrTaskService } from '../../../../services/admin/hr/hrTaskService';
import { useAdminRealtime } from '../../../../hooks/useAdminRealtime';
import { TaskDueLabel, TaskStatusChip } from '../../tasks/TaskStatusChip';
import { isTaskOverdue } from '../../../../types/hrTasks';
import { withBase } from '../../nav/navConfig';
import { usePanelBase } from '../../../../contexts/PanelBaseContext';
import { WidgetState } from '../WidgetState';
import type { HrTask } from '../../../../types/hrTasks';

// Ana pano görev widget'ı — DashboardGrid VE SalesDashboard'da aynı bileşen
// (RemindersWidget çift-kullanım deseni). Poll YOK ama realtime VAR:
// hr_tasks değişince (atama/silme/durum) widget kendini tazeler — "sildim
// ama hâlâ duruyor" bayatlığı yaşanmaz. Silme event'i yalnız tetikleyicidir;
// veri her seferinde RLS altında yeniden çekilir.

const MAX_ROWS = 6;

export function TasksWidget() {
    const base = usePanelBase();
    const [tasks, setTasks] = useState<HrTask[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        HrTaskService.listTasks({ status: 'all' })
            .then(rows => { setTasks(rows); setError(null); })
            .catch(e => {
                // Eskiden hata yalnızca konsola gidiyordu; kullanıcı "Açık görev yok"
                // görüyordu. Sıfır görev ile görevleri okuyamamak aynı şey değil.
                console.error('[TasksWidget] load error:', e);
                setError(e?.message || 'Bilinmeyen hata');
                setTasks([]);
            })
            .finally(() => setLoaded(true));
    }, []);

    useEffect(() => { load(); }, [load]);
    // Canlı: görev eklendi/silindi/taşındı → 500ms debounce ile tazele.
    useAdminRealtime(['hr_tasks'], load);

    const open = useMemo(() => tasks.filter(t => t.status === 'pending' || t.status === 'in_progress'), [tasks]);
    const awaitingApproval = useMemo(() => tasks.filter(t => t.status === 'done'), [tasks]);
    const overdue = useMemo(() => open.filter(isTaskOverdue), [open]);

    // Önce onay bekleyenler (yöneticinin işi), sonra son tarihi en yakın açıklar.
    const rows = useMemo(() => {
        const openSorted = [...open].sort((a, b) => {
            if (!a.due_at) return 1;
            if (!b.due_at) return -1;
            return a.due_at.localeCompare(b.due_at);
        });
        return [...awaitingApproval, ...openSorted].slice(0, MAX_ROWS);
    }, [awaitingApproval, open]);

    const tasksPath = withBase('/admin/tasks', base);

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <SquareKanban size={13} /> Görevler
                </p>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className={`rounded-lg px-2.5 py-2 ${awaitingApproval.length > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <p className={`text-[17px] font-bold tabular-nums ${awaitingApproval.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {awaitingApproval.length}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Onay Bekleyen</p>
                </div>
                <div className={`rounded-lg px-2.5 py-2 ${overdue.length > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                    <p className={`text-[17px] font-bold tabular-nums ${overdue.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {overdue.length}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Geciken</p>
                </div>
                <div className={`rounded-lg px-2.5 py-2 ${open.length > 0 ? 'bg-sky-50' : 'bg-slate-50'}`}>
                    <p className={`text-[17px] font-bold tabular-nums ${open.length > 0 ? 'text-sky-600' : 'text-slate-400'}`}>
                        {open.length}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Açık</p>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                {!loaded ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map(i => <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />)}
                    </div>
                ) : error ? (
                    <WidgetState kind="error" detail={error} onRetry={() => { setLoaded(false); load(); }} />
                ) : rows.length === 0 ? (
                    <p className="text-[12.5px] text-slate-400 py-4 text-center">Açık görev yok</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {rows.map(t => (
                            <li key={t.id}>
                                <Link
                                    to={tasksPath}
                                    className="flex items-center gap-2.5 py-2 hover:bg-slate-50 rounded-lg px-1 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12.5px] font-medium text-slate-800 truncate">{t.title}</p>
                                        <p className="text-[10.5px] text-slate-400 truncate">
                                            {t.assignee?.full_name || t.assignee?.email || '—'}
                                            {t.project && ` · ${t.project.name}`}
                                        </p>
                                    </div>
                                    <TaskDueLabel task={t} />
                                    <TaskStatusChip status={t.status} />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Link
                to={tasksPath}
                className="flex items-center justify-center gap-1 pt-2.5 mt-2 border-t border-slate-100 text-[12px] font-semibold text-primary hover:underline"
            >
                Görev panosunu aç <ArrowRight size={12} />
            </Link>
        </div>
    );
}
