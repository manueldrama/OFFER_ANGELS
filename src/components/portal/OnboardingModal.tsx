import React, { useState } from 'react';
import { ChevronRight, CheckCircle2, Monitor, Settings, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerName: string;
}

export default function OnboardingModal({ isOpen, onClose, customerName }: OnboardingModalProps) {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: `Hoş Geldin, ${customerName}!`,
            description: 'CAFEPASTE servis portalına hoş geldiniz. Cihazınızı kaydedin, kurulumu tamamlayın ve tüm hizmetlerimizden yararlanmaya başlayın.',
            icon: <Monitor size={40} className="text-white" />,
            bgColor: 'bg-slate-900'
        },
        {
            title: 'Cihazınızı Kaydedin',
            description: 'İlk adım olarak cihazınızı sisteme ekleyin. Bu sayede garanti takibi, servis geçmişi ve sarf malzeme siparişi gibi tüm hizmetlere erişebilirsiniz.',
            icon: <Settings size={40} className="text-white" />,
            bgColor: 'bg-slate-900'
        },
        {
            title: 'Her Zaman Yanınızdayız',
            description: 'Kurulum yardımı, teknik destek ve 7/24 AI asistanımız ile her an yanınızdayız. Hadi başlayalım!',
            icon: <Headphones size={40} className="text-white" />,
            bgColor: 'bg-slate-900'
        }
    ];

    if (!isOpen) return null;

    const currentStep = steps[step];

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                    className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-slate-100 p-8 sm:p-10 relative"
                >
                    <div className="text-center">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`w-20 h-20 ${currentStep.bgColor} rounded-xl flex items-center justify-center mx-auto mb-6 shadow-sm`}
                        >
                            {currentStep.icon}
                        </motion.div>

                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight mb-3">
                            {currentStep.title}
                        </h2>
                        <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
                            {currentStep.description}
                        </p>

                        <div className="flex items-center justify-center gap-2 mb-8">
                            {steps.map((_, i) => (
                                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-slate-900' : 'w-2 bg-slate-200'}`}></div>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            {step > 0 && (
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="px-6 py-3 font-semibold text-sm text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    Geri
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (step < steps.length - 1) {
                                        setStep(step + 1);
                                    } else {
                                        onClose();
                                    }
                                }}
                                className="flex-1 bg-slate-900 text-white font-semibold py-3.5 rounded-[10px] hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                {step === steps.length - 1 ? 'Kuruluma Başla' : 'Sonraki'}
                                {step === steps.length - 1 ? <CheckCircle2 size={18} /> : <ChevronRight size={18} />}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
