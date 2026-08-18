import React from 'react';
import { Trash2, X } from 'lucide-react';

interface Props {
    count: number;
    onDelete: () => void;
    onClear: () => void;
}

/**
 * Seçim yapılınca beliren toplu aksiyon barı.
 *
 * Teklif Linkleri'ndeki karşılığı marka gradientli; burada mockup'un düz dili
 * korunuyor (slate-900 dolgu, gölge yok) — sayfa içinde tek görsel dil kalsın.
 *
 * Seçim SAYFA kapsamlıdır: sayfalar arası "tümünü seç" bilinçli olarak yoktur,
 * çünkü 700+ id ile .in() sorgusu sessizce boş döner.
 */
export const OrdersBulkBar: React.FC<Props> = ({ count, onDelete, onClear }) => (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 text-white border-b border-slate-900">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="rounded-md bg-white/15 px-2 py-0.5 tabular-nums">{count}</span>
            sipariş seçildi
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/20 cursor-pointer"
            >
                <Trash2 size={13} />Sil
            </button>
            <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10 cursor-pointer"
            >
                <X size={13} />Seçimi temizle
            </button>
        </div>
    </div>
);
