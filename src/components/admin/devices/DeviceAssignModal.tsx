import React, { useState, useEffect } from 'react';
import { X, Save, Search, UserPlus } from 'lucide-react';
import { AdminCustomerDevicesService } from '../../../services/admin/customerDevicesService';
import { AdminLeadsService } from '../../../services/admin/leadsService';
import { CustomerDevice } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';

interface DeviceAssignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    device: CustomerDevice | null;
}

export default function DeviceAssignModal({ isOpen, onClose, onSuccess, device }: DeviceAssignModalProps) {
    const [leadId, setLeadId] = useState('');
    const [leads, setLeads] = useState<any[]>([]);
    const [searchLead, setSearchLead] = useState('');
    const [searchingLeads, setSearchingLeads] = useState(false);
    const [warrantyMonths, setWarrantyMonths] = useState(24);
    const [saving, setSaving] = useState(false);
    const { success, error } = useToast();

    // Prevent body scroll + fetch model-specific warranty config
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setLeadId('');
            setSearchLead('');
            // Load warranty config for this device's model, fallback to 24
            if (device?.product_model) {
                AdminCustomerDevicesService.getWarrantyConfigurations().then(configs => {
                    const model = device.product_model.trim().toLowerCase();
                    const match = configs.find(c => c.product_model.trim().toLowerCase() === model);
                    setWarrantyMonths(match?.default_warranty_months || 24);
                }).catch(() => setWarrantyMonths(24));
            } else {
                setWarrantyMonths(24);
            }
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    // Load recent leads on mount so dropdown isn't empty
    useEffect(() => {
        if (isOpen) {
            AdminLeadsService.listLeads({ limit: 20 }).then(res => setLeads(res.leads)).catch(() => {});
        }
    }, [isOpen]);

    const handleSearchLeads = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchLead(query);
        if (query.length < 2) {
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
        if (!device) return;
        if (!leadId) return error('Hata', 'Lütfen bir müşteri seçin.');

        setSaving(true);
        try {
            await AdminCustomerDevicesService.assignDeviceToCustomer(device.id, leadId, warrantyMonths);
            success('Başarılı', 'Cihaz müşteriye atandı ve garanti başlatıldı.');
            onSuccess();
        } catch (err: any) {
            console.error('[DeviceAssignModal] assignDevice error:', err);
            error('Hata', err?.message || 'Cihaz atanırken bir sorun oluştu.');
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
        } catch { return '—'; }
    };

    if (!isOpen || !device) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Cihaz Atama</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            <span className="font-mono">{device.serial_number || '—'}</span> · {device.product_model}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-6 flex-1">
                    {/* Device Info Card */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <UserPlus size={16} className="text-indigo-500" />
                            <span className="text-sm font-semibold text-slate-700">Cihaz Bilgileri</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <span className="block text-xs text-slate-400">Seri Numarası</span>
                                <span className="text-sm font-mono text-slate-800">{device.serial_number || '—'}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-400">Model</span>
                                <span className="text-sm text-slate-800">{device.product_model}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-400">Üretim Tarihi</span>
                                <span className="text-sm text-slate-800">{formatDate(device.manufactured_at)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Lead Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Müşteri Seçimi *</label>
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
                        <select
                            value={leadId}
                            onChange={(e) => setLeadId(e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
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

                    {/* Warranty Duration */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Garanti Süresi</label>
                        <select
                            value={warrantyMonths}
                            onChange={(e) => setWarrantyMonths(parseInt(e.target.value))}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                        >
                            {[6, 12, 18, 24, 36, 48].map(m => (
                                <option key={m} value={m}>{m} Ay{m === warrantyMonths ? ' (Model Varsayılanı)' : ''}</option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">Garanti Politikası ayarlarından model bazlı varsayılan otomatik yüklenir.</p>
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
                        {saving ? 'Atanıyor...' : 'Ata ve Garantiyi Başlat'}
                    </button>
                </div>
            </div>
        </div>
    );
}
