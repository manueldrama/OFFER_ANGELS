import React from 'react';
import { useEditor } from './EditorContext';
import { FIELDS, type EditorFieldId } from './schema/fields';

interface EditableProps {
    id: EditorFieldId;
    /** Optional presentation override; defaults to content[id]. */
    children?: React.ReactNode;
    as?: 'span' | 'div';
    className?: string;
    multiline?: boolean;
}

/**
 * Wraps any text node so it can be hovered/selected as an editable field.
 * Hover shows ✎ label; click opens the floating popover (handled in OfferExperienceEditor).
 */
export function Editable({ id, children, as = 'span', className, multiline }: EditableProps) {
    const ed = useEditor();
    const meta = FIELDS[id];
    const isHover = ed.hovered === id;
    const isActive = ed.active === id;
    const dirty = !!ed.dirtyMap[id];

    const value = ed.content[id] ?? '';
    const Tag = as;

    const outline = isActive
        ? 'outline outline-2 outline-indigo-600'
        : isHover
            ? 'outline outline-2 outline-dashed outline-indigo-400/60'
            : dirty
                ? 'outline outline-[1.5px] outline-dashed outline-orange-600/70'
                : 'outline outline-2 outline-transparent';

    return (
        <Tag
            data-edit-id={id}
            onMouseEnter={() => ed.setHovered(id)}
            onMouseLeave={() => ed.setHovered(null)}
            onClick={(e) => {
                e.stopPropagation();
                ed.setActive(id);
            }}
            className={[
                'relative cursor-text rounded-[4px] outline-offset-2 transition-[outline-color] duration-100',
                multiline ? 'block' : 'inline',
                outline,
                className ?? '',
            ].join(' ')}
        >
            {children ?? value}
            {dirty && !isActive && (
                <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-orange-600 ring-2 ring-white" />
            )}
            {isHover && !isActive && (
                <span
                    className="absolute -top-2.5 left-0 z-20 pointer-events-none whitespace-nowrap rounded-[4px] bg-indigo-600 px-1.5 py-[2px] text-[10px] font-medium text-white"
                    style={{ letterSpacing: '.02em' }}
                >
                    ✎ {meta.label}
                </span>
            )}
        </Tag>
    );
}
