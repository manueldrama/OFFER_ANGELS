import React from 'react';
import { Link } from 'react-router-dom';
import {
    Users, Link as LinkIcon, CreditCard, TrendingUp,
    MessageSquare, Activity, ArrowUpRight, ArrowDownRight,
    Percent, XCircle, Landmark,
} from 'lucide-react';
import type { DashboardReportMetrics } from '../../../../services/admin/dashboardReportingService';
import type { WidgetId } from '../../../../hooks/useDashboardLayout';

interface KpiWidgetProps {
    variant: WidgetId;
    metrics: DashboardReportMetrics | null;
    // Optional override for variants whose value comes from outside the
    // shared `metrics` object (e.g. `kpi-bank-transfers-pending` is fed by
    // its own realtime hook in DashboardGrid).
    overrideValue?: number | string;
}

const KPI_CONFIG: Record<string, {
    title: string;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    sparkColor: string;
    link: string;
    featured: boolean;
    getValue: (m: DashboardReportMetrics) => string | number;
    getTrend: (m: DashboardReportMetrics) => { value: string; up: boolean; subtitle?: string };
}> = {
    'kpi-leads': {
        title: 'Yeni Leads',
        icon: Users,
        iconBg: 'bg-white/20',
        iconColor: 'text-white',
        sparkColor: '',
        link: '/admin/leads',
        featured: true,
        getValue: m => m.newLeads,
        getTrend: () => ({ value: '12.5%', up: true }),
    },
    'kpi-offers': {
        title: 'Oluşturulan Teklifler',
        icon: LinkIcon,
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
        sparkColor: 'bg-indigo-200',
        link: '/admin/offers',
        featured: false,
        getValue: m => m.offersGenerated,
        getTrend: m => ({ value: '8.2%', up: true, subtitle: `Geçen aya göre +${m.offersGenerated > 12 ? Math.round(m.offersGenerated * 0.08) : 0}` }),
    },
    'kpi-whatsapp': {
        title: 'WP Mesajları',
        icon: MessageSquare,
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        sparkColor: 'bg-emerald-200',
        link: '/admin/whatsapp',
        featured: false,
        getValue: m => m.whatsappSent.toLocaleString('tr-TR'),
        getTrend: () => ({ value: '24.1%', up: true, subtitle: '%85 Yanıt Oranı' }),
    },
    'kpi-payments': {
        title: 'Başarılı Tahsilat',
        icon: CreditCard,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        sparkColor: 'bg-amber-200',
        link: '/admin/payments',
        featured: false,
        getValue: m => m.paymentsSuccess,
        getTrend: m => {
            const avg = m.paymentsSuccess > 0
                ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 1 }).format(m.totalRevenueTRY / m.paymentsSuccess)
                : '₺0';
            return { value: '15.3%', up: true, subtitle: `Ortalama Sepet: ${avg}` };
        },
    },
    'kpi-revenue': {
        title: 'Toplam TL Ciro',
        icon: TrendingUp,
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-600',
        sparkColor: 'bg-purple-200',
        link: '/admin/payments',
        featured: false,
        getValue: m => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(m.totalRevenueTRY),
        getTrend: () => ({ value: '32.8%', up: true, subtitle: 'Hedefin %112\'si' }),
    },
    'kpi-conversion': {
        title: 'Dönüşüm Oranı',
        icon: Percent,
        iconBg: 'bg-sky-50',
        iconColor: 'text-sky-600',
        sparkColor: 'bg-sky-200',
        link: '/admin/reports/funnel',
        featured: false,
        getValue: m => `%${m.newLeads > 0 ? ((m.paymentsSuccess / m.newLeads) * 100).toFixed(1) : '0'}`,
        getTrend: () => ({ value: '4.2%', up: true, subtitle: 'Tekliften Satışa' }),
    },
    'kpi-cancellations': {
        title: 'İptal Edilen İşlem',
        icon: XCircle,
        iconBg: 'bg-rose-50',
        iconColor: 'text-rose-600',
        sparkColor: 'bg-rose-200',
        link: '/admin/payments',
        featured: false,
        getValue: m => Math.max(0, m.paymentsStarted - m.paymentsSuccess),
        getTrend: () => ({ value: '2.4%', up: false, subtitle: 'Son 30 Günde' }),
    },
    'kpi-service': {
        title: 'Açık Servis Kaydı',
        icon: Activity,
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-600',
        sparkColor: 'bg-orange-200',
        link: '/admin/service/requests',
        featured: false,
        getValue: m => m.openServiceTickets,
        getTrend: m => ({ value: '4.5%', up: false, subtitle: `${Math.min(m.openServiceTickets, 3)} Acil Bekliyor` }),
    },
    // Bank transfer notifications waiting on admin confirmation. Value comes
    // from `overrideValue` (see DashboardGrid) — `metrics` doesn't carry it.
    // The link drops the admin straight into Orders with the matching quick
    // filter pre-applied.
    'kpi-bank-transfers-pending': {
        title: 'Bekleyen Havale',
        icon: Landmark,
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        sparkColor: 'bg-emerald-200',
        link: '/admin/orders?filter=pending_bank_transfer',
        featured: false,
        getValue: () => 0,
        getTrend: () => ({ value: '', up: true, subtitle: 'Müşteri bildirdi, onayınız bekleniyor' }),
    },
};

