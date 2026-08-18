import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { isEditModeRequested } from '../../hooks/editModeFlag';

interface Props {
    /** Supabase table name (e.g. 'products', 'product_detail_sections', 'offer_experiences') */
    table: string;
    /** Row id */
    rowId: string;
    /** Column name to update */
    field: string;
    /** Current rendered value */
    value: string | null | undefined;
    tag?: keyof React.JSX.IntrinsicElements;
    className?: string;
    style?: React.CSSProperties;
    /** Optional: also clear a localStorage prefix on save (e.g. `cafepaste_landing_data_`) */
    cacheClearPrefix?: string;
}

/**
 * Inline-editable text bound to an arbitrary Supabase table column.
 * Self-contained: gates on admin auth + ?edit=true sessionStorage flag.
 *
 * Use for product names, descriptions, subtitles — anything stored as a
 * single column in any table where the row id is known at render time.
 */
export function EditableTableText({ table, rowId, field, value, tag = 'span', className = '', style, cacheClearPrefix }: Props) {
    const { isAdmin } = useIsAdmin();
    const ref = useRef<HTMLElement>(null);
    const [saving, setSaving] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);
    const editMode = isAdmin && isEditModeRequested();
    const safe = value ?? '';

    useEffect(() => {
        if (ref.current) ref.current.textContent = safe;
    }, [safe]);

    if (!editMode) {
        const Tag = tag as any;
        return <Tag className={className} style={style}>{safe}</Tag>;
    }

    const handleBlur = async (e: React.FocusEvent) => {
        const newValue = (e.currentTarget as HTMLElement).innerText;
        if (newValue === safe || saving) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from(table)
                .update({ [field]: newValue, updated_at: new Date().toISOString() })
                .eq('id', rowId);
            if (error) throw error;
            if (cacheClearPrefix) {
                try {
                    Object.keys(localStorage).forEach(k => {
                        if (k.startsWith(cacheClearPrefix)) localStorage.removeItem(k);
                    });
                } catch { /* ignore */ }
            }
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1200);
        } catch (err: any) {
            console.error('[EditableTableText] save failed:', err?.message || err);
        } finally {
            setSaving(false);
        }
    };

    const Tag = tag as any;
    const editClass = `${className} outline-none transition-shadow ${savedFlash ? 'ring-2 ring-emerald-400/60 rounded' : 'hover:ring-2 hover:ring-indigo-400/40 hover:rounded focus:ring-2 focus:ring-indigo-500 focus:rounded'}`;
    return (
        <Tag
            ref={ref}
            className={editClass}
            style={style}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
            spellCheck={false}
            data-table={table}
            data-row={rowId}
            data-field={field}
        >
            {safe}
        </Tag>
    );
}
