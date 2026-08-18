import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

function ConditionNode({ data, selected }: any) {
    return (
        <div className={`bg-white rounded-xl border-2 shadow-sm min-w-[180px] ${selected ? 'border-orange-500 shadow-orange-100' : 'border-orange-300'}`}>
            <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3 !border-2 !border-white" />
            <div className="bg-orange-50 px-3 py-2 rounded-t-[10px] flex items-center gap-2">
                <div className="p-1 bg-orange-500 rounded-md">
                    <GitBranch className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-orange-800">Koşul (If/Else)</span>
            </div>
            <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{data.label || 'Koşul'}</p>
                {data.field && (
                    <p className="text-xs text-slate-500 mt-0.5">{data.field} {data.operator} {data.value}</p>
                )}
            </div>
            <div className="flex justify-between px-3 pb-2">
                <span className="text-[10px] font-medium text-green-600">Evet</span>
                <span className="text-[10px] font-medium text-red-500">Hayır</span>
            </div>
            <Handle type="source" position={Position.Bottom} id="true" className="!bg-green-500 !w-3 !h-3 !border-2 !border-white" style={{ left: '30%' }} />
            <Handle type="source" position={Position.Bottom} id="false" className="!bg-red-500 !w-3 !h-3 !border-2 !border-white" style={{ left: '70%' }} />
        </div>
    );
}

export default memo(ConditionNode);
