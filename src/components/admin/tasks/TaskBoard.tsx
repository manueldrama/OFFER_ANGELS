import { useMemo, useState } from 'react';
import {
    DndContext, DragOverlay, PointerSensor, closestCorners,
    useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { TaskCardBody } from './TaskCard';
import { BoardColumn } from './BoardColumn';
import type { HrTask, TaskStatus } from '../../../types/hrTasks';

// Kanban panosu — Offers.tsx'in çapraz-konteyner deseninin görev hâli:
// DndContext(closestCorners) + DragOverlay; sütun useDroppable, kart
// useSortable. Bırakma tek yerde (onDragEnd) yazılır; canlı önizleme
// karmaşasına girilmez, kart bırakınca yerine oturur.
//
// Konum matematiği: sütun içi sıra board_position (double) ile tutulur;
// araya bırakmada komşuların ORTALAMASI yazılır. Float hassasiyeti bu
// ölçekte tükenmez; gerekirse ileride bir yeniden-numaralama geçişi eklenir.

// İptal panoda kolon DEĞİL (kapanmış iş sürüklenmez); listede "Tümü"nde görünür.
const COLUMNS: TaskStatus[] = ['pending', 'in_progress', 'waiting', 'done', 'approved'];

/** Personelin durum makinesi (DB trigger'ıyla birebir) — UI ön kontrolü. */
function employeeCanMove(from: TaskStatus, to: TaskStatus): boolean {
    if (from === to) return true;
    const openSet = ['pending', 'in_progress', 'waiting'];
    if (openSet.includes(from)) return openSet.includes(to) || to === 'done';
    if (from === 'done') return to === 'in_progress';
    return false; // approved/cancelled'dan çıkış yönetici işi
}

export function TaskBoard({ tasks, canManage, showAssignee, onCardClick, onMove }: {
    tasks: HrTask[];
    canManage: boolean;
    showAssignee: boolean;
    onCardClick: (task: HrTask) => void;
    /** Optimistic güncelleme + servis yazımı + hata geri-alması ebeveynde. */
    onMove: (taskId: string, patch: { status?: TaskStatus; board_position?: number }) => void;
}) {
    const [activeTask, setActiveTask] = useState<HrTask | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    );

    const byColumn = useMemo(() => {
        const map: Record<TaskStatus, HrTask[]> = {
            pending: [], in_progress: [], done: [], approved: [],
        };
        for (const t of tasks) map[t.status]?.push(t);
        for (const col of COLUMNS) map[col].sort((a, b) => a.board_position - b.board_position);
        return map;
    }, [tasks]);

    const handleDragStart = (e: DragStartEvent) => {
        setActiveTask(tasks.find(t => t.id === e.active.id) ?? null);
    };

    const handleDragEnd = (e: DragEndEvent) => {
        const dragged = activeTask;
        setActiveTask(null);
        const { over } = e;
        if (!dragged || !over || over.id === dragged.id) return;

        // Hedef sütun: boş sütuna bırakıldıysa over.id = status; karta
        // bırakıldıysa o kartın sütunu.
        const overId = String(over.id);
        const overTask = COLUMNS.includes(overId as TaskStatus)
            ? null
            : tasks.find(t => t.id === overId) ?? null;
        const targetStatus: TaskStatus = overTask ? overTask.status : (overId as TaskStatus);

        if (!canManage && !employeeCanMove(dragged.status, targetStatus)) return;

        // Sürüklenen hariç hedef sütun listesi; kartın ÜSTÜNE bırakma = o
        // kartın önüne girme.
        const column = byColumn[targetStatus].filter(t => t.id !== dragged.id);
        let position: number;
        if (!overTask) {
            position = column.length > 0
                ? column[column.length - 1].board_position + 1000
                : Date.now() / 1000;
        } else {
            const idx = column.findIndex(t => t.id === overTask.id);
            const prev = idx > 0 ? column[idx - 1].board_position : null;
            const next = column[idx].board_position;
            position = prev == null ? next - 1000 : (prev + next) / 2;
        }

        onMove(dragged.id, {
            ...(targetStatus !== dragged.status ? { status: targetStatus } : {}),
            board_position: position,
        });
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveTask(null)}
        >
            <div className="flex gap-3 overflow-x-auto pb-3">
                {COLUMNS.map(status => (
                    <BoardColumn
                        key={status}
                        status={status}
                        tasks={byColumn[status]}
                        showAssignee={showAssignee}
                        canManage={canManage}
                        droppable={canManage || (status !== 'approved' && !!activeTask && employeeCanMove(activeTask.status, status))}
                        onCardClick={onCardClick}
                    />
                ))}
            </div>
            <DragOverlay>
                {activeTask && (
                    <div className="w-[244px] rotate-2 shadow-xl">
                        <TaskCardBody task={activeTask} showAssignee={showAssignee} />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
}
