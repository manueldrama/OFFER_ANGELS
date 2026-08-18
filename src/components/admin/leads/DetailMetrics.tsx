import React from 'react';
import type { DetailMetric } from '../../../services/admin/leadPoolService';

interface DetailMetricsProps {
    metrics: DetailMetric[];
}

export function DetailMetrics({ metrics }: DetailMetricsProps) {
    return (
        <div className="space-y-3">
            <div>
                <h3 className="text-sm font-bold text-slate-900">Daha fazla detay</h3>
                <p className="text-xs text-slate-500">Lead havuzunu değerlendirmek için sıcaklık, hız ve yanıt performansı gibi ek sinyaller.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {metrics.map((metric, i) => (
                    <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                        <p className="text-xs font-bold text-slate-700">{metric.label}</p>
                        <p className={`text-3xl font-black ${metric.color}`}>{metric.value}</p>
                        <p className="text-[10px] text-slate-400 leading-tight">{metric.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
