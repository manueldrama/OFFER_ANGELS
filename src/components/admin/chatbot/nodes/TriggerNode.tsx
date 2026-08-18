import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Zap, MessageSquare, AtSign, UserPlus, Hand } from 'lucide-react';

const TRIGGER_ICONS: Record<string, any> = {
    keyword: MessageSquare,
    comment_keyword: AtSign,
    story_mention: Zap,
    new_follower: UserPlus,
    manual: Hand,
};

const TRIGGER_LABELS: Record<string, string> = {
    keyword: 'Anahtar Kelime',
    comment_keyword: 'Yorum Anahtar Kelime',
    story_mention: 'Story Mention',
    new_follower: 'Yeni Takipçi',
    manual: 'Manuel Tetikle',
};

function TriggerNode({ data, selected }: any) {
    const Icon = TRIGGER_ICONS[data.triggerType] || Zap;
    return (
        <div className={`bg-white rounded-xl border-2 shadow-sm min-w-[180px] ${selected ? 'border-green-500 shadow-green-100' : 'border-green-300'}`}>
            <div className="bg-green-50 px-3 py-2 rounded-t-[10px] flex items-center gap-2">
                <div className="p-1 bg-green-500 rounded-md">
                    <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-green-800">Tetikleyici</span>
            </div>
            <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{data.label || 'Tetikleyici'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{TRIGGER_LABELS[data.triggerType] || data.triggerType}</p>
                {data.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {data.keywords.slice(0, 3).map((kw: string, i: number) => (
                            <span key={i} className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{kw}</span>
                        ))}
                        {data.keywords.length > 3 && <span className="text-[10px] text-slate-400">+{data.keywords.length - 3}</span>}
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3 !border-2 !border-white" />
        </div>
    );
}

export default memo(TriggerNode);
