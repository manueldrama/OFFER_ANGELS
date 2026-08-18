import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

/**
 * Süresi dolan teklif linki açıldığında müşteriye gösterilen modal.
 *
 * Tasarım çizgisi: "Refined Classic" — kullanıcı tercihi (design-reference
 * /01 — Refined Classic). Premium B2B his:
 *   • Üstte ince primary gradient strip
 *   • Yumuşak eyebrow chip (TEKLIF SÜRESİ DOLDU)
 *   • Büyük h2 + sıcak hitap ("Merhaba {Farzona Hanım}, teklifinizi yenileyelim.")
 *   • 2-sütun grid: Önceki Teklif | Durum (soft slate-50 background)
 *   • Dark CTA + subtle danışman linki
 *
 * Mod = "tanınmış müşteri" — guest fallback yok, lead bilgileri kullanılır.
 */

interface ExpiredOfferModalProps {
    open: boolean;
    onClose: () => void;
    /**
     * true → link 'pending_review': yeni lead ama oluşturma anında geçerli
     * kampanya yoktu. "Süresi doldu" yerine "teklifiniz hazırlanıyor" anlatımı
     * gösterilir; akış (modellere göz at → güncel teklif talep et → admin onayı)
     * aynıdır.
     */
    awaitingCampaign?: boolean;
    customerGreeting: string | null;
    originalOfferDate: string | null;
    originalOfferToken?: string | null;
    originalModelName?: string | null;
    /** Opsiyonel: müşteri WhatsApp ile danışmana yazmak istediğinde tıklanır */
    consultantWhatsAppHref?: string;
    /** Opsiyonel: tıklanınca müşteriyi destek sayfasına yönlendirir (verilirse WhatsApp linki yerine kullanılır) */
    onContactConsultant?: () => void;
}

const ExpiredOfferModal: React.FC<ExpiredOfferModalProps> = ({
    open,
    onClose,
    awaitingCampaign = false,
    customerGreeting,
    originalOfferDate,
    originalOfferToken,
    consultantWhatsAppHref,
    onContactConsultant,
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
                        {/* Primary gradient strip — ince accent */}
                        <div className="h-1 bg-gradient-to-r from-primary via-primary to-primary/60" />

                        <div className="p-7 md:p-10">
                            {/* Eyebrow chip — yumuşak, slate accent */}
                            <div className="flex justify-center mb-5">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/80 border border-slate-200/60">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.18em]">
                                        {awaitingCampaign
                                            ? t('offer:reclaimModal.eyebrowPending', 'Teklifiniz Hazırlanıyor')
                                            : t('offer:reclaimModal.eyebrow', 'Teklif Süresi Doldu')}
                                    </span>
                                </div>
                            </div>

                            {/* H2 başlık — sıcak ve refined */}
                            <h2 className="text-center text-[22px] md:text-[28px] font-bold text-slate-900 leading-[1.25] tracking-[-0.015em] mb-4">
                                {awaitingCampaign
                                    ? (customerGreeting
                                        ? t('offer:reclaimModal.titleNamedPending', { customerName: customerGreeting, defaultValue: 'Merhaba {{customerName}}, teklifinizi hazırlıyoruz.' })
                                        : t('offer:reclaimModal.titleAnonymousPending', 'Teklifinizi hazırlıyoruz.'))
                                    : (customerGreeting
                                        ? t('offer:reclaimModal.titleNamed', { customerName: customerGreeting, defaultValue: 'Merhaba {{customerName}}, teklifinizi yenileyelim.' })
                                        : t('offer:reclaimModal.titleAnonymous', 'Teklifinizi yenileyelim.'))}
                            </h2>

                            {/* Body — açıklayıcı */}
                            <p className="text-center text-[13.5px] md:text-[15px] text-slate-600 leading-[1.65] mb-7 max-w-md mx-auto">
                                {awaitingCampaign
                                    ? t('offer:reclaimModal.bodyPending', 'Talebinizi aldık. Aşağıdaki modellerden seçiminizi yapın; danışmanınız güncel fiyatlandırma ve stok ile size özel teklifinizi en kısa sürede iletecek.')
                                    : (originalOfferDate
                                        ? t('offer:reclaimModal.bodyWithDate', { date: originalOfferDate, defaultValue: '{{date}} tarihinde paylaştığımız teklif geçerlilik süresini doldurdu. Aşağıdaki modellerden seçiminizi yapın; danışman onayı sonrasında güncel fiyatlandırma ve stok ile yeni teklifiniz size iletilecek.' })
                                        : t('offer:reclaimModal.bodyGeneric', 'Önceki teklifinizin süresi doldu. Aşağıdaki modellere göz atıp güncel teklif talep edebilirsiniz; danışman onayı sonrası yeni teklifiniz size iletilecek.'))}
                            </p>

                            {/* 2-sütun bilgi grid — Önceki Teklif | Durum.
                                awaitingCampaign'de önceki teklif yok → gizle. */}
                            {!awaitingCampaign && (
                            <div className="grid grid-cols-2 gap-3 mb-7">
                                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1.5">
                                        {t('offer:reclaimModal.previousOfferLabel', 'Önceki Teklif')}
                                    </p>
                                    <p className="text-[14px] md:text-[15px] font-bold text-slate-900 leading-tight">
                                        {originalOfferDate || '—'}
                                    </p>
                                    {originalOfferToken && (
                                        <p className="text-[11px] text-slate-400 mt-0.5 truncate font-medium">
                                            {originalOfferToken}
                                        </p>
                                    )}
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1.5">
                                        {t('offer:reclaimModal.statusLabel', 'Durum')}
                                    </p>
                                    <p className="text-[14px] md:text-[15px] font-bold text-primary leading-tight">
                                        {t('offer:reclaimModal.statusValue', 'Süresi Dolmuş')}
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                        {t('offer:reclaimModal.statusSubtext', 'Yenileme gerekli')}
                                    </p>
                                </div>
                            </div>
                            )}

                            {/* CTA — dark, premium */}
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
                                    {t('offer:reclaimModal.cta', 'Modellere Göz At')}
                                </span>
                                <ArrowRight size={16} strokeWidth={2.25} />
                            </button>

                            {/* Subtle danışman linki — destek sayfasına yönlendirir */}
                            <div className="text-center mt-5">
                                {onContactConsultant ? (
                                    <button
                                        type="button"
                                        onClick={onContactConsultant}
                                        className="text-[12px] md:text-[13px] text-slate-500 hover:text-slate-900 underline decoration-slate-300 underline-offset-4 transition-colors"
                                    >
                                        {t('offer:reclaimModal.contactConsultantLink', 'Danışmanla görüşmek istiyorum')}
                                    </button>
                                ) : (
                                    <a
                                        href={consultantWhatsAppHref || 'https://wa.me/905551234567'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[12px] md:text-[13px] text-slate-500 hover:text-slate-900 underline decoration-slate-300 underline-offset-4 transition-colors"
                                    >
                                        {t('offer:reclaimModal.contactConsultantLink', 'Danışmanla görüşmek istiyorum')}
                                    </a>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ExpiredOfferModal;
