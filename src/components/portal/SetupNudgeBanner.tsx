import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Monitor, ArrowRight } from 'lucide-react';
import { usePortal } from '../../contexts/PortalContext';

export default function SetupNudgeBanner() {
    const { slug } = useParams<{ slug: string }>();
    const { hasDevices } = usePortal();

    if (hasDevices) return null;

    return (
        <Link
            to={`/portal/${slug}/training`}
            className="flex items-center gap-3 bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3 hover:border-amber-300 transition-all group"
        >
            <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                <Monitor size={15} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800">Kurulumunuzu tamamlayın</p>
                <p className="text-[10px] text-amber-600/80">Cihaz kaydı ve kurulum adımları bekleniyor</p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 shrink-0 group-hover:gap-2 transition-all">
                Kuruluma Git <ArrowRight size={12} />
            </div>
        </Link>
    );
}
