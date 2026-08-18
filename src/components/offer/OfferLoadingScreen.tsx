import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { EditableI18nText } from '../landing/EditableI18nText';

const easeOut = [0.22, 1, 0.36, 1] as const;

export function OfferLoadingScreen() {
  const { t } = useTranslation('offer');
  return (
    <motion.div
      key="offer-loading"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.4, ease: easeOut as unknown as number[] }}
      className="min-h-screen md:h-[100dvh] bg-white flex flex-col items-center justify-center"
    >
      {/* Logo */}
      <motion.img
        src="/logo.svg"
        alt="CAFEPASTE"
        className="h-8 md:h-10 object-contain mb-8"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: easeOut as unknown as number[] }}
      />

      {/* Shimmer progress bar */}
      <motion.div
        className="w-48 h-[3px] bg-slate-200 rounded-full overflow-hidden mb-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        <div className="h-full w-full shimmer-bar" />
      </motion.div>

      {/* Status text */}
      <motion.p
        className="text-sm text-slate-400 tracking-wide"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <EditableI18nText i18nKey="offer:loading.preparingOffer" value={t('offer:loading.preparingOffer')} />
      </motion.p>

      <style>{`
        .shimmer-bar {
          background: linear-gradient(90deg, transparent 0%, #1e293b 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </motion.div>
  );
}
