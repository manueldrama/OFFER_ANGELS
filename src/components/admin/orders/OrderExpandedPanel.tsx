import React from 'react';
import { MessageCircle, Clock } from 'lucide-react';
import { paymentLabel, collectedAmount, resolvePaymentApproval } from '../../../lib/reservations/orderStatus';
import type { CustomerReservation } from '../../../types/orders';

interface Props {
    order: CustomerReservation;
    busy?: boolean;
    onApprovePayment: () => void;
    onMessage: () => void;
    onSecondChance: () => void;
}

const money = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v || 0);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{children}</div>
);

/**
 * Genişletilmiş sipariş detayı — ürünler, teslimat ve ödeme.
 * Masaüstünde tablo satırının altında, mobilde kartın içinde aynı bileşen kullanılır.
 */
export const OrderExpandedPanel: React.FC<Props> = ({ order, busy, onApprovePayment, onMessage, onSecondChance }) => {
    const approval = resolvePaymentApproval(order);
    const collected = collectedAmount(order);
    const remaining = Number(order.remaining_amount || 0);

    const deliveryLine = [order.delivery_address, order.delivery_district, order.delivery_city]
        .filter(Boolean)
        .join(', ');
    const contact = order.delivery_contact_name || order.customer_name || 'İsimsiz Müşteri';
    const phone = order.delivery_phone;

    const canMessage = !!order.lead_id;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 p-5 bg-slate-50/70 border-t border-slate-200">
            {/* Ürünler */}
            <div className="min-w-0">
                <Label>Ürünler</Label>
                {order.items && order.items.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                        {order.items.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-white"
                            >
                                <span className="text-[13px] font-medium text-slate-800 truncate">{item.name}</span>
                                <span className="text-xs font-semibold text-slate-400 tabular-nums shrink-0">
                                    ×{item.quantity}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[13px] text-slate-400">Ürün bilgisi yok.</p>
                )}
            </div>

            {/* Müşteri & teslimat */}
            <div className="min-w-0">
                <Label>Müşteri &amp; Teslimat</Label>
                <div className="px-3.5 py-3 rounded-lg border border-slate-200 bg-white flex flex-col gap-1">
                    <span className="text-[13px] font-semibold text-slate-900 truncate">{contact}</span>
                    {phone ? (
                        <a href={`tel:${phone}`} className="text-[13px] text-slate-600 hover:text-indigo-600 transition-colors w-fit">
                            {phone}
                        </a>
                    ) : (
                        <span className="text-[13px] text-slate-400">Telefon yok</span>
                    )}
                    <span className="text-[13px] text-slate-600 leading-relaxed">
                        {deliveryLine || 'Teslimat adresi henüz girilmemiş'}
                    </span>
                    {order.manual_note && (
                        <span className="text-xs text-slate-400 mt-1 leading-relaxed">Not: {order.manual_note}</span>
                    )}
                </div>
            </div>

            {/* Ödeme */}
            <div className="min-w-0">
                <Label>Ödeme</Label>
                <div className="flex flex-col gap-1.5 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Yöntem</span>
                        <span className="font-medium text-slate-800 truncate">{paymentLabel(order)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Tahsil edilen</span>
                        <span className="font-semibold text-slate-900 tabular-nums">{money(collected)}</span>
                    </div>
                    {remaining > 0 && (
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Kalan</span>
                            <span className="font-semibold text-red-600 tabular-nums">{money(remaining)}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 mt-4">
                    {approval && (
                        <button
                            type="button"
                            onClick={onApprovePayment}
                            disabled={busy}
                            className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {approval.buttonLabel}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onMessage}
                        disabled={!canMessage}
                        title={canMessage ? 'WhatsApp mesajı gönder' : 'Bu siparişe bağlı müşteri kaydı yok'}
                        className={[
                            'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-lg border transition-colors',
                            approval ? '' : 'flex-1',
                            canMessage
                                ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer'
                                : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed',
                        ].join(' ')}
                    >
                        <MessageCircle size={14} />
                        Mesaj
                    </button>
                    {order.status === 'deposit_paid' && remaining > 0 && (
                        <button
                            type="button"
                            onClick={onSecondChance}
                            disabled={busy}
                            title="İkinci şans (indirimsiz süre) tanımla"
                            className={[
                                'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-lg border transition-colors',
                                approval ? '' : 'flex-1',
                                'bg-white text-amber-700 border-amber-200 hover:bg-amber-50 cursor-pointer',
                            ].join(' ')}
                        >
                            <Clock size={14} />
                            2. Şans
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
