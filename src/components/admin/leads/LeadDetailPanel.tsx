import React, { useEffect, useState } from 'react';
import {
    Phone, Mail, Calendar, Sparkles, RefreshCw, Send, ShieldAlert, UserX,
    Link as LinkIcon, Activity, ExternalLink, Eye, History,
} from 'lucide-react';
import { AdminLeadsService, Lead, LeadEvent } from '../../../services/admin/leadsService';
import { apiAssistanceService } from '../../../services/admin/aiAssistanceService';
import { BlockedContactsService } from '../../../services/admin/blockedContactsService';
import { NotInterestedService } from '../../../services/admin/notInterestedService';
import { AuthContext } from '../../../components/auth/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { VisitorHistorySection } from './VisitorHistorySection';
import { RelatedTasksPanel } from '../tasks/RelatedTasksPanel';
import { supabase } from '../../../lib/supabase/client';

interface LeadDetailPanelProps {
    /** Açılacak lead — listedeki kayıt yeterli (panel kendi tam profilini çeker). */
    leadId: string;
}

/** lead_events.event_type → TR etiket (slide-over'daki zaman çizelgesinin zenginleştirilmiş hali). */
const EVENT_LABELS: Record<string, string> = {
    lead_created: 'Lead oluşturuldu',
    status_changed: 'Durum değişti',
    offer_created: 'Teklif oluşturuldu',
    offer_sent: 'Teklif gönderildi',
    link_opened: 'Teklif görüntülendi',
    payment_started: 'Ödeme başlatıldı',
    payment_completed: 'Ödeme tamamlandı',
    note_added: 'Not eklendi',
    assigned: 'Temsilci atandı',
    followup_sent: 'Takip mesajı gönderildi',
    task_created: 'Görev açıldı',
    task_completed: 'Görev tamamlandı',
};

/**
 * Müşteri Yönetimi tablosunda satır içi açılan (akordiyon) lead detay paneli.
 * Slide-over (LeadDetailSlideOver) ile aynı bilgileri inline gösterir; ek olarak
 * teklif linkleri ve gerçek aktivite zaman çizelgesini de getirir.
 * Slide-over'a dokunulmadı — bu panel kendi verisini bağımsız çeker (canlı leadler için izole).
 */
