import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOfferLocale } from '../../contexts/OfferLocaleContext';
import { OfferFaqService } from '../../services/admin/offerFaqService';
import { CountryPaymentSettingsService } from '../../services/admin/countryPaymentSettingsService';
import type { OfferFaq } from '../../types';

/**
 * Final teklif altında gösterilen ülke + dil bazlı SSS akordeonu.
 * Veriyi offer'ın ülkesine ve aktif dile göre çözer; veri yoksa hiç render etmez.
 * Stil, final teklif kartlarıyla aynı dili konuşur (bg-white / slate / shadow-sm).
 */
export function OfferFaqSection() {
    const { countryCode, language } = useOfferLocale();
    const { t } = useTranslation();
    const [items, setItems] = useState<OfferFaq[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setLoaded(false);
        // Ana şalter (ülke bazlı) + içerik paralel çözülür. Şalter kapalıysa
        // yayında soru olsa bile bölüm gösterilmez. Ülke yoksa/row yoksa → varsayılan açık.
        Promise.all([
            OfferFaqService.listForCustomer(countryCode, language),
            countryCode
                ? CountryPaymentSettingsService.getByCountry(countryCode)
                    .then(row => row?.offer_faq_enabled !== false)
                    .catch(() => true)
                : Promise.resolve(true),
        ])
            .then(([rows, enabled]) => {
                if (!active) return;
                const visible = enabled ? rows : [];
                setItems(visible);
                setOpenId(visible[0]?.id ?? null); // ilk soru açık başlasın
            })
            .catch(() => { if (active) setItems([]); })
            .finally(() => { if (active) setLoaded(true); });
        return () => { active = false; };
    }, [countryCode, language]);

    // Veri yoksa bölümü hiç gösterme (boş başlık bırakma).
    if (!loaded || items.length === 0) return null;

    return (
        <section className="bg-white rounded-md border border-slate-100 shadow-sm overflow-hidden ofc-faq-block">
            <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                    <HelpCircle className="w-4 h-4" />
                </span>
                <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">
                    {t('offer:finalOffer.faqTitle', { defaultValue: 'Sıkça Sorulan Sorular' })}
                </h3>
            </div>

            <div className="divide-y divide-slate-100 border-t border-slate-100">
                {items.map(item => {
                    const isOpen = openId === item.id;
                    return (
                        <div key={item.id}>
                            <button
                                type="button"
                                onClick={() => setOpenId(isOpen ? null : item.id)}
                                aria-expanded={isOpen}
                                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50/60 transition-colors"
                            >
                                <span className="text-[14px] font-semibold text-slate-800">{item.question}</span>
                                <motion.span
                                    animate={{ rotate: isOpen ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="shrink-0 text-slate-400"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </motion.span>
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
                                        <p className="px-5 pb-4 text-[13px] leading-relaxed text-slate-500 whitespace-pre-line">
                                            {item.answer}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default OfferFaqSection;
