import React, { useEffect, useState } from 'react';
import {
    X, CreditCard, Clock, ServerCrash, FileJson, User, Link2,
    CheckCircle2, AlertTriangle, Lightbulb,
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    AdminPaymentsService,
    type PaymentDetailBundle,
    type PaymentGatewayEvent,
    type PaymentTimelineEvent,
} from '../../../services/admin/paymentsService';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { StatusBadge } from '../../ui/StatusBadge';
import CollapsibleSection from '../../ui/CollapsibleSection';
import { paymentStatusMeta, gatewayEventMeta, FAILURE_KIND_LABEL } from '../../../lib/paymentFailure';

interface Props {
    /** payment_transactions.id — null ise çekmece kapalı. */
    paymentId: string | null;
    onClose: () => void;
}

const EVENT_LABEL: Record<string, string> = {
    payment_started: 'Ödeme başlatıldı (PayTR sayfası açıldı)',
    payment_completed: 'Ödeme başarıyla tamamlandı',
    payment_failed: 'Ödeme başarısız sonuçlandı',
    reservation_created: 'Rezervasyon oluşturuldu (kapora)',
    reservation_paid: 'Rezervasyon tam ödendi',
    reservation_recovery_insert: 'Rezervasyon kurtarma kaydı oluşturuldu',
};

/**
 * Tek bir ödemenin teşhis çekmecesi.
 *
 * Var oluş sebebi: liste satırı "Başarısız" dediğinde operatörün bunun banka
 * reddi mi, müşterinin vazgeçmesi mi, yoksa bizim taraftaki bir arıza mı
 * olduğunu ayırt edebilmesi gerekiyor. Bu üç cevap üç ayrı kaynakta yaşıyor;
 * çekmece hepsini tek ekranda birleştirir.
 */
