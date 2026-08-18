import React from 'react';
import { Clock, Search, CheckCircle2, XCircle, Wrench } from 'lucide-react';

interface SupportStatusBadgeProps {
    status: string;
    isPhysicalService: boolean;
    createdAt?: string;
}

const SUPPORT_STATUSES: Record<string, { label: string; desc: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
    new: {
        label: 'Yeni Talep',
        desc: 'Ekibimiz talebinizi en kısa sürede inceleyecek.',
        icon: Clock,
        color: 'text-sky-700',
        bg: 'bg-sky-50',
        border: 'border-sky-100'
    },
    triaged: {
        label: 'İnceleniyor',
        desc: 'Teknik ekibimiz talebinizi değerlendiriyor.',
        icon: Search,
        color: 'text-indigo-700',
        bg: 'bg-indigo-50',
        border: 'border-indigo-100'
    },
    resolved: {
        label: 'Çözüldü',
        desc: 'Talebiniz başarıyla çözümlendi.',
        icon: CheckCircle2,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-100'
    },
    closed: {
        label: 'Kapatıldı',
        desc: 'Bu talep kapatılmıştır.',
        icon: XCircle,
        color: 'text-slate-500',
        bg: 'bg-slate-50',
        border: 'border-slate-200'
    }
};

const PHYSICAL_SERVICE_STATUS = {
    label: 'Fiziksel Servis',
    desc: 'Cihazınız teknik servis sürecinde.',
    icon: Wrench,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-100'
};

export default function SupportStatusBadge({ status, isPhysicalService }: SupportStatusBadgeProps) {
    const info = isPhysicalService ? PHYSICAL_SERVICE_STATUS : (SUPPORT_STATUSES[status] || SUPPORT_STATUSES.new);
    const Icon = info.icon;

    return (
        <div className={`flex items-center gap-3 p-3.5 rounded-lg border ${info.bg} ${info.border}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${info.bg} ${info.color}`}>
                <Icon size={18} />
            </div>
            <div>
                <span className={`text-xs font-semibold ${info.color}`}>{info.label}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">{info.desc}</p>
            </div>
        </div>
    );
}
