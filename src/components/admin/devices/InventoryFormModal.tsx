import React, { useState, useEffect } from 'react';
import { X, Save, Sparkles } from 'lucide-react';
import { AdminCustomerDevicesService } from '../../../services/admin/customerDevicesService';
import { AdminProductCatalogService } from '../../../services/admin/productCatalogService';
import { CatalogProduct } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

interface InventoryFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function InventoryFormModal({ isOpen, onClose, onSuccess }: InventoryFormModalProps) {
    const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
    const [model, setModel] = useState('');
    const [customModel, setCustomModel] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [batchNumber, setBatchNumber] = useState('');
    const [manufacturedAt, setManufacturedAt] = useState(new Date().toISOString().split('T')[0]);
    const [firmwareVersion, setFirmwareVersion] = useState('');
    const [notes, setNotes] = useState('');

    const [saving, setSaving] = useState(false);
    const [generatingSerial, setGeneratingSerial] = useState(false);
    const { success, error } = useToast();

    const isCustomModel = model === 'Diger';
    const effectiveModel = isCustomModel ? customModel : model;
    const modelPrefix = effectiveModel.replace(/-/g, '');

    // Prevent body scroll + fetch catalog
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            AdminProductCatalogService.listProducts({ type: 'machine', activeOnly: true, limit: 100 })
                .then(res => setCatalogProducts(res.products))
                .catch(console.error);
        } else {
            document.body.style.overflow = 'unset';
            resetForm();
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const resetForm = () => {
        setModel('');
        setCustomModel('');
        setSerialNumber('');
        setQuantity(1);
        setBatchNumber('');
        setManufacturedAt(new Date().toISOString().split('T')[0]);
        setFirmwareVersion('');
        setNotes('');
    };

    const handleGenerateSerial = async () => {
        if (!effectiveModel) return;
        setGeneratingSerial(true);
        try {
            const serial = await AdminCustomerDevicesService.generateSerialNumber(modelPrefix);
            setSerialNumber(serial);
        } catch (err: any) {
            error('Hata', err?.message || 'Seri numarası üretilemedi.');
        } finally {
            setGeneratingSerial(false);
        }
    };

    const handleSave = async () => {
        if (!effectiveModel) return error('Hata', 'Lütfen bir cihaz modeli seçin.');
        if (isCustomModel && !customModel.trim()) return error('Hata', 'Lütfen cihaz modelini girin.');

        setSaving(true);
        try {
            if (quantity === 1) {
                // Single device
                let serial = serialNumber;
                if (!serial) {
                    serial = await AdminCustomerDevicesService.generateSerialNumber(modelPrefix);
                }

                await AdminCustomerDevicesService.createInventoryDevice({
                    product_model: effectiveModel,
                    serial_number: serial,
                    batch_number: batchNumber || undefined,
                    firmware_version: firmwareVersion || undefined,
                    manufactured_at: new Date(manufacturedAt).toISOString(),
                    notes: notes || undefined,
                });

                success('Başarılı', `Envanter cihazı kaydedildi. SN: ${serial}`);
            } else {
                // Bulk create
                const serials: string[] = [];
                for (let i = 0; i < quantity; i++) {
                    const serial = await AdminCustomerDevicesService.generateSerialNumber(modelPrefix);
                    serials.push(serial);
                }

                const devices = serials.map(sn => ({
                    product_model: effectiveModel,
                    serial_number: sn,
                    batch_number: batchNumber || undefined,
                    firmware_version: firmwareVersion || undefined,
                    manufactured_at: new Date(manufacturedAt).toISOString(),
                }));

                await AdminCustomerDevicesService.bulkCreateInventory(devices);
                success('Başarılı', `${quantity} adet ${effectiveModel} envantere eklendi.`);
            }

            onSuccess();
        } catch (err: any) {
            console.error('[InventoryFormModal] save error:', err);
            error('Hata', err?.message || 'Envanter kaydedilirken bir sorun oluştu.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Yeni Envanter Kaydı</h2>
                        <p className="text-sm text-slate-500 mt-1">Üretimden çıkan cihazları envantere ekleyin.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-6 flex-1">
                    {/* Model Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Cihaz Modeli *</label>
                        <select
                            value={model}
                            onChange={(e) => { setModel(e.target.value); setSerialNumber(''); }}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                        >
                            <option value="">-- Model Seçin --</option>
                            {catalogProducts.map(p => (
                                <option key={p.id} value={p.product_code}>{p.product_code}</option>
                            ))}
                            <option value="Diger">Diğer / Manuel Giriş</option>
                        </select>
                        {isCustomModel && (
                            <input
                                type="text"
                                value={customModel}
                                onChange={(e) => setCustomModel(e.target.value.toUpperCase())}
                                placeholder="Model kodunu girin (Örn: CP-6000)"
                                className="w-full mt-2 px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase font-mono text-sm"
                            />
                        )}
                    </div>

                    {/* Serial Number */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Seri Numarası</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={quantity > 1 ? '' : serialNumber}
                                onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                                placeholder={quantity > 1 ? 'Toplu üretimde otomatik atanır' : 'Örn: CP2400-8XN2'}
                                disabled={quantity > 1}
                                className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <button
                                onClick={handleGenerateSerial}
                                disabled={!effectiveModel || generatingSerial || quantity > 1}
                                className="px-3 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md hover:bg-indigo-100 transition-colors text-sm font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                <Sparkles size={14} />
                                {generatingSerial ? 'Üretiliyor...' : 'Otomatik Üret'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Quantity */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Adet</label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                value={quantity}
                                onChange={(e) => {
                                    const val = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                                    setQuantity(val);
                                    if (val > 1) setSerialNumber('');
                                }}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* Batch Number */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Batch Numarası</label>
                            <input
                                type="text"
                                value={batchNumber}
                                onChange={(e) => setBatchNumber(e.target.value)}
                                placeholder="Örn: B2026-03"
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Manufactured Date */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Üretim Tarihi</label>
                            <input
                                type="date"
                                value={manufacturedAt}
                                onChange={(e) => setManufacturedAt(e.target.value)}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* Firmware Version */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Firmware Versiyonu</label>
                            <input
                                type="text"
                                value={firmwareVersion}
                                onChange={(e) => setFirmwareVersion(e.target.value)}
                                placeholder="Örn: v2.1.0"
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Notlar</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Üretim notları, kalite kontrol detayları vb."
                            rows={3}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none text-sm"
                        />
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                        disabled={saving}
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 text-sm font-medium rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={18} />
                        {saving ? 'Kaydediliyor...' : quantity > 1 ? `${quantity} Cihaz Kaydet` : 'Envantere Ekle'}
                    </button>
                </div>
            </div>
        </div>
    );
}
