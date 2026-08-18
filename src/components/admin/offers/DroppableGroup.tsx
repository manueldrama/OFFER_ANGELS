import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { OfferGroupAccordion, type OfferGroupAccordionProps } from './OfferGroupAccordion';
import { isGroupDropTarget } from './offerGroups';

/**
 * OfferGroupAccordion'u @dnd-kit useDroppable ile sarar. Bırakma hedefi id = grup anahtarı.
 * Yalnız "net" gruplar (hot/warm/followup/new) hedeftir; diğerleri disabled.
 */
export const DroppableGroup: React.FC<OfferGroupAccordionProps> = (props) => {
    const dropTarget = isGroupDropTarget(props.groupKey);
    const { setNodeRef, isOver } = useDroppable({ id: props.groupKey, disabled: !dropTarget });

    return (
        <div ref={setNodeRef}>
            <OfferGroupAccordion {...props} isDropOver={dropTarget && isOver} sortable />
        </div>
    );
};
