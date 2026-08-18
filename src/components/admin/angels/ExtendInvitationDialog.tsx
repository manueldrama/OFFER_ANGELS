// Angels davet süresi uzatma / yeniden aktifleştirme diyaloğu.
// ExtendOfferExpiryDialog kalıbının Angels (rose) uyarlaması.

import React, { useEffect, useMemo, useState } from 'react';
import { X, CalendarPlus, Clock, Calendar, Instagram, BellRing } from 'lucide-react';
import { AngelsService, isInvitationExpired } from '../../../services/angels/angelsService';
import { describeRemaining } from '../../../lib/offerExpiry';
import type { AngelInvitation } from '../../../types/angels';

interface ExtendInvitationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    invitation: AngelInvitation | null;
    onDone: () => void;
}

const QUICK_OPTIONS = [7, 14, 30, 60];

function toDateInputValue(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatTr(d: Date): string {
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export const ExtendInvitationDialog: React.FC<ExtendInvitationDialogProps> = ({
    isOpen, onClose, invitation, onDone,
}) => {
    const [quickDays, setQuickDays] = useState<number | null>(7);
    const [customDate, setCustomDate] = useState<string>('');
    const [customDays, setCustomDays] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setQuickDays(7);
            setCustomDate('');
            setCustomDays('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const currentRemaining = useMemo(
        () => describeRemaining(invitation?.expires_at ?? null),
        [invitation],
    );

    const newExpiryDate = useMemo<Date | null>(() => {
        if (!invitation) return null;
        if (customDate) {
            const d = new Date(`${customDate}T23:59:59`);
            return isNaN(d.getTime()) ? null : d;
        }
        const days = quickDays ?? (customDays ? parseInt(customDays, 10) : NaN);
        if (!Number.isFinite(days) || days <= 0) return null;
        const base = invitation.expires_at && new Date(invitation.expires_at).getTime() > Date.now()
            ? new Date(invitation.expires_at)
            : new Date();
        const next = new Date(base);
        next.setDate(next.getDate() + days);
        return next;
    }, [invitation, customDate, quickDays, customDays]);

    if (!isOpen || !invitation) return null;

    const isAccepted = invitation.status === 'accepted';
    const isExpired = isInvitationExpired(invitation);
    const hasRenewalRequest = !!invitation.renewal_requested_at;
    const todayInput = toDateInputValue(new Date());

    const handleQuickSelect = (days: number) => {
        setQuickDays(days);
        setCustomDate('');
        setCustomDays('');
    };

    const handleCustomDaysChange = (val: string) => {
        const clean = val.replace(/\D/g, '');
        setCustomDays(clean);
        if (clean) {
            setQuickDays(null);
            setCustomDate('');
        }
    };

    const handleCustomDateChange = (val: string) => {
        setCustomDate(val);
        if (val) {
            setQuickDays(null);
            setCustomDays('');
        }
    };

    const handleSubmit = async () => {
        if (!newExpiryDate || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const iso = newExpiryDate.toISOString();
            if (!isAccepted && isExpired) {
                await AngelsService.reactivateInvitation(invitation.id, iso);
            } else {
                await AngelsService.updateInvitationExpiry(invitation.id, iso);
            }
            onDone();
            onClose();
        } catch (err: any) {
            console.error('[ExtendInvitationDialog] error:', err);
            alert(err?.message || 'Davet süresi güncellenemedi.');
            setIsSubmitting(false);
        }
    };

    const remainingToneClass = {
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        red: 'bg-red-50 text-red-700 border-red-200',
        slate: 'bg-slate-50 text-slate-600 border-slate-200',
    }[currentRemaining.tone];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                            <CalendarPlus className="w-4 h-4 text-rose-600" />
                        </div>
                        {isExpired && !isAccepted ? 'Daveti Yeniden Aktifleştir' : 'Davet Süresini Uzat'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-md transition-colors cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                    {/* Invitation context */}
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-800 truncate">
                                {invitation.creator_name || '—'}
                            </div>
                            {invitation.instagram && (
                                <div className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1">
                                    <Instagram size={11} />@{invitation.instagram.replace(/^@/, '')}
                                </div>
                            )}
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${remainingToneClass}`}>
                            <Clock className="w-3 h-3" />
                            {currentRemaining.label}
                        </span>
                    </div>

                    {/* Pending renewal request */}
                    {hasRenewalRequest && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5">
                            <BellRing className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-800">
                                Creator yeni davet talep etti
                                {invitation.renewal_requested_at && (
                                    <> ({formatTr(new Date(invitation.renewal_requested_at))})</>
                                )}
                                . Süreyi güncellemek talebi onaylamış sayılacak.
                            </div>
                        </div>
                    )}

                    {/* Current expiry */}
                    <div className="text-xs text-slate-500">
                        Mevcut bitiş: <span className="font-medium text-slate-700">{invitation.expires_at ? formatTr(new Date(invitation.expires_at)) : '—'}</span>
                    </div>

                    {/* Quick options */}
                    <div>
                        <div className="text-xs font-semibold text-slate-600 mb-2">Hızlı uzat</div>
                        <div className="grid grid-cols-4 gap-2">
                            {QUICK_OPTIONS.map(days => {
                                const active = quickDays === days;
                                return (
                                    <button
                                        key={days}
                                        type="button"
                                        onClick={() => handleQuickSelect(days)}
                                        className={`px-3 py-2 text-sm font-bold rounded-md border transition-colors cursor-pointer ${
                                            active
                                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                                : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:bg-rose-50'
                                        }`}
                                    >
                                        +{days} gün
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom days */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Veya özel gün sayısı</label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={customDays}
                                onChange={e => handleCustomDaysChange(e.target.value)}
                                placeholder="Örn. 21"
                                className="w-full h-10 px-3 pr-12 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">gün</span>
                        </div>
                    </div>

                    {/* Custom date picker */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" /> Veya bitiş tarihi seç
                        </label>
                        <input
                            type="date"
                            min={todayInput}
                            value={customDate}
                            onChange={e => handleCustomDateChange(e.target.value)}
                            className="w-full h-10 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white"
                        />
                    </div>

                    {/* Preview */}
                    {newExpiryDate && (
                        <div className="bg-rose-50 border border-rose-100 rounded-lg p-3">
                            <div className="text-xs text-rose-600 font-semibold uppercase tracking-wider">Yeni bitiş tarihi</div>
                            <div className="text-base font-bold text-rose-900 mt-1">{formatTr(newExpiryDate)}</div>
                            <div className="text-[11px] text-rose-700 mt-1.5 space-y-0.5">
                                {isAccepted ? (
                                    <div>• Davet zaten kabul edilmiş — sadece geçerlilik tarihi güncellenir.</div>
                                ) : isExpired ? (
                                    <div>• Süresi dolmuş davet yeniden aktifleşecek, aynı link tekrar çalışacak.</div>
                                ) : (
                                    <div>• Davet linki bu tarihe kadar geçerli olacak.</div>
                                )}
                                {hasRenewalRequest && (
                                    <div>• Creator'ın yenileme talebi onaylanmış sayılacak.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        İptal
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!newExpiryDate || isSubmitting}
                        className="px-4 py-2.5 text-sm font-bold text-white bg-rose-600 rounded-md hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2 cursor-pointer"
                    >
                        <CalendarPlus className="w-4 h-4" />
                        {isSubmitting
                            ? 'Kaydediliyor…'
                            : isExpired && !isAccepted
                                ? 'Yeniden aktifleştir'
                                : 'Süreyi uzat'}
                    </button>
                </div>
            </div>
        </div>
    );
};
