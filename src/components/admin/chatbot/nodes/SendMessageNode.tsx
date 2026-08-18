import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';

function SendMessageNode({ data, selected }: any) {
    return (
        <div className={`bg-white rounded-xl border-2 shadow-sm min-w-[180px] max-w-[220px] ${selected ? 'border-blue-500 shadow-blue-100' : 'border-blue-300'}`}>
            <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
            <div className="bg-blue-50 px-3 py-2 rounded-t-[10px] flex items-center gap-2">
                <div className="p-1 bg-blue-500 rounded-md">
                    <MessageSquare className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-blue-800">Mesaj Gönder</span>
            </div>
            <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{data.label || 'Mesaj'}</p>
                {data.message && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-3 whitespace-pre-wrap">{data.message}</p>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
        </div>
    );
}

export default memo(SendMessageNode);
