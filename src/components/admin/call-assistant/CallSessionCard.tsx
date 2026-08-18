import { useEffect, useRef, useState } from 'react';
import { Phone, MessageCircle, Building2, Flame, Clock, Eye, Package, History, ArrowRight, Sparkles, FilePlus2, ChevronDown, Check, Loader2, ChevronLeft, ChevronRight, SkipForward, CalendarPlus, BellRing, PhoneMissed, MoreHorizontal, Send, Trash2, UserX } from 'lucide-react';
import { PhoneQrPopover } from '../offers/PhoneQrPopover';
import { LeadNotesCard } from '../leads/LeadNotesCard';
import { leadStatusLabel, leadStatusColor, LEAD_STATUS_ORDER } from '../../../lib/leadStatus';
import { CallBriefPanel, type CallBrief } from './CallBriefPanel';
import { FollowUpTimeline } from './FollowUpTimeline';
import { OutcomeBar, type OutcomeOpts } from './OutcomeBar';
import type { CallQueueItem, CallOutcome } from '../../../services/admin/callAssistantService';

interface CallSessionCardProps {
    item: CallQueueItem;
    index: number;
    total: number;
    brief: CallBrief | null;
    briefLoading: boolean;
    briefError: string | null;
    onRetryBrief: () => void;
    onOutcome: (outcome: CallOutcome, opts?: OutcomeOpts) => void;
    saving: boolean;
    /** "Kazanıldı" panelinden manuel satış kaydı modalını açar. */
    onRecordSale?: () => void;
    onOpenWhatsApp: () => void;
    onCreateOffer: () => void;
    onExtendExpiry: () => void;
    onSendFollowup: () => void;
    onDeleteOffer: () => void;
    onDeleteLead: () => void;
    followupBusy: boolean;
    onChangeStatus: (status: string) => void;
    statusSaving: boolean;
    onPrev: () => void;
    onNext: () => void;
    onSkip: () => void;
    canPrev: boolean;
    canNext: boolean;
}

function expiryLabel(hours: number): { text: string; tone: string } {
    if (hours <= 0) return { text: 'Süresi doldu', tone: 'text-rose-600' };
    if (hours <= 24) return { text: `${hours} saat kaldı`, tone: 'text-rose-600' };
    if (hours <= 48) return { text: `${hours} saat kaldı`, tone: 'text-amber-600' };
    const d = Math.round(hours / 24);
    return { text: `${d} gün kaldı`, tone: 'text-slate-500' };
}

function relCall(iso: string | null | undefined): string {
    if (!iso) return '';
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    if (h < 1) return 'az önce';
    if (h < 24) return `${h} saat önce`;
    return `${Math.floor(h / 24)} gün önce`;
}

