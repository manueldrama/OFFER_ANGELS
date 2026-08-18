import React, { useEffect, useState } from 'react';
import { X, User, Phone, Mail, Clock, Calendar, MessageCircle, AlertTriangle, Link as LinkIcon, RefreshCw, Sparkles, MapPin, ShieldAlert, Send, BadgeCheck } from 'lucide-react';
import { AdminLeadsService, Lead, LeadNote, LeadEvent } from '../../../services/admin/leadsService';
import { businessTypeI18nKey } from '../../../services/admin/businessTypesService';
import { useTranslation } from 'react-i18next';
import { apiAssistanceService } from '../../../services/admin/aiAssistanceService';
import { BlockedContactsService } from '../../../services/admin/blockedContactsService';
import { AuthContext } from '../../../components/auth/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { VisitorHistorySection } from './VisitorHistorySection';
import { RelatedTasksPanel } from '../tasks/RelatedTasksPanel';
import { ManualSaleModal } from '../orders/ManualSaleModal';
import { supabase } from '../../../lib/supabase/client';

interface LeadDetailSlideOverProps {
    leadId: string | null;
    onClose: () => void;
}

export const LeadDetailSlideOver: React.FC<LeadDetailSlideOverProps> = ({ leadId, onClose }) => {
    const { t } = useTranslation('common');
    const { error: toastError, success } = useToast();
    const { user } = React.useContext(AuthContext);
    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);

    // AI States
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [nextAction, setNextAction] = useState<string | null>(null);

    // Manuel takip mesajı state
    const [isSendingFollowup, setIsSendingFollowup] = useState(false);
    const [recentFollowupAt, setRecentFollowupAt] = useState<Date | null>(null);

    // Offline kapatılan satışı siparişe/ciroya aktarma modalı
    const [manualSaleOpen, setManualSaleOpen] = useState(false);

    useEffect(() => {
        if (leadId) loadLeadData();
    }, [leadId]);

    const loadLeadData = async () => {
        setLoading(true);
        try {
            const data = await AdminLeadsService.getLeadProfile(leadId!);
            setLead(data.lead);
            setAiSummary(data.lead.ai_state?.summary || null);
            setNextAction(data.lead.ai_state?.next_action || null);
            // Son 1 saatte takip mesajı atılmış mı? — uyarı için
            await checkRecentFollowup(leadId!);
        } catch (err) {
            toastError("Hata", "Lead detayları yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const checkRecentFollowup = async (lid: string) => {
        try {
            const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
            const { data } = await supabase
                .from('whatsapp_messages')
                .select('sent_at')
                .eq('lead_id', lid)
                .eq('direction', 'outbound')
                .in('template_name', ['followup_no_reply', 'followup_no_reply_neutral'])
                .gte('sent_at', oneHourAgo)
                .order('sent_at', { ascending: false })
                .limit(1);
            if (data && data.length > 0 && data[0].sent_at) {
                setRecentFollowupAt(new Date(data[0].sent_at));
            } else {
                setRecentFollowupAt(null);
            }
        } catch {
            setRecentFollowupAt(null);
        }
    };

    const handleSendFollowup = async () => {
        if (!lead?.phone_number) {
            toastError("Hata", "Bu müşterinin telefon numarası yok.");
            return;
        }
        const warningSuffix = recentFollowupAt
            ? `\n\n⚠ UYARI: Bu müşteriye son 1 saatte (${format(recentFollowupAt, 'HH:mm', { locale: tr })}) zaten takip mesajı gönderildi.`
            : '';
        if (!window.confirm(`${lead.customer_name || 'Müşteri'} adlı kişiye kişisel hitaplı takip mesajı gönderilecek. Onaylıyor musunuz?${warningSuffix}`)) {
            return;
        }

        setIsSendingFollowup(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/internal/send-no-reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token ?? ''}`,
                },
                body: JSON.stringify({ lead_id: lead.id }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body.error || `Gönderim başarısız (${res.status})`);
            }
            const sal = body.salutation_resolved ? ` (${body.salutation_resolved})` : ' (nötr)';
            success("Gönderildi", `Takip mesajı atıldı${sal}. Şablon: ${body.template_name}`);
            await checkRecentFollowup(lead.id);
        } catch (err: any) {
            toastError("Gönderim Hatası", err.message || "Mesaj gönderilemedi.");
        } finally {
            setIsSendingFollowup(false);
        }
    };

    const generateAiSummary = async () => {
        if (!lead) return;
        setIsAiGenerating(true);
        try {
            const result = await apiAssistanceService.callAction(lead.id, 'summary');
            setAiSummary(result.summary);
            setNextAction(result.next_action);
            success("Yapay Zeka", "Müşteri analizi başarıyla güncellendi.");
        } catch (err: any) {
            toastError("AI Hata", err.message || "Özet oluşturulamadı.");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleBlock = async () => {
        if (!lead?.phone_number) {
            toastError("Hata", "Bu müşterinin telefon numarası yok.");
            return;
        }
        if (!window.confirm(`${lead.customer_name} adlı müşteriyi engellemek istediğinize emin misiniz?`)) return;

        setIsBlocking(true);
        try {
            await BlockedContactsService.blockContact(lead.phone_number, 'Lead detay sayfasından engellendi', user?.id);
            success("Başarılı", "Müşteri engellendi listesine eklendi.");
        } catch (err: any) {
            if (err.code === '23505') {
                toastError("Hata", "Bu numara zaten engellenmiş durumda.");
            } else {
                toastError("Hata", err.message || "Engelleme başarısız.");
            }
        } finally {
            setIsBlocking(false);
        }
    };

    if (!leadId) return null;

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
            <div className={`relative w-full max-w-lg bg-slate-50 h-full flex flex-col shadow-2xl transition-transform duration-300 transform ${leadId ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-600/10 flex items-center justify-center text-indigo-600">
                            <User size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">{lead?.customer_name || 'Yükleniyor...'}</h2>
                            <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                <span>{lead?.company_name || 'Bireysel'}</span>
                                {lead?.business_type && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                                        {t(businessTypeI18nKey(lead.business_type), { defaultValue: lead.business_type })}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {lead?.phone_number && (
                            <button 
                                onClick={handleBlock} 
                                disabled={isBlocking}
                                title="Müşteriyi Engelle"
                                className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-md transition-colors mr-2 disabled:opacity-50"
                            >
                                <ShieldAlert size={20} />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {loading ? (
                        <div className="flex justify-center items-center h-32">
                            <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-primary animate-spin"></div>
                        </div>
                    ) : lead ? (
                        <>
                            {/* AI Summary Block */}
                            <div className="bg-gradient-to-br from-fuchsia-50 to-indigo-50 border border-fuchsia-100/50 rounded-lg p-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <Sparkles size={64} />
                                </div>

                                <div className="flex items-center justify-between mb-3 relative z-10">
                                    <div className="flex items-center gap-2 text-fuchsia-700 font-bold">
                                        <Sparkles size={18} />
                                        Yapay Zeka Özeti
                                    </div>
                                    <button
                                        onClick={generateAiSummary}
                                        disabled={isAiGenerating}
                                        className="text-xs text-fuchsia-600 hover:text-fuchsia-800 flex items-center gap-1 font-medium bg-white/50 px-2.5 py-1.5 rounded-md border border-fuchsia-200 transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw size={12} className={isAiGenerating ? 'animate-spin' : ''} />
                                        {isAiGenerating ? 'Üretiliyor...' : aiSummary ? 'Yeniden Özetle' : 'Özet Çıkar'}
                                    </button>
                                </div>

                                <div className="relative z-10 space-y-3">
                                    {aiSummary ? (
                                        <>
                                            <p className="text-sm text-slate-700 leading-relaxed">
                                                {aiSummary}
                                            </p>
                                            {nextAction && (
                                                <div className="bg-white/60 rounded-lg p-3 border border-fuchsia-100">
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Önerilen Aksiyon</span>
                                                    <span className="text-sm font-medium text-slate-800">{nextAction}</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-sm text-slate-500 italic">
                                            Özet henüz oluşturulmadı. Müşteri verilerini analiz etmek için "Özet Çıkar" butonuna tıklayın.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="bg-white rounded-lg border border-slate-200 p-5">
                                <h3 className="text-sm font-bold text-slate-900 mb-4 tracking-tight">İletişim Bilgileri</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm">
                                        <Phone size={16} className="text-slate-400" />
                                        <span className={lead.phone_number ? 'text-slate-700' : 'text-slate-400 italic'}>
                                            {lead.phone_number || 'Belirtilmedi'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Mail size={16} className="text-slate-400" />
                                        <span className={lead.email ? 'text-slate-700' : 'text-slate-400 italic'}>
                                            {lead.email || 'Belirtilmedi'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Calendar size={16} className="text-slate-400" />
                                        <span className="text-slate-700">
                                            Kayıt: {format(new Date(lead.created_at), 'dd MMM yyyy, HH:mm', { locale: tr })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Anonymous browsing history (visitor profile linked at lead capture) */}
                            <VisitorHistorySection leadId={lead.id} />

                            {/* Görevler — lead'e bağlı işler, ekrandan ayrılmadan
                                tamamlanır/oluşturulur (eski ölü placeholder'ın yeri). */}
                            <RelatedTasksPanel
                                context={{
                                    entityType: 'lead',
                                    entityId: lead.id,
                                    entityLabel: lead.company_name
                                        ? `${lead.customer_name} (${lead.company_name})`
                                        : lead.customer_name,
                                    defaultAssignee: lead.assigned_to ?? null,
                                    sourceType: 'lead_detail',
                                    sourceId: lead.id,
                                }}
                            />
                        </>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-slate-100 shrink-0 space-y-2">
                    <div className="flex flex-col gap-1.5">
                        <button
                            onClick={handleSendFollowup}
                            disabled={isSendingFollowup || !lead?.phone_number}
                            title={!lead?.phone_number ? 'Telefon numarası yok' : 'Kişisel hitaplı takip mesajı gönder'}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Send size={15} />
                            {isSendingFollowup ? 'Gönderiliyor...' : 'Takip Mesajı Gönder'}
                        </button>
                        {recentFollowupAt && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 text-center">
                                ⚠ Son 1 saatte ({format(recentFollowupAt, 'HH:mm', { locale: tr })}) zaten gönderildi
                            </p>
                        )}
                        {/* Satış dışarıda kapatıldıysa: siparişe + ciroya aktar. */}
                        <button
                            onClick={() => setManualSaleOpen(true)}
                            disabled={!lead}
                            title="Dışarıda kapatılan satışı siparişlere aktar"
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <BadgeCheck size={15} />
                            Manuel Satış Kaydet
                        </button>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md text-sm transition-colors"
                    >
                        Kapat
                    </button>
                </div>
            </div>

            {manualSaleOpen && lead && (
                <ManualSaleModal
                    leadId={lead.id}
                    leadName={lead.customer_name || undefined}
                    onClose={() => setManualSaleOpen(false)}
                    onSaved={loadLeadData}
                />
            )}
        </div>
    );
};
