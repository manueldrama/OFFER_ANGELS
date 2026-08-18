import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCode2, X, Copy, Check } from 'lucide-react';
import type { BlockInstance } from './schema/blocks';
import type { ContentMap } from './schema/fields';

interface Props {
    open: boolean;
    onClose: () => void;
    blocks: BlockInstance[];
    content: ContentMap;
    target: string;
    language: string;
}

export function ExportDrawer({ open, onClose, blocks, content, target, language }: Props) {
    const [copied, setCopied] = useState(false);
    if (!open) return null;

    const schema = {
        version: 1,
        target,
        language,
        blocks: blocks.map(b => ({
            id: b.id, type: b.type, visible: b.visible,
            locked: !!b.locked, column: b.column,
        })),
        content,
    };
    const json = JSON.stringify(schema, null, 2);

    const copy = () => {
        navigator.clipboard?.writeText(json).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        });
    };

    const drawer = (
        <div className="fixed inset-0 z-[200] flex justify-end bg-slate-900/20" onClick={onClose}>
            <div
                className="flex h-full w-[480px] flex-col bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
                    <div className="flex items-center gap-2">
                        <FileCode2 size={14} className="text-slate-700" />
                        <span className="text-[13px] font-semibold text-slate-900">Yapı + İçerik · JSON</span>
                    </div>
                    <div className="flex gap-1.5">
                        <button
                            onClick={copy}
                            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-indigo-700"
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Kopyalandı' : 'Kopyala'}
                        </button>
                        <button
                            onClick={onClose}
                            className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                        >
                            <X size={13} />
                        </button>
                    </div>
                </div>

                <pre className="flex-1 overflow-auto bg-slate-50 p-4 font-mono text-[11px] leading-relaxed text-slate-800">
                    {json}
                </pre>
            </div>
        </div>
    );

    return createPortal(drawer, document.body);
}
