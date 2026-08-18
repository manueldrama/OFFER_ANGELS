import React from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench, GraduationCap, Headphones, Package, MessageCircle } from 'lucide-react';
import { ViewType } from '../../../types';
import { EditableI18nText } from '../../landing/EditableI18nText';

interface TrustSupportSectionProps {
  onNavigate: (view: ViewType) => void;
}

const trustItems = [
  { icon: Wrench, label: 'Kurulum desteği' },
  { icon: GraduationCap, label: 'Eğitim ve onboarding' },
  { icon: Headphones, label: 'Satış sonrası destek' },
  { icon: Package, label: 'Orijinal sarf malzeme erişimi' },
];

const TrustSupportSection = ({ onNavigate }: TrustSupportSectionProps) => {
  const { t } = useTranslation('offer');
  return (
  <div className="space-y-4">
    {/* Trust items */}
    <div className="bg-white rounded-md border border-slate-100 shadow-card p-5 md:p-6">
      <h4 className="text-sm font-bold text-slate-900 mb-4">Teklifinizle birlikte</h4>
      <div className="grid grid-cols-2 gap-3">
        {trustItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-50 rounded-md flex items-center justify-center shrink-0">
              <item.icon size={15} className="text-slate-400" />
            </div>
            <span className="text-xs text-slate-600 font-medium leading-tight">{item.label}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Support card */}
    <div className="bg-violet-50/50 rounded-md border border-violet-100/50 p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center shrink-0 shadow-sm">
          <MessageCircle size={18} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900"><EditableI18nText i18nKey="offer:trustSupportSection.satisDanismaninizHazir" value={t('offer:trustSupportSection.satisDanismaninizHazir')} /></p>
          <p className="text-xs text-slate-500 mt-0.5"><EditableI18nText i18nKey="offer:trustSupportSection.sorularinizIcinHemenUlasin" value={t('offer:trustSupportSection.sorularinizIcinHemenUlasin')} /></p>
        </div>
      </div>
      <button
        onClick={() => onNavigate('support')}
        className="px-4 py-2.5 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shrink-0 shadow-sm"
      >
        Destek al
      </button>
    </div>
  </div>
  );
};

export default TrustSupportSection;
