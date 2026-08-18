import React, { useEffect } from 'react';
import { LucideIcon, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Native window.confirm() yerine geçen premium onay modalı.
 * Tek instance, callback tabanlı — ana sayfa bir confirm state'i tutar.
 */
type ConfirmTone = 'danger' | 'default';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
    /** İşlem sürerken true — butonlar kilitlenir, etiket "...yor" gösterir. */
    busy?: boolean;
    icon?: LucideIcon;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    description,
    confirmLabel = 'Onayla',
    cancelLabel = 'Vazgeç',
    tone = 'danger',
    busy = false,
    icon: Icon,
    onConfirm,
    onCancel,
}) => {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, busy, onCancel]);

    if (!isOpen) return null;

    const ToneIcon = Icon || AlertTriangle;
    const confirmBtn = tone === 'danger'
        ? 'bg-red-600 hover:bg-red-700'
        : 'bg-indigo-600 hover:bg-indigo-700';
    const iconWrap = tone === 'danger'
        ? 'bg-red-50 text-red-600'
        : 'bg-indigo-50 text-indigo-600';

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40"
            onClick={() => { if (!busy) onCancel(); }}
        >
            <div
                className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
            >
                <div className="flex items-start gap-3 mb-5">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', iconWrap)}>
                        <ToneIcon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-900">{title}</h3>
                        {description && (
                            <p className="text-sm text-slate-500 mt-1">{description}</p>
                        )}
                    </div>
                </div>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        className="px-4 py-2 text-sm font-medium text-slate-600 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={busy}
                        className={cn(
                            'px-4 py-2 text-sm font-semibold text-white rounded-md disabled:opacity-50 transition-colors',
                            confirmBtn,
                        )}
                    >
                        {busy ? 'İşleniyor…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
