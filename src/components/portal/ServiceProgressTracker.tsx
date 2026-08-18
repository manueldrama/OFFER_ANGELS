import React from 'react';
import { Truck, Package, Wrench, CheckCircle2, Box } from 'lucide-react';

interface ServiceProgressTrackerProps {
    status: string;
    shippingStatus?: string;
    shippingProvider?: string;
    trackingNumber?: string;
}

interface Step {
    id: string;
    label: string;
    icon: React.ReactNode;
    state: 'completed' | 'active' | 'pending';
}

export default function ServiceProgressTracker({ status, shippingStatus, shippingProvider, trackingNumber }: ServiceProgressTrackerProps) {
    const statusOrder = ['shipped_to_center', 'triaged', 'in_progress', 'testing', 'shipped_to_customer'];
    const currentIndex = statusOrder.indexOf(status);
    const isResolved = status === 'resolved' || status === 'closed';

    const getState = (stepIndex: number): 'completed' | 'active' | 'pending' => {
        if (isResolved) return 'completed';
        if (currentIndex < 0) return stepIndex === 0 ? 'active' : 'pending';
        if (stepIndex < currentIndex) return 'completed';
        if (stepIndex === currentIndex) return 'active';
        return 'pending';
    };

    const steps: Step[] = [
        { id: 'shipped', label: 'Kargoya Verildi', icon: <Truck size={16} />, state: getState(0) },
        { id: 'received', label: 'Teslim Alındı', icon: <Package size={16} />, state: getState(1) },
        { id: 'repair', label: 'Onarımda', icon: <Wrench size={16} />, state: getState(2) },
        { id: 'testing', label: 'Test', icon: <CheckCircle2 size={16} />, state: getState(3) },
        { id: 'delivered', label: 'Gönderildi', icon: <Box size={16} />, state: getState(4) },
    ];

    return (
        <div className="space-y-4">
            {/* Stepper */}
            <div className="flex items-center justify-between gap-1">
                {steps.map((step, idx) => (
                    <React.Fragment key={step.id}>
                        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                                step.state === 'completed'
                                    ? 'bg-slate-900 text-white'
                                    : step.state === 'active'
                                        ? 'bg-white text-slate-900 border-2 border-slate-900'
                                        : 'bg-slate-100 text-slate-300'
                            }`}>
                                {step.state === 'completed' ? <CheckCircle2 size={18} /> : step.icon}
                            </div>
                            <span className={`text-[9px] font-semibold text-center leading-tight ${
                                step.state !== 'pending' ? 'text-slate-700' : 'text-slate-400'
                            }`}>
                                {step.label}
                            </span>
                        </div>
                        {idx < steps.length - 1 && (
                            <div className="w-full max-w-[40px] h-0.5 bg-slate-100 mb-5 shrink-0">
                                <div className={`h-full bg-slate-900 transition-all duration-500 ${
                                    step.state === 'completed' ? 'w-full' : 'w-0'
                                }`} />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Shipping Info */}
            {(shippingProvider || trackingNumber) && (
                <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                    <Truck size={13} className="text-slate-400 shrink-0" />
                    <span>
                        {shippingProvider && <span className="font-medium text-slate-700">{shippingProvider}</span>}
                        {shippingProvider && trackingNumber && ' · '}
                        {trackingNumber && <span className="font-mono">{trackingNumber}</span>}
                    </span>
                </div>
            )}
        </div>
    );
}
