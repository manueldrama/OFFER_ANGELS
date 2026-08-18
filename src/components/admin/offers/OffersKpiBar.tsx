import React from 'react';
import { Layers, Flame, Sun, RotateCcw, Target, Sparkles, Snowflake, LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface OffersKpiBarProps {
    total: number;
    /** Komuta merkezi grup anahtarı → teklif linki sayıları (listedeki gerçek gruplar). */
    counts: Record<string, number>;
    /** Aktif sıcaklık filtresi anahtarı ('all' veya lead status). */
    active: string;
    onSelect: (key: string) => void;
    loading?: boolean;
}

interface Cell {
    /** Filtre/seçim anahtarı (lead status). */
    key: string;
    /** Sayım için komuta merkezi grup anahtarı (listedeki gerçek grup). */
    groupKey: string;
    label: string;
    help: string;
    icon: LucideIcon;
    /** index.css token taban adı. */
    color: 'new' | 'hot' | 'warm' | 'follow' | 'closing' | 'ice';
}

const CELLS: Cell[] = [
    { key: 'all', groupKey: 'all', label: 'Toplam Teklif', help: 'Tüm teklif linkleri', icon: Layers, color: 'new' },
    { key: 'hot', groupKey: 'hot', label: 'Sıcak Lead', help: 'Satışa en yakın', icon: Flame, color: 'hot' },
    { key: 'warm', groupKey: 'warm', label: 'Warm Lead', help: 'Isınmakta olan', icon: Sun, color: 'warm' },
    { key: 'follow_up', groupKey: 'followup', label: 'Takipte', help: 'Aksiyon bekliyor', icon: RotateCcw, color: 'follow' },
    { key: 'offer_sent', groupKey: 'closing', label: 'Kapanışa Yakın', help: 'İmza / ödeme aşaması', icon: Target, color: 'closing' },
    { key: 'new', groupKey: 'new', label: 'Yeni Lead', help: 'İlk temas bekliyor', icon: Sparkles, color: 'new' },
    { key: 'cold', groupKey: 'cold', label: 'Soğuk Lead', help: 'Düşük ilgi / soğumuş', icon: Snowflake, color: 'ice' },
];

/** Kompakt, tıklanabilir KPI bar — her hücre bir sıcaklık filtresine geçer. */
export const OffersKpiBar: React.FC<OffersKpiBarProps> = ({ total, counts, active, onSelect, loading }) => (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] sm:grid-cols-4 xl:grid-cols-7">
        {CELLS.map((c) => {
            const value = c.key === 'all' ? total : (counts[c.groupKey] || 0);
            const on = active === c.key;
            return (
                <button
                    key={c.key}
                    onClick={() => onSelect(on ? 'all' : c.key)}
                    className={cn(
                        'relative border-l border-t border-slate-100 px-4 py-3.5 text-left transition-colors',
                        on ? 'bg-brand-50' : 'hover:bg-[var(--color-slate-50)]',
                    )}
                >
                    {on && <span className="absolute inset-x-0 bottom-0 h-[2.5px]" style={{ background: 'var(--color-brand-600)' }} />}
                    <div className="mb-2 flex items-center gap-2">
                        <span
                            className="grid h-[26px] w-[26px] place-items-center rounded-lg"
                            style={{ background: `var(--color-${c.color}-bg)`, color: `var(--color-${c.color})` }}
                        >
                            <c.icon size={14} />
                        </span>
                        <span className="ml-auto h-[7px] w-[7px] rounded-full" style={{ background: `var(--color-${c.color})` }} />
                    </div>
                    {loading ? (
                        <span className="block h-7 w-12 animate-pulse rounded bg-slate-100" />
                    ) : (
                        <div className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-slate-900">{value}</div>
                    )}
                    <div className="mt-1 text-[12px] font-semibold text-slate-700">{c.label}</div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400">{c.help}</div>
                </button>
            );
        })}
    </div>
);
