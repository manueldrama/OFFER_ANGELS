const TR_MONTHS: Record<string, number> = {
  'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
  'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11,
};

/**
 * Parse Turkish date string in either format:
 * - "1.04.2026" (dot-separated)
 * - "1 Nisan 2026" (long Turkish format)
 */
export function parseTurkishDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try dot format: "1.04.2026"
  const dotParts = dateStr.split('.');
  if (dotParts.length === 3) {
    const d = new Date(+dotParts[2], +dotParts[1] - 1, +dotParts[0], 23, 59, 59);
    if (!isNaN(d.getTime())) return d;
  }

  // Try long Turkish format: "1 Nisan 2026"
  const spaceParts = dateStr.trim().split(/\s+/);
  if (spaceParts.length === 3) {
    const month = TR_MONTHS[spaceParts[1].toLowerCase()];
    if (month !== undefined) {
      const d = new Date(+spaceParts[2], month, +spaceParts[0], 23, 59, 59);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Try native Date parse as last resort
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  return null;
}

export interface RemainingTimeLabels {
  expired: string;
  days: string;
  hours: string;
  minutes: string;
}

const DEFAULT_LABELS: RemainingTimeLabels = {
  expired: 'Süre doldu',
  days: 'gün',
  hours: 'saat',
  minutes: 'dk',
};

export function getRemainingTime(validUntil: string, labels: RemainingTimeLabels = DEFAULT_LABELS): string {
  const target = parseTurkishDate(validUntil);
  if (!target) return validUntil;

  const diff = target.getTime() - Date.now();
  if (diff <= 0) return labels.expired;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days} ${labels.days} ${String(hours).padStart(2, '0')} ${labels.hours} ${String(mins).padStart(2, '0')} ${labels.minutes}`;
  return `${String(hours).padStart(2, '0')} ${labels.hours} ${String(mins).padStart(2, '0')} ${labels.minutes}`;
}

export function isExpiringSoon(validUntil: string): boolean {
  const target = parseTurkishDate(validUntil);
  if (!target) return false;

  const diff = target.getTime() - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

export function getTimePercentage(createdAt: string, expiryDate: string): number {
  const created = new Date(createdAt).getTime();
  const expiry = parseTurkishDate(expiryDate)?.getTime() || new Date(expiryDate).getTime();
  const now = Date.now();
  if (now >= expiry) return 0;
  const total = expiry - created;
  if (total <= 0) return 0;
  const remaining = expiry - now;
  return Math.max(0, Math.min(100, (remaining / total) * 100));
}

export type UrgencyTier = 'calm' | 'notice' | 'warning' | 'urgent' | 'critical' | 'expired';

export function getUrgencyTier(validUntil: string): UrgencyTier {
  const target = parseTurkishDate(validUntil);
  if (!target) return 'calm';
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const hours = diff / (1000 * 60 * 60);
  if (hours <= 1) return 'critical';
  if (hours <= 6) return 'urgent';
  if (hours <= 24) return 'warning';
  if (hours <= 72) return 'notice';
  return 'calm';
}

export type OfferStatusVariant = 'green' | 'amber' | 'orange' | 'red' | 'blue';

export interface OfferStatus {
  label: string;
  variant: OfferStatusVariant;
}

export interface OfferStatusLabels {
  depositPaid: string;
  bankPending: string;
  paymentPending: string;
  expired: string;
  expiringToday: string;
  active: string;
}

const DEFAULT_STATUS_LABELS: OfferStatusLabels = {
  depositPaid: 'Kapora Ödendi',
  bankPending: 'Havale Bekleniyor',
  paymentPending: 'Ödeme Bekliyor',
  expired: 'Süresi Doldu',
  expiringToday: 'Bugün Bitiyor',
  active: 'Aktif',
};

export function getOfferStatus(opts: {
  hasReservation: boolean;
  isExpired: boolean;
  expiringSoon: boolean;
  reservationStatus?: string;
  paymentMethod?: string;
}, labels: OfferStatusLabels = DEFAULT_STATUS_LABELS): OfferStatus {
  if (opts.hasReservation) {
    const s = opts.reservationStatus || 'pending';
    if (s === 'deposit_paid' || s === 'price_lock_expired') return { label: labels.depositPaid, variant: 'blue' };
    if (opts.paymentMethod === 'bank-transfer' && s === 'pending') return { label: labels.bankPending, variant: 'amber' };
    return { label: labels.paymentPending, variant: 'amber' };
  }
  if (opts.isExpired) return { label: labels.expired, variant: 'red' };
  if (opts.expiringSoon) return { label: labels.expiringToday, variant: 'orange' };
  return { label: labels.active, variant: 'green' };
}
