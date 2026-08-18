import React from 'react';
import { Search } from 'lucide-react';
import { ORDER_BUCKETS, BUCKET_ORDER, type OrderBucket } from '../../../lib/reservations/orderStatus';
import type { OrdersSummary } from '../../../services/admin/ordersService';

interface Props {
    search: string;
    onSearchChange: (v: string) => void;
    bucket: OrderBucket;
    onBucketChange: (b: OrderBucket) => void;
    summary: OrdersSummary | null;
    inputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * Arama + kova filtre pill'leri. Tablo kartının üst bölümü.
 *
 * Kısayol ipucu bilinçli olarak ⌘K DEĞİL: ⌘K global olarak sidebar menü
 * aramasına bağlı (AdminLayout). Çalışmayan bir ipucu göstermemek için `/`
 * kullanılıyor.
 */
export const OrdersToolbar: React.FC<Props> = ({
    search, onSearchChange, bucket, onBucketChange, summary, inputRef,
}) => {
    const countFor = (key: OrderBucket): number | null => {
        if (!summary) return null;
        if (key === 'all') return summary.total;
        return summary.counts[key as Exclude<OrderBucket, 'all'>] ?? 0;
    };

    // İptal kovası yalnızca gerçekten iptal kayıt varsa görünür — mockup'ta yok,
    // ama gerçek veride iptal siparişler hiçbir filtreden erişilemez kalmamalı.
    const visibleBuckets = BUCKET_ORDER.filter(
        key => key !== 'cancelled' || (countFor('cancelled') ?? 0) > 0,
    );

    return (
        <div className="p-3 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={e => onSearchChange(e.target.value)}
                    placeholder="Müşteri, sipariş no veya takip no ara…"
                    className="w-full pl-9 pr-12 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
                <kbd className="hidden sm:flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center h-5 px-1.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-400 pointer-events-none">
                    /
                </kbd>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
                {visibleBuckets.map(key => {
                    const def = ORDER_BUCKETS[key];
                    const count = countFor(key);
                    const isActive = bucket === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onBucketChange(key)}
                            className={[
                                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors cursor-pointer whitespace-nowrap',
                                isActive
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                            ].join(' ')}
                        >
                            {def.label}
                            {count !== null && (
                                <span className={`tabular-nums text-xs font-bold ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
