import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Semantik durum rozeti — admin panelindeki tüm "Aktif / İptal / Süre" gibi
 * statü göstergeleri için tek tip. Ad-hoc renkli span'ların yerini alır.
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const toneSurface: Record<StatusTone, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const toneDot: Record<StatusTone, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    neutral: 'bg-slate-400',
    info: 'bg-indigo-500',
};

interface StatusBadgeProps {
    tone?: StatusTone;
    children: React.ReactNode;
    /** Sol tarafa küçük renkli nokta ekler. */
    dot?: boolean;
    /** Sol tarafa lucide ikon ekler (dot ile birlikte kullanılmaz). */
    icon?: LucideIcon;
    size?: 'sm' | 'md';
    className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    tone = 'neutral',
    children,
    dot = false,
    icon: Icon,
    size = 'md',
    className,
}) => {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap',
                size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
                toneSurface[tone],
                className,
            )}
        >
            {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', toneDot[tone])} />}
            {Icon && <Icon size={size === 'sm' ? 11 : 12} className="shrink-0" />}
            {children}
        </span>
    );
};
