import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TASK_STATUS_ACCENT, TASK_STATUS_META } from '../../../types/hrTasks';
import { TaskCard } from './TaskCard';
import type { HrTask, TaskStatus } from '../../../types/hrTasks';

// Kanban sütunu — useDroppable(id=status) + SortableContext (Offers.tsx
// DroppableGroup deseni). droppable=false (personelde approved sütunu):
// sütun GÖRÜNÜR ama bırakma hedefi olarak kayıt edilmez; kartları da
// sürüklenemez. Asıl bekçi yine DB trigger'ı.
//
// Renk kimliği TASK_STATUS_ACCENT'ten (tek kaynak): üst şerit + renkli
// başlık pill'i + renkli sayaç + duruma tonlu sütun zemini.

export function BoardColumn({ status, tasks, showAssignee, canManage, droppable, onCardClick }: {
    status: TaskStatus;
    tasks: HrTask[];
    showAssignee: boolean;
    canManage: boolean;
    droppable: boolean;
    onCardClick: (task: HrTask) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !droppable });
    const meta = TASK_STATUS_META[status];
    const accent = TASK_STATUS_ACCENT[status];

    return (
        <div className="flex flex-col min-w-[250px] w-[270px] shrink-0">
            <div className={`h-[2px] rounded-t-full ${accent.bar}`} />
            <div className="flex items-center justify-between px-1.5 py-1.5">
                <span className={`h-6 inline-flex items-center px-2 rounded-md text-[11.5px] font-semibold ${accent.headerBg}`}>
                    {meta.label}
                </span>
                <span className={`min-w-[22px] h-[18px] px-1.5 inline-flex items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums ${accent.countBg}`}>
                    {tasks.length}
                </span>
            </div>
            <div
                ref={setNodeRef}
                className={`flex-1 rounded-xl p-2 space-y-2 min-h-[140px] transition-all ${
                    isOver && droppable
                        ? 'bg-sky-100/70 ring-2 ring-sky-300 ring-offset-1'
                        : accent.columnBg
                }`}
            >
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map(t => (
                        <TaskCard
                            key={t.id}
                            task={t}
                            showAssignee={showAssignee}
                            disabled={t.status === 'approved' && !canManage}
                            onClick={() => onCardClick(t)}
                        />
                    ))}
                </SortableContext>
                {tasks.length === 0 && (
                    <div className="py-8 text-center">
                        <p className="text-[11.5px] text-slate-400">
                            {droppable ? 'Kart buraya bırakılabilir' : 'Görev yok'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
