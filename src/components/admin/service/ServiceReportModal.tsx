import React, { useState, useRef } from 'react';
import { X, FileText, CheckCircle2, Loader2, AlertTriangle, CreditCard, Camera, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../lib/supabase/client';
import { ServiceRequest } from '../../../types';
import { PortalNotificationsService } from '../../../services/portalNotificationsService';
import { AdminCustomerDevicesService } from '../../../services/admin/customerDevicesService';

interface ServiceReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: ServiceRequest & { leads: { customer_name: string } };
    onSuccess: () => void;
}

const QUICK_ACTIONS = [
    'Cihaz temizliği',
    'Yazılım güncelleme',
    'Parça değişimi',
    'Kalibrasyon',
    'Test & kontrol',
    'Nozzle değişimi',
    'Hortum değişimi',
    'Filtre temizliği',
];

export default function ServiceReportModal({ isOpen, onClose, request, onSuccess }: ServiceReportModalProps) {
    const [loading, setLoading] = useState(false);
    const [selectedActions, setSelectedActions] = useState<string[]>([]);
    const [afterPhotos, setAfterPhotos] = useState<{ file: File; url: string }[]>([]);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [form, setForm] = useState({
        actionsTaken: '',
        partsReplaced: '',
        technicianNotes: '',
        isOutOfWarranty: false,
        serviceFee: 0
    });

    const toggleAction = (action: string) => {
        setSelectedActions(prev =>
            prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]
        );
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        const newPhotos = files.map(file => ({ file, url: URL.createObjectURL(file as Blob) }));
        setAfterPhotos(prev => [...prev, ...newPhotos]);
        e.target.value = '';
    };

    const removePhoto = (index: number) => {
        setAfterPhotos(prev => {
            URL.revokeObjectURL(prev[index].url);
            return prev.filter((_, i) => i !== index);
        });
    };

    const uploadPhotos = async (): Promise<string[]> => {
        const urls: string[] = [];
        for (const photo of afterPhotos) {
            const fileExt = photo.file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 11)}_${Date.now()}.${fileExt}`;
            const filePath = `service-reports/${request.id}/${fileName}`;
            const { error } = await supabase.storage.from('whatsapp_media').upload(filePath, photo.file);
            if (!error) {
                const { data } = supabase.storage.from('whatsapp_media').getPublicUrl(filePath);
                urls.push(data.publicUrl);
            }
        }
        return urls;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Combine checklist + free text
            const checklistText = selectedActions.length > 0 ? selectedActions.join(', ') : '';
            const freeText = form.actionsTaken.trim();
            const combinedActions = [checklistText, freeText].filter(Boolean).join('\n');

            // Upload after photos
            let photoUrls: string[] = [];
            if (afterPhotos.length > 0) {
                setUploadingPhotos(true);
                photoUrls = await uploadPhotos();
                setUploadingPhotos(false);
            }

            const report: any = {
                completed_at: new Date().toISOString(),
                actions: combinedActions,
                parts: form.partsReplaced,
                notes: form.technicianNotes,
                fees: form.isOutOfWarranty ? { service_fee: form.serviceFee } : null
            };
            if (photoUrls.length > 0) {
                report.after_photos = photoUrls;
            }

            // Append to service_reports array (backwards compatible)
            const existingLogs = (request.diagnostic_logs as any) || {};
            const existingReports: any[] = existingLogs.service_reports || [];
            // Migrate old single service_report into array if exists
            if (existingLogs.service_report && existingReports.length === 0) {
                existingReports.push(existingLogs.service_report);
            }
            existingReports.push(report);

            const { error } = await supabase
                .from('service_requests')
                .update({
                    status: 'resolved',
                    resolved_at: new Date().toISOString(),
                    diagnostic_logs: {
                        ...existingLogs,
                        service_report: report, // keep for backwards compat
                        service_reports: existingReports
                    }
                })
                .eq('id', request.id);

            if (error) throw error;

            // Save as service note (visible to customer)
            const noteContent = `Servis Raporu: ${combinedActions}${form.partsReplaced ? `\nDeğişen Parçalar: ${form.partsReplaced}` : ''}${form.isOutOfWarranty ? `\nServis Ücreti: ₺${form.serviceFee}` : ''}`;
            await supabase.from('service_notes').insert({
                service_request_id: request.id,
                author_type: 'admin',
                content: noteContent,
                is_internal: false
            });

            // Also save internal technician notes if provided
            if (form.technicianNotes.trim()) {
                await supabase.from('service_notes').insert({
                    service_request_id: request.id,
                    author_type: 'admin',
                    content: form.technicianNotes,
                    is_internal: true
                });
            }

            // Send portal notification for service report
            if (request.lead_id) {
                PortalNotificationsService.createNotification(request.lead_id, {
                    title: 'Servis Raporunuz Hazırlandı',
                    message: `"${request.title}" başlıklı servis talebinizin raporu tamamlandı. Detayları portaldan inceleyebilirsiniz.`,
                    type: 'success',
                    link: '/portal/service',
                }).catch(err => console.error('[ServiceReportModal] Portal notification failed:', err));
            }

            // Void warranty if out-of-warranty and device is linked
            if (form.isOutOfWarranty && request.customer_device_id) {
                AdminCustomerDevicesService.voidWarranty(
                    request.customer_device_id,
                    'Servis raporu: Garanti kapsamı dışı işlem'
                ).catch(err => console.error('[ServiceReportModal] Warranty void failed:', err));
            }

            // Cleanup
            afterPhotos.forEach(p => URL.revokeObjectURL(p.url));
            setAfterPhotos([]);
            setSelectedActions([]);
            setForm({ actionsTaken: '', partsReplaced: '', technicianNotes: '', isOutOfWarranty: false, serviceFee: 0 });

            onSuccess();
            onClose();
        } catch (err) {
            console.error('Report error:', err);
            alert('Rapor kaydedilirken bir hata oluştu.');
        } finally {
            setLoading(false);
            setUploadingPhotos(false);
        }
    };

    if (!isOpen) return null;

    const rma = (request as any).rma_number;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white w-full max-w-xl rounded-xl shadow-lg overflow-hidden border border-slate-200"
                >
                    <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                                    <FileText size={22} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">Servis Raporu Yaz</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        {request.leads?.customer_name} {rma && <span className="text-indigo-500">• {rma}</span>}
                                    </p>
                                </div>
                            </div>
                            <button type="button" onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Content — Single Column */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">

                            {/* Quick Action Chips */}
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Yapılan İşlemler</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {QUICK_ACTIONS.map(action => (
                                        <button
                                            key={action}
                                            type="button"
                                            onClick={() => toggleAction(action)}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                                                selectedActions.includes(action)
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            {selectedActions.includes(action) && <span className="mr-1">✓</span>}
                                            {action}
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm transition-all resize-none bg-white"
                                    value={form.actionsTaken}
                                    onChange={(e) => setForm(prev => ({ ...prev, actionsTaken: e.target.value }))}
                                    placeholder="Ek detay veya yukarıdakiler dışında yapılan işlemler..."
                                />
                            </div>

                            {/* Parts Replaced */}
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Değişen Parçalar</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm transition-all bg-white"
                                    value={form.partsReplaced}
                                    onChange={(e) => setForm(prev => ({ ...prev, partsReplaced: e.target.value }))}
                                    placeholder="Nozzle, Hortum vb."
                                />
                            </div>

                            {/* Technician Notes */}
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Teknisyen Notları</label>
                                <textarea
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm transition-all resize-none bg-white"
                                    value={form.technicianNotes}
                                    onChange={(e) => setForm(prev => ({ ...prev, technicianNotes: e.target.value }))}
                                    placeholder="Müşteriye cihazı dik tutması gerektiği söylendi."
                                />
                            </div>

                            {/* After Photos */}
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Servis Sonrası Fotoğraflar</label>
                                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />

                                <div className="flex flex-wrap gap-2">
                                    {afterPhotos.map((photo, i) => (
                                        <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                                            <img src={photo.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(i)}
                                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                                    >
                                        <Camera size={20} />
                                        <span className="text-[9px] mt-0.5 font-medium">Ekle</span>
                                    </button>
                                </div>
                            </div>

                            {/* Billing Section */}
                            <div className={`p-4 rounded-lg border transition-all ${form.isOutOfWarranty ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={16} className={form.isOutOfWarranty ? 'text-amber-600' : 'text-slate-400'} />
                                        <span className={`text-sm font-bold ${form.isOutOfWarranty ? 'text-amber-900' : 'text-slate-500'}`}>Garanti Kapsamı Dışı</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, isOutOfWarranty: !prev.isOutOfWarranty }))}
                                        className={`w-11 h-6 rounded-full relative transition-all ${form.isOutOfWarranty ? 'bg-amber-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${form.isOutOfWarranty ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>

                                {form.isOutOfWarranty && (
                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-amber-200">
                                            <CreditCard size={16} className="text-amber-600 shrink-0" />
                                            <input
                                                type="number"
                                                className="bg-transparent border-none outline-none text-sm font-bold w-full"
                                                placeholder="Servis Ücreti (₺)"
                                                value={form.serviceFee || ''}
                                                onChange={(e) => setForm(prev => ({ ...prev, serviceFee: Number(e.target.value) }))}
                                            />
                                        </div>
                                        {request.customer_device_id ? (
                                            <p className="text-[10px] text-red-600 font-semibold">⚠ Rapor kaydedildiğinde cihazın garantisi otomatik olarak iptal edilecektir.</p>
                                        ) : (
                                            <p className="text-[10px] text-amber-700 font-medium">⚠ Bu servis talebi bir cihaza bağlı değil — garanti otomatik iptal edilemez. Garantiyi manuel iptal etmek için Garanti Takip sayfasını kullanın.</p>
                                        )}
                                        <p className="text-[10px] text-amber-700 font-medium">Bu tutar, müşterinin portalında 'Ödeme Bekleniyor' olarak belirecektir.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button type="button" onClick={onClose} className="flex-1 py-3.5 font-bold text-slate-400 hover:text-slate-600 transition-colors">Vazgeç</button>
                            <button
                                disabled={loading || (selectedActions.length === 0 && !form.actionsTaken.trim())}
                                type="submit"
                                className="flex-[2] bg-slate-900 text-white font-black py-3.5 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        {uploadingPhotos ? 'Fotoğraflar yükleniyor...' : 'Kaydediliyor...'}
                                    </>
                                ) : (
                                    <>
                                        Raporu Kaydet ve Çözümlendi Yap
                                        <CheckCircle2 size={16} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
