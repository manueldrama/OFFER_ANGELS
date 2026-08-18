import React from 'react';
import { createPortal } from 'react-dom';
import { X, Plus } from 'lucide-react';
import { BLOCK_TYPES, type BlockTypeId, type BlockColumn } from './schema/blocks';

interface Props {
    open: boolean;
    column: BlockColumn;
    onClose: () => void;
    onAdd: (type: BlockTypeId) => void;
}

export function BlockLibraryDialog({ open, column, onClose, onAdd }: Props) {
    if (!open) return null;
    const items = Object.entries(BLOCK_TYPES) as Array<[BlockTypeId, typeof BLOCK_TYPES[BlockTypeId]]>;
    const newOnes = items.filter(([, m]) => m.isNew);
    const existing = items.filter(([, m]) => !m.isNew);

    const dialog = (
        <div
            className="fixed inset-0 z-[200] grid place-items-center bg-slate-900/30 p-5"
            onClick={onClose}
        >
            <div
                className="flex max-h-[82vh] w-[640px] max-w-[92vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <div className="text-[15px] font-semibold text-slate-900">Blok Ekle</div>
                        <div className="mt-0.5 text-[12px] text-slate-500">
                            {column === 'right' ? 'Sağ kolona' : 'Sol kolona'} yeni blok ekle
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {newOnes.length > 0 && (
                        <>
                            <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">
                                Yeni Şablonlar
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {newOnes.map(([k, m]) => (
                                    <button
                                        key={k}
                                        onClick={() => onAdd(k)}
                                        className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-indigo-300 hover:bg-indigo-50/30"
                                    >
                                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-indigo-50 text-indigo-700">
                                            <Plus size={16} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[12.5px] font-semibold text-slate-900">{m.label}</div>
                                            <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{m.desc}</div>
                                        </div>
                                        <span className="rounded bg-emerald-50 px-1.5 py-[2px] text-[9px] font-bold tracking-wide text-emerald-700">
                                            YENİ
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="mt-5 mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">
                        Mevcut Bloklar (kopyala)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {existing.filter(([, m]) => !m.defaultLocked).map(([k, m]) => (
                            <button
                                key={k}
                                onClick={() => onAdd(k)}
                                className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-indigo-300 hover:bg-indigo-50/30"
                            >
                                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">
                                    <Plus size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[12.5px] font-semibold text-slate-900">{m.label}</div>
                                    <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{m.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(dialog, document.body);
}
