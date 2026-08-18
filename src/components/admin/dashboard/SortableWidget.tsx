import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableWidgetProps {
    id: string;
    isEditMode: boolean;
    className?: string;
    onHide?: () => void;
    children: React.ReactNode;
}

export function SortableWidget({ id, isEditMode, className, onHide, children }: SortableWidgetProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id, disabled: !isEditMode });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'relative',
                isEditMode && 'ring-2 ring-dashed ring-indigo-300 rounded-xl',
                isDragging && 'ring-indigo-500',
                className,
            )}
        >
            {isEditMode && (
                <>
                    <button
                        {...attributes}
                        {...listeners}
                        className="absolute -top-2 -left-2 z-10 w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing hover:bg-indigo-700 transition-colors"
                        aria-label="Sürükle"
                    >
                        <GripVertical size={14} />
                    </button>
                    {onHide && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onHide(); }}
                            className="absolute -top-2 -right-2 z-10 w-7 h-7 bg-red-500 text-white rounded-lg flex items-center justify-center shadow-md cursor-pointer hover:bg-red-600 transition-colors"
                            aria-label="Modülü Gizle"
                            title="Modülü Gizle"
                        >
                            <X size={14} />
                        </button>
                    )}
                </>
            )}
            {children}
        </div>
    );
}
