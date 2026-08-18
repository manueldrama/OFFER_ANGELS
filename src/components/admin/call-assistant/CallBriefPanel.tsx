import { Sparkles, Target, MessageSquareQuote, ShieldQuestion, Megaphone, RefreshCw, AlertCircle } from 'lucide-react';

export interface CallBrief {
    why_now: string;
    talking_points: string[];
    objections: { q: string; a: string }[];
    goal: string;
    opening_line: string;
}

interface CallBriefPanelProps {
    brief: CallBrief | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}

/** AI arama brifingi — kart içinde yüklenirken skeleton, hata olursa yeniden dene. */
export function CallBriefPanel({ brief, loading, error, onRetry }: CallBriefPanelProps) {
    return (
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-700">
                    <Sparkles size={15} className="text-indigo-500" />
                    AI Arama Brifingi
                </span>
                {!loading && (
                    <button
                        onClick={onRetry}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Brifingi yeniden üret"
                    >
                        <RefreshCw size={12} /> Yenile
                    </button>
                )}
            </div>

            {loading && (
                <div className="space-y-2.5 animate-pulse">
                    <div className="h-3 w-3/4 rounded bg-indigo-100" />
                    <div className="h-3 w-full rounded bg-slate-100" />
                    <div className="h-3 w-5/6 rounded bg-slate-100" />
                    <div className="h-3 w-2/3 rounded bg-slate-100" />
                </div>
            )}

            {!loading && error && (
                <div className="flex flex-col items-start gap-2 text-[13px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5 text-amber-600">
                        <AlertCircle size={14} /> Brifing alınamadı.
                    </span>
                    {/* Gerçek sebep (kota/limit/anahtar) — teşhis için. */}
                    <p className="max-w-full break-words rounded-md bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-700">
                        {error}
                    </p>
                    <button
                        onClick={onRetry}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                    >
                        <RefreshCw size={12} /> Tekrar dene
                    </button>
                </div>
            )}

            {!loading && !error && brief && (
                <div className="space-y-3.5">
                    {brief.why_now && (
                        <p className="text-[13px] leading-relaxed text-slate-700">
                            <span className="font-semibold text-indigo-700">Neden şimdi: </span>
                            {brief.why_now}
                        </p>
                    )}

                    {brief.opening_line && (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                                <Megaphone size={12} /> Açılış
                            </span>
                            <p className="text-[13px] italic leading-snug text-slate-700">“{brief.opening_line}”</p>
                        </div>
                    )}

                    {brief.talking_points.length > 0 && (
                        <div>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                                <MessageSquareQuote size={12} /> Konuşma noktaları
                            </span>
                            <ul className="space-y-1.5">
                                {brief.talking_points.map((p, i) => (
                                    <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-slate-700">
                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {brief.objections.length > 0 && (
                        <div>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                                <ShieldQuestion size={12} /> Olası itirazlar
                            </span>
                            <div className="space-y-2">
                                {brief.objections.map((o, i) => (
                                    <div key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                                        <p className="text-[12px] font-semibold text-slate-600">“{o.q}”</p>
                                        <p className="mt-0.5 text-[13px] leading-snug text-slate-700">{o.a}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {brief.goal && (
                        <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                            <Target size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                            <p className="text-[13px] leading-snug text-emerald-800">
                                <span className="font-semibold">Hedef: </span>{brief.goal}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
