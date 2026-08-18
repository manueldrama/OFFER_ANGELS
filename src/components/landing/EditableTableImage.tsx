import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { isEditModeRequested } from '../../hooks/editModeFlag';
import { LandingImagePickerModal } from './LandingImagePickerModal';

interface Props {
    table: string;
    rowId: string;
    field: string;
    src: string | null | undefined;
    alt?: string;
    className?: string;
    style?: React.CSSProperties;
    acceptVideo?: boolean;
}

/**
 * Inline-editable image bound to an arbitrary Supabase table column.
 * Opens the LandingImagePickerModal (gallery / upload / URL) on click in edit mode,
 * then saves the chosen URL to `table.field` for the given row id.
 */
export function EditableTableImage({ table, rowId, field, src, alt = '', className = '', style, acceptVideo }: Props) {
    const { isAdmin } = useIsAdmin();
    const [pickerOpen, setPickerOpen] = useState(false);
    const editMode = isAdmin && isEditModeRequested();
    const isVideo = !!src && /\.(mp4|webm|mov)(\?|$)/i.test(src);

    const renderMedia = () => (
        isVideo
            ? <video src={src || ''} className={className} style={style} muted autoPlay loop playsInline />
            : <img src={src || ''} alt={alt} className={className} style={style} />
    );

    if (!editMode) return renderMedia();

    const handleSelect = async (url: string) => {
        try {
            const { error } = await supabase
                .from(table)
                .update({ [field]: url, updated_at: new Date().toISOString() })
                .eq('id', rowId);
            if (error) throw error;
            setPickerOpen(false);
            // Quick reflect — reload to fetch fresh row
            window.location.reload();
        } catch (err: any) {
            console.error('[EditableTableImage] save failed:', err?.message || err);
        }
    };

    return (
        <>
            <div className="relative group">
                {renderMedia()}
                <div
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-inherit"
                    onClick={() => setPickerOpen(true)}
                >
                    <div className="flex flex-col items-center gap-1 text-white">
                        <Camera size={20} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Değiştir</span>
                    </div>
                </div>
            </div>
            <LandingImagePickerModal
                open={pickerOpen}
                initialUrl={src}
                acceptVideo={acceptVideo}
                onClose={() => setPickerOpen(false)}
                onSelect={handleSelect}
            />
        </>
    );
}
