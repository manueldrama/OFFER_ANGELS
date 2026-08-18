import React from 'react';
import type { ConversionStage } from '../../../services/admin/leadPoolService';

interface ConversionFlowProps {
    stages: ConversionStage[];
}

export function ConversionFlow({ stages }: ConversionFlowProps) {
    const maxCount = Math.max(...stages.map(s => s.count), 1);

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-5 lg:p-5">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-slate-900">Segment bazlı dönüşüm akışı</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
                Toplam lead kartına tıklandıktan sonra havuzun hangi aşamalarda yoğunlaştığını görebilecek genişletilmiş görünüm.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stages.map((stage, idx) => (
                    <div key={stage.key} className="space-y-2">
                        <div className="flex items-baseline justify-between">
                            <span className="text-xs font-semibold text-slate-600">{stage.label}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{stage.count} lead</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">%{stage.percent}</div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${stage.color}`}
                                style={{ width: `${Math.max((stage.count / maxCount) * 100, 4)}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
