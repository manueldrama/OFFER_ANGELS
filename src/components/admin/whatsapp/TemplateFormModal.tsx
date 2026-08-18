import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { WhatsAppTemplate } from '../../../services/admin/whatsappTemplatesUIService';
import { TemplatePreview } from './TemplatePreview';

interface TemplateFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<WhatsAppTemplate>) => Promise<void>;
    existingTemplate?: WhatsAppTemplate | null;
}

const TEMPLATE_TYPES = [
    { value: 'initial_offer', label: 'İlk Teklif (initial_offer)' },
    { value: 'followup_no_open', label: 'Açılmayanlar (followup_no_open)' },
    { value: 'followup_no_offer', label: 'Teklif Üretmeyenler (followup_no_offer)' },
    { value: 'followup_no_payment', label: 'Ödeme Yapmayanlar (followup_no_payment)' },
    { value: 'followup_payment_abandoned', label: 'Ödeme Yarım Kalanlar (followup_payment_abandoned)' }
];

const AVAILABLE_VARIABLES = ['name', 'company', 'offer_link', 'selected_model', 'campaign_name', 'support_contact'];

export const TemplateFormModal: React.FC<TemplateFormModalProps> = ({ isOpen, onClose, onSave, existingTemplate }) => {
    const isEditing = !!existingTemplate;

    const [name, setName] = useState('');
    const [content, setContent] = useState('');
    const [language, setLanguage] = useState('tr');
    const [isActive, setIsActive] = useState(true);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (existingTemplate) {
                setName(existingTemplate.name);
                setContent(existingTemplate.content);
                setLanguage(existingTemplate.language || 'tr');
                setIsActive(existingTemplate.is_active !== undefined ? existingTemplate.is_active : true);
            } else {
                setName('');
                setContent('');
                setLanguage('tr');
                setIsActive(true);
            }
            setError('');
        }
    }, [isOpen, existingTemplate]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim() || !content.trim()) {
            setError('Şablon Adı ve Mesaj İçeriği zorunludur.');
            return;
        }

        setIsSubmitting(true);
        try {
            // Extract unique variables used in the content automatically
            const foundVars = AVAILABLE_VARIABLES.filter(v => content.includes(`{{${v}}}`));

            await onSave({
                name: name.trim(),
                content: content.trim(),
                language,
                is_active: isActive,
                variables: foundVars
            });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Kayıt sırasında bir hata oluştu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const insertVariable = (variable: string) => {
        setContent(prev => prev + `{{${variable}}}`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800">
                        {isEditing ? 'Şablonu Düzenle' : 'Yeni WhatsApp Şablonu Ekle'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto flex-1 flex flex-col md:flex-row gap-8">
                    {/* Form Section */}
                    <form id="templateForm" onSubmit={handleSubmit} className="flex-1 space-y-5">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Şablon Seçimi (Tip) <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isEditing}
                                className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#ECA611]/20 focus:border-[#ECA611] transition-all bg-white disabled:bg-slate-50 disabled:text-slate-500"
                            >
                                <option value="">Bir şablon tipi seçin...</option>
                                {TEMPLATE_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">Bu sistemin kuralları tanıyabilmesi için zorunlu ID değeridir.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Dil</label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="w-full h-11 px-4 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#ECA611]/20 focus:border-[#ECA611] transition-all bg-white"
                                >
                                    <option value="tr">Türkçe</option>
                                    <option value="en">English</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Durum</label>
                                <div className="flex items-center h-11">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isActive}
                                            onChange={(e) => setIsActive(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ECA611]"></div>
                                        <span className="ms-3 text-sm font-medium text-slate-700">{isActive ? 'Aktif' : 'Pasif'}</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <label className="block text-sm font-medium text-slate-700">
                                    Mesaj İçeriği <span className="text-red-500">*</span>
                                </label>
                                <span className="text-xs text-slate-500">Maks 1024 karakter</span>
                            </div>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={6}
                                className="w-full p-4 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#ECA611]/20 focus:border-[#ECA611] transition-all resize-none font-sans text-sm"
                                placeholder={"Merhaba {{name}}, sana özel teklifimizi inceledin mi?\nLink: {{offer_link}}"}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Kullanılabilir Değişkenler
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {AVAILABLE_VARIABLES.map(v => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => insertVariable(v)}
                                        className="px-2 py-1 text-xs font-mono bg-slate-100 text-slate-600 rounded border border-slate-100 hover:bg-slate-200 hover:border-slate-300 transition-colors"
                                    >
                                        {'{{' + v + '}}'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </form>

                    {/* Preview Section */}
                    <div className="flex-1 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8 flex flex-col">
                        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            Whatsapp Önizleme
                        </h3>
                        <div className="flex-1 bg-slate-50 rounded-lg p-4 flex items-center justify-center border border-slate-200 shadow-inner">
                            <TemplatePreview content={content} />
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all disabled:opacity-50"
                    >
                        İptal
                    </button>
                    <button
                        type="submit"
                        form="templateForm"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-[#ECA611]/20 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? 'Kaydediliyor...' : 'Şablonu Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
};
