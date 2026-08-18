import React from 'react';
import { Clock, AlertTriangle, Flame } from 'lucide-react';
import { parseTurkishDate, getRemainingTime, getUrgencyTier } from './offerTimeUtils';

interface PriorityBannerProps {
  validUntil: string;
  savings?: number;
}

const PriorityBanner = ({ validUntil, savings }: PriorityBannerProps) => {
  const target = parseTurkishDate(validUntil);
  const daysLeft = target ? Math.max(0, Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
  const tier = getUrgencyTier(validUntil);
  const remaining = getRemainingTime(validUntil);

  if (tier === 'expired') return null;

  if (tier === 'critical') {
    return (
      <div className="flex items-start gap-3 bg-red-600 rounded-md p-4 md:p-5 animate-pulse">
        <div className="w-9 h-9 bg-red-500 rounded-md flex items-center justify-center shrink-0 mt-0.5">
          <Flame size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-white">
            Son {remaining}! Fiyat şimdi kilitle
          </p>
          <p className="text-xs text-red-100 mt-0.5 leading-relaxed">
            {savings ? `₺${savings.toLocaleString('tr-TR')} avantajı kaybedeceksiniz. ` : ''}Bu fiyat geri gelmeyecek — şimdi harekete geç.
          </p>
        </div>
      </div>
    );
  }

  if (tier === 'urgent') {
    return (
      <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-md p-4 md:p-5">
        <div className="w-9 h-9 bg-red-100 rounded-md flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle size={18} className="text-red-600" />
        </div>
        <div>
          <p className="text-sm font-black text-red-900">
            Son {remaining} kaldı — fiyat artıyor
          </p>
          <p className="text-xs text-red-700/80 mt-0.5 leading-relaxed">
            {savings ? `₺${savings.toLocaleString('tr-TR')} lansman avantajı` : 'Lansman avantajı'} bugün sona eriyor. Sonraki fiyat daha yüksek.
          </p>
        </div>
      </div>
    );
  }

  if (tier === 'warning') {
    return (
      <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-md p-4 md:p-5">
        <div className="w-9 h-9 bg-orange-100 rounded-md flex items-center justify-center shrink-0 mt-0.5">
          <Clock size={18} className="text-orange-600" />
        </div>
        <div>
          <p className="text-sm font-black text-orange-900">
            Bu fiyat bugün bitiyor
          </p>
          <p className="text-xs text-orange-700/80 mt-0.5 leading-relaxed">
            {savings ? `₺${savings.toLocaleString('tr-TR')} avantaj` : 'Lansman fiyatı'} gece yarısı kapanıyor. Rezervasyon yapmazsanız bu fiyat geri gelmez.
          </p>
        </div>
      </div>
    );
  }

  if (tier === 'notice') {
    return (
      <div className="flex items-start gap-3 bg-amber-50/70 border border-amber-200 rounded-md p-4 md:p-5">
        <div className="w-9 h-9 bg-amber-100/60 rounded-md flex items-center justify-center shrink-0 mt-0.5">
          <Clock size={18} className="text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-amber-900">
            {daysLeft !== null ? `${daysLeft} gün` : 'Kısa süre'} içinde kapanıyor
          </p>
          <p className="text-xs text-amber-700/80 mt-0.5 leading-relaxed">
            Bugün rezervasyon yaparsanız mevcut fiyat ve teslimat tarihi garanti edilir.
          </p>
        </div>
      </div>
    );
  }

  // calm
  return (
    <div className="flex items-start gap-3 bg-amber-50/70 border border-amber-100 rounded-md p-4 md:p-5">
      <div className="w-9 h-9 bg-amber-100/60 rounded-md flex items-center justify-center shrink-0 mt-0.5">
        <Clock size={18} className="text-amber-600" />
      </div>
      <div>
        <p className="text-sm font-bold text-amber-900">
          Fiyat avantajı için son {daysLeft !== null ? `${daysLeft} gün` : 'kısa süre'}
        </p>
        <p className="text-xs text-amber-700/80 mt-0.5 leading-relaxed">
          Bugün rezervasyon yaparsanız mevcut fiyat ve teslimat tarihi garanti edilir.
        </p>
      </div>
    </div>
  );
};

export default PriorityBanner;
