import React from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { OfferLink } from '../../../services/admin/offerLinksService';
import type { OfferDerived } from '../../../lib/offerPriority';
import { OFFER_GROUP_BY_KEY, groupColors, type OfferGroupKey } from './offerGroups';
import { cn } from '../../../lib/utils';

export interface OfferRowItem {
    offer: OfferLink;
    d: OfferDerived;
    rank: number | null;
}

export interface OfferGroupAccordionProps {
    groupKey: OfferGroupKey;
    items: OfferRowItem[];
    open: boolean;
    onToggle: () => void;
    showAll: boolean;
    onToggleShowAll: () => void;
    /** Grup içinde gösterilecek azami satır (üstü "Daha fazla göster"). */
    page?: number;
    /** Satır render'ı dışarıdan verilir (tüm handler'lar Offers.tsx'te). */
    renderRow: (item: OfferRowItem) => React.ReactNode;
    /** Boş gruplarda satır gizlemek için (odak dışı boş gruplar render edilmez). */
    hideWhenEmpty?: boolean;
    /** Bir lead bu grubun üstüne sürükleniyor (bırakma hedefi vurgusu). */
    isDropOver?: boolean;
    /** hideWhenEmpty true olsa bile grubu görünür tut (sürükleme sırasında boş hedef). */
    forceVisible?: boolean;
    /** Grup içi yeniden sıralama için satırları SortableContext ile sar (yalnız öncelik
     * görünümü; aylık görünüm DndContext dışında olduğundan kapalı). */
    sortable?: boolean;
}

/** Sıcaklık grubu accordion — öncelik listesi VE aylık görünüm tarafından paylaşılır. */
export const OfferGroupAccordion: React.FC<OfferGroupAccordionProps> = ({
    groupKey, items, open, onToggle, showAll, onToggleShowAll, page = 12, renderRow, hideWhenEmpty,
    isDropOver, forceVisible, sortable,
}) => {
    const g = OFFER_GROUP_BY_KEY[groupKey];
    const gc = groupColors(g.color);
    if (hideWhenEmpty && items.length === 0 && !forceVisible) return null;

    const visible = showAll ? items : items.slice(0, page);
    const visibleTokens = visible.map((i) => i.offer.token);

    return (
        <div className="mb-2.5">
            {/* Grup başlığı */}
            <button
                onClick={onToggle}
                className={cn(
                    'relative flex w-full items-center gap-3 overflow-hidden border bg-white px-4 py-3 text-left shadow-[var(--shadow-card)] transition-all hover:shadow-md',
                    open ? 'rounded-t-2xl border-b-transparent' : 'rounded-2xl',
                    isDropOver ? 'border-transparent ring-2 ring-offset-1' : 'border-slate-200',
                )}
                style={isDropOver ? { '--tw-ring-color': gc.base } as React.CSSProperties : undefined}
            >
                <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: gc.base }} />
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px]" style={{ background: gc.bg, color: gc.base }}>
                    <g.icon size={16} />
                </span>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold tracking-tight text-slate-900">{g.label}</span>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums" style={{ background: gc.bg, color: gc.base }}>
                            {items.length}
                        </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] font-medium text-slate-400">{g.desc}</div>
                </div>
                <span className={cn('ml-auto grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-slate-400 transition-transform', open && 'rotate-180')}>
                    <ChevronDown size={16} />
                </span>
            </button>

            {/* Grup gövdesi */}
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="overflow-hidden rounded-b-2xl border border-t-0 border-slate-200 bg-[var(--color-slate-50)]"
                    >
                        {items.length === 0 ? (
                            <div className="px-5 py-8 text-center">
                                <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-300">
                                    <g.icon size={20} />
                                </div>
                                <div className="text-[13px] font-semibold text-slate-700">
                                    {groupKey === 'hot' ? 'Şu an sıcak lead yok' : 'Bu grupta lead yok'}
                                </div>
                                <div className="mt-0.5 text-[12px] text-slate-400">Kriterlere uyan teklif linki bulunamadı.</div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5 p-2">
                                {sortable ? (
                                    <SortableContext items={visibleTokens} strategy={verticalListSortingStrategy}>
                                        {visible.map((item) => (
                                            <React.Fragment key={item.offer.token}>{renderRow(item)}</React.Fragment>
                                        ))}
                                    </SortableContext>
                                ) : (
                                    visible.map((item) => (
                                        <React.Fragment key={item.offer.token}>{renderRow(item)}</React.Fragment>
                                    ))
                                )}
                                {items.length > page && (
                                    <button
                                        onClick={onToggleShowAll}
                                        className="mt-0.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white py-2.5 text-[12px] font-bold text-brand-700 transition-colors hover:bg-brand-50"
                                    >
                                        <ChevronDown size={13} className={showAll ? 'rotate-180' : ''} />
                                        {showAll ? `İlk ${page} lead’i göster` : `Daha fazla göster · +${items.length - page} lead`}
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
