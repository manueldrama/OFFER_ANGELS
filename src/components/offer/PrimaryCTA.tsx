import React from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PrimaryCTAProps {
    isVisible: boolean;
    onInspect: () => void;
    onContinue: () => void;
    inspectLabel: string;
    continueLabel: string;
}

const PrimaryCTA = ({
    isVisible,
    onInspect,
    onContinue,
    inspectLabel,
    continueLabel,
}: PrimaryCTAProps) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="fixed bottom-[78px] left-3 right-3 z-40 md:hidden"
                >
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)] p-3">
                        {/* Sadece Cihazı İncele — müşteri ürün hikâyesini görmeden fiyata atlayamaz. */}
                        <button
                            onClick={onInspect}
                            className="w-full font-bold py-3 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all text-sm flex items-center justify-center gap-2 shadow-sm shadow-primary/30 active:scale-[0.98]"
                        >
                            <Search size={14} />
                            {inspectLabel}
                            <ArrowRight size={14} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PrimaryCTA;
