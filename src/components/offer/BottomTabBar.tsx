import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, ShoppingBag, FileText, CreditCard, Headset, Box, Settings2, PlayCircle, MonitorSmartphone, ClipboardList, Scale, HelpCircle } from 'lucide-react';
import { ViewType, OfferExperience } from '../../types';

interface BottomTabBarProps {
    currentView: ViewType;
    setView: (v: ViewType) => void;
    hasSelectedProduct: boolean;
    onClearSelection: () => void;
    configActiveTab: string;
    setConfigActiveTab: (tab: string) => void;
    savedOffersCount: number;
    reservationsCount: number;
    experience: OfferExperience;
    onCompare?: () => void;
    onHelp?: () => void;
    compareLabel?: string;
    helpLabel?: string;
}

const TabButton = ({
    isActive,
    onClick,
    icon: Icon,
    label,
}: {
    isActive: boolean;
    onClick: () => void;
    icon: React.ElementType;
    label: string;
}) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 ${
            isActive ? 'text-primary' : 'text-slate-400 active:text-slate-500'
        }`}
    >
        <Icon
            size={20}
            strokeWidth={isActive ? 2.2 : 1.6}
            className={`transition-all duration-200 ${isActive ? 'fill-primary/20' : ''}`}
        />
        <span className={`text-[10px] text-center leading-none transition-all duration-200 ${
            isActive ? 'font-semibold' : 'font-normal text-slate-400'
        }`}>
            {label}
        </span>
        {isActive && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
        )}
    </button>
);

const BottomTabBar = ({
    currentView,
    setView,
    hasSelectedProduct,
    onClearSelection,
    configActiveTab,
    setConfigActiveTab,
    savedOffersCount,
    reservationsCount,
    experience,
    onCompare,
    onHelp,
    compareLabel,
    helpLabel,
}: BottomTabBarProps) => {
    const { t, i18n } = useTranslation('offer');
    const isTR = (i18n.language?.split('-')[0] || 'tr') === 'tr';
    // For non-TR languages, prefer i18n over the offer_experience override
    // (otherwise the override's TR text wins via `||` short-circuit)
    const pickLabel = (override: string | null | undefined, key: string) =>
        isTR ? (override || t(key)) : t(key);

    const navItems = [
        { id: 'summary', label: pickLabel(experience.tab_models_label, 'offer:models.deviceSelection'), icon: LayoutGrid, alwaysVisible: true },
        { id: 'my-offers', label: t('offer:nav.myOffers'), icon: FileText, alwaysVisible: true },
        { id: 'reservations', label: t('offer:nav.reservations'), icon: ClipboardList, alwaysVisible: true },
        { id: 'payment', label: t('offer:nav.reservation'), icon: CreditCard, alwaysVisible: false },
    ];

    const barClass = "md:hidden fixed bottom-3 left-3 right-3 bg-white/90 backdrop-blur-2xl rounded-2xl pb-safe z-[100] h-[60px] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)]";

    if (currentView === 'config') {
        return (
            <nav className={barClass}>
                <div className="flex items-center h-full px-2 relative">
                    {[
                        { id: 'Genel Bakış', label: t('offer:tabs.general'), icon: Box },
                        { id: 'Teknik Özellikler', label: t('offer:tabs.technical'), icon: Settings2 },
                        { id: 'Video Galeri', label: t('offer:tabs.gallery'), icon: PlayCircle }
                    ].map((tab) => (
                        <TabButton
                            key={tab.id}
                            isActive={configActiveTab === tab.id}
                            onClick={() => setConfigActiveTab(tab.id)}
                            icon={tab.icon}
                            label={tab.label}
                        />
                    ))}
                    <TabButton
                        isActive={false}
                        onClick={() => setView('support')}
                        icon={Headset}
                        label={pickLabel(experience.tab_support_label, 'offer:tabs.support')}
                    />
                </div>
            </nav>
        );
    }

    return (
        <nav className={barClass}>
            <div className="flex items-center h-full px-2 relative">
                {navItems.map((item) => {
                    if (!item.alwaysVisible && !hasSelectedProduct) return null;
                    if (item.id === 'summary' && currentView === 'summary') return null;
                    if (item.id === 'payment' && currentView !== 'payment') return null;
                    if (item.id === 'my-offers' && savedOffersCount === 0) return null;
                    if (item.id === 'reservations' && reservationsCount === 0) return null;

                    return (
                        <TabButton
                            key={item.id}
                            isActive={currentView === item.id}
                            onClick={() => {
                                if (item.id === 'summary') onClearSelection();
                                setView(item.id as ViewType);
                            }}
                            icon={item.icon}
                            label={item.label}
                        />
                    );
                })}
                {currentView === 'summary' && onCompare && (
                    <TabButton
                        isActive={false}
                        onClick={onCompare}
                        icon={Scale}
                        label={compareLabel || t('offer:models.compareButton')}
                    />
                )}
                {currentView === 'summary' && onHelp && (
                    <TabButton
                        isActive={false}
                        onClick={onHelp}
                        icon={HelpCircle}
                        label={helpLabel || t('offer:wizard.help')}
                    />
                )}
                {/* Destek — always last */}
                <TabButton
                    isActive={currentView === 'support'}
                    onClick={() => setView('support' as ViewType)}
                    icon={Headset}
                    label={pickLabel(experience.tab_support_label, 'offer:tabs.support')}
                />
            </div>
        </nav>
    );
};

export default BottomTabBar;
