import React, { useState } from 'react';
import { X, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { useToast } from '../../../contexts/ToastContext';
import type { CustomerReservation } from '../../../types/orders';

interface Props {
    order: CustomerReservation;
    onClose: () => void;
    onSaved: () => void;
}

export const SecondChanceModal: React.FC<Props> = ({ order, onClose, onSaved }) => {
    const { error, success } = useToast();
    const [busy, setBusy] = useState(false);
    const [durationHours, setDurationHours] = useState<number>(24);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);

        try {
            const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

            const { error: updateError } = await supabase
                .from('customer_reservations')
                .update({ second_chance_expires_at: expiresAt })
                .eq('id', order.id);

            if (updateError) throw updateError;

            success('Başarılı', `İkinci şans süresi ${durationHours} saat olarak tanımlandı.`);
            onSaved();
            onClose();
        } catch (err: any) {
            console.error('Second chance error:', err);
            error('Hata', err.message || 'İkinci şans süresi tanımlanamadı.');
        } finally {
            setBusy(false);
        }
    };

    const handleClear = async () => {
        setBusy(true);
        try {
            const { error: updateError } = await supabase
                .from('customer_reservations')
                .update({ second_chance_expires_at: null })
                .eq('id', order.id);

            if (updateError) throw updateError;

            success('Başarılı', 'İkinci şans iptal edildi.');
            onSaved();
            onClose();
        } catch (err: any) {
            console.error('Second chance clear error:', err);
            error('Hata', err.message || 'İkinci şans iptal edilemedi.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <Clock className="text-indigo-500" size={18} />
                        <h2 className="text-[15px] font-bold text-slate-800">İkinci Şans Tanımla</h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={busy}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 flex items-start gap-2.5">
                        <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                        <p className="text-xs text-amber-700 leading-relaxed">
                            İkinci şans, ön ödemesini yapmış fakat süresi geçmiş müşterilere kalan ödemeyi <strong>indirimsiz fiyattan</strong> yapabilmeleri için ek süre tanır.
                        </p>
                    </div>

                    <form id="second-chance-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-slate-700">Ek Süre (Saat)</label>
                            <select
                                value={durationHours}
                                onChange={e => setDurationHours(Number(e.target.value))}
                                disabled={busy}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow disabled:opacity-50"
                            >
                                <option value={12}>12 Saat</option>
                                <option value={24}>24 Saat (1 Gün)</option>
                                <option value={48}>48 Saat (2 Gün)</option>
                                <option value={72}>72 Saat (3 Gün)</option>
                                <option value={168}>168 Saat (1 Hafta)</option>
                            </select>
                        </div>
                    </form>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                    {order.second_chance_expires_at ? (
                        <button
                            type="button"
                            onClick={handleClear}
                            disabled={busy}
                            className="px-4 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                            İptal Et
                        </button>
                    ) : (
                        <div></div>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Vazgeç
                        </button>
                        <button
                            type="submit"
                            form="second-chance-form"
                            disabled={busy}
                            className="px-4 py-2 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center justify-center min-w-[100px]"
                        >
                            {busy ? 'Kaydediliyor...' : 'Süre Tanımla'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