export const PaymentDetailSlideOver: React.FC<Props> = ({ paymentId, onClose }) => {
    const [bundle, setBundle] = useState<PaymentDetailBundle | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!paymentId) { setBundle(null); setLoadError(null); return; }
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        AdminPaymentsService.getPaymentDetail(paymentId)
            .then(res => { if (!cancelled) setBundle(res); })
            .catch(err => { if (!cancelled) setLoadError(err?.message || 'Ödeme detayı yüklenemedi.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [paymentId]);

    // ESC ile kapatma + body scroll lock (AdSessionsDrawer ile aynı kalıp)
    useEffect(() => {
        if (!paymentId) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [paymentId, onClose]);

    if (!paymentId) return null;

    const txn = bundle?.transaction;
    const meta = txn ? paymentStatusMeta(txn) : null;

    return (
        <div className="fixed inset-0 z-[60] flex">
            <button
                aria-label="Kapat"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] cursor-default"
            />

            <aside
                role="dialog"
                aria-label="Ödeme detayı"
                className="relative ml-auto w-full max-w-[640px] h-full bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            >
                <header className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-white">
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold text-slate-900 truncate">Ödeme Detayı</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate">
                            {txn?.provider_transaction_id || '—'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 shrink-0"
                        aria-label="Kapat"
                    >
                        <X size={16} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {loading && (
                        <div className="py-16 flex justify-center"><LoadingSpinner /></div>
                    )}

                    {loadError && !loading && (
                        <div className="p-4 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
                            {loadError}
                        </div>
                    )}

                    {txn && meta && !loading && (
                        <>
                            {/* ── Sonuç: asıl cevap en üstte ───────────────────────── */}
                            <section className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <StatusBadge tone={meta.tone} icon={meta.icon}>{meta.label}</StatusBadge>
                                    {txn.test_mode && (
                                        <StatusBadge tone="info" size="sm">TEST İŞLEMİ</StatusBadge>
                                    )}
                                </div>

                                {meta.reason ? (
                                    <div className="space-y-2">
                                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                                            {FAILURE_KIND_LABEL[meta.reason.kind]}
                                        </div>
                                        <p className="text-sm font-semibold text-slate-900">{meta.reason.label}</p>
                                        {meta.reason.detail && (
                                            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded px-2.5 py-2">
                                                PayTR mesajı: {meta.reason.detail}
                                            </p>
                                        )}
                                        {meta.reason.hint && (
                                            <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2.5 py-2 flex items-start gap-2">
                                                <Lightbulb size={13} className="shrink-0 mt-0.5" />
                                                <span>{meta.reason.hint}</span>
                                            </p>
                                        )}
                                        {txn.failure_code && (
                                            <p className="text-[10px] text-slate-400 font-mono">
                                                PayTR kodu: {txn.failure_code}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-600">
                                        {meta.hint || 'Bu ödeme sorunsuz tamamlandı.'}
                                    </p>
                                )}
                            </section>

                            {/* ── Özet ──────────────────────────────────────────────── */}
                            <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
                                <Row icon={User} label="Müşteri" value={txn.leads?.customer_name || 'Bilinmiyor'} />
                                {txn.leads?.phone_number && (
                                    <Row label="Telefon" value={txn.leads.phone_number} mono />
                                )}
                                <Row
                                    icon={CreditCard}
                                    label="Tutar"
                                    value={new Intl.NumberFormat('tr-TR', {
                                        style: 'currency',
                                        currency: txn.currency || 'TRY',
                                    }).format(txn.amount)}
                                />
                                <Row label="Yöntem" value={txn.payment_method || '—'} />
                                <Row icon={Clock} label="Başlatıldı" value={fmt(txn.created_at)} />
                                {txn.paid_at && <Row label="Ödendi" value={fmt(txn.paid_at)} />}
                                <Row label="Son güncelleme" value={fmt(txn.updated_at)} />
                                {txn.token && (
                                    <Row
                                        icon={Link2}
                                        label="Teklif linki"
                                        value={
                                            <a
                                                href={`/offer/${txn.token}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-600 hover:underline font-mono text-[11px] break-all"
                                            >
                                                /offer/{txn.token}
                                            </a>
                                        }
                                    />
                                )}
                            </section>

                            {/* ── Sistem arızaları ──────────────────────────────────── */}
                            {bundle.gatewayEvents.length > 0 && (
                                <section className="bg-white border border-amber-200 rounded-lg overflow-hidden">
                                    <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                                        <ServerCrash size={14} className="text-amber-600" />
                                        <span className="text-sm font-semibold text-amber-900">
                                            Sistem olayları ({bundle.gatewayEvents.length})
                                        </span>
                                    </div>
                                    <div className="p-3 space-y-2">
                                        {bundle.gatewayEvents.map(ev => (
                                            <GatewayEventCard key={ev.id} event={ev} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* ── Zaman çizelgesi ───────────────────────────────────── */}
                            <CollapsibleSection
                                title="Zaman çizelgesi"
                                icon={Clock}
                                badge={String(bundle.timeline.length)}
                                defaultOpen={bundle.timeline.length > 0}
                            >
                                {bundle.timeline.length === 0 ? (
                                    <p className="text-xs text-slate-400">Bu ödeme için kayıtlı olay yok.</p>
                                ) : (
                                    <ol className="space-y-2.5">
                                        {bundle.timeline.map(ev => (
                                            <TimelineRow key={ev.id} event={ev} />
                                        ))}
                                    </ol>
                                )}
                            </CollapsibleSection>

                            {/* ── Ham callback ──────────────────────────────────────── */}
                            <CollapsibleSection title="PayTR ham bildirimi" icon={FileJson} defaultOpen={false}>
                                {txn.callback_payload ? (
                                    <pre className="text-[10px] leading-relaxed bg-slate-900 text-slate-100 rounded-md p-3 overflow-x-auto">
                                        {JSON.stringify(txn.callback_payload, null, 2)}
                                    </pre>
                                ) : (
                                    <p className="text-xs text-slate-400">
                                        PayTR'dan bu ödeme için bildirim kaydedilmemiş. Ödeme başlatıldı ama
                                        sonucu hiç dönmediyse (müşteri sayfadan çıktıysa) bu normaldir.
                                    </p>
                                )}
                            </CollapsibleSection>
                        </>
                    )}
                </div>
            </aside>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────

function fmt(value?: string | null): string {
    if (!value) return '—';
    try {
        return format(new Date(value), 'dd MMM yyyy, HH:mm:ss', { locale: tr });
    } catch {
        return value;
    }
}

const Row: React.FC<{
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    value: React.ReactNode;
    mono?: boolean;
}> = ({ icon: Icon, label, value, mono }) => (
    <div className="flex items-start justify-between gap-4 text-xs">
        <span className="text-slate-500 inline-flex items-center gap-1.5 shrink-0">
            {Icon && <Icon size={12} className="text-slate-400" />}
            {label}
        </span>
        <span className={`text-slate-900 font-medium text-right min-w-0 ${mono ? 'font-mono' : ''}`}>
            {value}
        </span>
    </div>
);

const TimelineRow: React.FC<{ event: PaymentTimelineEvent }> = ({ event }) => {
    const isFail = event.event_type === 'payment_failed';
    const isDone = event.event_type === 'payment_completed';
    const Icon = isFail ? AlertTriangle : isDone ? CheckCircle2 : Clock;
    const color = isFail ? 'text-red-500' : isDone ? 'text-emerald-500' : 'text-slate-400';

    return (
        <li className="flex items-start gap-2.5">
            <Icon size={13} className={`${color} shrink-0 mt-0.5`} />
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800">
                    {EVENT_LABEL[event.event_type] || event.event_type}
                </p>
                <p className="text-[10px] text-slate-400">{fmt(event.created_at)}</p>
                {event.metadata?.failed_reason_msg && (
                    <p className="text-[10px] text-red-600 mt-0.5">
                        {event.metadata.failed_reason_msg}
                    </p>
                )}
            </div>
        </li>
    );
};

const GatewayEventCard: React.FC<{ event: PaymentGatewayEvent }> = ({ event }) => {
    const info = gatewayEventMeta(event.kind);
    return (
        <div className="border border-slate-200 rounded-md p-2.5 bg-white">
            <div className="flex items-center justify-between gap-2 mb-1">
                <StatusBadge tone={info.tone} size="sm">{info.label}</StatusBadge>
                <span className="text-[10px] text-slate-400 shrink-0">{fmt(event.created_at)}</span>
            </div>
            <p className="text-[11px] text-slate-700">{event.message || info.description}</p>
            <p className="text-[10px] text-slate-400 mt-1">{info.description}</p>
        </div>
    );
};
