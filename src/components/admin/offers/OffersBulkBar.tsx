import React from 'react';
import { Trash2, X } from 'lucide-react';

interface OffersBulkBarProps {
    count: number;
    onDelete: () => void;
    onClear: () => void;
}

/** Seçim yapılınca beliren sticky mor toplu aksiyon barı. */
export const OffersBulkBar: React.FC<OffersBulkBarProps> = ({ count, onDelete, onClear }) => (
    <div
        className="sticky top-0 z-30 flex items-center gap-3 rounded-2xl px-4 py-2.5 text-white"
        style={{
            background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-700))',
            boxShadow: 'var(--shadow-brand)',
            animation: 'cpDrop .2s ease',
        }}
    >
        <div className="flex items-center gap-2 text-[13px] font-bold">
            <span className="rounded-lg bg-white/20 px-2.5 py-0.5 tabular-nums">{count}</span>
            link seçildi
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/15 px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-white/25"
            >
                <Trash2 size={13} />Seçili {count} Sil
            </button>
            <button
                onClick={onClear}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-white/15"
            >
                <X size={13} />Seçimi temizle
            </button>
        </div>
    </div>
);
