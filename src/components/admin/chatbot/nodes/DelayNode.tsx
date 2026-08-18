import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';

const UNIT_LABELS: Record<string, string> = {
    minutes: 'dakika',
    hours: 'saat',
    days: 'gün',
};

function DelayNode({ data, selected }: any) {
    return (
        <div className={`bg-white rounded-xl border-2 shadow-sm min-w-[160px] ${selected ? 'border-amber-500 shadow-amber-100' : 'border-amber-300'}`}>
            <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white" />
            <div className="bg-amber-50 px-3 py-2 rounded-t-[10px] flex items-center gap-2">
                <div className="p-1 bg-amber-500 rounded-md">
                    <Clock className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-amber-800">Bekleme</span>
            </div>
            <div className="px-3 py-2 text-center">
                <p className="text-lg font-bold text-slate-900">{data.duration || 0}</p>
                <p className="text-xs text-slate-500">{UNIT_LABELS[data.unit] || data.unit || 'dakika'}</p>
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white" />
        </div>
    );
}

export default memo(DelayNode);
