import React, { useState, useRef, useEffect } from 'react';
import { Monitor, Loader2, Search, CheckCircle, XCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '../../contexts/ToastContext';
import { CustomerPortalService } from '../../services/customerPortalService';

interface DeviceRegistrationFormProps {
    leadId: string;
    onSuccess: () => void;
    compact?: boolean;
}

type RegistrationMode = 'serial' | 'manual';

export default function DeviceRegistrationForm({ leadId, onSuccess, compact }: DeviceRegistrationFormProps) {
    const { success, error: toastError } = useToast();
    const [mode, setMode] = useState<RegistrationMode>('serial');
    const [formLoading, setFormLoading] = useState(false);
    const [customModel, setCustomModel] = useState(false);
    const [productModels, setProductModels] = useState<string[]>([]);

    // Serial number mode state
    const [serialInput, setSerialInput] = useState('');
    const [serialResult, setSerialResult] = useState<'pending' | 'not_found' | 'already_assigned' | 'already_requested' | null>(null);

    // Manual mode state
    const [form, setForm] = useState({
        product_model: '',
        serial_number: '',
        purchase_date: '',
        notes: ''
    });
    const formRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (formRef.current) {
            setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
        }
        CustomerPortalService.getProductModels()
            .then(setProductModels)
            .catch(() => {});
    }, []);

    const handleSerialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!serialInput.trim()) {
            toastError('Hata', 'Seri numarası giriniz.');
            return;
        }
        setFormLoading(true);
        setSerialResult(null);
        try {
            const result = await CustomerPortalService.requestDeviceBySerial(leadId, serialInput);
            setSerialResult(result.status);
            if (result.status === 'pending') {
                success('Talep Gönderildi', 'Cihaz kayıt talebiniz onay bekliyor.');
                setTimeout(() => onSuccess(), 1500);
            } else if (result.status === 'not_found') {
                toastError('Bulunamadı', 'Bu seri numarası sistemde kayıtlı değil.');
            } else if (result.status === 'already_assigned') {
                toastError('Zaten Kayıtlı', 'Bu cihaz başka bir müşteriye atanmış.');
            } else if (result.status === 'already_requested') {
                toastError('Talep Mevcut', 'Bu seri numarası için zaten bekleyen bir talebiniz var.');
            }
        } catch {
            toastError('Hata', 'İşlem sırasında bir hata oluştu.');
        } finally {
            setFormLoading(false);
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const model = form.product_model.trim();
        if (!model) {
            toastError('Hata', 'Cihaz modeli zorunludur.');
            return;
        }
        setFormLoading(true);
        try {
            await CustomerPortalService.registerDevice(leadId, {
                product_model: model,
                serial_number: form.serial_number.trim() || undefined,
                purchase_date: form.purchase_date || undefined,
                notes: form.notes.trim() || undefined
            });
            success('Cihaz Kaydedildi', 'Cihazınız başarıyla sisteme eklendi.');
            onSuccess();
        } catch {
            toastError('Hata', 'Cihaz kaydedilemedi. Lütfen tekrar deneyin.');
        } finally {
            setFormLoading(false);
        }
    };

    const handleModelChange = (value: string) => {
        if (value === '__other') {
            setCustomModel(true);
            setForm(prev => ({ ...prev, product_model: '' }));
        } else {
            setCustomModel(false);
            setForm(prev => ({ ...prev, product_model: value }));
        }
    };

    const inputClass = 'w-full px-3.5 py-2.5 rounded-[10px] border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20 transition-colors';

    const getSerialResultUI = () => {
        if (!serialResult) return null;
        switch (serialResult) {
            case 'pending':
                return (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-[10px] text-emerald-700 text-xs font-medium">
                        <CheckCircle size={14} /> Talebiniz alındı, admin onayı bekleniyor.
                    </div>
                );
            case 'not_found':
                return (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-[10px] text-red-600 text-xs font-medium">
                        <XCircle size={14} /> Bu seri numarası sistemde bulunamadı.
                    </div>
                );
            case 'already_assigned':
                return (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-[10px] text-amber-700 text-xs font-medium">
                        <XCircle size={14} /> Bu cihaz zaten bir müşteriye kayıtlı.
                    </div>
                );
            case 'already_requested':
                return (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-[10px] text-amber-700 text-xs font-medium">
                        <Clock size={14} /> Bu seri numarası için zaten bekleyen bir talebiniz var.
                    </div>
                );
        }
    };

    return (
        <motion.div
            ref={formRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
        >
            <div className={compact ? 'space-y-4' : 'bg-white rounded-xl border border-slate-200/80 overflow-hidden'}>
                {/* Mode Tabs */}
                <div className={compact ? 'flex gap-1 mb-4' : 'flex gap-1 p-4 pb-0'}>
                    <button
                        type="button"
                        onClick={() => { setMode('serial'); setSerialResult(null); }}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                            mode === 'serial'
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        Seri No ile Kayıt
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('manual')}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                            mode === 'manual'
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        Manuel Kayıt
                    </button>
                </div>

                {mode === 'serial' ? (
                    /* ── Serial Number Registration ── */
                    <form onSubmit={handleSerialSubmit}>
                        <div className={compact ? 'space-y-3' : 'p-4 pt-3 space-y-3'}>
                            <p className="text-[11px] text-slate-400">
                                Cihazınızın üzerindeki seri numarasını girin. Kayıt talebiniz admin tarafından onaylanacaktır.
                            </p>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                <input
                                    type="text"
                                    value={serialInput}
                                    onChange={e => { setSerialInput(e.target.value.toUpperCase()); setSerialResult(null); }}
                                    className={`${inputClass} pl-9 font-mono uppercase tracking-wider`}
                                    placeholder="Örn: CP2400-2026-00142"
                                    autoFocus
                                />
                            </div>
                            {getSerialResultUI()}
                        </div>
                        <div className={compact ? 'flex items-center' : 'px-4 py-3 border-t border-slate-100 flex items-center'}>
                            <button
                                type="submit"
                                disabled={formLoading || !serialInput.trim() || serialResult === 'pending'}
                                className={`${compact ? 'w-full' : 'flex-1'} py-2.5 bg-slate-900 text-white font-semibold text-xs rounded-[10px] hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5`}
                            >
                                {formLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={13} />}
                                {formLoading ? 'Kontrol ediliyor...' : 'Seri No ile Kayıt Talebi'}
                            </button>
                        </div>
                    </form>
                ) : (
                    /* ── Manual Registration (existing flow) ── */
                    <form onSubmit={handleManualSubmit}>
                        <div className={compact ? 'space-y-4' : 'p-4 pt-3 space-y-4'}>
                            <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Cihaz Modeli *</label>
                                {customModel ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={form.product_model}
                                            onChange={e => setForm(prev => ({ ...prev, product_model: e.target.value }))}
                                            className={inputClass}
                                            placeholder="Model adını yazın"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => { setCustomModel(false); setForm(prev => ({ ...prev, product_model: '' })); }}
                                            className="px-3 py-2 text-xs font-medium text-slate-500 border border-slate-200 rounded-[10px] hover:bg-slate-50 shrink-0"
                                        >
                                            Listeden Seç
                                        </button>
                                    </div>
                                ) : (
                                    <select
                                        value={form.product_model}
                                        onChange={e => handleModelChange(e.target.value)}
                                        className={inputClass}
                                    >
                                        <option value="">Model seçin</option>
                                        {productModels.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                        <option value="__other">Diğer (Manuel Giriş)</option>
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Seri Numarası</label>
                                <input
                                    type="text"
                                    value={form.serial_number}
                                    onChange={e => setForm(prev => ({ ...prev, serial_number: e.target.value }))}
                                    className={inputClass}
                                    placeholder="Cihazın üzerindeki seri numarası"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Satın Alma Tarihi</label>
                                <input
                                    type="date"
                                    value={form.purchase_date}
                                    onChange={e => setForm(prev => ({ ...prev, purchase_date: e.target.value }))}
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Not (Opsiyonel)</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                    className={`${inputClass} resize-none`}
                                    rows={2}
                                    placeholder="Cihaz hakkında eklemek istediğiniz bilgi"
                                />
                            </div>
                        </div>

                        <div className={compact ? 'flex items-center' : 'px-4 py-3 border-t border-slate-100 flex items-center'}>
                            <button
                                type="submit"
                                disabled={formLoading || !form.product_model.trim()}
                                className={`${compact ? 'w-full' : 'flex-1'} py-2.5 bg-slate-900 text-white font-semibold text-xs rounded-[10px] hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5`}
                            >
                                {formLoading ? <Loader2 size={14} className="animate-spin" /> : <Monitor size={13} />}
                                {formLoading ? 'Kaydediliyor...' : 'Cihazı Kaydet'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </motion.div>
    );
}
