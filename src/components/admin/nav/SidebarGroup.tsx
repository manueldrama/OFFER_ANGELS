import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { NavGroup } from './navConfig';

type Props = {
    group: NavGroup;
    isOpen: boolean;
    /** Aktif rota bu gruptaysa: kapalıyken bile başlıkta iz bırakır. */
    isActiveGroup: boolean;
    /** Arama sırasında katlama kilitlenir; başlık toggle edilemez. */
    locked: boolean;
    /** Grup KAPALIYKEN içeride bekleyen iş varsa başlıkta nokta olarak görünür. */
    badgeTone: 'danger' | 'info' | null;
    onToggle: () => void;
    children: React.ReactNode;
};

export function SidebarGroup({ group, isOpen, isActiveGroup, locked, badgeTone, onToggle, children }: Props) {
    const reduceMotion = useReducedMotion();
    const bodyId = `nav-group-${group.key}`;

    // Başlıksız kök grup (Kontrol Paneli / Canlı İzleme) katlanmaz: paneldeki
    // her koşulda görünen çapa. Katlanırsa "ana sayfaya nasıl dönerim" sorusu doğar.
    if (group.label === null) {
        return <div className="space-y-1.5">{children}</div>;
    }

    const Icon = group.icon;

    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                disabled={locked}
                aria-expanded={isOpen}
                aria-controls={bodyId}
                title={group.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-100 ${
                    locked ? 'cursor-default' : 'cursor-pointer'
                } ${
                    isOpen
                        ? 'bg-slate-50 border-slate-200'
                        : isActiveGroup
                          ? 'bg-white border-slate-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
            >
                <Icon
                    size={17}
                    className={`shrink-0 ${isOpen || isActiveGroup ? 'text-slate-700' : 'text-slate-400'}`}
                />
                <span
                    className={`flex-1 min-w-0 text-left text-[11px] font-semibold uppercase tracking-[0.6px] truncate ${
                        isOpen || isActiveGroup ? 'text-slate-800' : 'text-slate-500'
                    }`}
                >
                    {group.label}
                </span>

                {/* Kapalı grubun içindeki bekleyen iş: satır rozetleri o an gizli
                    olduğu için bunu gösteren tek sinyal budur. */}
                {!isOpen && badgeTone && (
                    <span
                        className={`shrink-0 w-[6px] h-[6px] rounded-full ${
                            badgeTone === 'danger' ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                    />
                )}
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold tabular-nums">
                    {group.items.length}
                </span>
                <ChevronRight
                    size={14}
                    className={`shrink-0 text-slate-300 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                />
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        id={bodyId}
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        {/* Sol dikey çizgi: açık grubun kapsamını gözle takip ettirir. */}
                        <div className="mt-1 ml-[22px] pl-2.5 border-l border-slate-200 space-y-px">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
