import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Image } from 'lucide-react';

function SendImageNode({ data, selected }: any) {
    return (
        <div className={`bg-white rounded-xl border-2 shadow-sm min-w-[180px] max-w-[220px] ${selected ? 'border-indigo-500 shadow-indigo-100' : 'border-indigo-300'}`}>
            <Handle type="target" position={Position.Top} className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white" />
            <div className="bg-indigo-50 px-3 py-2 rounded-t-[10px] flex items-center gap-2">
                <div className="p-1 bg-indigo-500 rounded-md">
                    <Image className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-indigo-800">Görsel Gönder</span>
            </div>
            <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{data.label || 'Görsel'}</p>
                {data.imageUrl && (
                    <div className="mt-1.5 rounded-md overflow-hidden bg-slate-100 h-16 flex items-center justify-center">
                        <img src={data.imageUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                )}
                {data.caption && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{data.caption}</p>}
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white" />
        </div>
    );
}

export default memo(SendImageNode);
