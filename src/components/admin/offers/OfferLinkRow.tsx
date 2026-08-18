import React, { useState } from 'react';
import {
    ChevronDown, Eye, Clock, Phone, MessageCircle, FileText, Copy, ExternalLink,
    Download, Trash2, Send, CalendarPlus, CalendarX, XCircle, CheckCircle2, Sparkles, Target,
    History, Flame, Zap, Link2, GripVertical, CalendarDays, CalendarClock, Pin, Building2, Repeat,
    BadgeCheck,
} from 'lucide-react';
import { OfferLink } from '../../../services/admin/offerLinksService';
import { TagPicker, tagColorClasses } from '../../../pages/admin/whatsapp/components/TagPicker';
import type { LeadTag } from '../../../services/admin/leadTagsService';
import { GeneratedOffer } from '../../../services/admin/generatedOffersService';
import { LeadTemperatureCell } from './LeadTemperatureCell';
import { WhatsAppQuickSend } from '../leads/WhatsAppQuickSend';
import { LeadNotesCard } from '../leads/LeadNotesCard';
import { LeadNoteInline } from '../leads/LeadNoteInline';
import type { LeadNote } from '../../../services/admin/leadsService';
import { AiScoreRing } from './AiScoreRing';
import { NextActionChip } from './NextActionChip';
import { CallTrackerCell } from './CallTrackerCell';
import type { LeadCallInfo } from '../../../services/admin/leadCallsService';
import { OfferCodePill } from './OfferCodePill';
import { ProductPills, productColor, extractProductNames } from './ProductPills';
import { OfferOverflowMenu, OverflowItem } from './OfferOverflowMenu';
import { PhoneQrPopover } from './PhoneQrPopover';
import { VisitHistoryPopover } from '../VisitHistoryPopover';
import { OFFER_GROUP_BY_KEY, groupColors } from './offerGroups';
import type { OfferDerived } from '../../../lib/offerPriority';
import { describeRemaining } from '../../../lib/offerExpiry';
import { leadStatusColor, leadStatusLabel } from '../../../lib/leadStatus';
import { formatDate, formatDateTime } from '../../../hooks/useAppSettings';
import { cn } from '../../../lib/utils';
import { ContextTaskButton } from '../tasks/ContextTaskButton';

