import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, FileText, Headphones, ClipboardList } from 'lucide-react';
import { ViewType, OfferExperience } from '../../types';

interface DesktopNavProps {
    currentView: ViewType;
    setView: (v: ViewType) => void;
    offerId?: string;
    reservationsCount: number;
    savedOffersCount: number;
    experience: OfferExperience;
    inline?: boolean;
    dark?: boolean;
}

const DesktopNav = ({ currentView, setView, offerId, reservationsCount, savedOffersCount, experience, inline, dark }: DesktopNavProps) => {
    const { t, i18n } = useTranslation('offer');
    const isTR = (i18n.language?.split('-')[0] || 'tr') === 'tr';
    // Non-TR languages: prefer i18n key over offer_experience override.
    // experience.* defaults are TR strings (offerContext.ts seed), so the
    // `||` short-circuit would always show TR — even when admin has
    // translated models.deviceSelection / tabs.support to PL/IT/etc.
    const pickLabel = (override: string | null | undefined, key: string) =>
        isTR ? (override || t(key)) : t(key);

    const navItems = [
        { id: 'summary', label: pickLabel(experience.tab_models_label, 'offer:models.deviceSelection'), icon: LayoutGrid },
        { id: 'my-offers', label: t('offer:nav.myOffers'), icon: FileText },
        { id: 'reservations', label: t('offer:nav.reservations'), icon: ClipboardList },
        { id: 'support', label: pickLabel(experience.tab_support_label, 'offer:tabs.support'), icon: Headphones },
    ];

    const navButtons = dark ? (
        <div className="flex items-center gap-1.5 px-2 py-1.5">
            {navItems.map((item) => {
                if (item.id === 'my-offers' && savedOffersCount === 0) return null;
                if (item.id === 'reservations' && reservationsCount === 0) return null;
                const isActive = currentView === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id as ViewType)}
                        className="flex items-center gap-2 px-2 py-3 transition-all duration-300 group relative"
                        style={{
                            color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                        }}
                    >
                        <item.icon size={16} strokeWidth={isActive ? 2.5 : 2} className="transition-colors" />
                        <span className={`text-sm tracking-wide ${isActive ? 'font-semibold' : 'font-medium hover:text-white'} transition-colors`}>
                            {item.label}
                        </span>
                        {/* Underline */}
                        <div className={`absolute bottom-0 left-2 right-2 h-0.5 bg-primary transition-all duration-300 origin-center ${isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100'}`} />
                    </button>
                );
            })}
        </div>
    ) : (
        <div className="flex items-center gap-1.5 px-2 py-1.5">
            {navItems.map((item) => {
                if (item.id === 'my-offers' && savedOffersCount === 0) return null;
                if (item.id === 'reservations' && reservationsCount === 0) return null;
                const isActive = currentView === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id as ViewType)}
                        className={`flex items-center gap-2 px-2 py-2.5 transition-all duration-300 group relative ${isActive
                            ? 'text-slate-900'
                            : 'text-slate-500'
                            }`}
                    >
                        <item.icon
                            size={16}
                            strokeWidth={isActive ? 2.5 : 2}
                            className={`transition-colors duration-300 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}
                        />
                        <span className={`text-sm tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>
                            {item.label}
                        </span>
                        {/* Underline */}
                        <div className={`absolute bottom-0 left-2 right-2 h-0.5 bg-slate-900 transition-all duration-300 origin-center ${isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100'}`} />
                    </button>
                );
            })}
        </div>
    );

    if (inline) return navButtons;

    return (
        <div className="hidden md:block w-full bg-white border-b border-slate-200/50 sticky top-14 z-40">
            <div className="max-w-[1200px] mx-auto px-8 flex items-center justify-center py-2.5">
                {navButtons}
            </div>
        </div>
    );
};

export default DesktopNav;
