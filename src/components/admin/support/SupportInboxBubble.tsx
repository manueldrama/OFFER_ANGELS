import React from 'react';
import { useLocation } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import { useSupportInbox } from '../../../contexts/SupportInboxContext';

const HIDDEN_PATHS = ['/admin/sales-support', '/admin/service/requests'];

export const SupportInboxBubble: React.FC = () => {
    const location = useLocation();
    const { unreadCount, isPanelOpen, openPanel } = useSupportInbox();

    if (HIDDEN_PATHS.some(p => location.pathname.startsWith(p))) return null;
    if (isPanelOpen) return null;

    return (
        <button
            onClick={openPanel}
            aria-label="Destek talepleri"
            className="fixed z-40 flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95
                       bottom-6 right-24 lg:right-24
                       max-[640px]:bottom-24 max-[640px]:right-4"
        >
            <LifeBuoy size={26} strokeWidth={2.2} />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </button>
    );
};

export default SupportInboxBubble;
