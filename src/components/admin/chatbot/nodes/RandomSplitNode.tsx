import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Dice5 } from 'lucide-react';

function RandomSplitNode({ data, selected }: any) {
    const splits = data.splits || [];
    return (
        <div className={`bg-white rounded-xl border-2 shadow-sm min-w-[180px] ${selected ? 'border-pink-500 shadow-pink-100' : 'border-pink-300'}`}>
            <Handle type="target" position={Position.Top} className="!bg-pink-500 !w-3 !h-3 !border-2 !border-white" />
            <div className="bg-pink-50 px-3 py-2 rounded-t-[10px] flex items-center gap-2">
                <div className="p-1 bg-pink-500 rounded-md">
                    <Dice5 className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-pink-800">Rastgele Dağılım</span>
            </div>
            <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{data.label || 'A/B Test'}</p>
                {splits.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {splits.map((s: any) => (
                            <span key={s.id} className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded">
                                {s.label}: %{s.percentage}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            {splits.length > 0 ? splits.map((s: any, i: number) => (
                <Handle
                    key={s.id}
                    type="source"
                    position={Position.Bottom}
                    id={s.id}
                    className="!bg-pink-500 !w-3 !h-3 !border-2 !border-white"
                    style={{ left: `${((i + 1) / (splits.length + 1)) * 100}%` }}
                />
            )) : (
                <Handle type="source" position={Position.Bottom} className="!bg-pink-500 !w-3 !h-3 !border-2 !border-white" />
            )}
        </div>
    );
}

export default memo(RandomSplitNode);
