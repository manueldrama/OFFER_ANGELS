import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PhoneCall, Loader2, Clock, X, RotateCcw } from 'lucide-react';
import { leadRemindersService } from '../../../services/admin/leadRemindersService';
import type { LeadCallInfo } from '../../../services/admin/leadCallsService';
import { formatDateTime } from '../../../hooks/useAppSettings';
import { cn } from '../../../lib/utils';

interface CallTrackerCellProps {
    leadId: string;
    token: string;
    callInfo?: LeadCallInfo;
    /** Arama kaydı düşürür (Offers.tsx → leadCallsService.logCall + optimistik state). */
    onLogCall: (leadId: string, token: string) => Promise<void> | void;
    /** Son aramayı geri alır (yanlış basış). Offers.tsx → leadCallsService.undoLastCall + optimistik -1. */
    onUndoCall?: (leadId: string) => Promise<void> | void;
    /** Kısa onay mesajı (toast). */
    onToast?: (msg: string) => void;
}

const daysSince = (iso: string): number =>
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

const lastCallLabel = (iso: string): string => {
    const d = daysSince(iso);
    if (d <= 0) return 'bugün arandı';
    if (d === 1) return 'dün arandı';
    return `${d} gün önce`;
};

const toLocalDatetimeInputValue = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Bugünden N gün sonrası, saat 10:00. */
const presetDate = (days: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(10, 0, 0, 0);
    return d;
};

const PRESETS: { label: string; days: number }[] = [
    { label: 'Yarın', days: 1 },
    { label: '3 gün sonra', days: 3 },
    { label: '1 hafta sonra', days: 7 },
];

/**
 * Liste satırı arama takibi: "Aradım" butonu + sayaç. Basınca arama kaydı düşer,
 * ardından "Ne zaman tekrar arayalım?" hatırlatıcı popover'ı açılır.
 * Popover, satırın overflow-hidden kapsayıcısı tarafından kırpılmasın diye
 * portal + fixed konum ile body'ye render edilir.
 */
export const CallTrackerCell: React.FC<CallTrackerCellProps> = ({
    leadId, token, callInfo, onLogCall, onUndoCall, onToast,
}) => {
    const [logging, setLogging] = useState(false);
    const [undoing, setUndoing] = useState(false);
    const [open, setOpen] = useState(false);
    const [customMode, setCustomMode] = useState(false);
    const [customAt, setCustomAt] = useState<string>(() => toLocalDatetimeInputValue(presetDate(1)));
    const [saving, setSaving] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    const btnRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);

    const POP_W = 256;

    const computePos = () => {
        const r = btnRef.current?.getBoundingClientRect();
        if (!r) return;
        const left = Math.max(8, Math.min(r.right - POP_W, window.innerWidth - POP_W - 8));
        setPos({ top: r.bottom + 6, left });
    };

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (logging) return;
        setLogging(true);
        try {
            await onLogCall(leadId, token);
            onToast?.('Arama kaydedildi');
            computePos();
            setCustomMode(false);
            setCustomAt(toLocalDatetimeInputValue(presetDate(1)));
            setOpen(true);
        } catch (err: any) {
            onToast?.(`Arama kaydedilemedi: ${err?.message ?? 'hata'}`);
        } finally {
            setLogging(false);
        }
    };

    const handleUndo = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (undoing || !onUndoCall) return;
        setUndoing(true);
        try {
            await onUndoCall(leadId);
            onToast?.('Son arama geri alındı');
        } catch (err: any) {
            onToast?.(`Geri alınamadı: ${err?.message ?? 'hata'}`);
        } finally {
            setUndoing(false);
        }
    };

    const createReminder = async (when: Date) => {
        if (saving) return;
        setSaving(true);
        try {
            await leadRemindersService.create({
                lead_id: leadId,
                remind_at: when.toISOString(),
                note: 'Tekrar ara',
            });
            onToast?.('Hatırlatıcı kuruldu');
            setOpen(false);
        } catch (err: any) {
            onToast?.(`Hatırlatıcı kurulamadı: ${err?.message ?? 'hata'}`);
        } finally {
            setSaving(false);
        }
    };

    // Dışarı tıkla / scroll / resize → kapat veya yeniden konumlandır.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (
                popRef.current && !popRef.current.contains(e.target as Node) &&
                btnRef.current && !btnRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        const onScrollResize = () => computePos();
        document.addEventListener('mousedown', onDown);
        window.addEventListener('resize', onScrollResize);
        window.addEventListener('scroll', onScrollResize, true);
        return () => {
            document.removeEventListener('mousedown', onDown);
            window.removeEventListener('resize', onScrollResize);
            window.removeEventListener('scroll', onScrollResize, true);
        };
    }, [open]);

    const count = callInfo?.count ?? 0;

    return (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
                ref={btnRef}
                type="button"
                onClick={handleClick}
                disabled={logging}
                className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-50',
                    count > 0
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
                title="Arama kaydı düş"
            >
                {logging ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}
                <span className="hidden sm:inline">Aradım</span>
            </button>

            {count > 0 && callInfo && (
                <div
                    className="hidden min-w-0 flex-col leading-tight sm:flex"
                    title={`Son arama: ${formatDateTime(callInfo.lastAt)}`}
                >
                    <span className="text-[11px] font-bold tabular-nums text-slate-700">{count}. arama</span>
                    <span className="text-[10px] text-slate-400">{lastCallLabel(callInfo.lastAt)}</span>
                </div>
            )}

            {count > 0 && onUndoCall && (
                <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoing}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 disabled:opacity-40"
                    title="Son aramayı geri al (yanlış basış)"
                >
                    {undoing ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                </button>
            )}

            {open && pos && createPortal(
                <div
                    ref={popRef}
                    style={{ position: 'fixed', top: pos.top, left: pos.left, width: POP_W }}
                    className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                        <span className="text-[11px] font-bold text-slate-700">Ne zaman tekrar arayalım?</span>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Kapat"
                        >
                            <X size={13} />
                        </button>
                    </div>

                    <div className="p-2.5">
                        {!customMode ? (
                            <div className="flex flex-col gap-1.5">
                                {PRESETS.map((p) => (
                                    <button
                                        key={p.days}
                                        type="button"
                                        disabled={saving}
                                        onClick={() => createReminder(presetDate(p.days))}
                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[12px] font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                                    >
                                        <Clock size={12} className="text-slate-400" />
                                        {p.label}
                                        <span className="ml-auto text-[10px] font-normal text-slate-400">10:00</span>
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setCustomMode(true)}
                                    className="rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                                >
                                    Özel tarih…
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <input
                                    type="datetime-local"
                                    value={customAt}
                                    onChange={(e) => setCustomAt(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                                />
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={!customAt || saving}
                                        onClick={() => createReminder(new Date(customAt))}
                                        className="flex-1 rounded-lg bg-brand-600 px-2 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
                                    >
                                        {saving ? <Loader2 size={12} className="mx-auto animate-spin" /> : 'Kur'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCustomMode(false)}
                                        className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-slate-500 hover:bg-slate-100"
                                    >
                                        Geri
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="mt-2 w-full rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                        >
                            Şimdilik gerek yok
                        </button>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
};
