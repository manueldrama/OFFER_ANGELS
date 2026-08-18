import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { LandingImagePickerModal } from './LandingImagePickerModal';

interface EditableImageProps {
    src: string | null | undefined;
    sectionType: string;
    fieldKey: string;
    onUpdate: (sectionType: string, fieldKey: string, value: string) => void;
    editMode: boolean;
    className?: string;
    style?: React.CSSProperties;
    alt?: string;
    acceptVideo?: boolean;
    /** Video için poster (thumbnail) — siyah kare yerine ilk frame görünür. */
    posterUrl?: string;
    /** loading attribute (img için). Default lazy; hero / above-fold için 'eager' geçilebilir. */
    loading?: 'eager' | 'lazy';
    fetchPriority?: 'high' | 'low' | 'auto';
}

export function EditableImage({ src, sectionType, fieldKey, onUpdate, editMode, className = '', style, alt = '', acceptVideo, posterUrl, loading = 'lazy', fetchPriority }: EditableImageProps) {
    const [pickerOpen, setPickerOpen] = useState(false);

    const isVideo = !!src && /\.(mp4|webm|mov)(\?|$)/i.test(src);

    const renderMedia = () => (
        isVideo
            ? (
                <video
                    src={src || ''}
                    className={className}
                    style={style}
                    muted
                    autoPlay
                    loop
                    playsInline
                    preload="metadata"
                    poster={posterUrl || undefined}
                />
            )
            : (
                <img
                    src={src || ''}
                    alt={alt}
                    className={className}
                    style={style}
                    loading={loading}
                    fetchPriority={fetchPriority}
                    decoding="async"
                />
            )
    );

    if (!editMode) {
        return renderMedia();
    }

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
                onSelect={(url) => {
                    onUpdate(sectionType, fieldKey, url);
                    setPickerOpen(false);
                }}
            />
        </>
    );
}
