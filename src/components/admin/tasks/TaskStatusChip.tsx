import { Chip, formatDateTR } from '../../../pages/admin/hr/_shared';
import {
    TASK_PRIORITY_META, TASK_STATUS_META, isTaskOverdue,
} from '../../../types/hrTasks';
import type { HrTask, TaskPriority, TaskStatus } from '../../../types/hrTasks';

// Görev çipleri — İK yüzeyinin Chip/ChipMeta dilini kullanır ki görev
// ekranları bordro/izin ekranlarıyla aynı ürüne ait görünsün.

export function TaskStatusChip({ status }: { status: TaskStatus }) {
    return <Chip meta={TASK_STATUS_META[status]} />;
}

export function TaskPriorityChip({ priority }: { priority: TaskPriority }) {
    // 'normal' çip basılmaz: her satırda tekrar eden etiket gürültüdür,
    // yalnız normalden sapma dikkat çekmeli.
    if (priority === 'normal') return null;
    return <Chip meta={TASK_PRIORITY_META[priority]} />;
}

/** Son tarih etiketi — geciken görevde kırmızı. */
export function TaskDueLabel({ task }: { task: Pick<HrTask, 'due_at' | 'status'> }) {
    if (!task.due_at) return <span className="text-[12px] text-slate-400">—</span>;
    const overdue = isTaskOverdue(task);
    const dt = new Date(task.due_at);
    const time = dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    return (
        <span className={`text-[12px] font-medium ${overdue ? 'text-rose-600' : 'text-slate-600'}`}>
            {formatDateTR(task.due_at)} {time}
            {overdue && <span className="ml-1 font-semibold">· Gecikti</span>}
        </span>
    );
}
