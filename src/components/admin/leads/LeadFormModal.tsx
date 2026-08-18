import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';

interface LeadFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { customer_name: string; company_name: string; phone_number: string; email: string; }) => Promise<void>;
    initialData?: { customer_name: string; company_name?: string; phone_number?: string; email?: string; } | null;
}

export const LeadFormModal: React.FC<LeadFormModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [name, setName] = useState(initialData?.customer_name || '');
    const [company, setCompany] = useState(initialData?.company_name || '');
    const [phone, setPhone] = useState(initialData?.phone_number || '');
    const [email, setEmail] = useState(initialData?.email || '');

    // Update state when initialData changes (e.g. when opening modal for a different lead)
    React.useEffect(() => {
        if (isOpen) {
            setName(initialData?.customer_name || '');
            setCompany(initialData?.company_name || '');
            setPhone(initialData?.phone_number || '');
            setEmail(initialData?.email || '');
            setError('');
        }
    }, [isOpen, initialData]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('Müşteri Adı zorunludur.');
            return;
        }
        if (!phone.trim() && !email.trim()) {
            setError('En az bir iletişim yöntemi (Telefon veya E-posta) belirtilmelidir.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSave({
                customer_name: name.trim(),
                company_name: company.trim(),
                phone_number: phone.trim(),
                email: email.trim()
            });

            // reset
            setName('');
            setCompany('');
            setPhone('');
            setEmail('');
            onClose();
        } catch (err: any) {
            setError(err.message || 'Kayıt sırasında hata oluştu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-indigo-600" />
                        {initialData ? 'Lead Düzenle' : 'Yeni Kurumsal Lead Ekle'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-md transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto">
                    <form id="leadForm" onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri Adı Soyadı <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="Örn: Ahmet Yılmaz"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Şirket / Klinik Adı</label>
                            <input
                                type="text"
                                value={company}
                                onChange={(e) => setCompany(e.target.value)}
                                className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="Örn: MedVoyage Clinic"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Telefon Numarası</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                                placeholder="+90 5XX XXX XX XX"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">E-Posta Adresi</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="ahmet@example.com"
                            />
                        </div>
                    </form>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        İptal
                    </button>
                    <button
                        type="submit"
                        form="leadForm"
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {isSubmitting ? 'Kaydediliyor...' : (initialData ? 'Leadi Güncelle' : 'Leadi Kaydet')}
                    </button>
                </div>
            </div>
        </div>
    );
};
