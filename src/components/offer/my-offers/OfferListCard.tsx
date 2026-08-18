import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CreditCard, Check, ChevronRight, ChevronDown, Package, Building2, Copy, Send, X, ArrowRight, Bell, Info, CheckCircle2 } from 'lucide-react';
import { SavedOffer } from '../../../types';
import { supabase } from '../../../lib/supabase/client';
import { isExpiringSoon, getUrgencyTier } from './offerTimeUtils';
import { useOfferStatusLabels } from '../../../hooks/useOfferStatusLabels';
import { useOfferLocale } from '../../../contexts/OfferLocaleContext';
import { formatPrice, formatPriceCompact, type SupportedCurrency } from '../../../utils/currency';
import OfferReminderButton from './OfferReminderButton';
import OfferTimeProgressBar from './OfferTimeProgressBar';
import type { BankInfo } from './MyOffersPage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { EditableI18nText } from '../../landing/EditableI18nText';

interface OfferListCardProps {
  offer: SavedOffer;
  depositPercent: number;
  onView: (offer: SavedOffer) => void;
  onNavigate?: (view: string) => void;
  onPayRemaining?: (reservationId: string) => void;
  index: number;
  token: string;
  bankInfo?: BankInfo | null;
  expanded?: boolean;
  onToggle?: () => void;
  key?: React.Key;
}

const benefits = [
  'Fiyat Avantajı Korunur',
  'Teslimat Planlaması Başlatılır',
];

