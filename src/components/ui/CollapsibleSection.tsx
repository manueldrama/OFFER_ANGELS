import React, { useState } from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CollapsibleSectionProps {
    title: string;
    icon: LucideIcon;
    defaultOpen?: boolean;
    badge?: string;
    children: React.ReactNode;
}

export default function CollapsibleSection({ title, icon: Icon, defaultOpen = true, badge, children }: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-slate-100 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/60 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-semibold text-slate-700">{title}</span>
                    {badge && (
                        <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">{badge}</span>
                    )}
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                </motion.div>
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 space-y-3">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
