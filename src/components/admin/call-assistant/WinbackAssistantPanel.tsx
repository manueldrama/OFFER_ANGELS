import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Flame, Sparkles, Clock3, PartyPopper, ListChecks } from 'lucide-react';
import { MetricCard } from '../../ui/MetricCard';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRealtime } from '../../../hooks/useAdminRealtime';
import { useAssignedLeadIds } from '../../../hooks/useAssignedLeadIds';
import { supabase } from '../../../lib/supabase/client';
import {
    callAssistantService, type WinbackQueueItem, type WinbackOutcome,
} from '../../../services/admin/callAssistantService';
import { AdminLeadsService } from '../../../services/admin/leadsService';
import { AdminOfferLinksService } from '../../../services/admin/offerLinksService';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { WhatsAppQuickSend } from '../leads/WhatsAppQuickSend';
import { NewOfferDrawer } from '../../../pages/admin/whatsapp/components/NewOfferDrawer';
import { ExtendOfferExpiryDialog } from '../offers/ExtendOfferExpiryDialog';
import { WinbackSessionCard } from './WinbackSessionCard';
import { WinbackQueueRail } from './WinbackQueueRail';
import type { CallBrief } from './CallBriefPanel';

const WIN_OUTCOME_TOAST: Record<WinbackOutcome, string> = {
    contacted: 'Arandı olarak işaretlendi',
    returned: 'Geri döndü olarak işaretlendi 🎉',
    declined: 'İlgilenmiyor olarak kapatıldı',
    reoffered: 'Yeniden teklif olarak işaretlendi',
    snooze: 'Sonraya ertelendi',
};

type WinFilterId = 'all' | 'high' | 'mid' | 'low' | 'pending' | 'done' | 'expired' | 'uncalled';

const isExpired = (i: WinbackQueueItem) =>
    !!i.candidate.offerValidUntil && new Date(i.candidate.offerValidUntil).getTime() < Date.now();

const WIN_FILTER_MATCH: Record<WinFilterId, (i: WinbackQueueItem) => boolean> = {
    all: () => true,
    high: (i) => i.bucket === 'high',
    mid: (i) => i.bucket === 'mid',
    low: (i) => i.bucket === 'low',
    pending: (i) => !i.winbackStatus,
    done: (i) => !!i.winbackStatus,
    expired: isExpired,
    uncalled: (i) => i.callInfo == null,
};

const WIN_CHIPS: { id: WinFilterId; label: string }[] = [
    { id: 'pending', label: 'Takip bekleyen' },
    { id: 'done', label: 'Takip edildi' },
    { id: 'expired', label: 'Süresi geçti' },
    { id: 'uncalled', label: 'Hiç aranmadı' },
];

