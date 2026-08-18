import React from 'react';
import { Eye, CreditCard, CalendarClock, Link2 } from 'lucide-react';
import { MetricCard } from '../../ui/MetricCard';
import type { OfferLinkGlobalStats } from '../../../services/admin/offerLinksService';

interface OffersMetricsProps {
    stats: OfferLinkGlobalStats | null;
    loading: boolean;
    /** "Süresi yaklaşan" kartına tıklayınca o filtreye geçer. */
    onFilterExpiringSoon?: () => void;
}

/**
 * Global KPI satırı — TÜM teklif linklerini kapsar (sayfa-bazlı değil).
 * Alt etiketler yalnız gerçek veriden gelir; sahte bağlam metni yoktur.
 */
export const OffersMetrics: React.FC<OffersMetricsProps> = ({ stats, loading, onFilterExpiringSoon }) => {
    const last7 = stats ? stats.weeklySeries.reduce((sum, p) => sum + p.opens, 0) : 0;
    const expiringSoon = stats?.expiringSoon ?? 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
                icon={Eye}
                title="Toplam açılma"
                value={stats?.totalOpens ?? 0}
                loading={loading}
                trend={stats?.weekTrend}
                sublabel={loading ? undefined : `Son 7 günde ${last7} açılma`}
            />
            <MetricCard
                icon={CreditCard}
                title="Ödeme sinyali"
                value={stats?.paymentSignals ?? 0}
                tone="success"
                loading={loading}
                sublabel={loading ? undefined : 'Ödeme adımına geçen link'}
            />
            <MetricCard
                icon={CalendarClock}
                title="Süresi yaklaşan"
                value={expiringSoon}
                tone={expiringSoon > 0 ? 'warning' : 'default'}
                loading={loading}
                sublabel={loading ? undefined : 'Önümüzdeki 3 gün içinde'}
                onClick={expiringSoon > 0 ? onFilterExpiringSoon : undefined}
            />
            <MetricCard
                icon={Link2}
                title="Aktif link"
                value={stats?.activeLinks ?? 0}
                loading={loading}
                sublabel={loading ? undefined : `${stats?.expiredLinks ?? 0} iptal edilmiş`}
            />
        </div>
    );
};
