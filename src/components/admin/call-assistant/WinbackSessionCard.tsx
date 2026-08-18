import { Phone, MessageCircle, Building2, Eye, Package, History, CalendarClock, RotateCcw, Sparkles, ChevronLeft, ChevronRight, SkipForward, BellRing, CreditCard } from 'lucide-react';
import { PhoneQrPopover } from '../offers/PhoneQrPopover';
import { LeadNotesCard } from '../leads/LeadNotesCard';
import { CallBriefPanel, type CallBrief } from './CallBriefPanel';
import { FollowUpTimeline } from './FollowUpTimeline';
import { WinbackOutcomeBar, type WinbackOutcomeOpts } from './WinbackOutcomeBar';
import { MoreActionsMenu } from './CallSessionCard';
import { WINBACK_BUCKET_META, WINBACK_STATUS_META } from '../../../lib/winbackScore';
import type { WinbackQueueItem, WinbackOutcome } from '../../../services/admin/callAssistantService';

interface WinbackSessionCardProps {
    item: WinbackQueueItem;
    index: number;
    total: number;
    brief: CallBrief | null;
    briefLoading: boolean;
    briefError: string | null;
    onRetryBrief: () => void;
    onOutcome: (outcome: WinbackOutcome, opts?: WinbackOutcomeOpts) => void;
    /** "Teklif Yenile / Yeniden teklif" — sayfa rawOffer varsa süre uzatır, yoksa yeni teklif açar. */
    onReoffer: (note?: string) => void;
    saving: boolean;
    onOpenWhatsApp: () => void;
    onSendFollowup: () => void;
    onDeleteOffer: () => void;
    onDeleteLead: () => void;
    followupBusy: boolean;
    onPrev: () => void;
    onNext: () => void;
    onSkip: () => void;
    canPrev: boolean;
    canNext: boolean;
}

