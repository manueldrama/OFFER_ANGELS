import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextData {
    addToast: (toast: Omit<ToastMessage, 'id'>) => void;
    removeToast: (id: string) => void;
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextData | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { ...toast, id }]);

        if (toast.duration !== 0) {
            setTimeout(() => {
                removeToast(id);
            }, toast.duration || 3500);
        }
    }, [removeToast]);

    const success = useCallback((title: string, message?: string) => addToast({ type: 'success', title, message }), [addToast]);
    const error = useCallback((title: string, message?: string) => addToast({ type: 'error', title, message, duration: 4500 }), [addToast]);
    const warning = useCallback((title: string, message?: string) => addToast({ type: 'warning', title, message, duration: 4000 }), [addToast]);
    const info = useCallback((title: string, message?: string) => addToast({ type: 'info', title, message }), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
            {children}
            <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col-reverse gap-3 pointer-events-none w-[calc(100%-2rem)] max-w-sm">
                <AnimatePresence mode="popLayout">
                    {toasts.map((toast) => (
                        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: () => void }> = ({ toast, onRemove }) => {
    const [progress, setProgress] = useState(100);
    const duration = toast.duration || 3500;

    useEffect(() => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);
            if (remaining <= 0) clearInterval(interval);
        }, 30);
        return () => clearInterval(interval);
    }, [duration]);

    const config = {
        success: {
            icon: <CheckCircle size={22} />,
            iconBg: 'bg-emerald-500',
            progressColor: 'bg-emerald-400',
            border: 'border-emerald-100',
        },
        error: {
            icon: <XCircle size={22} />,
            iconBg: 'bg-red-500',
            progressColor: 'bg-red-400',
            border: 'border-red-100',
        },
        warning: {
            icon: <AlertTriangle size={22} />,
            iconBg: 'bg-amber-500',
            progressColor: 'bg-amber-400',
            border: 'border-amber-100',
        },
        info: {
            icon: <Info size={22} />,
            iconBg: 'bg-blue-500',
            progressColor: 'bg-blue-400',
            border: 'border-blue-100',
        },
    }[toast.type];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`pointer-events-auto relative overflow-hidden rounded-lg bg-white shadow-lg border ${config.border}`}
        >
            <div className="flex items-start gap-3 p-4">
                <div className={`shrink-0 w-9 h-9 rounded-lg ${config.iconBg} text-white flex items-center justify-center shadow-sm`}>
                    {config.icon}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{toast.title}</p>
                    {toast.message && <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{toast.message}</p>}
                </div>
                <button
                    onClick={onRemove}
                    className="shrink-0 w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>
            {/* Progress bar */}
            <div className="h-[3px] bg-slate-100 w-full">
                <motion.div
                    className={`h-full ${config.progressColor}`}
                    initial={{ width: '100%' }}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </motion.div>
    );
};
