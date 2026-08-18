import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { DashboardReportMetrics } from '../../../../services/admin/dashboardReportingService';

interface FunnelWidgetProps {
    metrics: DashboardReportMetrics | null;
    // reports/funnel temsilciye kapalı — temsilci dashboard'unda linki gizle.
    hideDetailLink?: boolean;
}

const FUNNEL_COLORS = [
    'bg-sky-100',   // Ziyaretçi / Yeni Lead
    'bg-sky-400',   // Teklif Oluşturuldu
    'bg-emerald-400', // Link Açıldı
    'bg-indigo-400',  // Ödeme Başarılı
];

const BADGE_COLORS = [
    'bg-sky-100 text-sky-700',
    'bg-sky-100 text-sky-700',
    'bg-emerald-100 text-emerald-700',
    'bg-indigo-100 text-indigo-700',
];

export function FunnelWidget({ metrics, hideDetailLink }: FunnelWidgetProps) {
    const funnel = metrics?.funnel || [];
    const maxCount = Math.max(...funnel.map(f => f.count), 1);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">Satış Hunisi</h3>
                {!hideDetailLink && (
                    <Link to="/admin/reports/funnel" className="text-sky-500 text-[13px] font-medium flex items-center gap-1 hover:text-sky-700 transition-colors">
                        Detay <ArrowRight size={14} />
                    </Link>
                )}
            </div>

            {/* Funnel Items */}
            <div className="flex flex-col gap-5 mt-2">
                {funnel.map((step, idx) => {
                    const widthPercent = (step.count / maxCount) * 100;
                    return (
                        <div key={idx} className="flex flex-col">
                            <div className="flex justify-between mb-2 text-sm font-semibold text-slate-800">
                                <span>{step.stage}</span>
                                <span>{step.count.toLocaleString('tr-TR')}</span>
                            </div>
                            <div className="h-7 bg-slate-100 rounded-lg relative flex items-center overflow-hidden">
                                <div
                                    className={`h-full absolute left-0 top-0 rounded-lg transition-all duration-500 ${FUNNEL_COLORS[idx] || FUNNEL_COLORS[0]}`}
                                    style={{ width: `${Math.max(widthPercent, 3)}%` }}
                                />
                                {idx > 0 && (
                                    <span className={`relative z-10 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ml-2 ${BADGE_COLORS[idx] || BADGE_COLORS[0]}`}>
                                        %{step.conversionRate} Dönüşüm
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Net Conversion */}
            <div className="mt-auto pt-5 border-t border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-1">Net Dönüşüm (Lead → Ödeme)</p>
                <span className="text-4xl font-black text-slate-800">
                    {metrics?.newLeads ? Math.round(((metrics?.paymentsSuccess || 0) / metrics.newLeads) * 100) : 0}%
                </span>
            </div>
        </div>
    );
}
