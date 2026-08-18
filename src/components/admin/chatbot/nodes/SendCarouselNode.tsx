import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { LayoutGrid } from 'lucide-react';

function SendCarouselNode({ data, selected }: any) {
    const elements = data.elements || [];
    return (
        <div className={`bg-white rounded-xl border-2 shadow-sm min-w-[180px] max-w-[220px] ${selected ? 'border-violet-500 shadow-violet-100' : 'border-violet-300'}`}>
            <Handle type="target" position={Position.Top} className="!bg-violet-500 !w-3 !h-3 !border-2 !border-white" />
            <div className="bg-violet-50 px-3 py-2 rounded-t-[10px] flex items-center gap-2">
                <div className="p-1 bg-violet-500 rounded-md">
                    <LayoutGrid className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-violet-800">Carousel</span>
            </div>
            <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{data.label || 'Carousel'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{elements.length} kart</p>
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-3 !h-3 !border-2 !border-white" />
        </div>
    );
}

export default memo(SendCarouselNode);
