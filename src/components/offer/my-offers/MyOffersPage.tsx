import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock, ChevronDown, Calendar, Tag, Headset, Inbox } from 'lucide-react';
import { SavedOffer, ViewType } from '../../../types';
import { OfferContextData } from '../../../services/offerContext';
import { supabase } from '../../../lib/supabase/client';
import { useDepositPercent } from './useDepositPercent';
import OfferPageTitleBlock from './OfferPageTitleBlock';
import PriorityBanner from './PriorityBanner';
import OfferListCard from './OfferListCard';
import EmptyOffersState from './EmptyOffersState';
import { EditableI18nText } from '../../landing/EditableI18nText';

export interface BankInfo {
  iban: string;
  bank_name: string;
  account_holder: string;
  discount_percent: number;
}

function useOffersPerPage() {
  const calculate = () => {
    if (typeof window === 'undefined') return 2;
    const isDesktop = window.innerWidth >= 768;
    
    // Mobil cihazlarda ekran kaymasının bozulmaması için formül yerine her zaman 2 kart gösterelim.
    if (!isDesktop) return 2;

    const vh = window.innerHeight;
    const overhead = 220; // Expanded header + pagination breathing room
    const available = vh - overhead;
    const cardHeight = 300; // Deeply padded desktop 3-column height with gap
    const rows = Math.max(1, Math.floor(available / cardHeight));
    
    // Yalnızca 1 sütun var, alt bar kalktığı için doğal yüksekliğine göre limiti ayarlıyoruz
    return rows;
  };
  const [perPage, setPerPage] = React.useState(calculate);
  React.useEffect(() => {
    const handler = () => setPerPage(calculate());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return perPage;
}

interface MyOffersPageProps {
  savedOffers: SavedOffer[];
  onViewOffer: (offer: SavedOffer) => void;
  onPayRemaining?: (reservationId: string) => void;
  offerContext: OfferContextData;
  token: string;
  onNavigate: (view: ViewType) => void;
}

const MyOffersPage = ({ savedOffers, onViewOffer, onPayRemaining, offerContext, token, onNavigate }: MyOffersPageProps) => {
  const { t } = useTranslation('offer');
  const offersPerPage = useOffersPerPage();
  const depositPercent = useDepositPercent();
  const [page, setPage] = React.useState(0);
  const [bankInfo, setBankInfo] = React.useState<BankInfo | null>(null);
  const [expandedOfferId, setExpandedOfferId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<'all' | 'active' | 'deposit'>('all');
  
  type SortOption = 'newest' | 'oldest' | 'price_desc' | 'price_asc';
  const [sortOption, setSortOption] = React.useState<SortOption>('newest');
  const [isSortOpen, setIsSortOpen] = React.useState(false);

  const scrollPosRef = React.useRef<number | null>(null);

  const handleToggle = (offerId: string) => {
    setExpandedOfferId(prev => {
      const next = prev === offerId ? null : offerId;
      if (next) {
        scrollPosRef.current = window.scrollY;
        // Scroll is handled by OfferListCard's onAnimationComplete
      } else {
        setTimeout(() => {
          if (scrollPosRef.current !== null) {
            window.scrollTo({ top: scrollPosRef.current, behavior: 'smooth' });
            scrollPosRef.current = null;
          }
        }, 300);
      }
      return next;
    });
  };

  // Fetch bank info if any offer has bank-transfer payment
  React.useEffect(() => {
    const hasBankTransfer = savedOffers.some(o => o.paymentMethod === 'bank-transfer');
    if (!hasBankTransfer) return;
    (async () => {
      const { data } = await supabase
        .from('payment_settings')
        .select('value')
        .eq('key', 'payment_methods')
        .maybeSingle();
      if (data?.value?.bank_transfer) {
        const bt = data.value.bank_transfer;
        setBankInfo({ iban: bt.iban || '', bank_name: bt.bank_name || '', account_holder: bt.account_holder || '', discount_percent: bt.discount_percent ?? 5 });
      }
    })();
  }, [savedOffers]);

  // Sort: reservation offers (deposit/bank pending) first, then active
  const sortedOffers = React.useMemo(() => {
    return [...savedOffers].sort((a, b) => {
      const aHasRes = !!a.selectedReservation && a.selectedReservation !== '' && !['credit-card', 'bank-transfer', 'pre-payment'].includes(a.selectedReservation);
      const bHasRes = !!b.selectedReservation && b.selectedReservation !== '' && !['credit-card', 'bank-transfer', 'pre-payment'].includes(b.selectedReservation);
      
      // Her zaman Kaporalı (VIP) ödemeleri en üste sabitle.
      if (aHasRes && !bHasRes) return -1;
      if (!aHasRes && bHasRes) return 1;

      // Kaporalı durumu eşitse seçili Sıralamaya göre yönlendir.
      if (sortOption === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortOption === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortOption === 'price_desc') {
        return (b.total || 0) - (a.total || 0);
      }
      if (sortOption === 'price_asc') {
        return (a.total || 0) - (b.total || 0);
      }
      
      return 0;
    });
  }, [savedOffers, sortOption]);

  const maxDays = offerContext.campaignInfo.maxOfferValidityDays ?? 7;

  const filteredOffers = React.useMemo(() => {
    return sortedOffers.filter(offer => {
      if (filter === 'all') return true;
      
      const hasRes = !!offer.selectedReservation && offer.selectedReservation !== '' && !['credit-card', 'bank-transfer', 'pre-payment'].includes(offer.selectedReservation);
      const isExpired = offer.createdAt ? Date.now() > new Date(offer.createdAt).getTime() + maxDays * 86400000 : false;
      const isDepositPaid = hasRes || offer.paymentMethod === 'bank-transfer';

      if (filter === 'active') return !isDepositPaid && !isExpired;
      if (filter === 'deposit') return isDepositPaid;

      return true;
    });
  }, [sortedOffers, filter, maxDays]);

  const totalPages = Math.ceil(filteredOffers.length / offersPerPage);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  React.useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);
  const pagedOffers = filteredOffers.slice(safePage * offersPerPage, (safePage + 1) * offersPerPage);
  const displayOffers = pagedOffers;

  return (
    <div className="px-4 md:px-0 lg:px-0 pb-[120px] md:pb-24 md:max-w-[1360px] md:mx-auto min-h-[calc(100dvh-3.5rem)] flex flex-col justify-start pt-4 md:pt-0">
      <div className="space-y-6 md:space-y-0">
        {savedOffers.length === 0 ? (
          <div className="py-8">
            <EmptyOffersState onNavigate={onNavigate} />
          </div>
        ) : (
          <>
            {/* All expired warning — SavedOffer.expiryAt tek doğruluk noktası */}
            {(() => {
              const now = Date.now();
              const allExpired = savedOffers.length > 0 && savedOffers.every(o => new Date(o.expiryAt).getTime() <= now);
              return allExpired ? (
                <div className="bg-red-50 border border-red-100 rounded-md p-4 text-center">
                  <p className="text-red-600 font-bold text-sm"><EditableI18nText i18nKey="offer:myOffers.allExpiredTitle" value={t('offer:myOffers.allExpiredTitle')} /></p>
                  <p className="text-red-400 text-xs mt-1">{t('offer:myOffers.allExpiredContact', { defaultValue: 'Yeniden başvurmak için danışmanınızla iletişime geçin' })}</p>
                </div>
              ) : null;
            })()}

            {/* All Offers Container */}
            <div className="flex flex-col md:max-w-5xl md:mx-auto w-full gap-4 md:gap-5">
              
              {/* --- MOBILE FILTERS (Restored) --- */}
              <div className="md:hidden sticky top-[56px] z-40 bg-white -mx-4 px-4 pt-3 pb-2 border-b border-slate-100">
                 <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x snap-mandatory pr-6">
                   <button
                     onClick={() => { setFilter('all'); setPage(0); }}
                     className={`snap-start whitespace-nowrap px-4 py-2 text-xs font-bold rounded-full transition-all ${filter === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600'}`}>
                     <EditableI18nText i18nKey="offer:myOffers.filterAll" value={t('offer:myOffers.filterAll')} />
                   </button>
                   <button
                     onClick={() => { setFilter('active'); setPage(0); }}
                     className={`snap-start whitespace-nowrap px-4 py-2 text-xs font-bold rounded-full transition-all ${filter === 'active' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600'}`}>
                     <EditableI18nText i18nKey="offer:myOffers.filterActive" value={t('offer:myOffers.filterActive')} />
                   </button>
                   <button
                     onClick={() => { setFilter('deposit'); setPage(0); }}
                     className={`snap-end whitespace-nowrap px-4 py-2 text-xs font-bold rounded-full transition-all ${filter === 'deposit' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600'}`}>
                     <EditableI18nText i18nKey="offer:myOffers.filterDeposit" value={t('offer:myOffers.filterDeposit')} />
                   </button>
                 </div>
              </div>

              {/* --- DESKTOP FILTERS (Mockup Match) --- */}
              <div className="hidden md:flex items-center justify-between mb-4 sticky top-[84px] z-50 bg-white/95 backdrop-blur-md px-8 pb-4 pt-4 rounded-2xl border border-slate-200/50 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.06)]">
                 <div className="flex items-center gap-2">
                   <button
                     onClick={() => { setFilter('all'); setPage(0); }}
                     className={`px-5 py-2 text-sm font-bold rounded-full transition-all ${filter === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                     <EditableI18nText i18nKey="offer:myOffers.filterAll" value={t('offer:myOffers.filterAll')} />
                   </button>
                   <button
                     onClick={() => { setFilter('active'); setPage(0); }}
                     className={`px-5 py-2 text-sm font-bold rounded-full transition-all ${filter === 'active' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                     <EditableI18nText i18nKey="offer:myOffers.filterActive" value={t('offer:myOffers.filterActive')} />
                   </button>
                   <button
                     onClick={() => { setFilter('deposit'); setPage(0); }}
                     className={`px-5 py-2 text-sm font-bold rounded-full transition-all ${filter === 'deposit' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                     <EditableI18nText i18nKey="offer:myOffers.filterDeposit" value={t('offer:myOffers.filterDeposit')} />
                   </button>
                 </div>
                 <div className="flex items-center gap-3 relative">
                   
                   {/* Sort Dropdown Hook */}
                   <div className="relative">
                     <button 
                       onClick={() => setIsSortOpen(!isSortOpen)}
                       className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-full hover:bg-slate-50 relative z-50">
                        {t('offer:myOffers.sortPrefix')} {
                          sortOption === 'newest' ? t('offer:myOffers.sortNewest') :
                          sortOption === 'oldest' ? t('offer:myOffers.sortOldest', { defaultValue: 'En Eski' }) :
                          sortOption === 'price_desc' ? t('offer:myOffers.sortPriceDesc', { defaultValue: 'Azalan Fiyat' }) : t('offer:myOffers.sortPriceAsc', { defaultValue: 'Artan Fiyat' })
                        } <ChevronDown size={16} />
                     </button>
                     
                     {/* Overlay to close dropdown */}
                     {isSortOpen && (
                       <div 
                         className="fixed inset-0 z-40" 
                         onClick={() => setIsSortOpen(false)} 
                       />
                     )}

                     {/* Dropdown Menu */}
                     {isSortOpen && (
                       <motion.div 
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1)] overflow-hidden z-50 py-1"
                       >
                         {[
                           { id: 'newest', label: t('offer:myOffers.sortNewest'), icon: <Clock size={14}/> },
                           { id: 'oldest', label: t('offer:myOffers.sortOldest', { defaultValue: 'En Eski' }), icon: <Calendar size={14}/> },
                           { id: 'price_desc', label: t('offer:myOffers.sortPriceDesc', { defaultValue: 'Azalan Fiyat' }), icon: <ChevronDown size={14}/> },
                           { id: 'price_asc', label: t('offer:myOffers.sortPriceAsc', { defaultValue: 'Artan Fiyat' }), icon: <ChevronRight size={14}/> },
                         ].map(opt => (
                           <button
                             key={opt.id}
                             onClick={() => { setSortOption(opt.id as SortOption); setIsSortOpen(false); setPage(0); }}
                             className={`w-full flex items-center gap-2 text-left px-5 py-3 text-sm transition-all ${sortOption === opt.id ? 'font-bold text-slate-900 bg-slate-50' : 'text-slate-600 hover:bg-slate-50'}`}
                           >
                             <span className="text-slate-400">{opt.icon}</span>
                             {opt.label}
                           </button>
                         ))}
                       </motion.div>
                     )}
                   </div>
                   
                   <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 text-sm font-semibold rounded-full">
                      <Clock size={14} className="text-slate-500" /> {filter === 'deposit' ? t('offer:myOffers.countDeposit', { count: filteredOffers.length }) : t('offer:myOffers.countActive', { count: filteredOffers.length })}
                   </div>
                 </div>
              </div>

              {displayOffers.map((offer, i) => (
                <OfferListCard
                  key={offer.id}
                  offer={offer}
                  depositPercent={depositPercent}
                  onView={onViewOffer}
                  onNavigate={onNavigate}
                  onPayRemaining={onPayRemaining}
                  index={i}
                  token={token}
                  bankInfo={offer.paymentMethod === 'bank-transfer' ? bankInfo : null}
                  expanded={expandedOfferId === offer.id}
                  onToggle={() => handleToggle(offer.id)}
                />
              ))}

              {/* Filtre uyuşan sonuç yok — layout collapse'ı önler, kullanıcıya net mesaj verir */}
              {displayOffers.length === 0 && savedOffers.length > 0 && (
                <div className="bg-white border border-dashed border-slate-200 rounded-2xl py-12 px-6 text-center min-h-[280px] md:min-h-[320px] flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                    <Inbox size={26} className="text-slate-300" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">
                    {filter === 'deposit'
                      ? t('offer:myOffers.emptyDepositTitle', { defaultValue: 'Henüz kaporalı teklif yok' })
                      : filter === 'active'
                        ? t('offer:myOffers.emptyActiveTitle', { defaultValue: 'Aktif teklif bulunmuyor' })
                        : t('offer:myOffers.emptyFilterTitle', { defaultValue: 'Bu filtrede teklif yok' })}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    {filter === 'deposit'
                      ? t('offer:myOffers.emptyDepositDesc', { defaultValue: 'Kapora ödemesi tamamlanmış tekliflerin burada listelenir.' })
                      : t('offer:myOffers.emptyFilterDesc', { defaultValue: 'Farklı bir filtre seçerek diğer tekliflerini görebilirsin.' })}
                  </p>
                  {filter !== 'all' && (
                    <button
                      onClick={() => { setFilter('all'); setPage(0); }}
                      className="mt-5 px-5 py-2 text-xs font-bold rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                    >
                      {t('offer:myOffers.filterAll', { defaultValue: 'Tümünü Göster' })}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Pagination — Fixed bottom on both mobile and desktop */}
            {totalPages > 1 && (
              <div className="fixed bottom-16 left-0 right-0 z-40 py-3 bg-white/90 border-t border-slate-100 md:bottom-0 md:z-50 md:py-4 md:bg-white/80 md:backdrop-blur-2xl md:border-t md:border-slate-200/50 md:shadow-[0_-10px_40px_rgb(0,0,0,0.05)] backdrop-blur-md shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-center gap-2 w-full md:max-w-5xl md:mx-auto">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-9 h-9 md:w-10 md:h-10 rounded-md text-sm font-bold transition-all ${
                      i === page
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white"
                >
                  <ChevronRight size={16} />
                </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MyOffersPage;