const OfferListCard = ({ offer, depositPercent, onView, onNavigate, onPayRemaining, index, token, bankInfo, expanded = true, onToggle }: OfferListCardProps) => {
  const { t } = useTranslation('offer');
  const { language, currency: localeCurrency } = useOfferLocale();
  // Offers are immutable financial documents — the price is locked in the
  // currency they were issued with. A TR-issued offer keeps showing TL even if
  // the customer browses the device-selection page in EUR. Falls back to the
  // current locale's currency only for legacy rows that predate per-offer
  // currency tracking.
  const offerCurrency = (offer.currency || localeCurrency) as SupportedCurrency;
  const fp = (amount: number) => formatPrice(amount, offerCurrency, language);
  const fpc = (amount: number) => formatPriceCompact(amount, offerCurrency, language);
  const { getRemainingTime, getOfferStatus, labels: statusLabels, formatBankPendingLastDays, formatDepositPaidRemainingDays, formatDepositCriticalLastDays, depositPaidWaiting, priceLockExpired } = useOfferStatusLabels();
  // Tek doğruluk noktası: SavedOffer.expiryAt offerContext yükleme anında computeEffectiveOfferExpiry
  // ile hesaplandı. createdAt+maxDays formülü ile admin'in link uzatması burada zaten birleşmiş halde.
  const offerExpiry = offer.expiryAt;

  const hasReservation = !!offer.selectedReservation && offer.selectedReservation !== ''
    && !['credit-card', 'bank-transfer', 'pre-payment'].includes(offer.selectedReservation);
  const resStatus = offer.reservationStatus || 'pending';

  // Sipariş lojistikte (kargo/teslim) → Tekliflerim'de gizle, Rezervasyonlar'da takip edilir.
  const fullyCompleted = ['delivered', 'shipped'].includes(resStatus);
  if (hasReservation && fullyCompleted) return null;

  // İptal → gizle
  if (hasReservation && resStatus === 'cancelled') return null;

  // Tam ödeme yapıldı → Tekliflerim'de yeşil "Ödendi" rozeti ile göster,
  // sadece "Rezervasyonlarımda Gör" CTA'si. Aktif teklif CTA'ları gizlenir.
  const isFullyPaid = hasReservation && ['paid', 'fully_paid', 'confirmed'].includes(resStatus);

  // Kapora ödendi → göster, 14 gün geri sayım + "Kalanı Öde" CTA
  const isDepositPaid = hasReservation && ['deposit_paid', 'price_lock_expired'].includes(resStatus);

  // Havale bekliyor → göster, admin onayı bekle
  const isBankPending = hasReservation && offer.paymentMethod === 'bank-transfer' && resStatus === 'pending';

  // Havale: müşteri "Ödemeyi Yaptım" + fatura formu submit etti, admin onayı bekleniyor.
  // Sarı "Havale Bekleniyor" yerine mavi "Ödeme Bildirildi · Onay Bekleniyor" göster.
  const isBankTransferNotified = isBankPending && !!offer.bankTransferNotifiedAt;

  // Kapora 14 gün expiry
  const depositExpiry = React.useMemo(() => {
    if (isDepositPaid && offer.depositPaidAt) {
      return new Date(new Date(offer.depositPaidAt).getTime() + 14 * 86400000).toISOString();
    }
    return null;
  }, [isDepositPaid, offer.depositPaidAt]);

  const effectiveExpiry = depositExpiry || offerExpiry;
  const remaining = getRemainingTime(effectiveExpiry);
  const expiringSoon = isExpiringSoon(effectiveExpiry);
  const isExpired = !isDepositPaid && !isBankPending && remaining === statusLabels.expired;
  const urgencyTier = getUrgencyTier(effectiveExpiry);
  const isHighUrgency = !hasReservation && !isExpired && (urgencyTier === 'critical' || urgencyTier === 'urgent' || urgencyTier === 'warning');
  // Urgency for reserved cards (deposit paid / bank pending)
  const reservedUrgencyTier = hasReservation ? getUrgencyTier(effectiveExpiry) : 'calm';
  const reservedIsUrgent = hasReservation && (reservedUrgencyTier === 'critical' || reservedUrgencyTier === 'urgent' || reservedUrgencyTier === 'warning' || reservedUrgencyTier === 'notice');

  const [transferNotified, setTransferNotified] = React.useState(false);
  const [notifying, setNotifying] = React.useState(false);
  const [showBankDialog, setShowBankDialog] = React.useState(false);

  const handleTransferNotify = async () => {
    if (!offer.selectedReservation || notifying) return;
    setNotifying(true);
    await supabase
      .from('customer_reservations')
      .update({ bank_transfer_notified_at: new Date().toISOString() })
      .eq('id', offer.selectedReservation);
    setTransferNotified(true);
    setNotifying(false);
  };
  const depositAmount = Math.round(offer.total * depositPercent / 100);

  const isOpen = expanded;

  // Scroll CTA buttons into view after accordion opens
  React.useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      const card = document.getElementById(`offer-card-${offer.id}`);
      if (!card) return;
      const bottom = card.querySelector('.offer-card-bottom') as HTMLElement | null;
      if (bottom) {
        const rect = bottom.getBoundingClientRect();
        const safeArea = window.innerHeight - 140;
        if (rect.bottom > safeArea) {
          window.scrollBy({ top: rect.bottom - safeArea + 12, behavior: 'smooth' });
        }
      }
      // Set overflow visible for dropdown support
      const accordionEl = card.querySelector('.accordion-body') as HTMLElement | null;
      if (accordionEl) accordionEl.style.overflow = 'visible';
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, offer.id]);

  return (
    <div
      id={`offer-card-${offer.id}`}
      className={`relative bg-white rounded-md overflow-hidden border transition-all duration-300 scroll-mt-16 ${hasReservation
        ? isDepositPaid
          ? 'border-violet-100 md:border-slate-200/60 shadow-sm select-none'
          : 'border-violet-100 select-none shadow-sm'
        : isExpired
          ? 'border-red-100 opacity-60 grayscale shadow-sm'
          : 'border-slate-100 md:border-slate-200 shadow-sm'
        }`}
    >
      {/* MOBILE Status banner for paid offers */}
      {hasReservation && (() => {
        const daysLeft = (() => {
          const t = new Date(effectiveExpiry).getTime() - Date.now();
          return t > 0 ? Math.ceil(t / (1000 * 60 * 60 * 24)) : 0;
        })();
        const statusMap: Record<string, { label: string; color: string }> = {
          'pending': isBankTransferNotified ? {
            label: 'Ödeme Bildirildi · Onay Bekleniyor',
            color: 'text-blue-700 bg-blue-50 border-blue-100'
          } : {
            label: reservedUrgencyTier === 'notice' || reservedUrgencyTier === 'warning'
              ? formatBankPendingLastDays(daysLeft)
              : statusLabels.bankPending,
            color: reservedUrgencyTier === 'warning' || reservedUrgencyTier === 'urgent'
              ? 'text-orange-700 bg-orange-50 border-orange-200'
              : 'text-amber-700 bg-amber-50 border-amber-100'
          },
          'deposit_paid': {
            label: reservedUrgencyTier === 'notice'
              ? formatDepositPaidRemainingDays(daysLeft)
              : reservedUrgencyTier === 'warning' || reservedUrgencyTier === 'urgent'
                ? formatDepositCriticalLastDays(daysLeft)
                : depositPaidWaiting,
            color: reservedUrgencyTier === 'warning' || reservedUrgencyTier === 'urgent'
              ? 'text-orange-700 bg-orange-50 border-orange-200'
              : 'text-violet-700 bg-violet-50 border-violet-100'
          },
          'price_lock_expired': { label: priceLockExpired, color: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
          'paid': { label: 'Bu teklif ödendi', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
          'fully_paid': { label: 'Bu teklif ödendi', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
          'confirmed': { label: 'Bu teklif ödendi', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
        };
        const cfg = statusMap[resStatus] || statusMap['pending'];
        return (
          <div className={`md:hidden relative z-10 ${cfg.color} border-b rounded-t-md px-4 py-3 text-center`}>
            <div className="flex items-center justify-center gap-2">
              <Check size={14} />
              <span className="text-sm font-bold">{cfg.label}</span>
            </div>
          </div>
        );
      })()}

      {/* --- MOBILE COMPACT VIEW --- */}
      <div className="md:hidden">
        {/* Compact Card Header — always visible */}
        <div className="p-3 cursor-pointer" onClick={() => onToggle?.()}>
          <div className="flex items-center gap-3">
            {/* Thumbnail */}
            <div className="w-12 h-12 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
              {(() => {
                const firstProduct = offer.items.find(i => i.type === 'product');
                const img = firstProduct?.image;
                return img ? (
                  <img src={img} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package size={20} className="text-slate-300" />
                );
              })()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-slate-400 md:text-slate-800 md:font-bold font-medium truncate">
                    <span className="md:hidden">#{offer.offerNumber} · </span>
                    {offer.items.find(i => i.type === 'product')?.name || 'Teklif'}
                  </p>
                  {(() => {
                    const totalListPrice = offer.items.reduce((sum, i) => sum + (i.listPrice || i.price) * i.quantity, 0);
                    const savings = totalListPrice - offer.total;
                    const hasDiscount = savings > 0;
                    return (
                      <div className="mt-0.5">
                        <div className="flex items-baseline gap-2">
                          {hasDiscount && !isExpired && (
                            <span className="text-xs text-slate-400 line-through font-medium">{fpc(totalListPrice)}</span>
                          )}
                          <p className={`text-xl md:text-3xl font-bold md:tracking-tighter tracking-tight ${isExpired ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {fpc(offer.total)}
                          </p>
                        </div>
                        {hasDiscount && !isExpired && (
                          <span className="text-[10px] font-bold text-emerald-600">{t('offer:myOffers.featured.launchAdvantage', { amount: fpc(savings) })}</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="mt-1">
                  <ChevronDown size={16} className="text-slate-300" />
                </motion.div>
              </div>

              {/* Status badge + progress bar */}
              <div className="flex items-center gap-2 mt-1.5">
                {isFullyPaid ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 bg-emerald-50 text-emerald-700 border-emerald-100">
                    <CheckCircle2 size={10} /> Ödendi
                  </span>
                ) : isBankTransferNotified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 bg-blue-50 text-blue-700 border-blue-100">
                    <Send size={10} /> Onay Bekleniyor
                  </span>
                ) : (() => {
                  const status = getOfferStatus({ hasReservation, isExpired, expiringSoon, reservationStatus: offer.reservationStatus, paymentMethod: offer.paymentMethod });
                  const variantClasses: Record<string, string> = {
                    green: 'bg-emerald-50 md:bg-transparent text-emerald-600 md:text-slate-500 border-emerald-100 md:border-transparent',
                    amber: 'bg-amber-50 md:bg-transparent text-amber-600 md:text-slate-500 border-amber-100 md:border-transparent',
                    orange: 'bg-orange-50 md:bg-transparent text-orange-600 md:text-orange-600 border-orange-100 md:border-transparent',
                    red: 'bg-red-50 md:bg-transparent text-red-500 md:text-red-600 border-red-100 md:border-transparent',
                    blue: 'bg-blue-50 md:bg-transparent text-blue-600 md:text-slate-500 border-blue-100 md:border-transparent',
                  };
                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${variantClasses[status.variant]}`}>
                      {hasReservation ? <Check size={10} /> : <Clock size={10} />}
                      {status.label}
                    </span>
                  );
                })()}
              </div>

              {/* Progress bar — only for non-paid active offers */}
              {offer.createdAt && (
                <div className="mt-2">
                  <OfferTimeProgressBar createdAt={isDepositPaid && offer.depositPaidAt ? offer.depositPaidAt : offer.createdAt} expiryDate={effectiveExpiry} compact={isOpen} />
                </div>
              )}

              {/* Quick action + Hatırlat — collapsed only, ödenmiş kartta gizli */}
              {!isOpen && !isExpired && !isFullyPaid && (
                <div className="flex items-center gap-2 mt-2">
                  <OfferReminderButton offerId={offer.id} offerToken={token} expiryDate={offerExpiry} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isBankPending) {
                        setShowBankDialog(true);
                      } else if (isDepositPaid && offer.selectedReservation) {
                        onPayRemaining?.(offer.selectedReservation);
                      } else {
                        onView(offer);
                      }
                    }}
                    className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all active:scale-[0.98] ${hasReservation
                      ? reservedUrgencyTier === 'critical'
                        ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                        : reservedUrgencyTier === 'urgent' || reservedUrgencyTier === 'warning'
                          ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      : urgencyTier === 'critical'
                        ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                        : urgencyTier === 'urgent' || urgencyTier === 'warning'
                          ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                          : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
                      }`}
                  >
                    {isDepositPaid ? t('offer:myOffers.card.payRemaining') : isBankPending ? t('offer:myOffers.card.bankInfo') : urgencyTier === 'critical' ? t('offer:myOffers.card.lastChanceLock') : urgencyTier === 'urgent' ? t('offer:myOffers.card.lockNowArrow') : t('offer:myOffers.card.lockPriceArrow')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Accordion Body */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
              animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
              exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <div className="accordion-body relative px-3 pb-3">

                {/* Compact stat row */}
                <div className="flex items-center gap-2 mt-2 py-2 border-t border-slate-100 md:border-transparent md:pt-4">
                  <div className="flex-1 flex items-center gap-1.5">
                    <Clock size={12} className="text-violet-500" />
                    <span className="text-xs font-bold text-slate-900">{remaining}</span>
                  </div>
                  <div className="h-4 w-px bg-slate-200" />
                  <div className="flex-1 flex items-center gap-1.5 justify-end">
                    <CreditCard size={12} className="text-amber-500" />
                    <span className="text-xs font-bold text-slate-900">{fpc(depositAmount)}</span>
                    <span className="text-[10px] text-slate-400"><EditableI18nText i18nKey="offer:offerListCard.onOdeme" value={t('offer:offerListCard.onOdeme')} /></span>
                  </div>
                </div>

                {/* Product list — compact */}
                {offer.items.length > 0 && (() => {
                  const devices = offer.items.filter(i => i.type === 'product');
                  const accessories = offer.items.filter(i => i.type === 'accessory');
                  return (
                    <div className="py-2 border-t border-slate-100 md:border-transparent">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          {devices.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                              <Package size={12} className="text-primary shrink-0" />
                              <span className="text-xs font-semibold text-slate-700">{item.name}</span>
                              {item.quantity > 1 && <span className="text-[10px] text-slate-400">×{item.quantity}</span>}
                            </div>
                          ))}
                          {accessories.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                              <Package size={10} className="text-slate-300 shrink-0" />
                              <span className="text-[11px] text-slate-500">{item.name}</span>
                              {item.quantity > 1 && <span className="text-[10px] text-slate-400">×{item.quantity}</span>}
                            </div>
                          ))}
                        </div>
                        {!isExpired && (
                          <div className="shrink-0">
                            <OfferReminderButton offerId={offer.id} offerToken={token} expiryDate={offerExpiry} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Benefits — inline */}
                <div className="flex items-center gap-3 py-2 border-t border-slate-100 md:border-transparent md:pb-4">
                  {benefits.map((b) => (
                    <span key={b} className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                      <Check size={10} className="text-emerald-500" />{b}
                    </span>
                  ))}
                </div>

                {/* CTAs */}
                {isExpired ? (
                  <div className="offer-card-bottom py-2 border-t border-red-100 text-center">
                    <p className="text-xs font-bold text-red-400"><EditableI18nText i18nKey="offer:offerListCard.buTeklifinSuresiDolmustur" value={t('offer:offerListCard.buTeklifinSuresiDolmustur')} /></p>
                  </div>
                ) : isFullyPaid ? (
                  <div className="offer-card-bottom flex items-center gap-2 pt-2 border-t border-slate-100 md:border-transparent md:pt-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onNavigate?.('reservations'); }}
                      className="flex-1 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                    >
                      Rezervasyonlarımda Gör <ArrowRight size={14} />
                    </button>
                  </div>
                ) : isDepositPaid ? (
                  <div className="offer-card-bottom flex items-center gap-2 pt-2 border-t border-slate-100 md:border-transparent md:pt-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(offer); }}
                      className="md:hidden flex-1 px-3 py-2 rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      <EditableI18nText i18nKey="offer:myOffers.card.viewOffer" value={t('offer:myOffers.card.viewOffer')} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); offer.selectedReservation && onPayRemaining?.(offer.selectedReservation); }}
                      className={`flex-1 px-3 py-2 rounded-md text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${reservedUrgencyTier === 'critical'
                        ? 'bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/30'
                        : reservedUrgencyTier === 'urgent' || reservedUrgencyTier === 'warning'
                          ? 'bg-orange-500 hover:bg-orange-600 shadow-sm shadow-orange-500/20'
                          : 'bg-slate-900 hover:bg-slate-800'
                        }`}
                    >
                      {reservedUrgencyTier === 'critical' ? 'Son Şans — Kalanı Öde' : reservedUrgencyTier === 'urgent' ? 'Hemen Öde' : 'Kalanı Öde'}
                      <ChevronRight size={14} />
                    </button>
                  </div>
                ) : isBankTransferNotified ? (
                  <div className="offer-card-bottom flex items-center gap-2 pt-2 border-t border-slate-100 md:border-transparent md:pt-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(offer); }}
                      className="md:hidden flex-1 px-3 py-2 rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      <EditableI18nText i18nKey="offer:myOffers.card.viewOffer" value={t('offer:myOffers.card.viewOffer')} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onNavigate?.('reservations'); }}
                      className="flex-1 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                    >
                      <Send size={12} /> Rezervasyonlarımda Gör
                    </button>
                  </div>
                ) : isBankPending ? (
                  <div className="offer-card-bottom flex items-center gap-2 pt-2 border-t border-slate-100 md:border-transparent md:pt-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(offer); }}
                      className="md:hidden flex-1 px-3 py-2 rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      <EditableI18nText i18nKey="offer:myOffers.card.viewOffer" value={t('offer:myOffers.card.viewOffer')} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowBankDialog(true); }}
                      className={`flex-1 px-3 py-2 rounded-md text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${reservedUrgencyTier === 'critical'
                        ? 'bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/30'
                        : reservedUrgencyTier === 'urgent' || reservedUrgencyTier === 'warning'
                          ? 'bg-orange-500 hover:bg-orange-600 shadow-sm shadow-orange-500/20'
                          : 'bg-slate-900 hover:bg-slate-800'
                        }`}
                    >
                      <Building2 size={12} /> {reservedUrgencyTier === 'critical' ? 'Son Şans — Havale Yap' : 'Havale Bilgileri'}
                    </button>
                  </div>
                ) : (
                  <div className="offer-card-bottom flex items-center gap-2 pt-2 border-t border-slate-100 md:border-transparent md:pt-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(offer); }}
                      className="md:hidden flex-1 px-3 py-2 rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      <EditableI18nText i18nKey="offer:myOffers.card.viewOffer" value={t('offer:myOffers.card.viewOffer')} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(offer); }}
                      className={`flex-1 px-3 py-2 rounded-md text-white text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${urgencyTier === 'critical'
                        ? 'bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/30'
                        : urgencyTier === 'urgent' || urgencyTier === 'warning'
                          ? 'bg-orange-500 hover:bg-orange-600 shadow-sm shadow-orange-500/20'
                          : 'bg-slate-900 hover:bg-slate-800'
                        }`}
                    >
                      {urgencyTier === 'critical' ? t('offer:myOffers.card.lastChance') : urgencyTier === 'urgent' ? t('offer:myOffers.card.lockNow') : t('offer:myOffers.card.lockPrice')}
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- DESKTOP 3-COLUMN STRUCTURED VIEW (Mockup Match) --- */}
      <div className="hidden md:block">

        {/* Fully Paid (Ödendi) — Yeşil rezervasyon banner */}
        {isFullyPaid && (
          <div className="bg-emerald-50 px-6 py-3.5 border-b border-emerald-100 flex items-center">
            <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center mr-2.5 shadow-sm">
              <Check size={12} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 text-[14px]">Bu teklif ödendi <span className="text-emerald-500 font-extrabold mx-1.5">•</span> Aktif Rezervasyon</span>
            <span className="text-slate-500 text-[13px] ml-3 font-medium">Detaylar Rezervasyonlarım sekmesinde</span>
            <button
              type="button"
              onClick={() => onNavigate?.('reservations')}
              className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-md text-[12px] tracking-tight inline-flex items-center gap-1.5 transition-colors"
            >
              Rezervasyonlarımda Gör <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* Bank Transfer Notified — Mavi "Ödeme Bildirildi" banner */}
        {isBankTransferNotified && (
          <div className="bg-blue-50 px-6 py-3.5 border-b border-blue-100 flex items-center">
            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center mr-2.5 shadow-sm">
              <Send size={12} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 text-[14px]">Ödeme Bildirildi <span className="text-blue-400 font-extrabold mx-1.5">•</span> Onay Bekleniyor</span>
            <span className="text-slate-500 text-[13px] ml-3 font-medium">Havaleniz tarafımıza ulaştığında onaylanacak</span>
            <span className="ml-auto bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-md text-[12px] tracking-tight">İnceleniyor</span>
          </div>
        )}

        {/* Deposit Paid Purple Banner */}
        {isDepositPaid && (
          <div className="bg-violet-50 px-6 py-3.5 border-b border-violet-100 flex items-center">
            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center mr-2.5 shadow-sm">
              <Check size={12} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 text-[14px]"><EditableI18nText i18nKey="offer:offerListCard.kaporaOdendi" value={t('offer:offerListCard.kaporaOdendi')} /> <span className="text-indigo-400 font-extrabold mx-1.5">•</span> <EditableI18nText i18nKey="offer:offerListCard.kalanOdemeBekleniyor" value={t('offer:offerListCard.kalanOdemeBekleniyor')} /></span>
            <span className="text-slate-400 text-[13px] ml-3 font-medium"><EditableI18nText i18nKey="offer:offerListCard.odemeSonrasiTeslimatPlanlamasi" value={t('offer:offerListCard.odemeSonrasiTeslimatPlanlamasi')} /></span>
            <span className="ml-auto bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-md text-[12px] tracking-tight">
              {remaining} {t('offer:time.remainingSuffix', { defaultValue: 'kaldı' })}
            </span>
          </div>
        )}

        {/* Standard Active Banner (Mockup Consistency) */}
        {!isDepositPaid && !isFullyPaid && !isBankTransferNotified && !isExpired && (
          <div className="bg-[#f2fbf5] px-6 py-3.5 border-b border-emerald-100 flex items-center">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center mr-2.5 shadow-sm">
              <CheckCircle2 size={12} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 text-[14px]"><EditableI18nText i18nKey="offer:myOffers.card.activeOffer" value={t('offer:myOffers.card.activeOffer')} /> <span className="text-emerald-400 font-extrabold mx-1.5">•</span> <EditableI18nText i18nKey="offer:myOffers.card.approvalPending" value={t('offer:myOffers.card.approvalPending')} /></span>
            <span className="text-slate-500 text-[13px] ml-3 font-medium">{t('offer:myOffers.card.priceProtectedFor', { remaining: remaining.replace('kaldı', '').trim() })}</span>
            <span className="ml-auto bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-md text-[12px] tracking-tight">
              {remaining} {t('offer:myOffers.card.remaining', { defaultValue: 'kaldı' })}
            </span>
          </div>
        )}

        {/* Main Card Content */}
        <div className="flex flex-row p-6 items-stretch">

          {/* LEFT: Product Thumbnail & Identifiers */}
          <div className="flex items-start gap-4 w-[280px] shrink-0 pr-6">
            <div className="w-[84px] h-[84px] rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center p-1.5 shrink-0 relative overflow-hidden">
              {(() => {
                const img = offer.items.find(i => i.type === 'product')?.image;
                return img ? <img src={img} alt="" className="w-full h-full object-cover mix-blend-multiply rounded-md" /> : <Package size={24} className="text-slate-300" />;
              })()}
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="text-[16px] font-bold text-slate-900 leading-tight truncate">
                {offer.items.find(i => i.type === 'product')?.name || t('offer:offerListCard.specialOffer', { defaultValue: 'Özel Teklif' })}
              </h3>
              <div className="mt-3.5 flex flex-col gap-1.5">
                <div className="flex items-start gap-2 text-[12px] text-slate-500 font-medium leading-tight">
                  <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" /> <EditableI18nText i18nKey="offer:myOffers.card.campaignPriceProtected" value={t('offer:myOffers.card.campaignPriceProtected')} />
                </div>
                {isFullyPaid ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full bg-emerald-50 border border-emerald-100 w-fit">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span className="text-[11px] font-bold text-emerald-700">Ödendi</span>
                  </div>
                ) : isBankTransferNotified ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full bg-blue-50 border border-blue-100 w-fit">
                    <Send size={12} className="text-blue-600" />
                    <span className="text-[11px] font-bold text-blue-700">Onay Bekleniyor</span>
                  </div>
                ) : isDepositPaid ? (
                  <div className="flex items-start gap-2 text-[12px] text-slate-500 font-medium leading-tight">
                    <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" /> <EditableI18nText i18nKey="offer:offerListCard.teslimatPlanlamasi" value={t('offer:offerListCard.teslimatPlanlamasi')} />
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full bg-emerald-50 border border-emerald-100/50 w-fit">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    <span className="text-[11px] font-bold text-emerald-700"><EditableI18nText i18nKey="offer:myOffers.card.active" value={t('offer:myOffers.card.active')} /></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CENTER: Financial Data & Status Metadata */}
          <div className="flex-1 flex flex-col justify-start px-8 border-l border-slate-100 min-h-[140px] min-w-0">
            <div className="flex items-baseline gap-4 mb-2 pt-1">
              <span className={`text-[32px] font-extrabold tracking-tight ${isExpired ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {fpc(offer.total)}
              </span>
            </div>

            {isDepositPaid ? (
              <div className="flex flex-col gap-3">
                <div className="inline-flex items-center bg-slate-50/80 border border-slate-200/80 rounded-full px-3 py-1 w-fit mt-1">
                  <span className="text-[11px] text-slate-500 font-bold mr-1.5"><EditableI18nText i18nKey="offer:offerListCard.kalanOdeme" value={t('offer:offerListCard.kalanOdeme')} /></span>
                  <span className="text-[12px] text-slate-900 font-bold">{fpc(offer.total - (offer.total * depositPercent / 100))}</span>
                </div>

                {/* Progress Bar Visual (Mockup Match) */}
                <div className="mt-1">
                  <p className="text-[11px] font-bold text-slate-700 mb-2.5"><EditableI18nText i18nKey="offer:offerListCard.odemeDurumu" value={t('offer:offerListCard.odemeDurumu')} /></p>
                  <div className="flex items-center w-[280px]">
                    <div className="h-2.5 w-1/2 bg-emerald-500 rounded-l-full relative">
                      <div className="absolute top-4 left-0 flex items-center gap-1.5 whitespace-nowrap">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span className="text-[11px] font-bold text-slate-800"><EditableI18nText i18nKey="offer:offerListCard.kaporaOdendi2" value={t('offer:offerListCard.kaporaOdendi2')} /></span>
                      </div>
                    </div>
                    <div className="h-2.5 w-1/2 bg-slate-200 rounded-r-full relative">
                      <div className="absolute top-4 right-0 flex items-center gap-1.5 whitespace-nowrap">
                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="text-[11px] font-semibold text-slate-500"><EditableI18nText i18nKey="offer:offerListCard.kalanOdemeBekleniyor2" value={t('offer:offerListCard.kalanOdemeBekleniyor2')} /></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 mt-1 w-[280px]">
                <div className="flex items-center gap-1.5 text-[12px]">
                  <Clock size={14} className="text-slate-400" />
                  <span className="text-slate-500 font-medium"><EditableI18nText i18nKey="offer:myOffers.card.validity" value={t('offer:myOffers.card.validity')} /></span>
                  <span className="text-emerald-600 font-bold">{remaining}</span>
                </div>
                {offer.createdAt && (
                  <div className="w-full">
                    <OfferTimeProgressBar createdAt={isDepositPaid && offer.depositPaidAt ? offer.depositPaidAt : offer.createdAt} expiryDate={effectiveExpiry} compact={false} />
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600 mt-0.5">
                  <Check size={14} className="text-emerald-500" />
                  <EditableI18nText i18nKey="offer:myOffers.card.priceAdvantageActive" value={t('offer:myOffers.card.priceAdvantageActive')} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Strict Single Primary CTA + Secondaries */}
          <div className="flex flex-col justify-start pl-8 border-l border-slate-100 h-full w-[260px] shrink-0 pt-1">
            {isBankTransferNotified ? (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onNavigate?.('reservations'); }}
                  className="w-full bg-blue-600 text-white rounded-md py-2.5 text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={14} /> Rezervasyonlarımda Gör
                </button>
                <div className="mt-1 bg-blue-50 border border-blue-100 rounded-md p-3 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-blue-700 font-bold text-[11px]">
                    <Info size={14} /> Onay bekleniyor
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium pl-5">Havaleniz tarafımıza ulaştığında siparişiniz onaylanacak.</span>
                </div>
              </div>
            ) : isFullyPaid ? (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onNavigate?.('reservations'); }}
                  className="w-full bg-emerald-600 text-white rounded-md py-2.5 text-sm font-bold shadow-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  Rezervasyonlarımda Gör <ArrowRight size={14} />
                </button>
                <div className="mt-1 bg-emerald-50 border border-emerald-100 rounded-md p-3 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                    <CheckCircle2 size={14} /> Ödeme tamamlandı
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium pl-5">Bu teklif artık aktif bir rezervasyondur.</span>
                </div>
              </div>
            ) : isDepositPaid ? (
              <div className="flex flex-col gap-2.5">
                <button onClick={(e) => { e.stopPropagation(); offer.selectedReservation && onPayRemaining?.(offer.selectedReservation); }} className="w-full bg-slate-900 text-white rounded-md py-2.5 text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                  {t('offer:myOffers.card.completeRemainingPayment', { defaultValue: 'Kalan Ödemeyi Tamamla' })} <ArrowRight size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onView(offer); }} className="w-full bg-white border border-slate-200 text-slate-700 rounded-md py-2 text-[12px] font-bold hover:bg-slate-50 transition-colors">
                  <EditableI18nText i18nKey="offer:myOffers.card.viewOffer" value={t('offer:myOffers.card.viewOffer')} />
                </button>
                <button className="w-full bg-white border border-slate-200 text-slate-700 rounded-md py-2 text-[12px] font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                  <Bell size={14} /> <EditableI18nText i18nKey="offer:myOffers.card.remind" value={t('offer:myOffers.card.remind')} />
                </button>
                <div className="mt-1 bg-blue-50 border border-blue-100 rounded-md p-3 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-blue-700 font-bold text-[11px]">
                    <Info size={14} /> <EditableI18nText i18nKey="offer:myOffers.card.priceProtected" value={t('offer:myOffers.card.priceProtected')} />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium pl-5"><EditableI18nText i18nKey="offer:myOffers.card.dontMiss" value={t('offer:myOffers.card.dontMiss')} /></span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <button onClick={(e) => { e.stopPropagation(); onView(offer); }} className="w-full bg-slate-900 text-white rounded-md py-2.5 text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                  <EditableI18nText i18nKey="offer:myOffers.card.lockPrice" value={t('offer:myOffers.card.lockPrice')} /> <ArrowRight size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onView(offer); }} className="w-full bg-white border border-slate-200 text-slate-700 rounded-md py-2 text-sm font-bold hover:bg-slate-50 transition-colors">
                  <EditableI18nText i18nKey="offer:myOffers.card.viewOffer" value={t('offer:myOffers.card.viewOffer')} />
                </button>
                <button className="w-full bg-white border border-slate-200 text-slate-700 rounded-md py-2 text-sm font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                  <Bell size={14} /> <EditableI18nText i18nKey="offer:myOffers.card.remind" value={t('offer:myOffers.card.remind')} />
                </button>
                <div className="mt-1 bg-blue-50 border border-blue-100 rounded-md p-3 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-blue-700 font-bold text-[11px]">
                    <Info size={14} /> <EditableI18nText i18nKey="offer:myOffers.card.priceProtected" value={t('offer:myOffers.card.priceProtected')} />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium pl-5"><EditableI18nText i18nKey="offer:myOffers.card.dontMiss" value={t('offer:myOffers.card.dontMiss')} /></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bank info dialog */}
      <AnimatePresence>
        {bankInfo && showBankDialog && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { e.stopPropagation(); setShowBankDialog(false); }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-md bg-white rounded-md shadow-2xl overflow-y-auto max-h-[calc(100dvh-2rem)] flex flex-col"
            >
              <div className="px-6 pt-5 pb-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-1 rounded-full bg-slate-200" />
                  <button onClick={(e) => { e.stopPropagation(); setShowBankDialog(false); }} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><X size={18} className="text-slate-400" /></button>
                </div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-12 h-12 rounded-md bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100/50">
                    <Building2 size={24} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">Havale Bilgileri</h3>
                    <p className="text-sm text-slate-500 mt-0.5"><EditableI18nText i18nKey="offer:offerListCard.asagidakiHesabaOdemeYapabilirsiniz" value={t('offer:offerListCard.asagidakiHesabaOdemeYapabilirsiniz')} /></p>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6 pt-4 space-y-4">
                <div className="flex justify-between items-center px-2 py-1">
                  <span className="text-sm font-medium text-slate-500">Banka</span>
                  <span className="text-sm font-bold text-slate-900">{bankInfo.bank_name}</span>
                </div>
                <div className="bg-slate-50 rounded-md px-4 py-3 flex items-center justify-between border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5"><EditableI18nText i18nKey="offer:offerListCard.alici" value={t('offer:offerListCard.alici')} /></span>
                    <span className="text-sm font-bold text-slate-900">{bankInfo.account_holder}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(bankInfo.account_holder); }} className="p-2 bg-white rounded-md text-slate-400 hover:text-indigo-600 shadow-sm transition-colors active:scale-95">
                    <Copy size={16} />
                  </button>
                </div>
                <div className="bg-indigo-50 rounded-md px-4 py-3 flex items-center justify-between border border-indigo-100/50">
                  <div>
                    <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider block mb-0.5">IBAN</span>
                    <span className="font-mono text-[15px] font-bold tracking-wider text-indigo-900">{bankInfo.iban}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(bankInfo.iban.replace(/\s/g, '')); }} className="p-2 bg-white rounded-md text-indigo-500 hover:text-indigo-700 shadow-sm transition-colors active:scale-95 border border-indigo-100/50">
                    <Copy size={16} />
                  </button>
                </div>
                <div className="flex justify-between items-end pt-3 border-t border-slate-100 px-2">
                  <span className="text-sm font-medium text-slate-500"><EditableI18nText i18nKey="offer:offerListCard.odenecekTutar" value={t('offer:offerListCard.odenecekTutar')} /></span>
                  <span className="text-2xl font-bold text-indigo-600 tracking-tight">{fpc(Math.round(offer.total * (1 - bankInfo.discount_percent / 100)))}</span>
                </div>
                <div className="bg-amber-50 rounded-md px-4 py-3 border border-amber-100/50 my-2">
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">
                    Havale açıklamasına teklif kodunuzu (<span className="font-bold underline underline-offset-2">#{offer.offerNumber}</span>) yazmayı unutmayın.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTransferNotify(); }}
                    disabled={transferNotified || notifying}
                    className={`w-full py-3.5 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${transferNotified
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default shadow-none'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 active:scale-[0.98]'
                      }`}
                  >
                    {transferNotified
                      ? <><Check size={18} /> <EditableI18nText i18nKey="offer:offerListCard.bildirimGonderildi" value={t('offer:offerListCard.bildirimGonderildi')} /></>
                      : notifying
                        ? <EditableI18nText i18nKey="offer:offerListCard.notifyingGonderiliyor" value={t('offer:offerListCard.notifyingGonderiliyor')} />
                        : <><Send size={18} /> <EditableI18nText i18nKey="offer:offerListCard.odemeyiYaptim" value={t('offer:offerListCard.odemeyiYaptim')} /></>}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OfferListCard;
