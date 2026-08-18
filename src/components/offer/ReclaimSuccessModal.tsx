import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Müşteri reclaim talebini gönderdikten sonra gösterilen onay modal'ı.
 *
 * Tasarım: Refined Classic çizgisi (ExpiredOfferModal ile aynı dil) —
 * emerald accent gradient strip + soft eyebrow chip + 2-sütun bilgi grid.
 */

interface ReclaimSuccessModalProps {
    open: boolean;
    onClose: () => void;
    customerGreeting: string | null;
}

const ReclaimSuccessModal: React.FC<ReclaimSuccessModalProps> = ({
    open,
    onClose,
    customerGreeting,
}) => {
    const { t } = useTranslation(['offer']);

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 8 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/10 overflow-hidden"
                        aria-modal="true"
                        role="dialog"
                    >
                        {/* Emerald gradient strip — başarı accent */}
                        <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400/70" />

                        <div className="p-7 md:p-10">
                            {/* Eyebrow */}
                            <div className="flex justify-center mb-5">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-[0.18em]">
                                        {t('offer:reclaimSuccessModal.eyebrow', 'Talebiniz Alındı')}
                                    </span>
                                </div>
                            </div>

                            {/* H2 başlık */}
                            <h2 className="text-center text-[22px] md:text-[28px] font-bold text-slate-900 leading-[1.25] tracking-[-0.015em] mb-4">
                                {customerGreeting
                                    ? t('offer:reclaimSuccessModal.titleNamed', { customerName: customerGreeting, defaultValue: 'Teşekkürler, {{customerName}}' })
                                    : t('offer:reclaimSuccessModal.title', 'Teşekkürler.')}
                            </h2>

                            {/* Body */}
                            <p className="text-center text-[13.5px] md:text-[15px] text-slate-600 leading-[1.65] mb-7 max-w-md mx-auto">
                                {t('offer:reclaimSuccessModal.body', 'Talebiniz danışmanınıza iletildi. Stok ve güncel fiyat kontrolü sonrası size özel teklifiniz hazırlanacak.')}
                            </p>

                            {/* 2-sütun bilgi grid — Süreç | Yanıt Süresi */}
                            <div className="grid grid-cols-2 gap-3 mb-7">
                                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1.5">
                                        {t('offer:reclaimSuccessModal.processLabel', 'Süreç')}
                                    </p>
                                    <p className="text-[14px] md:text-[15px] font-bold text-emerald-700 leading-tight">
                                        {t('offer:reclaimSuccessModal.processValue', 'Onayda')}
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                        {t('offer:reclaimSuccessModal.processSubtext', 'Danışman incelemesi')}
                                    </p>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1.5">
                                        {t('offer:reclaimSuccessModal.responseLabel', 'Yanıt')}
                                    </p>
                                    <p className="text-[14px] md:text-[15px] font-bold text-slate-900 leading-tight">
                                        {t('offer:reclaimSuccessModal.responseValue', '24 Saat')}
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                        {t('offer:reclaimSuccessModal.responseSubtext', 'WhatsApp üzerinden')}
                                    </p>
                                </div>
                            </div>

                            {/* CTA */}
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 px-6 rounded-xl transition-all active:scale-[0.99] min-h-[52px]"
                                style={{
                                    boxShadow:
                                        '0 1px 2px rgba(0,0,0,0.08), 0 8px 24px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
                                }}
                            >
                                <span className="tracking-wide text-[14px] md:text-[15px]">
                                    {t('offer:reclaimSuccessModal.cta', 'Tamam')}
                                </span>
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ReclaimSuccessModal;