export interface OfferLinkRowProps {
    offer: OfferLink;
    /** Parent'ta hesaplanan türetilmiş alanlar (skor/grup/aksiyon/süre). */
    derived: OfferDerived;
    /** Öncelik sırası # (yoksa null). */
    rank: number | null;
    selected: boolean;
    onToggleSelect: (token: string) => void;
    onCopyLink: (token: string) => void;
    onToggleStatus: (offer: OfferLink) => void;
    onExtend: (offer: OfferLink) => void;
    /** Süreyi şimdi bitir — sayacı sıfırlar, müşteriye "süresi doldu" reclaim ekranını gösterir. */
    onEndExpiry: (offer: OfferLink) => void;
    onSendFollowup: (offer: OfferLink) => void;
    onDelete: (offer: OfferLink) => void;
    /** "Satıldı olarak işaretle" — dışarıda kapatılan satışı rezervasyona çevirir. */
    onMarkSold?: (offer: OfferLink) => void;
    sendingFollowup: boolean;
    onStatusChange: (leadId: string, status: string) => void;
    onRescore: (leadId: string) => void;
    scoring: boolean;
    /** Satır açık mı (= final teklifler yüklü/expanded). */
    expanded: boolean;
    finalOffers: GeneratedOffer[] | undefined;
    loadingFinal: boolean;
    onToggleFinal: (token: string) => void;
    onCopyFinal: (token: string, id: string) => void;
    onDownloadFinalImage: (offer: OfferLink, fo: GeneratedOffer) => void;
    onDeleteFinalOne: (offer: OfferLink, fo: GeneratedOffer) => void;
    onDeleteFinalAll: (offer: OfferLink) => void;
    /** Kısa onay mesajı (kod kopyalama vb.). */
    onToast?: (msg: string) => void;
    /** Bu lead için arama özeti (sayı/son arama) — yoksa hiç arama yapılmamış. */
    callInfo?: LeadCallInfo;
    /** "Aradım" → arama kaydı düşürür (Offers.tsx → leadCallsService.logCall). */
    onLogCall: (leadId: string, token: string) => Promise<void> | void;
    /** "Geri Al" → son aramayı siler (Offers.tsx → leadCallsService.undoLastCall). */
    onUndoCall?: (leadId: string) => Promise<void> | void;
    /* ── Sürükle-bırak (opsiyonel; verilmezse satır eskisi gibi davranır) ── */
    /** Sürüklenebilir kartın node ref'i (@dnd-kit useDraggable.setNodeRef). */
    dndSetNodeRef?: (el: HTMLElement | null) => void;
    /** Sürükleme transform stili. */
    dndStyle?: React.CSSProperties;
    /** Tutamaca bağlanacak attributes + listeners (@dnd-kit). Verildiğinde tutamaç render edilir. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dndHandleProps?: { attributes: any; listeners: any };
    /** Bu satır şu an sürükleniyor mu (kaynak kopya soluklaştırılır). */
    isDragging?: boolean;
    /* ── Etiket + sabitleme (renkli işaretleme & grup içi öne alma) ── */
    /** Bu lead'e atanmış etiketler (renkli rozet + sol kenar şeridi). */
    assignedTags?: LeadTag[];
    /** Etiket atandı/kaldırıldığında parent'ı tazeler. */
    onTagsChange?: (leadId: string) => void;
    /** Sabitle (pin) / sabiti kaldır — grup içi en üste tutar. */
    onTogglePin?: (offer: OfferLink) => void;
    /* ── Satır içi müşteri notu (kapalı satırda orta boşlukta özet) ── */
    /** Bu lead'in en son oluşturulan kullanıcı notu (yoksa undefined). */
    latestNote?: LeadNote | null;
    /** Notu kaydeder (noteId dolu → güncelle, null → yeni). Verilirse satır içi not hücresi render edilir. */
    onSaveNote?: (leadId: string, noteId: string | null, content: string) => Promise<void>;
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** offer_analytics → TR zaman çizelgesi etiketi. */
const TIMELINE_LABELS: Record<string, string> = {
    link_opened: 'Teklif görüntülendi',
    product_viewed: 'Ürün seçimi yapıldı',
    payment_started: 'Ödeme başlatıldı',
    payment_completed: 'Ödeme tamamlandı ✓',
    offer_created_manual: 'Teklif oluşturuldu',
};

const expiryToneColor: Record<string, string> = {
    green: 'var(--color-ok)', amber: 'var(--color-warm)', red: 'var(--color-hot)', slate: 'var(--color-slate-500)',
};

/** Accordion teklif linki satırı — collapsed özet + expanded satış detayı. */
export const OfferLinkRow: React.FC<OfferLinkRowProps> = ({
    offer, derived, rank, selected, onToggleSelect, onCopyLink, onToggleStatus, onExtend, onEndExpiry,
    onSendFollowup, onDelete, onMarkSold, sendingFollowup, onStatusChange, onRescore, scoring,
    expanded, finalOffers, loadingFinal, onToggleFinal, onCopyFinal,
    onDownloadFinalImage, onDeleteFinalOne, onDeleteFinalAll, onToast,
    callInfo, onLogCall, onUndoCall,
    dndSetNodeRef, dndStyle, dndHandleProps, isDragging,
    assignedTags, onTagsChange, onTogglePin,
    latestNote, onSaveNote,
}) => {
    const [waOpen, setWaOpen] = useState(false);

    const customerName = offer.leads?.customer_name || 'Bilinmiyor';
    const phone = offer.leads?.phone_number;
    const g = OFFER_GROUP_BY_KEY[derived.group];
    const gc = groupColors(g.color);
    const tags = assignedTags ?? [];
    const primaryTag = tags[0];
    const pinned = derived.pinned;
    const remaining = describeRemaining(derived.effectiveExpiry.toISOString());
    const timeColor = expiryToneColor[remaining.tone] || 'var(--color-slate-900)';

    const analytics = ((offer as unknown as { offer_analytics?: any[] }).offer_analytics) || [];
    const timeline = [...analytics]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6);

