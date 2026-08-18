import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Send, Sparkles, RefreshCw } from 'lucide-react';
import { AdminLeadsService, Lead } from '../../../services/admin/leadsService';
import { AdminWhatsAppTemplatesService, WhatsAppTemplate } from '../../../services/admin/whatsappTemplatesUIService';
import { apiAssistanceService } from '../../../services/admin/aiAssistanceService';

interface ManualWhatsAppModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (data: { lead_id: string; phone_number: string; message_content: string; template_name?: string }) => Promise<void>;
}

export const ManualWhatsAppModal: React.FC<ManualWhatsAppModalProps> = ({ isOpen, onClose, onSend }) => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);

    const [selectedLeadId, setSelectedLeadId] = useState('');
    const [selectedTemplateName, setSelectedTemplateName] = useState('custom');
    const [messageContent, setMessageContent] = useState('');

    const [loadingData, setLoadingData] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');

    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiTone, setAiTone] = useState('professional');

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            setSelectedLeadId('');
            setSelectedTemplateName('custom');
            setMessageContent('');
            setError('');
        }
    }, [isOpen]);

    const fetchInitialData = async () => {
        setLoadingData(true);
        try {
            const [leadsRes, templatesRes] = await Promise.all([
                AdminLeadsService.listLeads({ limit: 100 }),
                AdminWhatsAppTemplatesService.listTemplates()
            ]);
            // Sadece telefonu olanları filtreleyelim
            setLeads(leadsRes.leads.filter(l => Boolean(l.phone_number)));
            setTemplates(templatesRes.filter(t => t.is_active !== false));
        } catch (err) {
            console.error('Data fetch error', err);
            setError('Veriler yüklenirken bir hata oluştu.');
        } finally {
            setLoadingData(false);
        }
    };

    const handleTemplateChange = (tmplName: string) => {
        setSelectedTemplateName(tmplName);
        if (tmplName === 'custom') {
            setMessageContent('');
        } else {
            const tmpl = templates.find(t => t.name === tmplName);
            if (tmpl) {
                setMessageContent(tmpl.content);
            }
        }
    };

    const handleGenerateAi = async () => {
        if (!selectedLeadId) {
            setError('Lütfen önce bir Müşteri (Lead) seçin.');
            return;
        }
        setIsAiGenerating(true);
        setError('');
        try {
            const result = await apiAssistanceService.callAction(selectedLeadId, 'suggest', aiTone);
            setMessageContent(result);
            setSelectedTemplateName('custom'); // switch back to custom
        } catch (err: any) {
            setError(err.message || 'Yapay zeka mesajı oluşturamadı.');
        } finally {
            setIsAiGenerating(false);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const selectedLead = leads.find(l => l.id === selectedLeadId);

        if (!selectedLead) {
            setError('Lütfen bir Müşteri (Lead) seçin.');
            return;
        }

        if (!selectedLead.phone_number) {
            setError('Seçilen müşterinin telefon numarası eksik.');
            return;
        }

        if (!messageContent.trim()) {
            setError('Mesaj içeriği boş olamaz.');
            return;
        }

        setIsSending(true);
        try {
            await onSend({
                lead_id: selectedLead.id,
                phone_number: selectedLead.phone_number,
                message_content: messageContent.trim(),
                template_name: selectedTemplateName === 'custom' ? undefined : selectedTemplateName
            });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Gönderim sırasında hata oluştu.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-500" />
                        Manuel WhatsApp Mesajı
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto max-h-[70vh]">
                    <form id="waForm" onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Alıcı Müşteri <span className="text-red-500">*</span></label>
                            <select
                                value={selectedLeadId}
                                onChange={(e) => setSelectedLeadId(e.target.value)}
                                className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                disabled={loadingData}
                            >
                                <option value="">Müşteri Seçin...</option>
                                {leads.map(l => (
                                    <option key={l.id} value={l.id}>
                                        {l.customer_name} ({l.phone_number})
                                    </option>
                                ))}
                            </select>
                            {loadingData && <p className="text-xs text-slate-400 mt-1">Veriler yükleniyor...</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Şablon Seçimi</label>
                            <select
                                value={selectedTemplateName}
                                onChange={(e) => handleTemplateChange(e.target.value)}
                                className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                disabled={loadingData}
                            >
                                <option value="custom">-- Özel Mesaj (Serbest Metin) --</option>
                                {templates.map(t => (
                                    <option key={t.name} value={t.name}>
                                        {t.name} ({t.language.toUpperCase()})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* AI Assistant Banner */}
                        {selectedLeadId && (
                            <div className="bg-gradient-to-br from-fuchsia-50 to-indigo-50 border border-fuchsia-100 rounded-lg p-4 flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-fuchsia-700 font-bold text-sm">
                                    <Sparkles size={16} /> Yapay Zeka (AI) Asistan
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={aiTone}
                                        onChange={(e) => setAiTone(e.target.value)}
                                        className="h-9 px-2 py-1 text-sm border border-fuchsia-200 rounded text-slate-700 bg-white focus:outline-none focus:border-fuchsia-400"
                                    >
                                        <option value="professional">Profesyonel / Kurumsal</option>
                                        <option value="warm">Sıcak / Samimi</option>
                                        <option value="urgent">Aciliyet Odaklı (Tetikleyici)</option>
                                        <option value="short">Kısa ve Öz</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleGenerateAi}
                                        disabled={isAiGenerating || loadingData}
                                        className="flex-1 px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <RefreshCw size={14} className={isAiGenerating ? 'animate-spin' : ''} />
                                        {isAiGenerating ? 'AI Düşünüyor...' : 'Mesaj Taslağı Oluştur'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Mesaj İçeriği <span className="text-red-500">*</span></label>
                            <textarea
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none font-mono"
                                placeholder="WhatsApp mesajınız..."
                            />
                            {selectedTemplateName !== 'custom' && (
                                <p className="text-xs text-amber-600 mt-1">
                                    Not: Sabit değişkenli ({'{{...}}'}) mesajlarda değerleri manuel doldurduğunuzdan emin olun.
                                </p>
                            )}
                        </div>
                    </form>
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSending}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        İptal
                    </button>
                    <button
                        type="submit"
                        form="waForm"
                        disabled={isSending}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {isSending ? 'Gönderiliyor...' : 'Mesajı Gönder'}
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
