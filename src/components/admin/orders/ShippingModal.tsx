import React, { useState } from 'react';
import { XCircle } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { ordersService } from '../../../services/admin/ordersService';
import { SHIPPING_CARRIERS, DEFAULT_CARRIER } from '../../../lib/reservations/shippingCarriers';
import type { CustomerReservation } from '../../../types/orders';

interface Props {
    order: CustomerReservation;
    onClose: () => void;
    onSaved: () => void;
}

/** Kargo firması + takip numarası girişi. Orders.tsx'ten çıkarıldı. */
export const ShippingModal: React.FC<Props> = ({ order, onClose, onSaved }) => {
    const [company, setCompany] = useState(order.shipping_company || DEFAULT_CARRIER);
    const [tracking, setTracking] = useState(order.tracking_number || '');
    const [saving, setSaving] = useState(false);
    const { error, success } = useToast();

    // Teslim edilmiş bir siparişte takip numarası düzeltmek durumu geri almamalı.
    const keepsStatus = order.status === 'shipped' || order.status === 'delivered';

    const handleSave = async () => {
        setSaving(true);
        try {
            await ordersService.saveShipping(order.id, order.status, company, tracking);
            success(
                'Başarılı',
                keepsStatus
                    ? 'Kargo bilgileri güncellendi.'
                    : 'Kargo bilgileri kaydedildi ve sipariş kargolandı olarak işaretlendi.',
            );
            onSaved();
            onClose();
        } catch {
            error('Hata', 'Kargo bilgileri kaydedilemedi.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-lg w-full max-w-sm overflow-hidden p-5 animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-5">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Kargo Bilgisi Gir</h3>
                        <p className="text-xs text-slate-400 mt-0.5">#{order.offer_code} — {order.customer_name}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Kargo Firması</label>
                        <select
                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none bg-white cursor-pointer"
                            value={company}
                            onChange={e => setCompany(e.target.value)}
                        >
                            {SHIPPING_CARRIERS.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Takip Numarası</label>
                        <input
                            type="text"
                            value={tracking}
                            onChange={e => setTracking(e.target.value)}
                            placeholder="Takip kodunu girin..."
                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none"
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!tracking || saving}
                        className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {saving ? 'Kaydediliyor…' : keepsStatus ? 'Kargo Bilgisini Güncelle' : 'Kaydet ve Kargolandı İşaretle'}
                    </button>
                </div>
            </div>
        </div>
    );
};
