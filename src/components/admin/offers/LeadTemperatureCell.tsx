import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, leadStatusColor } from '../../../lib/leadStatus';

interface LeadTemperatureCellProps {
    leadId: string;
    aiState?: { score: number | null; reasoning: string | null } | null;
    status?: string | null;
    /** Bu lead şu an yeniden skorlanıyor mu. */
    scoring: boolean;
    onRescore: (leadId: string) => void;
    onStatusChange: (leadId: string, status: string) => void;
}

/** AI skorundan sıcaklık sınıfı (PriorityLeadTable ile aynı eşikler). */
function aiTone(score: number | null | undefined): { cls: string; word: string } {
    if (score == null) return { cls: 'bg-slate-50 text-slate-500 border-slate-200', word: 'Skor yok' };
    if (score >= 80) return { cls: 'bg-rose-50 text-rose-700 border-rose-200', word: 'Sıcak' };
    if (score >= 40) return { cls: 'bg-amber-50 text-amber-700 border-amber-200', word: 'Ilık' };
    return { cls: 'bg-teal-50 text-teal-700 border-teal-200', word: 'Soğuk' };
}

/**
 * Lead sıcaklık hücresi — AI değerlendirmesi ÜSTTE, ekibin elle koyduğu
 * sınıflandırma ALTTA. Manuel durum buradan kontrol edilebilir.
 */
export const LeadTemperatureCell: React.FC<LeadTemperatureCellProps> = ({
    leadId, aiState, status, scoring, onRescore, onStatusChange,
}) => {
    const score = typeof aiState?.score === 'number' ? aiState.score : null;
    const ai = aiTone(score);

    return (
        <div className="flex flex-col gap-1.5">
            {/* AI satırı */}
            <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider w-8 shrink-0">AI</span>
                <span
                    title={aiState?.reasoning || undefined}
                    className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border',
                        ai.cls,
                        aiState?.reasoning && 'cursor-help',
                    )}
                >
                    {score != null ? `${score} · ${ai.word}` : ai.word}
                </span>
                <button
                    onClick={() => onRescore(leadId)}
                    disabled={scoring}
                    title="AI skorunu yeniden hesapla"
                    className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
                >
                    {scoring
                        ? <RefreshCw size={12} className="animate-spin" />
                        : <Sparkles size={12} />}
                </button>
            </div>

            {/* Manuel durum satırı */}
            <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider w-8 shrink-0">Siz</span>
                <select
                    value={status || 'new'}
                    onChange={(e) => onStatusChange(leadId, e.target.value)}
                    className={cn(
                        'text-[11px] font-semibold pl-2 pr-1 py-1 rounded-md border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
                        leadStatusColor(status),
                    )}
                >
                    {LEAD_STATUS_ORDER.map(val => (
                        <option key={val} value={val}>{LEAD_STATUS_LABELS[val]}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};
