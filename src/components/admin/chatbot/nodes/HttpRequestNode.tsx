import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Globe } from 'lucide-react';

function HttpRequestNode({ data, selected }: any) {
    return (
        <div className={`bg-white rounded-xl border-2 shadow-sm min-w-[180px] max-w-[220px] ${selected ? 'border-slate-600 shadow-slate-100' : 'border-slate-400'}`}>
            <Handle type="target" position={Position.Top} className="!bg-slate-600 !w-3 !h-3 !border-2 !border-white" />
            <div className="bg-slate-100 px-3 py-2 rounded-t-[10px] flex items-center gap-2">
                <div className="p-1 bg-slate-600 rounded-md">
                    <Globe className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-slate-700">HTTP İsteği</span>
            </div>
            <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{data.label || 'API Çağrısı'}</p>
                {data.method && data.url && (
                    <div className="mt-1 flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            data.method === 'GET' ? 'bg-green-100 text-green-700' :
                            data.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                        }`}>{data.method}</span>
                        <span className="text-[10px] text-slate-500 truncate">{data.url}</span>
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-slate-600 !w-3 !h-3 !border-2 !border-white" />
        </div>
    );
}

export default memo(HttpRequestNode);
