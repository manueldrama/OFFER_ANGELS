import React from 'react';
import { ChevronRight, Pencil, Trash2, Truck, PackagePlus, BadgeCheck } from 'lucide-react';
import { formatDateTime } from '../../../hooks/useAppSettings';
import { getEffectiveReservationStatus } from '../../../lib/reservations/effectiveStatus';
import { paymentLabel, canEnterShipping } from '../../../lib/reservations/orderStatus';
import { carrierLabel } from '../../../lib/reservations/shippingCarriers';
import type { ReservationStatus } from '../../../lib/reservations/orderStatus';
import type { CustomerReservation } from '../../../types/orders';
import { OrderStatusMenu } from './OrderStatusMenu';
import { OrderExpandedPanel } from './OrderExpandedPanel';
import { ContextTaskButton } from '../tasks/ContextTaskButton';

export interface OrderRowActions {
    onStatusChange: (order: CustomerReservation, next: ReservationStatus) => void;
    onOpenShipping: (order: CustomerReservation) => void;
    onEdit: (order: CustomerReservation) => void;
    onDelete: (order: CustomerReservation) => void;
    onApprovePayment: (order: CustomerReservation) => void;
    onMessage: (order: CustomerReservation) => void;
    onSecondChance: (order: CustomerReservation) => void;
}

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

/** Bu pencerede oluşan siparişler "YENİ" rozeti alır. */
const NEW_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export const money = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

/** "1× Cafepaste Pro, 2× Renkli Pod" — satırın ikinci satırındaki ürün özeti. */
export function itemsSummary(order: CustomerReservation): string {
    if (!order.items || order.items.length === 0) return '';
    return order.items.map(i => `${i.quantity}× ${i.name}`).join(', ');
}

export function isNewOrder(order: CustomerReservation): boolean {
    const ms = new Date(order.created_at).getTime();
    return !isNaN(ms) && Date.now() - ms < NEW_ORDER_WINDOW_MS;
}

/** Kurumsal/Bireysel ayrımı — şirket adı doluysa kurumsal. */
export function customerSegment(order: CustomerReservation): string {
    return order.company_name ? `${order.company_name} · Kurumsal` : 'Bireysel';
}

export const OrderRow: React.FC<Props> = ({
    order, selected, expanded, focused, busy, onToggleSelect, onToggleExpand, actions,
}) => {
    const effective = getEffectiveReservationStatus(order);
    const canShip = canEnterShipping(order.status);
    const summary = itemsSummary(order);

    return (
        <>
            <tr
                data-order-id={order.id}
                className={[
                    'transition-colors',
                    focused ? 'bg-indigo-50/60 ring-2 ring-inset ring-indigo-500' : selected ? 'bg-slate-50' : 'hover:bg-slate-50/70',
                    busy ? 'opacity-60' : '',
                ].join(' ')}
            >
                <td className="px-4 py-3 align-top">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={onToggleSelect}
                        aria-label="Siparişi seç"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer w-4 h-4 mt-1"
                    />
                </td>

                {/* Sipariş */}
                <td className="px-4 py-3 align-top">
                    <button
                        type="button"
                        onClick={onToggleExpand}
                        className="flex items-start gap-1.5 text-left cursor-pointer group"
                        aria-expanded={expanded}
                    >
                        <ChevronRight
                            size={14}
                            className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                        />
                        <span className="flex flex-col min-w-0">
                            <span className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[13px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                    {order.offer_code || order.offer_token?.slice(0, 8)}
                                </span>
                                {isNewOrder(order) && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                        YENİ
                                    </span>
                                )}
                                {order.sale_source === 'manual' && (
                                    <span
                                        title="Offline kapatılan satış — ödeme sağlayıcısından geçmedi"
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold"
                                    >
                                        <BadgeCheck size={10} />
                                        MANUEL
                                    </span>
                                )}
                            </span>
                            <span className="text-xs text-slate-400 mt-0.5 truncate max-w-[280px]">
                                {formatDateTime(order.created_at)}{summary ? ` · ${summary}` : ''}
                            </span>
                        </span>
                    </button>
                </td>

                {/* Müşteri */}
                <td className="px-4 py-3 align-top">
                    <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-semibold text-slate-900 truncate">
                            {order.customer_name || 'İsimsiz Müşteri'}
                        </span>
                        <span className="text-xs text-slate-400 mt-0.5 truncate">{customerSegment(order)}</span>
                    </div>
                </td>

                {/* Tutar */}
                <td className="px-4 py-3 align-top">
                    <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-slate-900 tabular-nums whitespace-nowrap">
                            {money(order.total)}
                        </span>
                        <span className="text-xs text-slate-400 mt-0.5">{paymentLabel(order)}</span>
                    </div>
                </td>

                {/* Durum */}
                <td className="px-4 py-3 align-top">
                    <OrderStatusMenu
                        value={order.status}
                        effective={effective}
                        disabled={busy}
                        onChange={next => actions.onStatusChange(order, next)}
                    />
                </td>

                {/* Kargo */}
                <td className="px-4 py-3 align-top">
                    {order.tracking_number ? (
                        <button
                            type="button"
                            onClick={() => actions.onOpenShipping(order)}
                            title="Kargo bilgisini düzenle"
                            className="flex flex-col text-left group cursor-pointer"
                        >
                            <span className="text-[13px] font-medium text-slate-700 group-hover:text-indigo-600 transition-colors inline-flex items-center gap-1.5">
                                <Truck size={13} className="text-slate-400 shrink-0" />
                                {carrierLabel(order.shipping_company)}
                            </span>
                            <span className="text-xs font-mono text-slate-400 mt-0.5">{order.tracking_number}</span>
                        </button>
                    ) : canShip ? (
                        <button
                            type="button"
                            onClick={() => actions.onOpenShipping(order)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer whitespace-nowrap"
                        >
                            <PackagePlus size={13} />
                            Kargo gir
                        </button>
                    ) : (
                        <span className="text-xs text-slate-300">—</span>
                    )}
                </td>

                {/* İşlem */}
                <td className="px-4 py-3 align-top text-right">
                    <div className="inline-flex items-center gap-1">
                        {/* Görev — teklif (varsa lead) bağıyla; ikisi de yoksa gizli */}
                        {(order.offer_token || order.lead_id) && (
                            <ContextTaskButton
                                variant="icon"
                                context={{
                                    entityType: order.offer_token ? 'offer' : 'lead',
                                    entityId: order.offer_token || order.lead_id!,
                                    entityLabel: `#${order.offer_code || order.offer_token || ''} — ${order.customer_name}`,
                                    initialTitle: `Sipariş takibi: ${order.customer_name}`,
                                    extraLinks: order.offer_token && order.lead_id
                                        ? [{ entity_type: 'lead', entity_id: order.lead_id, label: order.customer_name }]
                                        : [],
                                }}
                            />
                        )}
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
                </td>
            </tr>

            {expanded && (
                <tr>
                    <td colSpan={7} className="p-0">
                        <OrderExpandedPanel
                            order={order}
                            busy={busy}
                            onApprovePayment={() => actions.onApprovePayment(order)}
                            onMessage={() => actions.onMessage(order)}
                            onSecondChance={() => actions.onSecondChance(order)}
                        />
                    </td>
                </tr>
            )}
        </>
    );
};
