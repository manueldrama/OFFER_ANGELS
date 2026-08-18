import { useState } from 'react';
import { PhoneOutgoing, RotateCcw, ThumbsDown, Clock, StickyNote, Loader2 } from 'lucide-react';
import { SNOOZE_OPTIONS, type WinbackOutcome } from '../../../services/admin/callAssistantService';

export interface WinbackOutcomeOpts {
    note?: string;
    snoozeHours?: number;
    untilIso?: string;
}

interface WinbackOutcomeBarProps {
    /** Statü sonuçları (contacted/returned/declined) + snooze. */
    onOutcome: (outcome: WinbackOutcome, opts?: WinbackOutcomeOpts) => void;
    /** "Yeniden teklif" — süre uzatma dialog'unu açar (statüyü uzatma başarısında sayfa yazar). */
    onReoffer: (note?: string) => void;
    saving: boolean;
}

function localToIso(v: string): string | null {
    if (!v) return null;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Geri Kazanım arama sonucu butonları — winback_status'a yazar.
 * Arandı / Geri döndü / Yeniden teklif / İlgilenmiyor / Sonra ara.
 */
export function WinbackOutcomeBar({ onOutcome, onReoffer, saving }: WinbackOutcomeBarProps) {
    const [snoozeOpen, setSnoozeOpen] = useState(false);
    const [note, setNote] = useState('');
    const [exact, setExact] = useState('');

    const noteOpt = note.trim() ? { note: note.trim() } : {};
    const fire = (outcome: WinbackOutcome, extra: WinbackOutcomeOpts = {}) => {
        setSnoozeOpen(false);
        onOutcome(outcome, { ...noteOpt, ...extra });
        setNote(''); setExact('');
    };

    const btn = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

    return (
        <div className="relative">
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5">
                <StickyNote size={14} className="shrink-0 text-slate-400" />
                <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Görüşme notu (opsiyonel) — sonuca eklenir"
                    className="w-full bg-transparent py-2 text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <button
                    disabled={saving}
                    onClick={() => fire('contacted')}
                    className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}
                >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <PhoneOutgoing size={15} />}
                    Arandı
                </button>

                <button
                    disabled={saving}
                    onClick={() => fire('returned')}
                    className={`${btn} bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50`}
                >
                    <RotateCcw size={15} />
                    Geri döndü
                </button>

                <button
                    disabled={saving}
                    onClick={() => { setSnoozeOpen(false); onReoffer(note.trim() || undefined); setNote(''); }}
                    className={`${btn} bg-white text-amber-700 border border-amber-200 hover:bg-amber-50`}
                >
                    <RotateCcw size={15} className="text-amber-500" />
                    Yeniden teklif
                </button>

                <button
                    disabled={saving}
                    onClick={() => fire('declined')}
                    className={`${btn} bg-white text-rose-600 border border-rose-200 hover:bg-rose-50`}
                >
                    <ThumbsDown size={15} />
                    İlgilenmiyor
                </button>

                <button
                    disabled={saving}
                    onClick={() => setSnoozeOpen((v) => !v)}
                    className={`${btn} bg-white text-slate-700 border border-slate-200 hover:bg-slate-50`}
                >
                    <Clock size={15} className="text-indigo-500" />
                    Sonra ara
                </button>
            </div>

            {snoozeOpen && (
                <div className="absolute bottom-full right-0 z-10 mb-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ne zaman tekrar aransın?</p>
                    {SNOOZE_OPTIONS.map((o) => (
                        <button
                            key={o.hours}
                            onClick={() => fire('snooze', { snoozeHours: o.hours })}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                        >
                            <Clock size={13} className="text-slate-400" />
                            {o.label}
                        </button>
                    ))}
                    <div className="mt-1 border-t border-slate-100 px-2 pt-2">
                        <p className="mb-1 text-[11px] font-semibold text-slate-400">Belirli saat</p>
                        <input
                            type="datetime-local"
                            value={exact}
                            onChange={(e) => setExact(e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <button
                            disabled={!localToIso(exact)}
                            onClick={() => { const iso = localToIso(exact); if (iso) fire('snooze', { untilIso: iso }); }}
                            className="mt-1.5 w-full rounded-md bg-indigo-600 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            Bu saatte hatırlat
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
