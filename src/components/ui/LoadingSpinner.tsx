import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    message?: string;
    fullScreen?: boolean;
    className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    message,
    fullScreen = false,
    className = ''
}) => {
    const { t } = useTranslation('common');
    const displayMessage = message ?? t('common:loading');
    const containerClasses = fullScreen
        ? "fixed inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm z-50"
        : `flex flex-col items-center justify-center p-8 ${className}`;

    return (
        <div className={containerClasses}>
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            {displayMessage && <p className="mt-3 text-sm font-medium text-slate-600">{displayMessage}</p>}
        </div>
    );
};
