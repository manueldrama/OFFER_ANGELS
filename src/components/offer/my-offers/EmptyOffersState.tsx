import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FileText, ArrowRight, LayoutGrid } from 'lucide-react';
import { ViewType } from '../../../types';
import { EditableI18nText } from '../../landing/EditableI18nText';

interface EmptyOffersStateProps {
  onNavigate: (view: ViewType) => void;
}

const EmptyOffersState = ({ onNavigate }: EmptyOffersStateProps) => {
  const { t } = useTranslation('offer');
  return (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="bg-white rounded-md border border-slate-100 shadow-card p-8 md:p-12 text-center max-w-lg mx-auto"
  >
    <div className="w-16 h-16 bg-violet-50 rounded-md flex items-center justify-center mx-auto mb-5">
      <FileText size={28} className="text-violet-400" />
    </div>
    <h3 className="text-xl font-black text-slate-900 mb-2">
      <EditableI18nText i18nKey="offer:myOffers.emptyState.title" value={t('offer:myOffers.emptyState.title')} />
    </h3>
    <p className="text-sm text-slate-500 leading-relaxed mb-8 max-w-sm mx-auto">
      <EditableI18nText i18nKey="offer:myOffers.emptyState.subtitle" value={t('offer:myOffers.emptyState.subtitle')} />
    </p>
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
      <button
        onClick={() => onNavigate('summary')}
        className="w-full sm:w-auto px-6 py-3.5 rounded-md bg-primary hover:bg-primary-dark text-white text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
      >
        <EditableI18nText i18nKey="offer:myOffers.emptyState.createOffer" value={t('offer:myOffers.emptyState.createOffer')} />
        <ArrowRight size={16} />
      </button>
      <button
        onClick={() => onNavigate('summary')}
        className="w-full sm:w-auto px-6 py-3.5 rounded-md border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
      >
        <LayoutGrid size={16} />
        <EditableI18nText i18nKey="offer:myOffers.emptyState.browseOptions" value={t('offer:myOffers.emptyState.browseOptions')} />
      </button>
    </div>
  </motion.div>
  );
};

export default EmptyOffersState;
