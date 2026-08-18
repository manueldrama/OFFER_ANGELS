import { useTranslation } from 'react-i18next';
import { getRemainingTime, getOfferStatus, RemainingTimeLabels, OfferStatusLabels, OfferStatus } from '../components/offer/my-offers/offerTimeUtils';

/**
 * i18n-aware wrapper around the pure offerTimeUtils helpers.
 *
 * Returns the same `getRemainingTime` and `getOfferStatus` functions but
 * pre-bound with the localized labels for the active language. Use this in
 * components that render offer cards / status pills so all status text
 * respects the current language.
 */
export function useOfferStatusLabels() {
    const { t } = useTranslation('offer');

    const remainingLabels: RemainingTimeLabels = {
        expired: t('offer:time.expired'),
        days: t('offer:time.days'),
        hours: t('offer:time.hours'),
        minutes: t('offer:time.minutes'),
    };

    const statusLabels: OfferStatusLabels = {
        depositPaid: t('offer:offerStatus.depositPaid'),
        bankPending: t('offer:offerStatus.bankPending'),
        paymentPending: t('offer:offerStatus.paymentPending'),
        expired: t('offer:offerStatus.expired'),
        expiringToday: t('offer:offerStatus.expiringToday'),
        active: t('offer:offerStatus.active'),
    };

    // Dynamic banner formatters (interpolated countdown variants)
    const formatBankPendingLastDays = (days: number) =>
        t('offer:offerStatus.bankPendingLastDays', { days, defaultValue: `Havale bekleniyor — son ${days} gün!` });
    const formatDepositPaidRemainingDays = (days: number) =>
        t('offer:offerStatus.depositPaidRemainingDays', { days, defaultValue: `Kapora ödendi · Kalan ödeme için ${days} gün kaldı` });
    const formatDepositCriticalLastDays = (days: number) =>
        t('offer:offerStatus.depositCriticalLastDays', { days, defaultValue: `⚠️ Kalan ödeme için son ${days} gün!` });
    const depositPaidWaiting = t('offer:offerStatus.depositPaidWaiting', { defaultValue: 'Kapora ödendi · Kalan ödeme bekleniyor' });
    const priceLockExpired = t('offer:offerStatus.priceLockExpired', { defaultValue: 'Fiyat güncellendi · Ödeme bekleniyor' });

    return {
        labels: { ...remainingLabels, ...statusLabels },
        getRemainingTime: (validUntil: string) => getRemainingTime(validUntil, remainingLabels),
        getOfferStatus: (opts: Parameters<typeof getOfferStatus>[0]): OfferStatus =>
            getOfferStatus(opts, statusLabels),
        formatBankPendingLastDays,
        formatDepositPaidRemainingDays,
        formatDepositCriticalLastDays,
        depositPaidWaiting,
        priceLockExpired,
    };
}
