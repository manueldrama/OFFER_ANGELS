import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Clock, CreditCard, Check, ChevronRight, Package, AlertTriangle, Flame } from 'lucide-react';
import { SavedOffer } from '../../../types';
import { getRemainingTime, isExpiringSoon, getUrgencyTier } from './offerTimeUtils';
import { useOfferLocale } from '../../../contexts/OfferLocaleContext';
import { formatPriceCompact, type SupportedCurrency } from '../../../utils/currency';
import { EditableI18nText } from '../../landing/EditableI18nText';

interface FeaturedOfferCardProps {
  offer: SavedOffer;
  validUntil: string;
  depositPercent: number;
  onView: (offer: SavedOffer) => void;
}

const FeaturedOfferCard = ({ offer, validUntil, depositPercent, onView }: FeaturedOfferCardProps) => {
  const { t } = useTranslation('offer');
  const { language, currency: localeCurrency } = useOfferLocale();
  // Lock formatting to the offer's original currency so a Turkish-issued offer
  // stays in TL even when the customer browses in a German locale.
  const offerCurrency = (offer.currency || localeCurrency) as SupportedCurrency;
  const fpc = (amount: number) => formatPriceCompact(amount, offerCurrency, language);
  const benefits = [
    t('offer:myOffers.featured.benefits.priceProtected'),
    t('offer:myOffers.featured.benefits.installScheduling'),
    t('offer:myOffers.featured.benefits.advisorSupport'),
  ];
  const remaining = getRemainingTime(validUntil);
  const expiringSoon = isExpiringSoon(validUntil);
  const tier = getUrgencyTier(validUntil);
  const depositAmount = Math.round(offer.total * depositPercent / 100);

  const savings = (() => {
    const totalList = offer.items.reduce((s, i) => s + (i.listPrice || i.price) * i.quantity, 0);
    return totalList > offer.total ? totalList - offer.total : 0;
  })();

  const isCritical = tier === 'critical';
  const isUrgent = tier === 'urgent' || tier === 'warning';

  const ctaLabel = isCritical
    ? t('offer:myOffers.featured.lastChanceLockNow')
    : isUrgent
      ? t('offer:myOffers.featured.lockNow')
      : t('offer:myOffers.featured.lockPrice');

  const ctaClass = isCritical
    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30'
    : isUrgent
      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30'
      : 'bg-primary hover:bg-primary-dark text-white shadow-sm';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={`bg-white rounded-md border shadow-sm overflow-hidden ${isCritical ? 'border-red-200' : isUrgent ? 'border-orange-200' : 'border-slate-100'}`}
    >
      {/* Loss framing banner — urgent/critical only */}
      {(isUrgent || isCritical) && savings > 0 && (
        <div className={`px-5 py-3 flex items-center gap-2 ${isCritical ? 'bg-red-600' : 'bg-orange-500'}`}>
          {isCritical ? <Flame size={14} className="text-white shrink-0" /> : <AlertTriangle size={14} className="text-white shrink-0" />}
          <p className="text-xs font-bold text-white">
            {isCritical
              ? t('offer:myOffers.featured.savingsLossCritical', { amount: fpc(savings), remaining })
              : t('offer:myOffers.featured.savingsLossUrgent', { amount: fpc(savings) })}
          </p>
        </div>
      )}

      <div className="p-5 md:p-8">
        {/* Top: Badge + Mobile Price */}
        <div className="flex items-start justify-between mb-4">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
            isCritical
              ? 'bg-red-50 text-red-600 border border-red-200'
              : expiringSoon
                ? 'bg-rose-50 text-rose-600 border border-rose-100'
                : 'bg-violet-50 text-violet-600 border border-violet-100'
          }`}>
            <Clock size={12} />
            {isCritical ? t('offer:myOffers.featured.remainingShort', { remaining }) : expiringSoon ? t('offer:myOffers.featured.endingToday') : t('offer:myOffers.featured.limitedOffer')}
          </div>
          {/* Price on mobile */}
          <div className="md:hidden text-right">
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              {fpc(offer.total)}
            </p>
            {savings > 0 && (
              <p className="text-[10px] font-bold text-emerald-600">{t('offer:myOffers.featured.launchAdvantage', { amount: fpc(savings) })}</p>
            )}
          </div>
        </div>

        {/* Desktop: Two-axis layout */}
        <div className="md:flex md:items-start md:justify-between md:gap-8">
          {/* Left: Offer info */}
          <div className="flex-1 min-w-0">
            {/* Offer Code */}
            <h3 className="font-mono text-xl md:text-2xl font-bold text-slate-900 tracking-tight truncate">
              {offer.offerNumber}
            </h3>
            <p className="text-sm text-slate-500 mt-1"><EditableI18nText i18nKey="offer:myOffers.featured.tailoredOffer" value={t('offer:myOffers.featured.tailoredOffer')} /></p>

            {/* Stat boxes */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className={`rounded-md p-3.5 ${isCritical ? 'bg-red-50' : isUrgent ? 'bg-orange-50' : 'bg-violet-50/70'}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock size={13} className={isCritical ? 'text-red-500' : isUrgent ? 'text-orange-500' : 'text-violet-500'} />
                  <span className={`text-[11px] font-semibold ${isCritical ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-violet-600'}`}><EditableI18nText i18nKey="offer:myOffers.featured.remainingTime" value={t('offer:myOffers.featured.remainingTime')} /></span>
                </div>
                <p className={`text-lg font-bold ${isCritical || isUrgent ? 'text-red-700' : 'text-slate-900'}`}>{remaining}</p>
              </div>
              <div className="bg-amber-50/70 rounded-md p-3.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CreditCard size={13} className="text-amber-500" />
                  <span className="text-[11px] font-semibold text-amber-600"><EditableI18nText i18nKey="offer:myOffers.featured.payToday" value={t('offer:myOffers.featured.payToday')} /></span>
                </div>
                <p className="text-lg font-bold text-slate-900">{fpc(depositAmount)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5"><EditableI18nText i18nKey="offer:myOffers.featured.depositReservation" value={t('offer:myOffers.featured.depositReservation')} /></p>
              </div>
            </div>
          </div>

          {/* Right: Price on desktop */}
          <div className="hidden md:flex md:flex-col md:items-end md:pt-1 shrink-0">
            <p className="text-sm text-slate-400 font-medium"><EditableI18nText i18nKey="offer:myOffers.featured.totalAmount" value={t('offer:myOffers.featured.totalAmount')} /></p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight mt-1">
              {fpc(offer.total)}
            </p>
            {savings > 0 && (
              <p className="text-xs font-bold text-emerald-600 mt-1">{t('offer:myOffers.featured.launchAdvantage', { amount: fpc(savings) })}</p>
            )}
          </div>
        </div>

        {/* Product list */}
        {offer.items.length > 0 && (() => {
          const devices = offer.items.filter(i => i.type === 'product');
          const accessories = offer.items.filter(i => i.type === 'accessory');
          return (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 mb-2.5"><EditableI18nText i18nKey="offer:myOffers.featured.offerContents" value={t('offer:myOffers.featured.offerContents')} /></p>
              <div className="space-y-1.5">
                {devices.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Package size={13} className="text-primary shrink-0" />
                    <span className="text-sm font-semibold text-slate-700">{item.name}</span>
                    {item.quantity > 1 && <span className="text-xs text-slate-400">×{item.quantity}</span>}
                  </div>
                ))}
                {accessories.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Package size={12} className="text-slate-300 shrink-0" />
                    <span className="text-xs text-slate-500">{item.name}</span>
                    {item.quantity > 1 && <span className="text-[11px] text-slate-400">×{item.quantity}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Benefits */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col gap-2">
            {benefits.map((b) => (
              <div key={b} className="flex items-center gap-2">
                <div className="w-5 h-5 bg-emerald-50 rounded-full flex items-center justify-center shrink-0">
                  <Check size={12} className="text-emerald-500" />
                </div>
                <span className="text-sm text-slate-600">{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={() => onView(offer)}
            className="flex-1 md:flex-none px-6 py-3.5 rounded-md border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <EditableI18nText i18nKey="offer:myOffers.featured.viewDetails" value={t('offer:myOffers.featured.viewDetails')} />
          </button>
          <button
            onClick={() => onView(offer)}
            className={`flex-1 md:flex-none px-6 py-3.5 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${ctaClass}`}
          >
            {ctaLabel}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default FeaturedOfferCard;
