import React from 'react';

interface Step {
    stage: string;
    count: number;
    conversionRate: number;
}

export function FunnelChart({ data }: { data: Step[] }) {
    if (!data || data.length === 0) return <div className="text-slate-500 text-sm">Veri bulunamadı.</div>;

    const maxCount = Math.max(...data.map(d => d.count));

    return (
        <div className="flex flex-col gap-4">
            {data.map((step, idx) => {
                const widthPercent = maxCount > 0 ? (step.count / maxCount) * 100 : 0;

                return (
                    <div key={idx} className="relative">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-semibold text-slate-700">{step.stage}</span>
                            <span className="text-slate-500 font-medium">{step.count}</span>
                        </div>
                        <div className="h-8 bg-slate-100 rounded-md overflow-hidden flex items-center shadow-inner relative">
                            <div
                                className={`h-full transition-all duration-500 ${getColorForIndex(idx)}`}
                                style={{ width: `${Math.max(widthPercent, 2)}%` }} // min width so it's visible
                            />
                            {/* Conversion Rate Bubble */}
                            {idx > 0 && (
                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white bg-black/20 px-1.5 py-0.5 rounded">
                                    %{step.conversionRate} Dönüşüm
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function getColorForIndex(index: number) {
    const colors = [
        'bg-blue-400',
        'bg-indigo-400',
        'bg-purple-400',
        'bg-pink-400',
        'bg-green-400',
        'bg-emerald-400'
    ];
    return colors[index % colors.length];
}
