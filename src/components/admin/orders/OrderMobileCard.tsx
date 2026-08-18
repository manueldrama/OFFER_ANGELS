import React from 'react';
import { ChevronRight, Pencil, Trash2, Truck, PackagePlus } from 'lucide-react';
import { formatDateTime } from '../../../hooks/useAppSettings';
import { getEffectiveReservationStatus } from '../../../lib/reservations/effectiveStatus';
import { carrierLabel } from '../../../lib/reservations/shippingCarriers';
import { canEnterShipping } from '../../../lib/reservations/orderStatus';
import type { CustomerReservation } from '../../../types/orders';
import { OrderStatusMenu } from './OrderStatusMenu';
import { OrderExpandedPanel } from './OrderExpandedPanel';
import { money, itemsSummary, isNewOrder, customerSegment, type OrderRowActions } from './OrderRow';

interface Props {
    order: CustomerReservation;
    selected: boolean;
    expanded: boolean;
    focused: boolean;
    busy: boolean;
    onToggleSelect: () => void;
    onToggleExpand: () => void;
    actions: OrderRowActions;
}

/**
 * Mobil sipariş kartı (<768px).
 *
 * 7 sütunlu tablo 375px'te kullanılamaz hale geliyor. Detay bölümü masaüstüyle
 * AYNI OrderExpandedPanel'i kullanır — ikinci bir tasarım doğmaz.
 */
export const OrderMobileCard: React.FC<Props> = ({
    order, selected, expanded, focused, busy, onToggleSelect, onToggleExpand, actions,
}) => {
    const effective = getEffectiveReservationStatus(order);
    const canShip = canEnterShipping(order.status);
    const summary = itemsSummary(order);

    return (
        <div
            data-order-id={order.id}
            className={[
                'border-b border-slate-200 last:border-b-0 transition-colors',
                focused ? 'bg-indigo-50/60' : selected ? 'bg-slate-50' : 'bg-white',
                busy ? 'opacity-60' : '',
            ].join(' ')}
        >
            <div className="p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={onToggleSelect}
                        aria-label="Siparişi seç"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer w-4 h-4 mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[13px] font-bold text-slate-900">
                                {order.offer_code || order.offer_token?.slice(0, 8)}
                            </span>
                            {isNewOrder(order) && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                    YENİ
                                </span>
                            )}
                            {order.sale_source === 'manual' && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                    MANUEL
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {formatDateTime(order.created_at)}{summary ? ` · ${summary}` : ''}
                        </p>
                    </div>
                    <OrderStatusMenu
                        value={order.status}
                        effective={effective}
                        disabled={busy}
                        onChange={next => actions.onStatusChange(order, next)}
                    />
                </div>

                <div className="flex items-end justify-between gap-3 pl-7">
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">
                            {order.customer_name || 'İsimsiz Müşteri'}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{customerSegment(order)}</p>
                    </div>
                    <span className="text-[13px] font-bold text-slate-900 tabular-nums shrink-0">
                        {money(order.total)}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-2 pl-7">
                    {order.tracking_number ? (
                        <button
                            type="button"
                            onClick={() => actions.onOpenShipping(order)}
                            className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer min-w-0"
                        >
                            <Truck size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{carrierLabel(order.shipping_company)}</span>
                            <span className="font-mono text-slate-400 truncate">{order.tracking_number}</span>
                        </button>
                    ) : canShip ? (
                        <button
                            type="button"
                            onClick={() => actions.onOpenShipping(order)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        >
                            <PackagePlus size={13} />
                            Kargo gir
                        </button>
                    ) : <span />}

                    <div className="inline-flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => actions.onEdit(order)}
                            title="Düzenle"
                            className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer"
                        >
                            <Pencil size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={() => actions.onDelete(order)}
                            title="Sil"
                            className="text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onToggleExpand}
                    aria-expanded={expanded}
                    className="ml-7 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer w-fit"
                >
                    <ChevronRight size={13} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    {expanded ? 'Detayı gizle' : 'Detay'}
                </button>
            </div>

            {expanded && (
                <OrderExpandedPanel
                    order={order}
                    busy={busy}
                    onApprovePayment={() => actions.onApprovePayment(order)}
                    onMessage={() => actions.onMessage(order)}
                />
            )}
        </div>
    );
};
