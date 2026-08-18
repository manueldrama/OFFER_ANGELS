import React from 'react';
import { createPortal } from 'react-dom';
import { History, X, Check } from 'lucide-react';
import { FIELDS, type EditorFieldId, type ContentMap } from './schema/fields';

interface Props {
    open: boolean;
    onClose: () => void;
    dirtyMap: Partial<Record<EditorFieldId, boolean>>;
    data: ContentMap;
    savedData: ContentMap;
    onJump: (id: EditorFieldId) => void;
}

export function HistoryDrawer({ open, onClose, dirtyMap, data, savedData, onJump }: Props) {
    if (!open) return null;
    const dirtyKeys = Object.keys(dirtyMap).filter(k => dirtyMap[k as EditorFieldId]) as EditorFieldId[];

    const drawer = (
        <div className="fixed inset-0 z-[200] flex justify-end bg-slate-900/20" onClick={onClose}>
            <div
                className="flex h-full w-[420px] flex-col bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
                    <div className="flex items-center gap-2">
                        <History size={14} className="text-slate-700" />
                        <span className="text-[13px] font-semibold text-slate-900">Bekleyen Değişiklikler</span>
                        <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-indigo-50 px-1.5 text-[11px] font-semibold text-indigo-700">
                            {dirtyKeys.length}
                        </span>
                    </div>
                    <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50">
                        <X size={13} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    {dirtyKeys.length === 0 ? (
                        <div className="grid place-items-center py-10 text-center">
                            <Check size={28} className="text-emerald-600" />
                            <div className="mt-3 text-[13px] font-semibold text-slate-900">
                                Tüm değişiklikler kayıtlı
                            </div>
                            <div className="mt-1 text-[11.5px] text-slate-500">
                                Bir alana tıklayarak düzenlemeye başlayın.
                            </div>
                        </div>
                    ) : (
                        dirtyKeys.map(k => (
                            <button
                                key={k}
                                onClick={() => { onJump(k); onClose(); }}
                                className="mb-2 block w-full rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-left hover:bg-slate-50"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-semibold text-slate-900">
                                        {FIELDS[k]?.label ?? k}
                                    </span>
                                    <span className="ml-auto text-[10px] text-slate-500">az önce</span>
                                </div>
                                <div className="mt-1.5 font-mono text-[11px] leading-relaxed">
                                    <div className="text-rose-700/80 line-through opacity-70">
                                        − {savedData[k] || '(boş)'}
                                    </div>
                                    <div className="text-emerald-700">
                                        + {data[k] || '(boş)'}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(drawer, document.body);
}