export const LeadDetailPanel: React.FC<LeadDetailPanelProps> = ({ leadId }) => {
    const { error: toastError, success } = useToast();
    const { session } = React.useContext(AuthContext);

    const [lead, setLead] = useState<Lead | null>(null);
    const [events, setEvents] = useState<LeadEvent[]>([]);
    const [offerLinks, setOfferLinks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [nextAction, setNextAction] = useState<string | null>(null);
    const [isAiGenerating, setIsAiGenerating] = useState(false);

    const [isSendingFollowup, setIsSendingFollowup] = useState(false);
    const [recentFollowupAt, setRecentFollowupAt] = useState<Date | null>(null);
    const [isBlocking, setIsBlocking] = useState(false);
    const [isMarkingNI, setIsMarkingNI] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            try {
                const data = await AdminLeadsService.getLeadProfile(leadId);
                if (!alive) return;
                setLead(data.lead);
                setEvents(data.events || []);
                setOfferLinks(data.offerLinks || []);
                setAiSummary(data.lead.ai_state?.summary || null);
                setNextAction(data.lead.ai_state?.next_action || null);
                await checkRecentFollowup(leadId);
            } catch {
                if (alive) toastError('Hata', 'Lead detayları yüklenemedi.');
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadId]);

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
            setRecentFollowupAt(data && data.length > 0 && data[0].sent_at ? new Date(data[0].sent_at) : null);
        } catch {
            setRecentFollowupAt(null);
        }
    };

    const generateAiSummary = async () => {
        if (!lead) return;
        setIsAiGenerating(true);
        try {
            const result = await apiAssistanceService.callAction(lead.id, 'summary');
            setAiSummary(result.summary);
            setNextAction(result.next_action);
            success('Yapay Zeka', 'Müşteri analizi güncellendi.');
        } catch (err: any) {
            toastError('AI Hata', err.message || 'Özet oluşturulamadı.');
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleSendFollowup = async () => {
        if (!lead?.phone_number) { toastError('Hata', 'Bu müşterinin telefon numarası yok.'); return; }
        const warningSuffix = recentFollowupAt
            ? `\n\n⚠ UYARI: Bu müşteriye son 1 saatte (${format(recentFollowupAt, 'HH:mm', { locale: tr })}) zaten takip mesajı gönderildi.`
            : '';
        if (!window.confirm(`${lead.customer_name || 'Müşteri'} adlı kişiye kişisel hitaplı takip mesajı gönderilecek. Onaylıyor musunuz?${warningSuffix}`)) return;

        setIsSendingFollowup(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/internal/send-no-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
                body: JSON.stringify({ lead_id: lead.id }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Gönderim başarısız (${res.status})`);
            const sal = body.salutation_resolved ? ` (${body.salutation_resolved})` : ' (nötr)';
            success('Gönderildi', `Takip mesajı atıldı${sal}.`);
            await checkRecentFollowup(lead.id);
        } catch (err: any) {
            toastError('Gönderim Hatası', err.message || 'Mesaj gönderilemedi.');
        } finally {
            setIsSendingFollowup(false);
        }
    };

    const handleMarkNotInterested = async () => {
        if (!lead?.id) return;
        if (!window.confirm(`${lead.customer_name || 'Bu müşteri'} "İlgilenmiyor" olarak işaretlenecek: remarketing/otomasyondan çıkacak ve İlgilenmeyenler sayfasına taşınacak. Emin misiniz?`)) return;
        setIsMarkingNI(true);
        try {
            await NotInterestedService.mark(lead.id, 'admin');
            success('İşaretlendi', 'Müşteri İlgilenmeyenler listesine taşındı.');
        } catch (err: any) {
            toastError('Hata', err.message || 'İşaretleme başarısız.');
        } finally {
            setIsMarkingNI(false);
        }
    };

    const handleBlock = async () => {
        if (!lead?.phone_number) { toastError('Hata', 'Bu müşterinin telefon numarası yok.'); return; }
        if (!window.confirm(`${lead.customer_name} adlı müşteriyi engellemek istediğinize emin misiniz?`)) return;
        setIsBlocking(true);
        try {
            await BlockedContactsService.blockContact(lead.phone_number, 'Lead detay panelinden engellendi', session?.user?.id);
            success('Başarılı', 'Müşteri engellendi listesine eklendi.');
        } catch (err: any) {
            if (err.code === '23505') toastError('Hata', 'Bu numara zaten engellenmiş durumda.');
            else toastError('Hata', err.message || 'Engelleme başarısız.');
        } finally {
            setIsBlocking(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
            </div>
        );
    }
    if (!lead) return null;

    return (
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1.4fr_1fr]" style={{ animation: 'cpFadeIn .18s ease' }}>
            {/* ── Sol kolon ── */}
            <div className="min-w-0 space-y-4">
                {/* AI özeti */}
                <div className="relative overflow-hidden rounded-xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 to-indigo-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[13px] font-bold text-fuchsia-700">
                            <Sparkles size={16} />Yapay Zeka Özeti
                            {lead.ai_state?.score != null && (
                                <span className="rounded-md bg-white/60 px-1.5 py-0.5 text-[11px] font-bold text-fuchsia-700">
                                    {lead.ai_state.score}/100
                                </span>
                            )}
                        </div>
                        <button
                            onClick={generateAiSummary}
                            disabled={isAiGenerating}
                            className="flex items-center gap-1 rounded-md border border-fuchsia-200 bg-white/50 px-2.5 py-1.5 text-[11px] font-medium text-fuchsia-600 transition-colors hover:text-fuchsia-800 disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={isAiGenerating ? 'animate-spin' : ''} />
                            {isAiGenerating ? 'Üretiliyor...' : aiSummary ? 'Yeniden Özetle' : 'Özet Çıkar'}
                        </button>
                    </div>
                    {aiSummary ? (
                        <div className="space-y-2">
                            <p className="text-[13px] leading-relaxed text-slate-700">{aiSummary}</p>
                            {nextAction && (
                                <div className="rounded-lg border border-fuchsia-100 bg-white/60 p-2.5">
                                    <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Önerilen Aksiyon</span>
                                    <span className="text-[13px] font-medium text-slate-800">{nextAction}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-[12.5px] italic text-slate-500">
                            Özet henüz oluşturulmadı. "Özet Çıkar" ile müşteri verilerini analiz edebilirsiniz.
                        </p>
                    )}
                </div>

                {/* İletişim bilgileri */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 text-[12px] font-bold tracking-tight text-slate-900">İletişim Bilgileri</h3>
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 text-[13px]">
                            <Phone size={15} className="text-slate-400" />
                            <span className={lead.phone_number ? 'text-slate-700' : 'italic text-slate-400'}>{lead.phone_number || 'Belirtilmedi'}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-[13px]">
                            <Mail size={15} className="text-slate-400" />
                            <span className={lead.email ? 'text-slate-700' : 'italic text-slate-400'}>{lead.email || 'Belirtilmedi'}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-[13px]">
                            <Calendar size={15} className="text-slate-400" />
                            <span className="text-slate-700">Kayıt: {format(new Date(lead.created_at), 'dd MMM yyyy, HH:mm', { locale: tr })}</span>
                        </div>
                    </div>
                </div>

                {/* Teklif linkleri */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-bold tracking-tight text-slate-900">
                        <LinkIcon size={13} className="text-slate-400" />Teklif Linkleri
                        {offerLinks.length > 0 && <span className="text-[11px] font-semibold text-slate-400">({offerLinks.length})</span>}
                    </h3>
                    {offerLinks.length === 0 ? (
                        <p className="text-[12.5px] italic text-slate-400">Bu lead için henüz teklif linki oluşturulmadı.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {offerLinks.slice(0, 5).map((link: any) => {
                                const opens = (link.offer_analytics?.filter((a: any) => a.action_type === 'link_opened').length) ?? 0;
                                return (
                                    <a
                                        key={link.id}
                                        href={`/offer/${link.token}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2 transition-colors hover:border-indigo-400"
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="truncate font-mono text-[11px] font-bold text-slate-900">{link.token}</span>
                                            {!link.is_active && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">İptal</span>}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400">
                                            <span className="inline-flex items-center gap-1"><Eye size={11} />{opens}</span>
                                            <span className="text-slate-400">{format(new Date(link.created_at), 'dd.MM.yyyy', { locale: tr })}</span>
                                            <ExternalLink size={12} className="text-slate-300" />
                                        </div>
                                    </a>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Aksiyonlar */}
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                    <button
                        onClick={handleSendFollowup}
                        disabled={isSendingFollowup || !lead.phone_number}
                        title={!lead.phone_number ? 'Telefon numarası yok' : 'Kişisel hitaplı takip mesajı gönder'}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Send size={14} />{isSendingFollowup ? 'Gönderiliyor...' : 'Takip Mesajı Gönder'}
                    </button>
                    {lead.phone_number && (
                        <button
                            onClick={handleBlock}
                            disabled={isBlocking}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        >
                            <ShieldAlert size={14} />{isBlocking ? 'Engelleniyor...' : 'Engelle'}
                        </button>
                    )}
                    <button
                        onClick={handleMarkNotInterested}
                        disabled={isMarkingNI}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 text-[12px] font-semibold text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50"
                        title="Remarketing'den çıkar, İlgilenmeyenler'e taşı"
                    >
                        <UserX size={14} />{isMarkingNI ? 'İşaretleniyor...' : 'İlgilenmiyor'}
                    </button>
                    {recentFollowupAt && (
                        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                            ⚠ Son 1 saatte ({format(recentFollowupAt, 'HH:mm', { locale: tr })}) gönderildi
                        </span>
                    )}
                </div>
            </div>

            {/* ── Sağ kolon ── */}
            <div className="min-w-0 space-y-4 lg:border-l lg:border-slate-200 lg:pl-4">
                {/* Görevler — lead'in yanında oluştur/tamamla (v4 bağlamsal katman) */}
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

                {/* Ziyaretçi geçmişi (anonim gezinme) */}
                <VisitorHistorySection leadId={lead.id} />

                {/* Aktivite zaman çizelgesi */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-bold tracking-tight text-slate-900">
                        <History size={13} className="text-slate-400" />Geçmiş Aktiviteler
                    </h3>
                    {events.length === 0 ? (
                        <p className="text-[12.5px] italic text-slate-400">Henüz aktivite kaydı yok.</p>
                    ) : (
                        <div className="relative pl-[18px]">
                            <span className="absolute bottom-1 left-[5px] top-1 w-px bg-slate-200" />
                            {events.slice(0, 8).map((ev) => (
                                <div key={ev.id} className="relative pb-3 last:pb-0">
                                    <span className="absolute -left-[16px] top-[3px] h-[9px] w-[9px] rounded-full border-2 border-indigo-400 bg-white" />
                                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-900">
                                        <Activity size={11} className="text-slate-300" />
                                        {EVENT_LABELS[ev.event_type] || ev.event_type}
                                    </div>
                                    <div className="mt-0.5 text-[10.5px] text-slate-400">
                                        {format(new Date(ev.created_at), 'dd MMM yyyy, HH:mm', { locale: tr })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