function money(n: number | null): string {
    if (n === null) return '—';
    return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

/** Teklifin süresi ne durumda — doldu/aktif/yok. */
function offerStatusLabel(validUntil: string | null, hasOffer: boolean): { text: string; tone: string } {
    if (!hasOffer) return { text: 'Teklif yok', tone: 'text-slate-400' };
    if (!validUntil) return { text: 'Süre belirsiz', tone: 'text-slate-500' };
    const days = Math.floor((Date.now() - new Date(validUntil).getTime()) / 86_400_000);
    if (days >= 0) return { text: days === 0 ? 'Bugün doldu' : `${days} gün önce doldu`, tone: 'text-rose-600' };
    return { text: `${-days} gün geçerli`, tone: 'text-emerald-600' };
}

/** Geri Kazanım odak kartı — ölü/sessiz adayın tüm bağlamı + geri-kazanım AI brifingi + sonuçlar. */
export function WinbackSessionCard({
    item, index, total, brief, briefLoading, briefError, onRetryBrief, onOutcome, onReoffer, saving,
    onOpenWhatsApp, onSendFollowup, onDeleteOffer, onDeleteLead, followupBusy,
    onPrev, onNext, onSkip, canPrev, canNext,
}: WinbackSessionCardProps) {
    const c = item.candidate;
    const bucket = WINBACK_BUCKET_META[item.bucket];
    const telHref = item.phone ? `tel:+${item.phone.replace(/\D/g, '')}` : undefined;
    const hasOffer = !!c.offerToken;
    const exp = offerStatusLabel(c.offerValidUntil, hasOffer);
    const renewLabel = hasOffer ? 'Teklif Yenile' : 'Yeni Teklif';

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            {/* Üst şerit — gezinme + sıra göstergesi + şans skoru */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-2.5">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <button onClick={onPrev} disabled={!canPrev} title="Önceki"
                            className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                            <ChevronLeft size={15} />
                        </button>
                        <button onClick={onNext} disabled={!canNext} title="Sonraki"
                            className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                            <ChevronRight size={15} />
                        </button>
                        <button onClick={onSkip} disabled={total <= 1} title="Bu kişiyi geç (sıranın sonuna at)"
                            className="ml-1 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 h-7 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
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
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[12px] font-bold text-amber-800"
                            title={item.reminderNote || 'Planlanan takip zamanı geldi'}>
                            <BellRing size={12} /> Hatırlatma vakti
                        </span>
                    )}
                    {item.winbackStatus && (
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-bold ${WINBACK_STATUS_META[item.winbackStatus].tone}`}>
                            {WINBACK_STATUS_META[item.winbackStatus].label}
                        </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold ${bucket.tone}`}>
                        <RotateCcw size={13} />
                        %{item.score} geri dönüş şansı
                    </span>
                </div>
            </div>

            <div className="p-5 sm:p-6">
                {/* Kimlik */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-[22px] font-bold leading-tight text-slate-900">{item.customerName}</h2>
                        {item.companyName && (
                            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-slate-500">
                                <Building2 size={13} className="text-slate-400" />
                                {item.companyName}
                                {item.businessType ? ` · ${item.businessType}` : ''}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[12px] font-semibold text-violet-700">
                            {bucket.label}
                        </span>
                        {c.aiScore !== null && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[12px] font-semibold text-indigo-700">
                                <Sparkles size={12} /> {c.aiScore}
                            </span>
                        )}
                    </div>
                </div>

                {/* Telefon + aksiyonlar */}
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    {item.phone ? (
                        <>
                            <a href={telHref} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-emerald-700">
                                <Phone size={16} /> Ara
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
                    <button onClick={onOpenWhatsApp}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50">
                        <MessageCircle size={15} className="text-green-600" /> WhatsApp
                    </button>
                    <button onClick={() => onReoffer()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-semibold text-amber-700 transition-colors hover:bg-amber-100">
                        <RotateCcw size={15} /> {renewLabel}
                    </button>
                    <MoreActionsMenu
                        followupBusy={followupBusy}
                        onSendFollowup={onSendFollowup}
                        onDeleteOffer={onDeleteOffer}
                        onDeleteLead={onDeleteLead}
                    />
                </div>

                {/* AI tek-cümle gerekçe */}
                {c.aiReasoning && (
                    <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-snug text-slate-600">
                        {c.aiReasoning}
                    </p>
                )}

                {/* Neden bu sırada — geri kazanım sinyalleri */}
                {item.signals.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Neden bu sırada:</span>
                        {item.signals.map((s, i) => (
                            <span key={i} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                {s}
                            </span>
                        ))}
                    </div>
                )}

                {/* Meta ızgara */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Meta icon={Eye} label="Son görüntüleme" value={c.lastViewedLabel || '—'} sub={`${c.opens} açılış`} />
                    <Meta icon={CalendarClock} label="Teklif süresi" value={exp.text} valueTone={exp.tone} />
                    <Meta icon={Package} label="Teklif modeli"
                        value={c.products.length ? c.products[0] : '—'}
                        sub={c.offerTotal !== null ? money(c.offerTotal) : (c.products.length > 1 ? `+${c.products.length - 1} model` : undefined)} />
                    <Meta icon={History} label="Arama geçmişi"
                        value={item.callInfo ? `${item.callInfo.count} arama` : 'Hiç aranmadı'}
                        sub={c.paymentStarted ? 'ödemeye gitmişti' : `${c.ageDays} günlük lead`} />
                </div>

                {/* Ödeme sinyali vurgusu */}
                {c.paymentStarted && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-1.5 text-[12px] font-semibold text-emerald-700">
                        <CreditCard size={13} />
                        Daha önce ödemeye gitmişti — güçlü geri dönüş adayı
                    </div>
                )}

                {/* Geri-kazanım AI brifingi */}
                <div className="mt-5">
                    <CallBriefPanel brief={brief} loading={briefLoading} error={briefError} onRetry={onRetryBrief} />
                </div>

                {/* Takip geçmişi */}
                <div className="mt-5">
                    <FollowUpTimeline leadId={item.leadId} />
                </div>

                {/* Müşteri notları */}
                <div className="mt-5">
                    <LeadNotesCard leadId={item.leadId} />
                </div>
            </div>

            {/* Sonuç butonları */}
            <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:px-6">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Geri kazanım sonucu</p>
                <WinbackOutcomeBar onOutcome={onOutcome} onReoffer={onReoffer} saving={saving} />
            </div>
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