/** Arama Asistanı'nın "Geri Kazanım" modu — ölü/sessiz adayları AI brifingli, sıralı arar. */
export function WinbackAssistantPanel() {
    const toast = useToast();
    const [items, setItems] = useState<WinbackQueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [current, setCurrent] = useState(0);
    const [saving, setSaving] = useState(false);
    const [filterId, setFilterId] = useState<WinFilterId>('all');

    const [waLead, setWaLead] = useState<WinbackQueueItem | null>(null);
    const [extendLead, setExtendLead] = useState<WinbackQueueItem | null>(null);
    const [newOfferLead, setNewOfferLead] = useState<WinbackQueueItem | null>(null);
    const [followupBusy, setFollowupBusy] = useState(false);
    const [confirmState, setConfirmState] = useState<{
        title: string; description?: string; confirmLabel?: string; tone?: 'danger' | 'default'; onConfirm: () => Promise<void>;
    } | null>(null);
    const [confirmBusy, setConfirmBusy] = useState(false);

    const [brief, setBrief] = useState<CallBrief | null>(null);
    const [briefLoading, setBriefLoading] = useState(false);
    const [briefError, setBriefError] = useState<string | null>(null);
    const briefReqId = useRef(0);
    const currentLeadIdRef = useRef<string | null>(null);

    const filteredItems = useMemo(() => items.filter(WIN_FILTER_MATCH[filterId]), [items, filterId]);
    const countFor = useCallback((id: WinFilterId) => items.filter(WIN_FILTER_MATCH[id]).length, [items]);
    const toggleFilter = (id: WinFilterId) => setFilterId((prev) => (prev === id && id !== 'all' ? 'all' : id));

    const activeItem = filteredItems[current] || null;
    const activeLeadId = activeItem?.leadId ?? null;
    useEffect(() => { currentLeadIdRef.current = activeLeadId; }, [activeLeadId]);

    // Liste değişince odaktaki kişiyi koru; yoksa indeksi sınırla.
    useEffect(() => {
        setCurrent((c) => {
            const keepId = currentLeadIdRef.current;
            if (keepId) {
                const idx = filteredItems.findIndex((it) => it.leadId === keepId);
                if (idx >= 0) return idx;
            }
            return Math.min(c, Math.max(0, filteredItems.length - 1));
        });
    }, [filteredItems]);

    // Satış temsilcisi winback'te de sadece kendi leadlerini görür (admin: global).
    const scopeLeadIds = useAssignedLeadIds();
    const scopeKey = scopeLeadIds === undefined ? 'global' : scopeLeadIds === null ? 'pending' : scopeLeadIds.join(',');

    const fetchQueue = useCallback(async () => {
        if (scopeLeadIds === null) return; // lead listesi çözülene dek bekle
        try {
            setItems(await callAssistantService.buildWinbackQueue(scopeLeadIds ?? undefined));
        } catch (e: any) {
            toast.error('Geri kazanım sırası yüklenemedi', e?.message);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast, scopeKey]);

    useEffect(() => { fetchQueue(); }, [fetchQueue]);
    useAdminRealtime(['lead_events', 'leads', 'offer_links'], () => { fetchQueue(); });

    const loadBrief = useCallback(async (leadId: string) => {
        const reqId = ++briefReqId.current;
        setBrief(null); setBriefError(null); setBriefLoading(true);
        try {
            const b = await callAssistantService.getCallBrief(leadId, 'winback');
            if (reqId === briefReqId.current) setBrief(b);
        } catch (e: any) {
            if (reqId === briefReqId.current) setBriefError(e?.message || 'hata');
        } finally {
            if (reqId === briefReqId.current) setBriefLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!activeLeadId) { setBrief(null); setBriefLoading(false); setBriefError(null); return; }
        setBrief(null); setBriefError(null); setBriefLoading(true);
        const t = setTimeout(() => loadBrief(activeLeadId), 450);
        return () => clearTimeout(t);
    }, [activeLeadId, loadBrief]);

    const dropActive = (leadId: string) => setItems((prev) => prev.filter((it) => it.leadId !== leadId));

    const handleOutcome = async (outcome: WinbackOutcome, opts?: { note?: string; snoozeHours?: number; untilIso?: string }) => {
        if (!activeItem || saving) return;
        setSaving(true);
        try {
            await callAssistantService.recordWinbackOutcome(activeItem.leadId, activeItem.candidate.offerToken, outcome, opts);
            toast.success(WIN_OUTCOME_TOAST[outcome]);
            dropActive(activeItem.leadId);
        } catch (e: any) {
            toast.error('Kaydedilemedi', e?.message);
        } finally {
            setSaving(false);
        }
    };

    // "Yeniden teklif" — teklif varsa süre uzat, yoksa yeni teklif. Başarıda reoffered işaretle.
    const handleReoffer = (item: WinbackQueueItem) => {
        if (item.rawOffer) setExtendLead(item);
        else setNewOfferLead(item);
    };
    const markReoffered = async (item: WinbackQueueItem) => {
        try {
            await callAssistantService.recordWinbackOutcome(item.leadId, item.candidate.offerToken, 'reoffered');
            dropActive(item.leadId);
        } catch { /* sessiz — uzatma zaten oldu */ }
    };

    const handlePrev = () => setCurrent((c) => Math.max(0, c - 1));
    const handleNext = () => setCurrent((c) => Math.min(filteredItems.length - 1, c + 1));
    const handleSkip = () => {
        if (!activeItem || filteredItems.length <= 1) return;
        const skipId = activeItem.leadId;
        const nextItem = filteredItems[current + 1] ?? filteredItems[0];
        currentLeadIdRef.current = nextItem?.leadId ?? null;
        setItems((prev) => {
            const idx = prev.findIndex((it) => it.leadId === skipId);
            if (idx < 0) return prev;
            return [...prev.slice(0, idx), ...prev.slice(idx + 1), prev[idx]];
        });
    };

    const sendOfferLink = async (token: string, offerId?: string | null) => {
        const res = await fetch('/api/customer/send-offer-link', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offer_token: token, offer_id: offerId || undefined, admin_final: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) throw new Error(data?.message || data?.error || 'Teklif linki gönderilemedi');
    };

    const runConfirm = async () => {
        if (!confirmState || confirmBusy) return;
        setConfirmBusy(true);
        try { await confirmState.onConfirm(); setConfirmState(null); }
        catch (e: any) { toast.error('İşlem başarısız', e?.message); }
        finally { setConfirmBusy(false); }
    };

    const handleSendFollowup = (item: WinbackQueueItem) => {
        if (!item.phone) { toast.error('Hata', 'Müşterinin telefon numarası yok.'); return; }
        setConfirmState({
            title: 'Takip mesajı gönderilsin mi?',
            description: `${item.customerName} adlı kişiye kişisel hitaplı WhatsApp takip mesajı gönderilecek.`,
            confirmLabel: 'Gönder', tone: 'default',
            onConfirm: async () => {
                setFollowupBusy(true);
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const res = await fetch('/api/internal/send-no-reply', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
                        body: JSON.stringify({ lead_id: item.leadId }),
                    });
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(body.error || `Gönderim başarısız (${res.status})`);
                    toast.success('Gönderildi', `Takip mesajı atıldı. Şablon: ${body.template_name ?? '—'}`);
                } finally { setFollowupBusy(false); }
            },
        });
    };

    const handleDeleteOffer = (item: WinbackQueueItem) => {
        if (!item.candidate.offerToken) { toast.error('Hata', 'Bu adayın silinecek teklifi yok.'); return; }
        setConfirmState({
            title: 'Teklif kalıcı silinsin mi?',
            description: `${item.customerName} için bu teklif (link + final teklif + analizler) kalıcı silinecek. Geri alınamaz.`,
            confirmLabel: 'Teklifi sil', tone: 'danger',
            onConfirm: async () => {
                await AdminOfferLinksService.deleteOffers([item.candidate.offerToken!]);
                toast.success('Teklif silindi');
                dropActive(item.leadId);
            },
        });
    };

    const handleDeleteLead = (item: WinbackQueueItem) => {
        setConfirmState({
            title: 'Müşteri (lead) kalıcı silinsin mi?',
            description: `${item.customerName} ve bağlı tüm teklif / olay / not kayıtları kalıcı silinecek. Bu işlem geri alınamaz.`,
            confirmLabel: 'Kalıcı sil', tone: 'danger',
            onConfirm: async () => {
                await AdminLeadsService.deleteLead(item.leadId);
                toast.success('Müşteri silindi');
                dropActive(item.leadId);
            },
        });
    };

    const counts = useMemo(() => ({
        total: items.length,
        high: items.filter((i) => i.bucket === 'high').length,
        mid: items.filter((i) => i.bucket === 'mid').length,
        low: items.filter((i) => i.bucket === 'low').length,
        done: items.filter((i) => i.winbackStatus).length,
    }), [items]);

    const ring = (id: WinFilterId) => (filterId === id ? 'ring-2 ring-violet-500/50 border-violet-300' : '');

    return (
        <>
            {/* KPI — kova kartları (tıklayınca filtreler) */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard icon={Users} title="Toplam aday" value={counts.total} tone="default"
                    sublabel={`${counts.done} takip edildi`}
                    onClick={() => toggleFilter('all')} className={ring('all')} />
                <MetricCard icon={Flame} title="Yüksek Şans" value={counts.high} tone="success"
                    onClick={() => toggleFilter('high')} className={ring('high')} />
                <MetricCard icon={Sparkles} title="Orta Şans" value={counts.mid} tone="warning"
                    onClick={() => toggleFilter('mid')} className={ring('mid')} />
                <MetricCard icon={Clock3} title="Düşük Şans" value={counts.low} tone="default"
                    onClick={() => toggleFilter('low')} className={ring('low')} />
            </div>

            {/* Akıllı segment çipleri */}
            {!loading && items.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {WIN_CHIPS.map((f) => {
                        const count = countFor(f.id);
                        if (count === 0) return null;
                        const active = f.id === filterId;
                        return (
                            <button key={f.id} onClick={() => toggleFilter(f.id)}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                                    active ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}>
                                {f.label}
                                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                    {filterId !== 'all' && (
                        <button onClick={() => setFilterId('all')}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-50 cursor-pointer">
                            Filtreyi temizle
                        </button>
                    )}
                </div>
            )}

            {loading ? (
                <LoadingSpinner message="Geri kazanım sırası hazırlanıyor..." />
            ) : items.length === 0 ? (
                <EmptyState icon={PartyPopper} title="Geri kazanım adayı yok"
                    description="Şu an ölü/sessiz, geri kazanılacak aday bulunmuyor. Teklif süresi dolan veya sessizleşen leadler burada belirir." />
            ) : filteredItems.length === 0 ? (
                <EmptyState icon={ListChecks} title="Bu filtrede aday yok"
                    description="Seçili filtreye uyan aday bulunmuyor. Başka bir filtre seç veya “Toplam aday”a dön." />
            ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <AnimatePresence mode="wait">
                            {activeItem && (
                                <motion.div key={activeItem.leadId}
                                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                                    transition={{ duration: 0.18 }}>
                                    <WinbackSessionCard
                                        item={activeItem}
                                        index={current}
                                        total={filteredItems.length}
                                        brief={brief}
                                        briefLoading={briefLoading}
                                        briefError={briefError}
                                        onRetryBrief={() => activeLeadId && loadBrief(activeLeadId)}
                                        onOutcome={handleOutcome}
                                        onReoffer={() => handleReoffer(activeItem)}
                                        saving={saving}
                                        onOpenWhatsApp={() => setWaLead(activeItem)}
                                        onSendFollowup={() => handleSendFollowup(activeItem)}
                                        onDeleteOffer={() => handleDeleteOffer(activeItem)}
                                        onDeleteLead={() => handleDeleteLead(activeItem)}
                                        followupBusy={followupBusy}
                                        onPrev={handlePrev}
                                        onNext={handleNext}
                                        onSkip={handleSkip}
                                        canPrev={current > 0}
                                        canNext={current < filteredItems.length - 1}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <div className="lg:col-span-1">
                        <WinbackQueueRail items={filteredItems} currentIndex={current} onSelect={setCurrent} />
                    </div>
                </div>
            )}

            {/* Overlays */}
            {waLead && (
                <WhatsAppQuickSend
                    lead={{
                        id: waLead.leadId,
                        customer_name: waLead.customerName,
                        phone_number: waLead.phone,
                        company_name: waLead.companyName,
                        country_code: waLead.countryCode,
                    }}
                    onClose={() => setWaLead(null)}
                />
            )}

            {newOfferLead && (
                <NewOfferDrawer
                    isOpen={!!newOfferLead}
                    onClose={() => setNewOfferLead(null)}
                    leadId={newOfferLead.leadId}
                    customerName={newOfferLead.customerName}
                    onSendOfferLink={async (token, offerId) => {
                        try {
                            await sendOfferLink(token, offerId);
                            toast.success('Teklif oluşturuldu', 'Link WhatsApp’tan gönderildi.');
                        } catch (e: any) { toast.error('Gönderilemedi', e?.message); throw e; }
                    }}
                    onCreated={() => { const l = newOfferLead; if (l) markReoffered(l); }}
                />
            )}

            <ExtendOfferExpiryDialog
                isOpen={!!extendLead}
                onClose={() => setExtendLead(null)}
                offer={extendLead?.rawOffer ?? null}
                onExtended={() => { const l = extendLead; if (l) markReoffered(l); }}
                onSuccess={(t, m) => toast.success(t, m)}
                onError={(t, m) => toast.error(t, m)}
            />

            <ConfirmDialog
                isOpen={!!confirmState}
                title={confirmState?.title ?? ''}
                description={confirmState?.description}
                confirmLabel={confirmState?.confirmLabel}
                tone={confirmState?.tone ?? 'danger'}
                busy={confirmBusy}
                onConfirm={runConfirm}
                onCancel={() => { if (!confirmBusy) setConfirmState(null); }}
            />
        </>
    );
}
