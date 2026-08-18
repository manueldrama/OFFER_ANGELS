import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MousePointer2 } from 'lucide-react';

function SendButtonNode({ data, selected }: any) {
    const buttons = data.buttons || [];
    return (
        <div className={`bg-white rounded-xl border-2 shadow-sm min-w-[180px] max-w-[220px] ${selected ? 'border-cyan-500 shadow-cyan-100' : 'border-cyan-300'}`}>
            <Handle type="target" position={Position.Top} className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-white" />
            <div className="bg-cyan-50 px-3 py-2 rounded-t-[10px] flex items-center gap-2">
                <div className="p-1 bg-cyan-500 rounded-md">
                    <MousePointer2 className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-cyan-800">Butonlu Mesaj</span>
            </div>
            <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{data.label || 'Butonlu Mesaj'}</p>
                {data.message && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{data.message}</p>}
                {buttons.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2">
                        {buttons.map((btn: any, i: number) => (
                            <div key={btn.id || i} className="text-[10px] bg-cyan-100 text-cyan-700 px-2 py-1 rounded text-center font-medium">
                                {btn.title}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Each button gets its own source handle */}
            {buttons.length > 0 ? buttons.map((btn: any, i: number) => (
                <Handle
                    key={btn.id || i}
                    type="source"
                    position={Position.Bottom}
                    id={btn.id || `btn-${i}`}
                    className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-white"
                    style={{ left: `${((i + 1) / (buttons.length + 1)) * 100}%` }}
                />
            )) : (
                <Handle type="source" position={Position.Bottom} className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-white" />
            )}
        </div>
    );
}

export default memo(SendButtonNode);