    const overflowItems: OverflowItem[] = [
        { key: 'copy', label: 'Linki kopyala', icon: Link2, onClick: () => onCopyLink(offer.token) },
        ...(onMarkSold
            ? [{ key: 'mark-sold', label: 'Satıldı olarak işaretle', icon: BadgeCheck, onClick: () => onMarkSold(offer) }]
            : []),
        { key: 'delete', label: 'Sil', icon: Trash2, onClick: () => onDelete(offer), danger: true },
    ];

    return (
        <>
            {waOpen && phone && (
                <WhatsAppQuickSend
                    lead={{ id: offer.lead_id, customer_name: customerName, phone_number: phone }}
                    onClose={() => setWaOpen(false)}
                />
            )}
            <div
                ref={dndSetNodeRef}
                style={dndStyle}
                className={cn(
                    'relative overflow-hidden rounded-2xl border bg-white transition-shadow',
                    selected ? 'border-brand-400 ring-2 ring-brand-50'
                        : expanded ? 'border-slate-300 shadow-lg'
                        : pinned ? 'border-brand-300 ring-1 ring-brand-100' : 'border-slate-200 hover:shadow-md',
                    isDragging && 'opacity-40',
                )}
            >
                {/* sol renk aksanı — etiket varsa onun renginde kalın şerit, yoksa grup aksanı */}
                {primaryTag ? (
                    <span className={cn('absolute left-0 top-0 bottom-0 w-[5px]', tagColorClasses(primaryTag.color).dot)} />
                ) : (
                    <span
                        className="absolute left-0 top-0 bottom-0 w-[3px]"
                        style={{ background: gc.base, opacity: derived.group === 'hot' || expanded ? 1 : 0 }}
                    />
                )}

                {/* ── Collapsed satır ── */}
                <div
                    onClick={() => onToggleFinal(offer.token)}
                    className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5"
                >
                    {/* sürükle tutamacı (yalnız dnd etkinken) */}
                    {dndHandleProps && (
                        <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            {...dndHandleProps.attributes}
                            {...dndHandleProps.listeners}
                            className="hidden shrink-0 cursor-grab touch-none text-slate-300 transition-colors hover:text-slate-500 active:cursor-grabbing sm:grid sm:h-6 sm:w-5 sm:place-items-center"
                            title="Durumu değiştirmek için sürükle"
                            aria-label="Sürükle"
                        >
                            <GripVertical size={15} />
                        </button>
                    )}

                    {/* checkbox */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleSelect(offer.token); }}
                        className={cn(
                            'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-2 transition-colors',
                            selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white hover:border-brand-500',
                        )}
                        aria-label={selected ? 'Seçimi kaldır' : 'Seç'}
                    >
                        {selected && <CheckCircle2 size={11} strokeWidth={3} />}
                    </button>

                    {/* avatar */}
                    <div
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-xs font-bold"
                        style={{ background: gc.bg, color: gc.base }}
                    >
                        {initials(customerName)}
                    </div>

