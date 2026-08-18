import React, { useEffect, useRef, useState } from 'react';
import { StickyNote, Check, X, Loader2, Pencil, Plus } from 'lucide-react';
import type { LeadNote } from '../../../services/admin/leadsService';
import { formatDateTime } from '../../../hooks/useAppSettings';
import { cn } from '../../../lib/utils';

interface LeadNoteInlineProps {
    leadId: string;
    /** Bu lead'in en son oluşturulan kullanıcı notu (yoksa undefined/null). */
    note: LeadNote | null | undefined;
    /**
     * Notu kaydeder. noteId dolu → güncelle, null → yeni not ekle.
     * Parent (Offers) toplu state'i tazeler.
     */
    onSave: (leadId: string, noteId: string | null, content: string) => Promise<void>;
}

/**
 * Teklif satırı KAPALIYKEN orta boşlukta görünen, satır içi düzenlenebilir
 * "en son müşteri notu" özeti. Tıklama satırı açmaz (stopPropagation); boşken
 * "Not ekle" çağrısı gösterir. framer-motion yerine hafif CSS geçişi kullanır.
 */
export const LeadNoteInline: React.FC<LeadNoteInlineProps> = ({ leadId, note, onSave }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const taRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (editing) {
            setDraft(note?.note_content ?? '');
            // odaklan + imleci sona al
            requestAnimationFrame(() => {
                const el = taRef.current;
                if (el) {
                    el.focus();
                    el.setSelectionRange(el.value.length, el.value.length);
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing]);

    const startEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditing(true);
    };
    const cancel = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditing(false);
        setDraft('');
    };

    const save = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const content = draft.trim();
        if (!content || saving) return;
        // İçerik değişmediyse boşuna kaydetme.
        if (note && content === note.note_content) {
            setEditing(false);
            return;
        }
        setSaving(true);
        try {
            await onSave(leadId, note?.id ?? null, content);
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        e.stopPropagation();
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            save();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    };

    // ── Düzenleme modu ──
    if (editing) {
        return (
            <div
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 rounded-lg border border-brand-200 bg-white p-2 shadow-sm"
            >
                <textarea
                    ref={taRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={2}
                    placeholder="Bu müşteriyle ilgili bir not yazın…"
                    className="w-full resize-none rounded-md border-0 bg-transparent px-1 py-0.5 text-[12px] leading-snug text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
                <div className="mt-1 flex items-center justify-end gap-1">
                    <span className="mr-auto text-[9.5px] text-slate-400">⌘/Ctrl + Enter</span>
                    <button
                        onClick={cancel}
                        className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        title="Vazgeç"
                        aria-label="Vazgeç"
                    >
                        <X size={14} />
                    </button>
                    <button
                        onClick={save}
                        disabled={saving || !draft.trim()}
                        className="grid h-6 w-6 place-items-center rounded-md bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                        title="Kaydet"
                        aria-label="Kaydet"
                    >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                    </button>
                </div>
            </div>
        );
    }

    // ── Boş durum (henüz not yok) ──
    if (!note) {
        return (
            <button
                type="button"
                onClick={startEdit}
                className="group/note flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-400 transition-colors hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600"
                title="Not ekle"
            >
                <Plus size={12} className="shrink-0" />
                <span className="truncate">Not ekle</span>
            </button>
        );
    }

    // ── Dolu özet (tıkla → düzenle) ──
    return (
        <button
            type="button"
            onClick={startEdit}
            className={cn(
                'group/note flex min-w-0 flex-1 items-start gap-1.5 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 text-left transition-colors',
                'hover:border-brand-200 hover:bg-brand-50/50',
            )}
            title={`${note.note_content}\n\n${formatDateTime(note.created_at)} · düzenlemek için tıkla`}
        >
            <StickyNote size={12} className="mt-[1px] shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-medium leading-tight text-slate-700">
                    {note.note_content}
                </span>
                <span className="mt-0.5 block truncate text-[9.5px] text-slate-400">
                    {formatDateTime(note.created_at)}
                </span>
            </span>
            <Pencil
                size={11}
                className="mt-[1px] shrink-0 text-slate-300 opacity-0 transition-opacity group-hover/note:opacity-100"
            />
        </button>
    );
};
