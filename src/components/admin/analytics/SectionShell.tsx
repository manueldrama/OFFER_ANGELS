import React from 'react';
import { TrendingUp, LucideIcon, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface SectionShellProps {
    title: string;
    icon?: LucideIcon;
    description?: string;
    action?: React.ReactNode;
    loading?: boolean;
    empty?: boolean;
    emptyText?: string;
    children: React.ReactNode;
    className?: string;
    pad?: boolean;
}

export const SectionShell: React.FC<SectionShellProps> = ({
    title, icon: Icon = TrendingUp, description, action, loading, empty, emptyText = 'Bu zaman aralığı için veri yok.',
    children, className = '', pad = true,
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`}
        >
            <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-100">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Icon size={14} className="text-slate-400" />
                        {title}
                    </h2>
                    {description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Info size={11} className="text-slate-400" />
                            {description}
                        </p>
                    )}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            <div className={pad ? 'p-5' : ''}>
                {loading ? (
                    <div className="py-10 flex items-center justify-center">
                        <div className="h-6 w-6 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
                    </div>
                ) : empty ? (
                    <div className="py-12 text-center text-sm text-slate-400">{emptyText}</div>
                ) : (
                    children
                )}
            </div>
        </motion.div>
    );
};