                    {/* müşteri */}
                    <div className="min-w-0 flex-1 lg:flex-none lg:w-[210px]">
                        <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-semibold text-slate-900" title={customerName}>
                                {customerName}
                            </span>
                            {phone && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setWaOpen(true); }}
                                    className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[5px] bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-500 hover:text-white"
                                    title="WhatsApp konuşmasını aç"
                                >
                                    <MessageCircle size={11} />
                                </button>
                            )}
                            {/* tekrar gelen müşteri — Canlı İzleme'deki "N. kez geldi" sinyaliyle aynı */}
                            {derived.returning && (
                                <VisitHistoryPopover leadId={offer.lead_id} token={offer.token}>
                                    <span
                                        title={`${derived.visits} kez linke/teklife geldi — geçmiş için tıkla`}
                                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 whitespace-nowrap transition-colors hover:bg-indigo-100"
                                    >
                                        <Repeat size={10} />{derived.visits}. kez geldi
                                    </span>
                                </VisitHistoryPopover>
                            )}
                        </div>
                        {/* firma adı + iş türü — kapalı satırda müşteri kimliği */}
                        {(offer.leads?.company_name || offer.leads?.business_type) && (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                                <Building2 size={10} className="shrink-0 text-slate-400" />
                                <span className="truncate">
                                    {[offer.leads?.company_name, offer.leads?.business_type].filter(Boolean).join(' · ')}
                                </span>
                            </div>
                        )}
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                            {phone ? (
                                <PhoneQrPopover phone={phone}>
                                    <Phone size={10} className="shrink-0" />
                                    <span className="truncate font-mono">{phone}</span>
                                </PhoneQrPopover>
                            ) : (
                                <span className="flex items-center gap-1">
                                    <Phone size={10} className="shrink-0" />
                                    <span className="truncate font-mono">—</span>
                                </span>
                            )}
                            <span
                                className="hidden shrink-0 items-center gap-1 sm:inline-flex"
                                title="Lead geliş tarihi"
                            >
                                <span className="text-slate-300">·</span>
                                <CalendarDays size={10} className="shrink-0" />
                                <span className="tabular-nums">{formatDate(offer.created_at)}</span>
                            </span>
                        </div>
                        {/* renkli etiketler + etiket seçici (tıklama satırı açmaz) */}
                        {onTagsChange && (
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                <TagPicker
                                    leadId={offer.lead_id}
                                    assignedTags={tags}
                                    onChange={() => onTagsChange(offer.lead_id)}
                                />
                            </div>
                        )}
                    </div>

                    {/* satır içi müşteri notu — kapalı satırda orta boşlukta en son not özeti (düzenlenebilir) */}
                    {onSaveNote && (
                        <div className="hidden min-w-0 flex-1 lg:flex">
                            <LeadNoteInline
                                leadId={offer.lead_id}
                                note={latestNote}
                                onSave={onSaveNote}
                            />
                        </div>
                    )}

                    {/* durum rozeti (lead sıcaklığı) */}
                    <div className="hidden shrink-0 sm:block">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10.5px] font-bold', leadStatusColor(derived.status))}>
                            {leadStatusLabel(derived.status)}
                        </span>
                        {offer.leads?.status_source === 'auto' && (
                            <span
                                className="ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-1 text-[9.5px] font-bold"
                                style={{ background: 'var(--color-brand-50)', color: 'var(--color-brand-700)' }}
                                title="Durum AI tarafından otomatik atandı. Elle değiştirirsen sabitlenir."
                            >
                                <Sparkles size={9} />AI
                            </span>
                        )}
                        {!offer.is_active && (
                            <span className="ml-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">İptal</span>
                        )}
                    </div>

                    {/* AI ring */}
                    <div className="hidden shrink-0 md:block">
                        <AiScoreRing score={derived.aiScore} />
                    </div>

                    {/* açılma */}
                    <div className="hidden shrink-0 lg:flex">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1 text-[11.5px] font-bold text-slate-700">
                            <Eye size={11} />{derived.opens}
                        </span>
                    </div>

                    {/* kalan süre + bitiş tarihi */}
                    <div className="hidden w-[112px] shrink-0 lg:block">
                        <div className="text-[10px] font-medium text-slate-400">Kalan</div>
                        <div className="text-[11.5px] font-semibold" style={{ color: timeColor }}>{remaining.label}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium tabular-nums text-slate-400" title="Teklif bitiş tarihi">
                            <CalendarClock size={9} className="shrink-0" />
                            <span>{formatDate(derived.effectiveExpiry)}</span>
                        </div>
                    </div>

                    {/* önerilen aksiyon */}
                    <div className="hidden w-[150px] shrink-0 xl:flex">
                        <NextActionChip action={derived.nextAction} />
                    </div>

                    {/* öncelik # */}
                    <div className="hidden w-[52px] shrink-0 justify-end md:flex">
                        {rank ? (
                            rank <= 3 ? (
                                <span
                                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-extrabold"
                                    style={{ background: 'var(--color-hot-bg)', color: 'var(--color-hot)' }}
                                >
                                    <Flame size={10} />#{rank}
                                </span>
                            ) : (
                                <span className="text-[11px] font-extrabold tabular-nums text-slate-600">#{rank}</span>
                            )
                        ) : (
                            <span className="text-[11px] font-bold text-slate-300">—</span>
                        )}
                    </div>

                    {/* arama takibi (her zaman görünür) */}
                    <div className="shrink-0">
                        <CallTrackerCell
                            leadId={offer.lead_id}
                            token={offer.token}
                            callInfo={callInfo}
                            onLogCall={onLogCall}
                            onUndoCall={onUndoCall}
                            onToast={onToast}
                        />
                    </div>

                    {/* sabitle (pin) — grubun en üstüne tutar */}
                    {onTogglePin && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onTogglePin(offer); }}
                            className={cn(
                                'grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors',
                                pinned
                                    ? 'bg-brand-50 text-brand-600'
                                    : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500',
                            )}
                            title={pinned ? 'Sabiti kaldır' : 'En üste sabitle'}
                            aria-label={pinned ? 'Sabiti kaldır' : 'En üste sabitle'}
                        >
                            <Pin size={14} className={pinned ? 'fill-current' : ''} />
                        </button>
                    )}

                    {/* chevron */}
                    <div
                        className={cn(
                            'grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition-transform',
                            expanded && 'rotate-180',
                        )}
                        style={expanded ? { color: 'var(--color-brand-600)', background: 'var(--color-brand-50)' } : undefined}
                    >
                        <ChevronDown size={16} />
                    </div>
                </div>

                {/* ── Expanded detay ── */}
                {expanded && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="grid grid-cols-1 gap-5 border-t border-dashed border-slate-200 bg-[var(--color-slate-50)] p-4 lg:grid-cols-[1.5fr_1fr] lg:pl-[52px]"
                        style={{ animation: 'cpFadeIn .18s ease' }}
                    >
                        {/* sol kolon */}
                        <div className="min-w-0">
                            <div className="mb-3.5 flex flex-wrap items-center gap-2">
                                <OfferCodePill code={offer.token} onCopy={() => onToast?.('Teklif kodu kopyalandı')} />
                                <a
                                    href={`/offer/${offer.token}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    <ExternalLink size={13} />Teklifi Gör
                                </a>
                                <span
                                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                                    style={{ background: gc.bg, color: gc.base }}
                                >
                                    <g.icon size={12} />{g.label}
                                </span>
                            </div>

                            <ProductPills products={derived.products} />

                            <div className="mb-3.5 flex items-center gap-2 text-[11.5px] font-semibold text-slate-400">
                                <Clock size={12} />
                                {derived.ageDays <= 1 ? 'Bugün geldi'
                                    : derived.ageDays < 7 ? `${derived.ageDays} gün önce geldi`
                                    : derived.ageDays < 30 ? `${Math.round(derived.ageDays / 7)} hafta önce geldi`
                                    : `${Math.round(derived.ageDays / 30)} ay önce geldi`}
                                <span className="font-normal text-slate-400">· {formatDate(offer.created_at)}</span>
                                <span className="font-normal text-slate-400">· bitiş {formatDate(derived.effectiveExpiry)}</span>
                                {derived.ageDays >= 60 && (
                                    <span
                                        className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                                        style={{ background: 'var(--color-cold-bg)', color: 'var(--color-cold)' }}
                                    >
                                        Eski lead · otomatik düşük önceliğe alındı
                                    </span>
                                )}
                            </div>

                            {/* AI değerlendirmesi */}
                            <div
                                className="mb-3.5 flex gap-3 rounded-xl border p-3.5"
                                style={{ background: 'linear-gradient(120deg, var(--color-brand-50), #fff)', borderColor: 'var(--color-brand-100)' }}
                            >
                                <div
                                    className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]"
                                    style={{ background: 'linear-gradient(140deg, var(--color-brand-500), var(--color-brand-700))', boxShadow: 'var(--shadow-brand)' }}
                                >
                                    <Sparkles size={15} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--color-brand-700)' }}>
                                        AI DEĞERLENDİRMESİ{derived.aiScore != null ? ` · ${derived.aiScore}/100` : ''}
                                    </div>
                                    <div className="mt-1 text-[12.5px] leading-snug text-slate-700">
                                        {offer.leads?.ai_state?.reasoning || 'Bu lead için AI değerlendirmesi henüz oluşturulmadı. Sağdaki paneldeki ✦ ile yeniden skorlayabilirsiniz.'}
                                    </div>
                                </div>
                            </div>

                            {/* istatistik kartları */}
                            <div className="mb-4 grid grid-cols-3 gap-2.5">
                                {[
                                    { k: 'Açılma', icon: Eye, v: `${derived.opens}`, sm: 'kez' },
                                    { k: 'Kalan Süre', icon: Clock, v: remaining.label, color: timeColor },
                                    { k: 'Son Görüntüleme', icon: History, v: derived.lastViewedLabel },
                                ].map((s) => (
                                    <div key={s.k} className="rounded-xl border border-slate-200 bg-white p-2.5">
                                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                                            <s.icon size={12} />{s.k}
                                        </div>
                                        <div className="mt-1 text-[14px] font-bold leading-tight text-slate-900" style={s.color ? { color: s.color } : undefined}>
                                            {s.v}{s.sm && <span className="ml-1 text-[10.5px] font-semibold text-slate-400">{s.sm}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* final teklifler */}
                            <div className="mb-4">
                                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    <Zap size={12} />Final teklifler
                                </div>
                                {loadingFinal ? (
                                    <div className="flex items-center gap-2 text-[11.5px] text-slate-400">
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                                        Yükleniyor…
                                    </div>
                                ) : finalOffers && finalOffers.length === 0 ? (
                                    <p className="text-[11.5px] italic text-slate-400">Müşteri tarafından henüz bir teklif kesinleştirilmedi.</p>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {(finalOffers?.length ?? 0) > 1 && (
                                            <button
                                                onClick={() => onDeleteFinalAll(offer)}
                                                className="inline-flex w-fit items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-600 transition-colors hover:bg-red-50"
                                            >
                                                <Trash2 size={12} />Tümünü sil ({finalOffers?.length})
                                            </button>
                                        )}
                                        {finalOffers?.map((fo) => (
                                            <div
                                                key={fo.id}
                                                className="flex w-fit min-w-[240px] items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2 transition-colors hover:border-brand-400"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="grid h-6 w-6 place-items-center rounded bg-brand-100">
                                                        <FileText size={12} style={{ color: 'var(--color-brand-700)' }} />
                                                    </div>
                                                    <div className="flex min-w-0 flex-col">
                                                        <span className="text-[11px] font-bold text-slate-900">{fo.offer_number}</span>
                                                        {/* hangi ürün(ler)in teklifi — generated_offer.items'tan türetilir */}
                                                        {(() => {
                                                            const names = extractProductNames(fo.items);
                                                            if (names.length === 0) return null;
                                                            return (
                                                                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                                                                    {names.map((n) => {
                                                                        const c = productColor(n);
                                                                        return (
                                                                            <span
                                                                                key={n}
                                                                                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9.5px] font-bold leading-none"
                                                                                style={{ color: c.text, background: c.bg, borderColor: c.border }}
                                                                            >
                                                                                <span className="h-1 w-1 rounded-full" style={{ background: c.text }} />
                                                                                {n}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </span>
                                                            );
                                                        })()}
                                                        <span className="mt-0.5 text-[9px] text-slate-500">{formatDateTime(fo.created_at)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => onCopyFinal(offer.token, fo.id)} className="p-1 text-slate-400 transition-colors hover:text-brand-600" title="Final linki kopyala"><Copy size={14} /></button>
                                                    <a href={`/offer/${offer.token}/teklif/${fo.id}`} target="_blank" rel="noreferrer" className="p-1 text-slate-400 transition-colors hover:text-brand-600" title="Görüntüle"><ExternalLink size={14} /></a>
                                                    <button onClick={() => onDownloadFinalImage(offer, fo)} className="p-1 text-slate-400 transition-colors hover:text-brand-600" title="Teklif görselini indir"><Download size={14} /></button>
                                                    <button onClick={() => onDeleteFinalOne(offer, fo)} className="p-1 text-slate-400 transition-colors hover:text-red-500" title="Sil"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* aksiyon barı */}
                            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3.5">
                                <button
                                    onClick={() => setWaOpen(true)}
                                    disabled={!phone}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                                >
                                    <MessageCircle size={14} />WhatsApp’ta Aç
                                </button>
                                <button
                                    onClick={() => onSendFollowup(offer)}
                                    disabled={sendingFollowup || !phone}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px disabled:opacity-50"
                                    style={{ background: 'linear-gradient(140deg, var(--color-brand-500), var(--color-brand-700))', boxShadow: 'var(--shadow-brand)' }}
                                >
                                    {sendingFollowup
                                        ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        : <Send size={14} />}
                                    {sendingFollowup ? 'Gönderiliyor' : 'Takip Mesajı Gönder'}
                                </button>
                                <button onClick={() => onExtend(offer)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                                    <CalendarPlus size={13} />Süreyi Uzat
                                </button>
                                <button
                                    onClick={() => onEndExpiry(offer)}
                                    disabled={offer.is_active === false || derived.expiresHours <= 0}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                                    title="Teklif süresini şimdi bitir — müşteri 'süresi doldu, yenileyelim' ekranını görür"
                                >
                                    <CalendarX size={13} />Süreyi Bitir
                                </button>
                                <button onClick={() => onToggleStatus(offer)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                                    {offer.is_active ? <><XCircle size={13} />İptal Et</> : <><CheckCircle2 size={13} />Aktifleştir</>}
                                </button>
                                {/* Görev — teklif+lead bağıyla, ekrandan ayrılmadan */}
                                <ContextTaskButton
                                    variant="compact"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-sky-700 transition-colors hover:bg-sky-50 cursor-pointer"
                                    context={{
                                        entityType: 'offer',
                                        entityId: offer.token,
                                        entityLabel: `${customerName} · ${offer.token}`,
                                        extraLinks: offer.lead_id
                                            ? [{ entity_type: 'lead', entity_id: offer.lead_id, label: customerName }]
                                            : [],
                                    }}
                                />
                                <div className="ml-auto">
                                    <OfferOverflowMenu items={overflowItems} openUp />
                                </div>
                            </div>
                        </div>

                        {/* sağ kolon */}
                        <div className="min-w-0 lg:border-l lg:border-slate-200 lg:pl-5">
                            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                <Target size={12} />Önerilen Sonraki Aksiyon
                            </div>
                            <div
                                className="mb-4 flex items-center gap-2.5 rounded-xl border p-3"
                                style={{ background: 'var(--color-brand-50)', borderColor: 'var(--color-brand-100)' }}
                            >
                                <div
                                    className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]"
                                    style={{ background: 'linear-gradient(140deg, var(--color-brand-500), var(--color-brand-700))', boxShadow: 'var(--shadow-brand)' }}
                                >
                                    <Zap size={15} className="text-white" />
                                </div>
                                <div>
                                    <div className="text-[13px] font-bold" style={{ color: 'var(--color-brand-700)' }}>{derived.nextAction}</div>
                                    <div className="mt-0.5 text-[11px] text-slate-500">Türetilen öneri · şimdi yapılması tavsiye edilir</div>
                                </div>
                            </div>

                            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                <Sparkles size={12} />AI & Durum
                            </div>
                            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
                                <LeadTemperatureCell
                                    leadId={offer.lead_id}
                                    aiState={offer.leads?.ai_state}
                                    status={offer.leads?.status}
                                    scoring={scoring}
                                    onRescore={onRescore}
                                    onStatusChange={onStatusChange}
                                />
                            </div>

                            <LeadNotesCard leadId={offer.lead_id} />

                            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                <History size={12} />Son Hareketler
                            </div>
                            {timeline.length === 0 ? (
                                <p className="text-[11.5px] italic text-slate-400">Henüz hareket kaydı yok.</p>
                            ) : (
                                <div className="relative pl-[18px]">
                                    <span className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-200" />
                                    {timeline.map((it, i) => (
                                        <div key={i} className="relative pb-3 last:pb-0">
                                            <span
                                                className="absolute -left-[16px] top-[3px] h-[9px] w-[9px] rounded-full border-2 bg-white"
                                                style={{ borderColor: 'var(--color-brand-400)' }}
                                            />
                                            <div className="text-[12px] font-semibold text-slate-900">
                                                {TIMELINE_LABELS[it.action_type] || it.action_type}
                                            </div>
                                            <div className="mt-0.5 text-[10.5px] text-slate-400">{formatDateTime(it.created_at)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
