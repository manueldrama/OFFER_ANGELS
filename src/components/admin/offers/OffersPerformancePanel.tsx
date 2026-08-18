import React, { useRef, useState, useCallback } from 'react';
import { Flame } from 'lucide-react';
import type { OfferLinkGlobalStats, OfferLinkHotLead } from '../../../services/admin/offerLinksService';

interface OffersPerformancePanelProps {
    stats: OfferLinkGlobalStats | null;
    loading: boolean;
}

function scoreTint(score: number | null): { iconBg: string; iconColor: string; border: string } {
    if (score == null) return { iconBg: 'bg-slate-50', iconColor: 'text-slate-500', border: 'border-slate-200' };
    if (score >= 80) return { iconBg: 'bg-red-50', iconColor: 'text-red-500', border: 'border-red-200' };
    if (score >= 50) return { iconBg: 'bg-orange-50', iconColor: 'text-orange-500', border: 'border-orange-200' };
    return { iconBg: 'bg-slate-50', iconColor: 'text-slate-500', border: 'border-slate-200' };
}

/**
 * AI sıcaklık sıralaması — segment kartlarına eş, yatay drag-scroll kart şeridi.
 * AI'nin en sıcak gördüğü müşteriler; her kart skor + isim + AI önerisi.
 */
export const OffersPerformancePanel: React.FC<OffersPerformancePanelProps> = ({ stats, loading }) => {
    const hotLeads: OfferLinkHotLead[] = stats?.hotLeads ?? [];

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

    return (
        <div>
            <div className="flex items-center gap-1.5 mb-2 px-1">
                <Flame size={14} className="text-orange-500" />
                <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    AI sıcaklık sıralaması
                </h2>
                <span className="text-[10px] text-slate-400 ml-1">Skorlama Puan Ağırlıkları'ndan hesaplanır</span>
            </div>

            {loading ? (
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                    {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="flex-shrink-0 h-24 w-[220px] rounded-lg bg-slate-50 animate-pulse" />
                    ))}
                </div>
            ) : hotLeads.length === 0 ? (
                <div className="rounded-lg border border-slate-200 border-dashed bg-white p-6 text-center">
                    <p className="text-xs text-slate-400">Henüz AI skoru hesaplanmış müşteri yok.</p>
                </div>
            ) : (
                <div
                    ref={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    className={`flex gap-3 overflow-x-auto pb-2 no-scrollbar select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                    {hotLeads.map(lead => {
                        const tint = scoreTint(lead.score);
                        return (
                            <div
                                key={lead.leadId}
                                className={`flex-shrink-0 flex items-start gap-3 p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow min-w-[220px] max-w-[260px] ${tint.border}`}
                            >
                                <div className={`p-2 rounded-full shrink-0 ${tint.iconBg}`}>
                                    <Flame size={16} className={tint.iconColor} />
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="text-2xl font-bold text-slate-900 leading-none">{lead.score}</p>
                                    <p className="text-xs font-semibold text-slate-600 mt-1 truncate" title={lead.customer}>
                                        {lead.customer}
                                    </p>
                                    <p
                                        className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight"
                                        title={lead.scoreReason || undefined}
                                    >
                                        {lead.scoreReason || `AI skoru: ${lead.score}`}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
