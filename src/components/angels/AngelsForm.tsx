// Dark-surface form primitives for the CAFEPASTE Angels acceptance + venue
// request forms. Kept self-contained (not the light shadcn Input) so the
// premium dark invitation mood stays intact while still feeling native to the
// brand. Uses the Angels palette (A) from AngelsShell.

import React, { useRef, useState } from 'react';
import { Upload, X, Check, Loader2 } from 'lucide-react';
import { A } from './AngelsShell';
import { AngelsService } from '../../services/angels/angelsService';

export function AngelsLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
    return (
        <label
            className="block font-semibold mb-2"
            style={{ fontSize: 13, letterSpacing: '0.02em', color: A.textSecondary }}
        >
            {children}
            {optional && (
                <span style={{ color: A.textGhost, fontWeight: 400, marginLeft: 6 }}>optional</span>
            )}
        </label>
    );
}

const inputStyle: React.CSSProperties = {
    background: A.surface,
    border: `1px solid ${A.border}`,
    color: A.text,
    borderRadius: 10,
    padding: '13px 15px',
    fontSize: 15,
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
};

function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = A.red;
    e.currentTarget.style.boxShadow = `0 0 0 3px ${A.redSoft}`;
}
function focusOff(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = A.border;
    e.currentTarget.style.boxShadow = 'none';
}

export function AngelsInput({
    value,
    onChange,
    placeholder,
    type = 'text',
    prefix,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    prefix?: string;
}) {
    if (prefix) {
        return (
            <div className="flex items-stretch" style={{ ...inputStyle, padding: 0, overflow: 'hidden' }}>
                <span
                    className="inline-flex items-center"
                    style={{ padding: '0 4px 0 15px', color: A.textMuted, fontSize: 15 }}
                >
                    {prefix}
                </span>
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: A.text,
                        fontSize: 15,
                        padding: '13px 15px 13px 0',
                        flex: 1,
                        outline: 'none',
                    }}
                />
            </div>
        );
    }
    return (
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={inputStyle}
            onFocus={focusOn}
            onBlur={focusOff}
        />
    );
}

export function AngelsTextarea({
    value,
    onChange,
    placeholder,
    rows = 4,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    rows?: number;
}) {
    return (
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
            onFocus={focusOn}
            onBlur={focusOff}
        />
    );
}

/** Multi-select chips for collaboration categories. */
export function CategoryPicker({
    options,
    selected,
    onToggle,
}: {
    options: readonly string[];
    selected: string[];
    onToggle: (value: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2.5">
            {options.map(opt => {
                const on = selected.includes(opt);
                return (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onToggle(opt)}
                        className="inline-flex items-center gap-1.5 font-medium transition-all duration-150"
                        style={{
                            fontSize: 13.5,
                            padding: '8px 14px',
                            borderRadius: 9999,
                            border: `1px solid ${on ? A.red : A.border}`,
                            background: on ? A.redSoft : 'transparent',
                            color: on ? '#FFFFFF' : A.textSecondary,
                            cursor: 'pointer',
                        }}
                    >
                        {on && <Check size={13} />}
                        {opt}
                    </button>
                );
            })}
        </div>
    );
}

/** Single profile image upload (square preview). Copy overrides come from the
 *  admin-editable form_copy section (translations); defaults stay EN. */
export function ProfileImageUploader({
    value,
    onChange,
    copy,
}: {
    value: string | null;
    onChange: (url: string | null) => void;
    copy?: { title?: string; hint?: string; uploadError?: string };
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function handleFile(file: File | undefined) {
        if (!file) return;
        setErr(null);
        setBusy(true);
        try {
            const url = await AngelsService.uploadImage(file);
            onChange(url);
        } catch (e: any) {
            console.error('[angels] profile upload failed', e);
            setErr(copy?.uploadError || 'Upload failed. Please try again.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex items-center gap-4">
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="relative shrink-0 flex items-center justify-center overflow-hidden"
                style={{
                    width: 92,
                    height: 92,
                    borderRadius: 16,
                    border: `1px solid ${value ? A.red : A.border}`,
                    background: A.surface,
                    cursor: 'pointer',
                }}
            >
                {value ? (
                    <img src={value} alt="Profile" className="w-full h-full object-cover" />
                ) : busy ? (
                    <Loader2 size={22} className="animate-spin" style={{ color: A.textMuted }} />
                ) : (
                    <Upload size={22} style={{ color: A.textMuted }} />
                )}
            </button>
            <div className="text-sm" style={{ color: A.textMuted }}>
                <p style={{ color: A.textSecondary, fontWeight: 600, marginBottom: 2 }}>{copy?.title || 'Profile photo'}</p>
                <p style={{ fontSize: 12.5 }}>{copy?.hint || 'A clear portrait works best.'}</p>
                {err && <p style={{ color: A.red, fontSize: 12.5, marginTop: 4 }}>{err}</p>}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0])}
            />
        </div>
    );
}

/** Multi-image gallery upload with previews + remove. */
export function GalleryUploader({
    images,
    onChange,
    max = 8,
    copy,
}: {
    images: string[];
    onChange: (urls: string[]) => void;
    max?: number;
    copy?: { addLabel?: string; uploadError?: string };
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function handleFiles(files: FileList | null) {
        if (!files || files.length === 0) return;
        setErr(null);
        setBusy(true);
        try {
            const remaining = max - images.length;
            const slice = Array.from(files).slice(0, remaining);
            const urls: string[] = [];
            for (const f of slice) {
                urls.push(await AngelsService.uploadImage(f));
            }
            onChange([...images, ...urls]);
        } catch (e: any) {
            console.error('[angels] gallery upload failed', e);
            setErr(copy?.uploadError || 'Some photos failed to upload. Please try again.');
        } finally {
            setBusy(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    }

    return (
        <div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {images.map((url, i) => (
                    <div
                        key={url + i}
                        className="relative overflow-hidden group"
                        style={{ aspectRatio: '1', borderRadius: 12, border: `1px solid ${A.border}` }}
                    >
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                            type="button"
                            onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                            className="absolute top-1.5 right-1.5 inline-flex items-center justify-center"
                            style={{
                                width: 24,
                                height: 24,
                                borderRadius: 9999,
                                background: 'rgba(0,0,0,0.65)',
                                color: '#fff',
                                cursor: 'pointer',
                            }}
                            aria-label="Remove photo"
                        >
                            <X size={13} />
                        </button>
                    </div>
                ))}
                {images.length < max && (
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-1.5"
                        style={{
                            aspectRatio: '1',
                            borderRadius: 12,
                            border: `1px dashed ${A.borderStrong}`,
                            background: A.surface,
                            color: A.textMuted,
                            cursor: 'pointer',
                        }}
                    >
                        {busy ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                        <span style={{ fontSize: 11.5 }}>{copy?.addLabel || 'Add'}</span>
                    </button>
                )}
            </div>
            <p style={{ color: A.textGhost, fontSize: 12, marginTop: 8 }}>
                {images.length}/{max} photos
            </p>
            {err && <p style={{ color: A.red, fontSize: 12.5, marginTop: 4 }}>{err}</p>}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
            />
        </div>
    );
}

/** A labelled field wrapper. */
export function Field({
    label,
    optional,
    children,
}: {
    label: string;
    optional?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div>
            <AngelsLabel optional={optional}>{label}</AngelsLabel>
            {children}
        </div>
    );
}
