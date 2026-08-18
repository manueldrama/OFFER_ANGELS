import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface OverflowItem {
    key: string;
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    danger?: boolean;
}

interface OfferOverflowMenuProps {
    items: OverflowItem[];
    /** Menü yukarı mı açılsın (aksiyon barı altta olduğunda). */
    openUp?: boolean;
}

/** ⋯ taşma menüsü — "Sil" gibi yıkıcı/ikincil aksiyonlar burada gizlenir. */
export const OfferOverflowMenu: React.FC<OfferOverflowMenuProps> = ({ items, openUp }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
                title="Daha fazla"
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
                <MoreHorizontal size={16} />
            </button>
            {open && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                        'absolute right-0 z-40 min-w-[180px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg',
                        openUp ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
                    )}
                >
                    {items.map((it, i) => (
                        <React.Fragment key={it.key}>
                            {it.danger && i > 0 && <div className="my-1 h-px bg-slate-100" />}
                            <button
                                onClick={() => { setOpen(false); it.onClick(); }}
                                className={cn(
                                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold transition-colors',
                                    it.danger
                                        ? 'text-red-600 hover:bg-red-50'
                                        : 'text-slate-700 hover:bg-slate-50',
                                )}
                            >
                                <it.icon size={14} className="shrink-0" />
                                {it.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};
