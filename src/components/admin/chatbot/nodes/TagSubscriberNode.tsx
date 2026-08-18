import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Tag } from 'lucide-react';

function TagSubscriberNode({ data, selected }: any) {
    return (
        <div className={`bg-white rounded-xl border-2 shadow-sm min-w-[160px] ${selected ? 'border-teal-500 shadow-teal-100' : 'border-teal-300'}`}>
            <Handle type="target" position={Position.Top} className="!bg-teal-500 !w-3 !h-3 !border-2 !border-white" />
            <div className="bg-teal-50 px-3 py-2 rounded-t-[10px] flex items-center gap-2">
                <div className="p-1 bg-teal-500 rounded-md">
                    <Tag className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-teal-800">Etiket {data.action === 'remove' ? 'Çıkar' : 'Ekle'}</span>
            </div>
            <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{data.label || 'Etiket'}</p>
                {data.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {data.tags.map((t: string, i: number) => (
                            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${data.action === 'remove' ? 'bg-red-100 text-red-700 line-through' : 'bg-teal-100 text-teal-700'}`}>
                                {t}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-teal-500 !w-3 !h-3 !border-2 !border-white" />
        </div>
    );
}

export default memo(TagSubscriberNode);
