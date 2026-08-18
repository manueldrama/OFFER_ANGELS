import React from 'react';
import { List, CalendarDays } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type OffersView = 'priority' | 'monthly';

interface OffersViewTabsProps {
    view: OffersView;
    onChange: (v: OffersView) => void;
}

const TABS: { key: OffersView; label: string; icon: typeof List }[] = [
    { key: 'priority', label: 'Öncelik Listesi', icon: List },
    { key: 'monthly', label: 'Aylık Görünüm', icon: CalendarDays },
];

/** Öncelik Listesi / Aylık Görünüm sekme geçişi. */
export const OffersViewTabs: React.FC<OffersViewTabsProps> = ({ view, onChange }) => (
    <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-[var(--shadow-card)]">
        {TABS.map((t) => {
            const on = view === t.key;
            return (
                <button
                    key={t.key}
                    onClick={() => onChange(t.key)}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition-colors',
                        on ? 'text-white' : 'text-slate-500 hover:text-slate-900',
                    )}
                    style={on ? { background: 'var(--color-brand-600)', boxShadow: 'var(--shadow-brand)' } : undefined}
                >
                    <t.icon size={14} />
                    {t.label}
                </button>
            );
        })}
    </div>
);
