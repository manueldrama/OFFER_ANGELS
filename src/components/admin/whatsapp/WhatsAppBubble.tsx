import React from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useWhatsAppBubble } from '../../../contexts/WhatsAppBubbleContext';

const HIDDEN_PATH = '/admin/whatsapp-chat';

export const WhatsAppBubble: React.FC = () => {
    const location = useLocation();
    const { totalUnread, isPanelOpen, openPanel } = useWhatsAppBubble();

    // WhatsApp Chat sayfasindaysak baloncuk gizlenir.
    if (location.pathname.startsWith(HIDDEN_PATH)) return null;
    // Panel acikken baloncuk gerek yok — panel'in kendi kapatma butonu var.
    if (isPanelOpen) return null;

    return (
        <button
            onClick={openPanel}
            aria-label="WhatsApp sohbetleri"
            className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#1ebd5b] text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
        >
            <MessageCircle size={26} strokeWidth={2.2} />
            {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
                    {totalUnread > 99 ? '99+' : totalUnread}
                </span>
            )}
        </button>
    );
};

export default WhatsAppBubble;
