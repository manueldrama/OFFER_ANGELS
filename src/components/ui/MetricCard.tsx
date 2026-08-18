import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Yeniden kullanılabilir KPI kartı — ikon, başlık, değer, opsiyonel trend pill
 * ve factual alt etiket. Görsel dil: KpiWidget standart kartı.
 * Sahte/sabit açıklama metni TAŞIMAZ — sublabel yalnızca doğru hesaplanabiliyorsa verilir.
 */
export type MetricTone = 'default' | 'success' | 'warning' | 'danger';

const toneStyles: Record<MetricTone, { iconBg: string; iconColor: string }> = {
    default: { iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
    success: { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    warning: { iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
    danger: { iconBg: 'bg-red-50', iconColor: 'text-red-600' },
};

interface MetricCardProps {
    icon: LucideIcon;
    title: string;
    value: React.ReactNode;
    tone?: MetricTone;
    /** Sağ üstte yeşil/kırmızı yüzde pill. */
    trend?: { value: string; up: boolean };
    /** Değerin altında küçük, gerçek veriden gelen bağlam satırı. */
    sublabel?: string;
    onClick?: () => void;
    loading?: boolean;
    className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    icon: Icon,
    title,
    value,
    tone = 'default',
    trend,
    sublabel,
    onClick,
    loading = false,
    className,
}) => {
    const t = toneStyles[tone];
    const TrendIcon = trend?.up ? ArrowUpRight : ArrowDownRight;
    const interactive = !!onClick;

    return (
        <div
            onClick={onClick}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
            className={cn(
                'bg-white rounded-lg p-5 border border-slate-200 flex flex-col transition-colors',
                interactive && 'cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
                className,
            )}
        >
            <div className="flex items-start justify-between mb-4">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', t.iconBg)}>
                    <Icon size={18} className={t.iconColor} />
                </div>
                {trend && (
                    <div className={cn(
                        'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
                        trend.up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
                    )}>
                        <TrendIcon size={12} />
                        {trend.value}
                    </div>
                )}
            </div>
            <div className="flex flex-col gap-1">
                {loading ? (
                    <span className="h-8 w-16 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <span className="text-[26px] font-bold text-slate-900 leading-tight">{value}</span>
                )}
                <span className="text-[13px] font-medium text-slate-500">{title}</span>
            </div>
            {sublabel && !loading && (
                <span className="text-xs font-medium text-slate-400 mt-1.5">{sublabel}</span>
            )}
        </div>
    );
};
