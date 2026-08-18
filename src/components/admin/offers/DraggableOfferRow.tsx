import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { OfferLinkRow, type OfferLinkRowProps } from './OfferLinkRow';

interface DraggableOfferRowProps extends OfferLinkRowProps {
    /** Sürükleme kapalıysa (pasif link) tutamaç gizlenir, kart sabit kalır. */
    disabled?: boolean;
}

/**
 * OfferLinkRow'u @dnd-kit useSortable ile sarar — hook'lar satır başına çağrılsın diye
 * ayrı bileşen. Sıralanabilir id = offer token; grup içinde yeniden sıralama (reorder)
 * ve gruplar arası bırakma (durum değişimi) aynı sortable ile yürür. data.group ile
 * handleDragEnd kaynak grubu çözer.
 */
export const DraggableOfferRow: React.FC<DraggableOfferRowProps> = ({ disabled, ...rowProps }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: rowProps.offer.token,
        disabled,
        data: { leadId: rowProps.offer.lead_id, group: rowProps.derived.group },
    });

    return (
        <OfferLinkRow
            {...rowProps}
            dndSetNodeRef={setNodeRef}
            dndStyle={{
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                transition,
            }}
            dndHandleProps={disabled ? undefined : { attributes, listeners }}
            isDragging={isDragging}
        />
    );
};
