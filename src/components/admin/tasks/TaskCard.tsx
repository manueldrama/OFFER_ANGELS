import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircle2, MessageSquare, Paperclip, CheckSquare } from 'lucide-react';
import { LabelChip } from './LabelPicker';
import { TaskDueLabel, TaskPriorityChip } from './TaskStatusChip';
import { TASK_PRIORITY_ACCENT, avatarColor } from '../../../types/hrTasks';
import type { HrTask } from '../../../types/hrTasks';

// Kanban kartı. useSortable ile sütun içinde sıralanır ve sütunlar arası
// taşınır (Offers.tsx DraggableOfferRow deseni). disabled: onaylanmış görev
// yalnız yönetici tarafından taşınabilir — asıl bekçi DB trigger'ı, bu UI
// nezaketi.
//
// Görsel dil (Asana kart anatomisi): proje rengi + etiketler üstte, başlık,
// altta son tarih / öncelik / sayaç ikonları / avatar; sol kenar öncelik
// aksanı; hover'da hafif yükselme.

function initials(name: string | null | undefined): string {
    if (!name) return '?';
    return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toLocaleUpperCase('tr');
}

export function TaskCardBody({ task, showAssignee }: { task: HrTask; showAssignee: boolean }) {
    const assigneeName = task.assignee?.full_name || task.assignee?.email;
    const itemsTotal = task.items?.length ?? 0;
    const itemsDone = task.items?.filter(i => i.is_done).length ?? 0;
    const accent = TASK_PRIORITY_ACCENT[task.priority];

    return (
        <div className={`bg-white rounded-lg border border-slate-200 px-2.5 py-2.5 transition-all hover:border-slate-300 hover:shadow-sm ${accent ?? ''}`}>
            {(task.project || task.labels.length > 0) && (
                <div className="flex flex-wrap items-center gap-1 mb-1.5">
                    {task.project && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.project.color }} />
                            {task.project.name}
                        </span>
                    )}
                    {task.labels.map(l => <LabelChip key={l} label={l} />)}
                </div>
            )}
            <p className="text-[13px] font-medium text-slate-800 break-words">
                {task.status === 'approved' && <CheckCircle2 size={12} className="inline mr-1 text-emerald-600" />}
                {task.title}
            </p>

            {itemsTotal > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="h-1 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${itemsDone === itemsTotal ? 'bg-emerald-500' : 'bg-sky-500'}`}
                            style={{ width: `${(itemsDone / itemsTotal) * 100}%` }}
                        />
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400 tabular-nums">
                        <CheckSquare size={10} /> {itemsDone}/{itemsTotal}
                    </span>
                </div>
            )}

            <div className="flex items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <TaskDueLabel task={task} />
                    <TaskPriorityChip priority={task.priority} />
                    {(task.comments_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-slate-400">
                            <MessageSquare size={10} /> {task.comments_count}
                        </span>
                    )}
                    {(task.attachments_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-slate-400">
                            <Paperclip size={10} /> {task.attachments_count}
                        </span>
                    )}
                </div>
                {showAssignee && (
                    <span
                        title={assigneeName || ''}
                        className={`w-6 h-6 rounded-full text-white text-[10px] font-bold inline-flex items-center justify-center shrink-0 ${avatarColor(assigneeName || '?')}`}
                    >
                        {initials(assigneeName)}
                    </span>
                )}
            </div>
        </div>
    );
}

export function TaskCard({ task, showAssignee, disabled, onClick }: {
    task: HrTask;
    showAssignee: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
        disabled,
    });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`cursor-pointer touch-none ${isDragging ? 'opacity-40' : ''}`}
        >
            <TaskCardBody task={task} showAssignee={showAssignee} />
        </div>
    );
}
