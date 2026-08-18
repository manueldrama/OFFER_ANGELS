import React from 'react';
import {
    Phone, MessageCircle, Send, RefreshCw, Bell, CalendarClock, Pause, PackageCheck, Check, Zap, LucideIcon,
} from 'lucide-react';

const ACTION_ICON: Record<string, LucideIcon> = {
    'Bugün ara': Phone,
    'WhatsApp takibi gönder': MessageCircle,
    'Takip mesajı gönder': Send,
    'Teklifi yenile': RefreshCw,
    'Süre dolmadan hatırlat': Bell,
    'Satış görüşmesi planla': CalendarClock,
    'Beklemeye al': Pause,
    'Kurulum planla': PackageCheck,
    '—': Check,
};

interface NextActionChipProps {
    action: string;
    className?: string;
}

/** Türetilen "önerilen sonraki aksiyon" çipi — referans NextChip. */
export const NextActionChip: React.FC<NextActionChipProps> = ({ action, className }) => {
    const Icon = ACTION_ICON[action] || Zap;
    return (
        <span
            title={action}
            className={
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
                'border max-w-full truncate ' + (className || '')
            }
            style={{
                background: 'var(--color-brand-50)',
                color: 'var(--color-brand-700)',
                borderColor: 'var(--color-brand-100)',
            }}
        >
            <Icon size={12} className="shrink-0" />
            <span className="truncate">{action}</span>
        </span>
    );
};
