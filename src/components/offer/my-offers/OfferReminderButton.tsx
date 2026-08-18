import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellRing, Check, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { EditableI18nText } from '../../landing/EditableI18nText';

const REMINDER_OPTIONS = [
  { labelKey: 'offer:myOffers.reminder.1hour', value: 1, unit: 'hour' as const },
  { labelKey: 'offer:myOffers.reminder.6hour', value: 6, unit: 'hour' as const },
  { labelKey: 'offer:myOffers.reminder.1day', value: 1, unit: 'day' as const },
  { labelKey: 'offer:myOffers.reminder.2day', value: 2, unit: 'day' as const },
];

interface OfferReminderButtonProps {
  offerId: string;
  offerToken: string;
  expiryDate: string;
}

const OfferReminderButton = ({ offerId, offerToken, expiryDate }: OfferReminderButtonProps) => {
  const { t } = useTranslation('offer');
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeReminders, setActiveReminders] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  // Masaüstü popover pozisyonu — parent kart overflow-hidden olduğu için
  // 'absolute' clip ediliyordu. 'fixed' + getBoundingClientRect ile düzgün konum.
  const [desktopPos, setDesktopPos] = React.useState<{ top: number; right: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Load existing reminders
  React.useEffect(() => {
    if (!offerId || offerId.length < 20) return; // Skip non-UUID IDs
    (async () => {
      try {
        const { data } = await supabase
          .from('offer_reminders')
          .select('reminder_key')
          .eq('offer_id', offerId);
        if (data) setActiveReminders(data.map(r => r.reminder_key));
      } catch { /* ignore */ }
    })();
  }, [offerId]);

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const toggleReminder = async (option: typeof REMINDER_OPTIONS[0]) => {
    const key = `${option.value}-${option.unit}`;
    const isActive = activeReminders.includes(key);
    setSaving(true);

    try {
      if (isActive) {
        await supabase
          .from('offer_reminders')
          .delete()
          .eq('offer_id', offerId)
          .eq('reminder_key', key);
        setActiveReminders(prev => prev.filter(k => k !== key));
      } else {
        // Calculate remind_at
        const expiry = new Date(expiryDate);
        const ms = option.unit === 'hour' ? option.value * 3600000 : option.value * 86400000;
        const remindAt = new Date(expiry.getTime() - ms);

        await supabase
          .from('offer_reminders')
          .upsert({
            offer_id: offerId,
            offer_token: offerToken,
            reminder_key: key,
            remind_at: remindAt.toISOString(),
            status: 'pending'
          }, { onConflict: 'offer_id,reminder_key' });
        setActiveReminders(prev => [...prev, key]);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }
    } catch (err) {
      console.error('Reminder toggle error:', err);
    } finally {
      setSaving(false);
    }
  };

  const hasReminders = activeReminders.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          // Açılış öncesi masaüstü için buton pozisyonunu kaydet (fixed konumlandırma).
          if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDesktopPos({
              top: rect.bottom + 8,
              right: Math.max(8, window.innerWidth - rect.right),
            });
          }
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
          hasReminders
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
        }`}
      >
        {hasReminders ? <BellRing size={13} /> : <Bell size={13} />}
        {hasReminders ? t('offer:myOffers.reminder.active', { count: activeReminders.length }) : t('offer:myOffers.reminder.default')}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* MOBİL: bottom sheet — parent kart overflow-hidden olsa bile fixed konum
                viewport'a göre düzgün gözükür. Overlay'e tıklayınca kapanır. */}
            <motion.div
              key="mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setIsOpen(false)}
              className="md:hidden fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              key="mobile-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-[101] bg-white rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom)]"
            >
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mt-2.5 mb-1" />
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-800"><EditableI18nText i18nKey="offer:myOffers.reminder.setupTitle" value={t('offer:myOffers.reminder.setupTitle')} /></p>
                  <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {REMINDER_OPTIONS.map(option => {
                    const key = `${option.value}-${option.unit}`;
                    const isActive = activeReminders.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleReminder(option)}
                        disabled={saving}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-md text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Bell size={14} />
                          {t(option.labelKey)}
                        </span>
                        {isActive && <Check size={16} className="text-primary" />}
                      </button>
                    );
                  })}
                </div>
                {justSaved && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-emerald-600 font-semibold text-center mt-3"
                  >
                    <EditableI18nText i18nKey="offer:myOffers.reminder.saved" value={t('offer:myOffers.reminder.saved')} />
                  </motion.p>
                )}
              </div>
            </motion.div>

            {/* MASAÜSTÜ: popover (fixed, button getBoundingClientRect ile konum).
                'absolute' kullansaydık parent kart overflow-hidden clip ederdi. */}
            <motion.div
              key="desktop-popover"
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={desktopPos ? { top: desktopPos.top, right: desktopPos.right } : undefined}
              className="hidden md:block fixed z-[60] bg-white rounded-md border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden w-52"
            >
              <div className="p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold text-slate-700"><EditableI18nText i18nKey="offer:myOffers.reminder.setupTitle" value={t('offer:myOffers.reminder.setupTitle')} /></p>
                  <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-1">
                  {REMINDER_OPTIONS.map(option => {
                    const key = `${option.value}-${option.unit}`;
                    const isActive = activeReminders.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleReminder(option)}
                        disabled={saving}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Bell size={12} />
                          {t(option.labelKey)}
                        </span>
                        {isActive && <Check size={14} className="text-primary" />}
                      </button>
                    );
                  })}
                </div>
                {justSaved && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] text-emerald-600 font-medium text-center mt-2"
                  >
                    <EditableI18nText i18nKey="offer:myOffers.reminder.saved" value={t('offer:myOffers.reminder.saved')} />
                  </motion.p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OfferReminderButton;
