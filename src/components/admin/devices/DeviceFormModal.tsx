import React, { useState, useEffect } from 'react';
import { X, Save, Search } from 'lucide-react';
import { AdminCustomerDevicesService } from '../../../services/admin/customerDevicesService';
import { AdminLeadsService } from '../../../services/admin/leadsService';
import { AdminProductCatalogService } from '../../../services/admin/productCatalogService';
import { CatalogProduct } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

interface DeviceFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    prefilledLeadId?: string;
}

export default function DeviceFormModal({ isOpen, onClose, onSuccess, prefilledLeadId }: DeviceFormModalProps) {
    const [leadId, setLeadId] = useState(prefilledLeadId || '');
    const [leads, setLeads] = useState<any[]>([]);
    const [searchLead, setSearchLead] = useState('');
    const [searchingLeads, setSearchingLeads] = useState(false);
    const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);

    const [productModel, setProductModel] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [warrantyMonths, setWarrantyMonths] = useState(24);
    const [status, setStatus] = useState('active');
    const [notes, setNotes] = useState('');

    const [saving, setSaving] = useState(false);
    const { success, error } = useToast();

    // Prevent body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            if (prefilledLeadId) fetchSingleLead(prefilledLeadId);

            // Fetch live catalog
            AdminProductCatalogService.listProducts({ type: 'machine', activeOnly: true, limit: 100 })
                .then(res => setCatalogProducts(res.products))
                .catch(console.error);

        } else {
            document.body.style.overflow = 'unset';
            setProductModel('');
            setSerialNumber('');
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const fetchSingleLead = async (id: string) => {
        try {
            const { lead } = await AdminLeadsService.getLeadProfile(id);
            if (lead) {
                setLeads([lead]);
                setLeadId(id);
            }
        } catch (e) { }
    }

    // Load recent leads on mount so dropdown isn't empty
    useEffect(() => {
        if (isOpen && !prefilledLeadId) {
            AdminLeadsService.listLeads({ limit: 20 }).then(res => setLeads(res.leads)).catch(() => {});
        }
    }, [isOpen, prefilledLeadId]);

    const handleSearchLeads = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchLead(query);
        if (query.length < 2) {
            // Reset to recent leads
            AdminLeadsService.listLeads({ limit: 20 }).then(res => setLeads(res.leads)).catch(() => {});
            return;
        }

        setSearchingLeads(true);
        try {
            const { leads: data } = await AdminLeadsService.listLeads({ search: query, limit: 20 });
            setLeads(data);
        } catch (err) { }
        finally { setSearchingLeads(false); }
    };

    const handleSave = async () => {
        if (!leadId) return error('Hata', 'Lütfen bir müşteri seçin.');
        if (!productModel) return error('Hata', 'Lütfen bir cihaz modeli seçin.');

        setSaving(true);
        try {
            const startDate = new Date(purchaseDate);
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + warrantyMonths);

            await AdminCustomerDevicesService.createDevice({
                lead_id: leadId,
                product_model: productModel,
                serial_number: serialNumber || null,
                purchase_date: startDate.toISOString(),
                warranty_start_date: startDate.toISOString(),
                warranty_end_date: endDate.toISOString(),
                status,
                notes: notes || null
            });
            success('Başarılı', 'Cihaz kaydı oluşturuldu.');
            onSuccess();
        } catch (err: any) {
            console.error('[DeviceFormModal] createDevice error:', err);
            error('Hata', err?.message || 'Cihaz kaydedilirken bir sorun oluştu.');
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
                        <h2 className="text-xl font-bold text-slate-900">Yeni Cihaz Kaydı</h2>
                        <p className="text-sm text-slate-500 mt-1">Müşteriye satılan yeni cihazın sistem kaydını yapın.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-6 flex-1">
                    {/* Lead Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Müşteri Seçimi *</label>
                        {!prefilledLeadId && (
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="İsim, Tel no veya Kayıt No ile ara (en az 3 karakter)..."
                                    value={searchLead}
                                    onChange={handleSearchLeads}
                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                        )}
                        <select
                            value={leadId}
                            onChange={(e) => setLeadId(e.target.value)}
                            disabled={!!prefilledLeadId}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <option value="">-- Müşteri Seçin --</option>
                            {leads.map(l => (
                                <option key={l.id} value={l.id}>
                                    {l.company_name || l.customer_name || 'İsimsiz'} {l.customer_name && l.company_name ? `- ${l.customer_name}` : ''} ({l.phone_number || 'Tel yok'}) #{l.id.substring(0, 6)}
                                </option>
                            ))}
                        </select>
                        {searchingLeads && <span className="text-xs text-indigo-600 mt-1">Aranıyor...</span>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Cihaz Modeli *</label>
                            <select
                                value={productModel}
                                onChange={(e) => setProductModel(e.target.value)}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                            >
                                <option value="">-- Model Seçin --</option>
                                {catalogProducts.map(p => (
                                    <option key={p.id} value={p.product_code}>{p.product_code}</option>
                                ))}
                                <option value="Diger">Diğer / Eski Model</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Seri Numarası</label>
                            <input
                                type="text"
                                value={serialNumber}
                                onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                                placeholder="Örn: CP-2401-8XN2"
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase font-mono text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Satın Alma Tarihi</label>
                            <input
                                type="date"
                                value={purchaseDate}
                                onChange={(e) => setPurchaseDate(e.target.value)}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Garanti Süresi</label>
                            <select
                                value={warrantyMonths}
                                onChange={(e) => setWarrantyMonths(parseInt(e.target.value))}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                            >
                                <option value={12}>12 Ay</option>
                                <option value={24}>24 Ay (Standart)</option>
                                <option value={36}>36 Ay (+1 Yıl)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Güncel Durum</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                            >
                                <option value="active">Aktif</option>
                                <option value="inactive">Pasif</option>
                                <option value="service">Serviste</option>
                                <option value="retired">Hizmet Dışı</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Admin Notları</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Kurulum detayları, teslimat notları vb. (Müşteri görmez)"
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
                        {saving ? 'Kaydediliyor...' : 'Cihazı Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}
