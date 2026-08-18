import React, { useRef, useState, useCallback } from 'react';
import { Users, Flame, Sun, RotateCcw, Target, Clock, Sparkles, AlertTriangle } from 'lucide-react';
import type { PoolStats } from '../../../services/admin/leadPoolService';

interface SegmentPillsProps {
    stats: PoolStats | null;
    activeFilter: string;
    onFilter: (status: string) => void;
}

const PILLS = [
    { key: 'all', label: 'Toplam', icon: Users, border: 'border-indigo-200', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', activeBg: 'bg-indigo-50' },
    { key: 'hot', label: 'Sıcak lead', icon: Flame, border: 'border-red-200', iconBg: 'bg-red-50', iconColor: 'text-red-500', activeBg: 'bg-red-50' },
    { key: 'warm', label: 'Warm lead', icon: Sun, border: 'border-orange-200', iconBg: 'bg-orange-50', iconColor: 'text-orange-500', activeBg: 'bg-orange-50' },
    { key: 'follow_up', label: 'Takip', icon: RotateCcw, border: 'border-cyan-200', iconBg: 'bg-cyan-50', iconColor: 'text-cyan-600', activeBg: 'bg-cyan-50' },
    { key: 'offer_sent', label: 'Yakın', icon: Target, border: 'border-amber-200', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', activeBg: 'bg-amber-50' },
    { key: 'new', label: 'Yeni', icon: Sparkles, border: 'border-blue-200', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', activeBg: 'bg-blue-50' },
    { key: 'contacted', label: 'İlk temas', icon: Clock, border: 'border-violet-200', iconBg: 'bg-violet-50', iconColor: 'text-violet-600', activeBg: 'bg-violet-50' },
    { key: 'risk', label: 'Risk', icon: AlertTriangle, border: 'border-rose-200', iconBg: 'bg-rose-50', iconColor: 'text-rose-500', activeBg: 'bg-rose-50' },
];

function getCount(stats: PoolStats | null, key: string): number {
    if (!stats) return 0;
    if (key === 'all') return stats.total;
    if (key === 'risk') return stats.riskCount;
    return stats.byStatus[key] || 0;
}

function getDescription(stats: PoolStats | null, key: string): string {
    if (!stats) return '';
    switch (key) {
        case 'all': return `Bu hafta +${stats.newThisWeek} yeni kayıt eklendi.`;
        case 'hot': return 'Satın alma niyeti yüksek, geri dönüş hız güçlü.';
        case 'warm': return 'İlk temas kurulmuş, doğru teklif ile hızla ısınabilecek.';
        case 'follow_up': return 'Takip sürecinde, düzenli iletişim gerekli.';
        case 'offer_sent': return 'Teklif paylaşıldı, son onay veya yönetici görüşmesi bekleniyor.';
        case 'new': return 'Bugün gelen ve henüz ilk araması yapılmamış leadler.';
        case 'contacted': return 'İlk temas yapıldı, takip bekleniyor.';
        case 'risk': return '24 saati geçen geri dönüş bekleyen kayıtlar. Kritik.';
        default: return '';
    }
}

export function SegmentPills({ stats, activeFilter, onFilter }: SegmentPillsProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragState = useRef({ startX: 0, scrollLeft: 0, moved: false });

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        const el = scrollRef.current;
        if (!el) return;
        setIsDragging(true);
        dragState.current = { startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false };
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = x - dragState.current.startX;
        if (Math.abs(walk) > 3) dragState.current.moved = true;
        scrollRef.current.scrollLeft = dragState.current.scrollLeft - walk;
    }, [isDragging]);

    const onMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    return (
        <div
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            className={`flex gap-3 overflow-x-auto pb-2 no-scrollbar select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
            {PILLS.map(pill => {
                const count = getCount(stats, pill.key);
                const isActive = activeFilter === pill.key || (activeFilter === 'all' && pill.key === 'all');
                const Icon = pill.icon;

                return (
                    <button
                        key={pill.key}
                        onClick={() => { if (!dragState.current.moved) onFilter(pill.key === 'all' ? 'all' : pill.key); }}
                        className={`flex-shrink-0 flex items-start gap-3 p-4 rounded-lg border transition-all cursor-pointer min-w-[160px] max-w-[200px] ${
                            isActive
                                ? `${pill.activeBg} ${pill.border} shadow-sm`
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                        }`}
                    >
                        <div className={`p-2 rounded-full ${pill.iconBg} shrink-0`}>
                            <Icon size={16} className={pill.iconColor} />
                        </div>
                        <div className="text-left min-w-0">
                            <p className="text-2xl font-bold text-slate-900 leading-none">{count}</p>
                            <p className="text-xs font-semibold text-slate-600 mt-1">{pill.label}</p>
                            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">{getDescription(stats, pill.key)}</p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
