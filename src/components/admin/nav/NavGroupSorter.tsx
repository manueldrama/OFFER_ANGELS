import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Lock } from 'lucide-react';
import type { NavGroup } from './navConfig';

type Props = {
    /** İzin filtresinden geçmiş, MEVCUT sıradaki gruplar. */
    groups: NavGroup[];
    onReorder: (orderedKeys: string[]) => void;
};

function SortableRow({ group }: { group: NavGroup }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: group.key,
    });
    const Icon = group.icon;

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border bg-white select-none ${
                isDragging
                    ? 'border-slate-400 shadow-lg z-10 relative'
                    : 'border-slate-200 hover:border-slate-300'
            }`}
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={`${group.label} sırasını değiştir`}
                className="shrink-0 p-0.5 -m-0.5 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing touch-none"
            >
                <GripVertical size={15} />
            </button>
            <Icon size={16} className="shrink-0 text-slate-500" />
            <span className="flex-1 min-w-0 text-left text-[11px] font-semibold uppercase tracking-[0.6px] text-slate-700 truncate">
                {group.label}
            </span>
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold tabular-nums">
                {group.items.length}
            </span>
        </div>
    );
}

/**
 * Menü düzenleme modu — ana kategorilerin sırasını sürükleyerek değiştirir.
 *
 * Normal menüyü "sürüklenebilir" yapmak yerine AYRI bir liste render edilir.
 * Gezinme menüsü sürekli tıklanan bir yüzey; aynı yüzeye sürükleme bindirmek
 * kazara sıra bozulmasına yol açar. Ayrıca burada gruplar kapalı ve satırlar
 * gizli olduğu için 15 kategori tek ekranda durur, sürüklemek kolaylaşır.
 *
 * Kök grup (Kontrol Paneli / Canlı İzleme) listeye HİÇ girmez — sabittir.
 */
export function NavGroupSorter({ groups, onReorder }: Props) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor)
    );

    const pinned = groups.filter((g) => g.label === null);
    const sortable = groups.filter((g) => g.label !== null);
    const keys = sortable.map((g) => g.key);

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = keys.indexOf(String(active.id));
        const newIndex = keys.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1) return;
        onReorder(arrayMove(keys, oldIndex, newIndex));
    }

    return (
        <div className="space-y-1.5">
            {pinned.map((group) => (
                <div
                    key={group.key}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60"
                    title="Kontrol Paneli her zaman en üstte kalır"
                >
                    <Lock size={13} className="shrink-0 text-slate-300" />
                    <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.6px] text-slate-400">
                        Genel
                    </span>
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[11px] font-semibold tabular-nums">
                        {group.items.length}
                    </span>
                </div>
            ))}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={keys} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                        {sortable.map((group) => (
                            <SortableRow key={group.key} group={group} />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}
