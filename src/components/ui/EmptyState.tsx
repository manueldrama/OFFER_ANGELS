import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action,
    className = ''
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-200 border-dashed rounded-lg ${className}`}>
            <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center mb-4 border border-slate-100">
                <Icon size={24} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                {description}
            </p>
            {action && (
                <div>{action}</div>
            )}
        </div>
    );
};
