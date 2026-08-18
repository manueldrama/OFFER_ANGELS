import { useState } from 'react';
import { PhoneOff, PhoneMissed, Clock, ThumbsDown, Trophy, Loader2, BellPlus, StickyNote, Receipt } from 'lucide-react';
import { SNOOZE_OPTIONS, type CallOutcome } from '../../../services/admin/callAssistantService';

export interface OutcomeOpts {
    snoozeHours?: number;
    untilIso?: string;
    followUpIso?: string;
    note?: string;
    reason?: string;
}

interface OutcomeBarProps {
    /** Sonuç seçilince çağrılır; snooze/takip için zaman, "İlgilenmiyor" için neden taşır. */
    onOutcome: (outcome: CallOutcome, opts?: OutcomeOpts) => void;
    saving: boolean;
    /**
     * "Kazanıldı" panelindeki "Satış detayını kaydet" — telefonda kapatılan satışı
     * rezervasyona/ciroya aktaran ManualSaleModal'ı açar. Verilmezse panel yerine
     * doğrudan 'won' sonucu yazılır (eski davranış).
     */
    onRecordSale?: () => void;
}

/** "İlgilenmiyor" için hazır neden etiketleri — Lead Kalitesi raporuna besler. */
const DECLINE_REASONS = ['Fiyat', 'Zaman', 'Rakip', 'İhtiyaç yok', 'Diğer'];

/** "Ulaşıldı" sonrası hızlı takip seçenekleri (saat sonrası). */
const FOLLOWUP_OPTIONS: { label: string; hours: number }[] = [
    { label: 'Yarın', hours: 24 },
    { label: '2 gün', hours: 48 },
    { label: '3 gün', hours: 72 },
];

/** Yerel datetime-local değerini ISO'ya çevirir (boşsa null). */
function localToIso(v: string): string | null {
    if (!v) return null;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Arama sonucu butonları — sonuç + otomatik sonraki aksiyon. Opsiyonel hızlı not tüm
 * sonuçlara iliştirilir. "Sonra ara" snooze (göreli/kesin saat), "İlgilenmiyor" neden,
 * "Ulaşıldı" takip hatırlatması açar.
 */
export function OutcomeBar({ onOutcome, saving, onRecordSale }: OutcomeBarProps) {
    const [panel, setPanel] = useState<null | 'snooze' | 'decline' | 'followup' | 'won'>(null);
    const [note, setNote] = useState('');
    const [exact, setExact] = useState('');

    const noteOpt = note.trim() ? { note: note.trim() } : {};
    const fire = (outcome: CallOutcome, extra: OutcomeOpts = {}) => {
        setPanel(null);
        onOutcome(outcome, { ...noteOpt, ...extra });
        setNote(''); setExact('');
    };
    const togglePanel = (p: 'snooze' | 'decline' | 'followup' | 'won') => setPanel((c) => (c === p ? null : p));

    const btn = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

    return (
        <div className="relative">
            {/* Opsiyonel hızlı not — seçilen sonuca iliştirilir */}
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
                    onClick={() => togglePanel('followup')}
                    className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
                >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <PhoneOff size={15} />}
                    Ulaşıldı
                </button>

                <button
                    disabled={saving}
                    onClick={() => fire('no_answer')}
                    className={`${btn} bg-white text-slate-700 border border-slate-200 hover:bg-slate-50`}
                >
                    <PhoneMissed size={15} className="text-amber-500" />
                    Cevap yok
                </button>

                <button
                    disabled={saving}
                    onClick={() => togglePanel('snooze')}
                    className={`${btn} bg-white text-slate-700 border border-slate-200 hover:bg-slate-50`}
                >
                    <Clock size={15} className="text-indigo-500" />
                    Sonra ara
                </button>

                <button
                    disabled={saving}
                    onClick={() => togglePanel('decline')}
                    className={`${btn} bg-white text-rose-600 border border-rose-200 hover:bg-rose-50`}
                >
                    <ThumbsDown size={15} />
                    İlgilenmiyor
                </button>

                <button
                    disabled={saving}
                    onClick={() => (onRecordSale ? togglePanel('won') : fire('won'))}
                    className={`${btn} bg-white text-green-700 border border-green-200 hover:bg-green-50`}
                >
                    <Trophy size={15} />
                    Kazanıldı
                </button>
            </div>

            {/* "Sonra ara" — göreli süreler + kesin saat */}
            {panel === 'snooze' && (
                <div className="absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
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

            {/* "İlgilenmiyor" — neden etiketi */}
            {panel === 'decline' && (
                <div className="absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">İlgilenmeme nedeni</p>
                    {DECLINE_REASONS.map((r) => (
                        <button
                            key={r}
                            onClick={() => fire('not_interested', { reason: r })}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                        >
                            <ThumbsDown size={13} className="text-slate-400" />
                            {r}
                        </button>
                    ))}
                </div>
            )}

            {/* "Kazanıldı" — sadece durum mu, yoksa satış kaydı da mı? */}
            {panel === 'won' && (
                <div className="absolute bottom-full right-0 z-10 mb-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <button
                        onClick={() => { setPanel(null); onRecordSale?.(); }}
                        className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-emerald-50 transition-colors cursor-pointer"
                    >
                        <Receipt size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                        <span>
                            <span className="block text-[13px] font-semibold text-emerald-700">Satış detayını kaydet</span>
                            <span className="block text-[11px] text-slate-500">Sipariş oluşturulur, ciroya girer</span>
                        </span>
                    </button>
                    <div className="mt-1 border-t border-slate-100 pt-1">
                        <button
                            onClick={() => fire('won')}
                            className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            <Trophy size={13} className="mt-0.5 shrink-0 text-slate-400" />
                            <span>
                                <span className="block text-[13px] font-semibold text-slate-700">Sadece kazanıldı işaretle</span>
                                <span className="block text-[11px] text-slate-500">Sipariş oluşturulmaz</span>
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {/* "Ulaşıldı" — opsiyonel takip hatırlatması */}
            {panel === 'followup' && (
                <div className="absolute bottom-full left-1/2 z-10 mb-2 w-60 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <button
                        onClick={() => fire('reached')}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                    >
                        <PhoneOff size={13} />
                        Kaydet, takip yok
                    </button>
                    <div className="mt-1 border-t border-slate-100 pt-1">
                        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Takip hatırlatması kur</p>
                        {FOLLOWUP_OPTIONS.map((o) => (
                            <button
                                key={o.hours}
                                onClick={() => fire('reached', { followUpIso: new Date(Date.now() + o.hours * 3_600_000).toISOString() })}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                            >
                                <BellPlus size={13} className="text-amber-500" />
                                {o.label} sonra hatırlat
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