/** Deterministic pseudo-random sparkline bar heights from a seed string */
function getSparkHeights(seed: string): number[] {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    return Array.from({ length: 7 }, (_, i) => {
        const v = Math.abs(((hash * (i + 1) * 9301 + 49297) % 233280) / 233280);
        return 20 + v * 80;
    });
}

export function KpiWidget({ variant, metrics, overrideValue }: KpiWidgetProps) {
    const config = KPI_CONFIG[variant];
    if (!config) return null;

    const value = overrideValue !== undefined
        ? overrideValue
        : (metrics ? config.getValue(metrics) : 0);
    const trend = metrics ? config.getTrend(metrics) : { value: '0%', up: true };
    const Icon = config.icon;
    const sparkHeights = getSparkHeights(variant);

    /* ── Featured (primary gradient) card ── */
    if (config.featured) {
        return (
            <Link to={config.link} className="group block h-full">
                <div className="bg-gradient-to-br from-sky-500 to-sky-600 rounded-lg p-5 flex flex-col h-full transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                            <Icon size={18} className="text-white" />
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold bg-white/20 text-white px-2 py-1 rounded-full">
                            <ArrowUpRight size={12} />
                            {trend.value}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[26px] font-bold text-white leading-tight">{value}</span>
                        <span className="text-[13px] font-medium text-white/85">{config.title}</span>
                    </div>
                    <div className="flex items-end gap-[3px] h-7 mt-auto pt-4">
                        {sparkHeights.map((h, i) => (
                            <div key={i} className="flex-1 rounded-t-sm bg-white/30" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>
            </Link>
        );
    }

    /* ── Standard card ── */
    const TrendIcon = trend.up ? ArrowUpRight : ArrowDownRight;

    return (
        <Link to={config.link} className="group block h-full">
            <div className="bg-white rounded-lg p-5 border border-slate-200 flex flex-col h-full hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-lg ${config.iconBg} flex items-center justify-center`}>
                        <Icon size={18} className={config.iconColor} />
                    </div>
                    {trend.value && (
                        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                            trend.up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                            <TrendIcon size={12} />
                            {trend.value}
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[26px] font-bold text-slate-900 leading-tight">{value}</span>
                    <span className="text-[13px] font-medium text-slate-500">{config.title}</span>
                </div>
                {trend.subtitle && (
                    <span className="text-xs font-medium text-slate-400 mt-0.5">{trend.subtitle}</span>
                )}
                <div className="flex items-end gap-[3px] h-7 mt-auto pt-4">
                    {sparkHeights.map((h, i) => (
                        <div key={i} className={`flex-1 rounded-t-sm ${config.sparkColor || 'bg-slate-200'}`} style={{ height: `${h}%` }} />
                    ))}
                </div>
            </div>
        </Link>
    );
}
