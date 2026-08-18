import React from 'react';
import { ORDER_BUCKETS, KPI_BUCKETS, type OrderBucket } from '../../../lib/reservations/orderStatus';
import type { OrdersSummary } from '../../../services/admin/ordersService';

interface Props {
    summary: OrdersSummary | null;
    loading: boolean;
    activeBucket: OrderBucket;
    onSelect: (bucket: OrderBucket) => void;
}

const money = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v);

/**
 * KPI kartları — nokta+etiket → değer → yardımcı metin.
 *
 * MetricCard kasıtlı olarak kullanılmadı: onun DOM sırası ikon→değer→başlık,
 * burada istenen sıra ise farklı. className ile bükmek yerine aynı token
 * değerleriyle (bg-white rounded-lg p-5 border-slate-200 / text-[26px] / 13px /
 * 12px) yazıldı — görsel olarak aynı aileden kalır.
 */
export const OrdersKpiCards: React.FC<Props> = ({ summary, loading, activeBucket, onSelect }) => {
    const cards: { key: OrderBucket; label: string; help: string; dot: string; value: React.ReactNode }[] = [
        ...KPI_BUCKETS.map(key => {
            const def = ORDER_BUCKETS[key];
            return {
                key: key as OrderBucket,
                label: def.kpiLabel || def.label,
                help: def.kpiHelp || '',
                dot: def.dotClass || 'bg-slate-400',
                value: summary ? summary.counts[key as Exclude<OrderBucket, 'all'>] : null,
            };
        }),
        {
            key: 'completed' as OrderBucket,
            label: 'Tahsil edilen',
            help: 'Tüm siparişler',
            dot: 'bg-emerald-500',
            // SQL fonksiyonu henüz uygulanmadıysa null gelir — uydurma sayı basmak
            // yerine "—" gösterilir.
            value: summary ? (summary.collectedTotal === null ? '—' : money(summary.collectedTotal)) : null,
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((card, idx) => {
                // Tahsilat kartı bir filtre değil, salt gösterim.
                const interactive = idx < KPI_BUCKETS.length;
                const isActive = interactive && activeBucket === card.key;
                const Tag: any = interactive ? 'button' : 'div';

                return (
                    <Tag
                        key={card.label}
                        type={interactive ? 'button' : undefined}
                        onClick={interactive ? () => onSelect(isActive ? 'all' : card.key) : undefined}
                        className={[
                            'bg-white rounded-lg p-5 border flex flex-col text-left transition-colors',
                            isActive ? 'border-slate-900' : 'border-slate-200',
                            interactive ? 'cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20' : '',
                        ].join(' ')}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${card.dot}`} />
                            <span className="text-[13px] font-medium text-slate-500 truncate">{card.label}</span>
                        </div>
                        {loading || card.value === null ? (
                            <span className="h-8 w-20 rounded bg-slate-100 animate-pulse" />
                        ) : (
                            <span className="text-[26px] font-bold text-slate-900 leading-tight tabular-nums truncate">
                                {card.value}
                            </span>
                        )}
                        <span className="text-xs font-medium text-slate-400 mt-1.5">{card.help}</span>
                    </Tag>
                );
            })}
        </div>
    );
};
