import React from 'react';
import { motion } from 'framer-motion';
import { getTimePercentage, getRemainingTime, getUrgencyTier } from './offerTimeUtils';

interface OfferTimeProgressBarProps {
  createdAt: string;
  expiryDate: string;
  compact?: boolean;
}

const OfferTimeProgressBar = ({ createdAt, expiryDate, compact = false }: OfferTimeProgressBarProps) => {
  const pct = getTimePercentage(createdAt, expiryDate);
  const remaining = getRemainingTime(expiryDate);
  const tier = getUrgencyTier(expiryDate);
  const isExpired = remaining === 'Süre doldu';

  const barColor = isExpired
    ? 'bg-red-300'
    : pct > 75
      ? 'bg-emerald-500'
      : pct > 50
        ? 'bg-amber-500'
        : pct > 25
          ? 'bg-orange-500'
          : 'bg-red-500';

  const textColor = isExpired
    ? 'text-red-400'
    : pct > 75
      ? 'text-emerald-600'
      : pct > 50
        ? 'text-amber-600'
        : pct > 25
          ? 'text-orange-600'
          : 'text-red-600';

  const animClass = tier === 'critical'
    ? 'animate-bounce'
    : tier === 'urgent' || tier === 'warning'
      ? 'animate-pulse'
      : '';

  return (
    <div className="w-full">
      <div className="w-full h-2 md:h-2.5 bg-slate-100 md:bg-slate-200/60 rounded-full overflow-hidden shadow-inner relative">
        <div
          className={`h-full rounded-full transition-all duration-500 overflow-hidden relative ${barColor} ${animClass}`}
          style={{ width: `${isExpired ? 100 : Math.max(2, pct)}%`, boxShadow: `inset 0 2px 4px rgba(255,255,255,0.3)` }}
        >
          {/* Premium Animated Shimmer Overlay */}
          {!isExpired && (
            <motion.div
              className="absolute inset-0 z-10 w-[200%] bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg]"
              initial={{ x: '-150%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
            />
          )}
        </div>
      </div>
      {!compact && (
        <p className={`text-[10px] md:text-[11px] md:tracking-wide font-semibold mt-1 md:mt-1.5 ${textColor} ${tier === 'critical' ? 'font-black' : ''}`}>
          {remaining}
          {tier === 'critical' && ' — SON ŞANS'}
          {tier === 'urgent' && ' kaldı'}
        </p>
      )}
    </div>
  );
};

export default OfferTimeProgressBar;