/** Odaklı arama kartı — tek müşterinin tüm bilgisi + AI brifingi + sonuç butonları. */
export function CallSessionCard({
    item, index, total, brief, briefLoading, briefError, onRetryBrief, onOutcome, saving, onRecordSale, onOpenWhatsApp, onCreateOffer,
    onChangeStatus, statusSaving, onPrev, onNext, onSkip, canPrev, canNext, onExtendExpiry,
    onSendFollowup, onDeleteOffer, onDeleteLead, followupBusy,
}: CallSessionCardProps) {
    const d = item.derived;
    const exp = expiryLabel(d.expiresHours);
    const reasoning = item.offer.leads?.ai_state?.reasoning || null;
    const telHref = item.phone ? `tel:+${item.phone.replace(/\D/g, '')}` : undefined;

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            {/* Üst şerit — gezinme + sıra göstergesi + öncelik skoru */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-2.5">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onPrev}
                            disabled={!canPrev}
                            title="Önceki"
                            className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronLeft size={15} />
                        </button>
                        <button
                            onClick={onNext}
                            disabled={!canNext}
                            title="Sonraki"
                            className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronRight size={15} />
                        </button>
                        <button
                            onClick={onSkip}
                            disabled={total <= 1}
                            title="Bu kişiyi geç (sıranın sonuna at)"
                            className="ml-1 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 h-7 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <SkipForward size={13} /> Geç
                        </button>
                    </div>
                    <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-[11px] font-bold text-white tabular-nums">
                            {index + 1}
                        </span>
                        / {total}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {item.reminderDue && (
                        <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[12px] font-bold text-amber-800"
                            title={item.reminderNote || 'Planlanan takip zamanı geldi'}
                        >
                            <BellRing size={12} />
                            Hatırlatma vakti
                        </span>
                    )}
                    {item.waAwaitingReply && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[12px] font-bold text-green-700">
                            <MessageCircle size={12} />
                            WhatsApp cevap bekliyor
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-700">
                        <Flame size={13} className="text-amber-500" />
                        Öncelik {item.rankScore}
                    </span>
                </div>
            </div>

            <div className="p-5 sm:p-6">
                {/* Kimlik + durum */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-[22px] font-bold leading-tight text-slate-900">{item.customerName}</h2>
                        {item.companyName && (
                            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-slate-500">
                                <Building2 size={13} className="text-slate-400" />
                                {item.companyName}
                                {item.offer.leads?.business_type ? ` · ${item.offer.leads.business_type}` : ''}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <StatusDropdown status={d.status} saving={statusSaving} onChange={onChangeStatus} />
                        {d.aiScore !== null && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[12px] font-semibold text-indigo-700">
                                <Sparkles size={12} /> {d.aiScore}
                            </span>
                        )}
                    </div>
                </div>

                {/* Telefon + aksiyonlar */}
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    {item.phone ? (
                        <>
                            <a
                                href={telHref}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-emerald-700"
                            >
                                <Phone size={16} />
                                Ara
                            </a>
                            <PhoneQrPopover phone={item.phone}>
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] font-medium tabular-nums text-slate-700 hover:bg-slate-50">
                                    <Phone size={14} className="text-slate-400" />
                                    {item.phone}
                                </span>
                            </PhoneQrPopover>
                        </>
                    ) : (
                        <span className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-[13px] text-slate-400">
                            Telefon numarası yok
                        </span>
                    )}
                    <button
                        onClick={onOpenWhatsApp}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <MessageCircle size={15} className="text-green-600" />
                        WhatsApp
                    </button>
                    <button
                        onClick={onCreateOffer}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-[13px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                    >
                        <FilePlus2 size={15} />
                        Manuel Teklif
                    </button>
                    <button
                        onClick={onExtendExpiry}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <CalendarPlus size={15} className="text-amber-500" />
                        Süre Uzat
                    </button>
                    <MoreActionsMenu
                        followupBusy={followupBusy}
                        onSendFollowup={onSendFollowup}
                        onDeleteOffer={onDeleteOffer}
                        onDeleteLead={onDeleteLead}
                    />
                </div>

                {/* AI tek-cümle gerekçe */}
                {reasoning && (
                    <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-snug text-slate-600">
                        {reasoning}
                    </p>
                )}

                {/* Neden bu sırada — sıralamaya katkı veren aktif sinyaller (şeffaflık) */}
                {item.signals.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Neden bu sırada:</span>
                        {item.signals.map((s, i) => {
                            const isWa = s.startsWith('WhatsApp');
                            const isNote = s.startsWith('ekip notu');
                            return (
                                <span
                                    key={i}
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                        isWa ? 'bg-green-50 text-green-700'
                                        : isNote ? 'bg-amber-50 text-amber-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    {s}
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* Meta ızgara */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Meta icon={Eye} label="Son görüntüleme" value={d.lastViewedLabel} sub={`${d.opens} açılış`} />
                    <Meta icon={Clock} label="Teklif süresi" value={exp.text} valueTone={exp.tone} />
                    <Meta
                        icon={Package}
                        label="Teklif modeli"
                        value={item.products.length ? item.products[0] : '—'}
                        sub={item.products.length > 1 ? `+${item.products.length - 1} model` : undefined}
                    />
                    <Meta
                        icon={History}
                        label="Arama geçmişi"
                        value={item.callInfo ? `${item.callInfo.count} arama` : 'Hiç aranmadı'}
                        sub={
                            item.callInfo
                                ? (item.callInfo.noAnswerCount > 0
                                    ? `${item.callInfo.noAnswerCount}× üst üste cevapsız · ${relCall(item.callInfo.lastAt)}`
                                    : relCall(item.callInfo.lastAt))
                                : undefined
                        }
                        valueTone={(item.callInfo?.noAnswerCount ?? 0) >= 2 ? 'text-rose-600' : undefined}
                    />
                </div>

                {/* Cevapsız eskalasyonu — 3+ üst üste ulaşılamadıysa WhatsApp'a yönlendir */}
                {(item.callInfo?.noAnswerCount ?? 0) >= 3 && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose-700">
                            <PhoneMissed size={14} />
                            {item.callInfo!.noAnswerCount}× üst üste ulaşılamadı — WhatsApp'tan dene
                        </span>
                        <button
                            onClick={onOpenWhatsApp}
                            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-green-700 cursor-pointer"
                        >
                            <MessageCircle size={13} />
                            WhatsApp'a geç
                        </button>
                    </div>
                )}

                {/* Önerilen aksiyon */}
                {d.nextAction && d.nextAction !== '—' && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-1.5 text-[12px] font-semibold text-indigo-700">
                        <ArrowRight size={13} />
                        {d.nextAction}
                    </div>
                )}

                {/* AI brifing */}
                <div className="mt-5">
                    <CallBriefPanel brief={brief} loading={briefLoading} error={briefError} onRetry={onRetryBrief} />
                </div>

                {/* Takip geçmişi — bu lead'in son arama/sonuç/erteleme/not olayları */}
                <div className="mt-5">
                    <FollowUpTimeline leadId={item.leadId} />
                </div>

                {/* Müşteri notları — mevcut notları gör + yeni not ekle */}
                <div className="mt-5">
                    <LeadNotesCard leadId={item.leadId} />
                </div>
            </div>

            {/* Sonuç butonları */}
            <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:px-6">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Arama sonucu</p>
                <OutcomeBar onOutcome={onOutcome} saving={saving} onRecordSale={onRecordSale} />
            </div>
        </div>
    );
}

/** "Daha fazla" menüsü — takip mesajı gönder + tehlikeli işlemler (teklif/lead sil). */
export function MoreActionsMenu({
    followupBusy, onSendFollowup, onDeleteOffer, onDeleteLead,
}: { followupBusy: boolean; onSendFollowup: () => void; onDeleteOffer: () => void; onDeleteLead: () => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const run = (fn: () => void) => { setOpen(false); fn(); };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                title="Daha fazla"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
            >
                <MoreHorizontal size={15} className="text-slate-400" />
                Daha fazla
            </button>

            {open && (
                <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <button
                        onClick={() => run(onSendFollowup)}
                        disabled={followupBusy}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {followupBusy ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <Send size={14} className="text-indigo-500" />}
                        Takip mesajı gönder
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                        onClick={() => run(onDeleteOffer)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                        <Trash2 size={14} />
                        Teklifi sil
                    </button>
                    <button
                        onClick={() => run(onDeleteLead)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                        <UserX size={14} />
                        Müşteriyi sil
                    </button>
                </div>
            )}
        </div>
    );
}

/** Üst kısımdaki durum rozeti — tıklayınca durum değiştirme menüsü açılır. */
function StatusDropdown({ status, saving, onChange }: { status: string; saving: boolean; onChange: (s: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                disabled={saving}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-60 cursor-pointer ${leadStatusColor(status)}`}
                title="Durumu değiştir"
            >
                {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                {leadStatusLabel(status)}
                <ChevronDown size={12} className="opacity-60" />
            </button>

            {open && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Durumu değiştir</p>
                    {LEAD_STATUS_ORDER.map((s) => (
                        <button
                            key={s}
                            onClick={() => { setOpen(false); if (s !== status) onChange(s); }}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            <span className="inline-flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${leadStatusColor(s).split(' ')[0]}`} />
                                {leadStatusLabel(s)}
                            </span>
                            {s === status && <Check size={13} className="text-indigo-600" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function Meta({
    icon: Icon, label, value, sub, valueTone,
}: { icon: typeof Eye; label: string; value: string; sub?: string; valueTone?: string }) {
    return (
        <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <Icon size={12} /> {label}
            </span>
            <p className={`mt-1 truncate text-[13px] font-semibold ${valueTone || 'text-slate-800'}`}>{value}</p>
            {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
        </div>
    );
}
