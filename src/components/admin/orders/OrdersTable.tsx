import React from 'react';
import { PackageSearch } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import type { CustomerReservation } from '../../../types/orders';
import { OrderRow, type OrderRowActions } from './OrderRow';
import { OrderMobileCard } from './OrderMobileCard';
import { OrderRowSkeletonList, OrderCardSkeletonList } from './OrderRowSkeleton';

interface Props {
    orders: CustomerReservation[];
    loading: boolean;
    /** Arama/filtre uygulanmış mı — boş durum metnini belirler. */
    filtered: boolean;
    selectedIds: string[];
    expandedId: string | null;
    focusedId: string | null;
    busyId: string | null;
    onToggleSelect: (id: string) => void;
    onToggleSelectAllOnPage: () => void;
    onToggleExpand: (id: string) => void;
    actions: OrderRowActions;
}

const COLUMNS = ['Sipariş', 'Müşteri', 'Tutar', 'Durum', 'Kargo'];

export const OrdersTable: React.FC<Props> = ({
    orders, loading, filtered, selectedIds, expandedId, focusedId, busyId,
    onToggleSelect, onToggleSelectAllOnPage, onToggleExpand, actions,
}) => {
    const allOnPageSelected = orders.length > 0 && orders.every(o => selectedIds.includes(o.id));

    const empty = !loading && orders.length === 0;
    const emptyBlock = (
        <EmptyState
            icon={PackageSearch}
            title={filtered ? 'Sipariş bulunamadı' : 'Henüz sipariş yok'}
            description={
                filtered
                    ? 'Arama veya filtre kriterlerinize uyan sipariş yok. Filtreyi genişletmeyi deneyin.'
                    : 'Müşteri siparişleri buraya düşecek. Dışarıda kapattığınız satışları "Manuel Satış" ile ekleyebilirsiniz.'
            }
        />
    );

    return (
        <>
            {/* Masaüstü tablo */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[1080px] xl:min-w-0">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left w-10">
                                <input
                                    type="checkbox"
                                    checked={allOnPageSelected}
                                    onChange={onToggleSelectAllOnPage}
                                    aria-label="Bu sayfadaki siparişlerin tümünü seç"
                                    title="Bu sayfadaki tüm siparişleri seç"
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer w-4 h-4"
                                />
                            </th>
                            {COLUMNS.map(c => (
                                <th
                                    key={c}
                                    className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400"
                                >
                                    {c}
                                </th>
                            ))}
                            <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                İşlem
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <OrderRowSkeletonList count={6} />
                        ) : empty ? (
                            <tr>
                                <td colSpan={7} className="p-0">{emptyBlock}</td>
                            </tr>
                        ) : (
                            orders.map(order => (
                                <OrderRow
                                    key={order.id}
                                    order={order}
                                    selected={selectedIds.includes(order.id)}
                                    expanded={expandedId === order.id}
                                    focused={focusedId === order.id}
                                    busy={busyId === order.id}
                                    onToggleSelect={() => onToggleSelect(order.id)}
                                    onToggleExpand={() => onToggleExpand(order.id)}
                                    actions={actions}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobil kart listesi */}
            <div className="md:hidden">
                {loading ? (
                    <OrderCardSkeletonList count={4} />
                ) : empty ? (
                    emptyBlock
                ) : (
                    orders.map(order => (
                        <OrderMobileCard
                            key={order.id}
                            order={order}
                            selected={selectedIds.includes(order.id)}
                            expanded={expandedId === order.id}
                            focused={focusedId === order.id}
                            busy={busyId === order.id}
                            onToggleSelect={() => onToggleSelect(order.id)}
                            onToggleExpand={() => onToggleExpand(order.id)}
                            actions={actions}
                        />
                    ))
                )}
            </div>
        </>
    );
};
