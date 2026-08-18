import React, { useRef, useState, useCallback } from 'react';
import { Users, Flame, Sun, RotateCcw, Target, Clock, Sparkles, LucideIcon } from 'lucide-react';

interface OffersSegmentCardsProps {
    /** Toplam teklif linki sayısı. */
    total: number;
    /** Lead durumuna göre teklif linki sayıları. */
    counts: Record<string, number>;
    /** Aktif filtre anahtarı — yalnız interactive iken kullanılır. */
    active?: string;
    onSelect?: (key: string) => void;
    loading?: boolean;
    /** false ise kartlar gösterim amaçlıdır — tıklanmaz, aktif vurgu yapılmaz. */
    interactive?: boolean;
    /** Şeridin üstünde küçük başlık (AI sıralaması için). */
    heading?: { icon?: LucideIcon; label: string; hint?: string };
}

const PILLS = [
    { key: 'all', label: 'Toplam', icon: Users, border: 'border-indigo-200', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', activeBg: 'bg-indigo-50' },
    { key: 'hot', label: 'Sıcak lead', icon: Flame, border: 'border-red-200', iconBg: 'bg-red-50', iconColor: 'text-red-500', activeBg: 'bg-red-50' },
    { key: 'warm', label: 'Warm lead', icon: Sun, border: 'border-orange-200', iconBg: 'bg-orange-50', iconColor: 'text-orange-500', activeBg: 'bg-orange-50' },
    { key: 'follow_up', label: 'Takip', icon: RotateCcw, border: 'border-cyan-200', iconBg: 'bg-cyan-50', iconColor: 'text-cyan-600', activeBg: 'bg-cyan-50' },
    { key: 'offer_sent', label: 'Yakın', icon: Target, border: 'border-amber-200', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', activeBg: 'bg-amber-50' },
    { key: 'new', label: 'Yeni', icon: Sparkles, border: 'border-blue-200', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', activeBg: 'bg-blue-50' },
    { key: 'contacted', label: 'İlk temas', icon: Clock, border: 'border-violet-200', iconBg: 'bg-violet-50', iconColor: 'text-violet-600', activeBg: 'bg-violet-50' },
] as const;

const DESCRIPTIONS: Record<string, string> = {
    all: 'Tüm teklif linkleri.',
    hot: 'Satın alma niyeti yüksek müşterilerin linkleri.',
    warm: 'İlk temas kurulmuş, doğru teklif ile hızla ısınabilecek.',
    follow_up: 'Takip sürecinde, düzenli iletişim gerekli.',
    offer_sent: 'Teklif paylaşıldı, son onay veya yönetici görüşmesi bekleniyor.',
    new: 'Bugün gelen ve henüz ilk araması yapılmamış müşteriler.',
    contacted: 'İlk temas yapıldı, takip bekleniyor.',
};

/**
 * Teklif Linkleri üst filtre kartları — Müşteri Yönetimi'ndeki SegmentPills ile
 * aynı görsel dil. Her kart bir lead durumu (sıcaklık); tıklanınca o filtreye geçer.
 */
export const OffersSegmentCards: React.FC<OffersSegmentCardsProps> = ({
    total, counts, active = 'all', onSelect, loading, interactive = true, heading,
}) => {
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

    const onMouseUp = useCallback(() => setIsDragging(false), []);

    const getCount = (key: string): number => key === 'all' ? total : (counts[key] || 0);
    const HeadingIcon = heading?.icon;

    return (
        <div>
            {heading && (
                <div className="flex items-center gap-1.5 mb-2 px-1">
                    {HeadingIcon && <HeadingIcon size={14} className="text-orange-500" />}
                    <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{heading.label}</h2>
                    {heading.hint && <span className="text-[10px] text-slate-400 ml-1">{heading.hint}</span>}
                </div>
            )}
            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                className={`flex gap-3 overflow-x-auto pb-2 no-scrollbar select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
                {PILLS.map(pill => {
                    const count = getCount(pill.key);
                    const isActive = interactive && active === pill.key;
                    const Icon = pill.icon;
                    const Tag: any = interactive ? 'button' : 'div';

                    return (
                        <Tag
                            key={pill.key}
                            onClick={interactive
                                ? () => { if (!dragState.current.moved) onSelect?.(pill.key); }
                                : undefined}
                            className={`flex-shrink-0 flex items-start gap-3 p-4 rounded-lg border transition-all min-w-[170px] max-w-[210px] ${
                                isActive
                                    ? `${pill.activeBg} ${pill.border} shadow-sm`
                                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                            } ${interactive ? 'cursor-pointer' : ''}`}
                        >
                            <div className={`p-2 rounded-full ${pill.iconBg} shrink-0`}>
                                <Icon size={16} className={pill.iconColor} />
                            </div>
                            <div className="text-left min-w-0">
                                {loading ? (
                                    <span className="block h-7 w-12 rounded bg-slate-100 animate-pulse" />
                                ) : (
                                    <p className="text-2xl font-bold text-slate-900 leading-none">{count}</p>
                                )}
                                <p className="text-xs font-semibold text-slate-600 mt-1">{pill.label}</p>
                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">{DESCRIPTIONS[pill.key]}</p>
                            </div>
                        </Tag>
                    );
                })}
            </div>
        </div>
    );
};
