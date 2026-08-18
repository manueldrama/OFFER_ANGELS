import React from 'react';
import { Pencil, Layers, Lock, Plus, FileCode2, User } from 'lucide-react';

type Mode = 'content' | 'structure';

interface Props {
    mode: Mode;
    onMode: (m: Mode) => void;
    canStructure: boolean;
    realRole: string | null;
    viewerRole: string;
    onViewerRole: (r: string) => void;
    onAddBlock: () => void;
    onExport: () => void;
}

export function EditorModeBar({
    mode, onMode, canStructure, realRole, viewerRole, onViewerRole, onAddBlock, onExport,
}: Props) {
    return (
        <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 shadow-lg">
                <div className="flex gap-0.5 rounded-full bg-slate-100 p-0.5">
                    <button
                        onClick={() => onMode('content')}
                        className={[
                            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors',
                            mode === 'content' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                        ].join(' ')}
                    >
                        <Pencil size={11} /> Hızlı düzenle
                    </button>
                    <button
                        onClick={() => canStructure && onMode('structure')}
                        disabled={!canStructure}
                        title={canStructure ? 'Yapı düzenle' : 'Yalnızca super_admin'}
                        className={[
                            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors',
                            mode === 'structure' && canStructure
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500',
                            !canStructure ? 'opacity-50' : '',
                        ].join(' ')}
                    >
                        <Layers size={11} /> Yapı düzenle
                        {!canStructure && <Lock size={10} />}
                    </button>
                </div>

                {realRole === 'super_admin' && (
                    <>
                        <span className="h-4 w-px bg-slate-200" />
                        <div className="flex items-center gap-1 pr-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Önizle
                            </span>
                            <select
                                value={viewerRole}
                                onChange={(e) => onViewerRole(e.target.value)}
                                title="Bu rol gibi görüntüle"
                                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
                            >
                                <option value="super_admin">Admin</option>
                                <option value="support_admin">Manager</option>
                                <option value="sales_admin">Satış Temsilcisi</option>
                            </select>
                        </div>
                    </>
                )}

                {mode === 'structure' && canStructure && (
                    <>
                        <span className="h-4 w-px bg-slate-200" />
                        <button
                            onClick={onAddBlock}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-indigo-700"
                        >
                            <Plus size={11} /> Yeni blok
                        </button>
                        <button
                            onClick={onExport}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-slate-800"
                        >
                            <FileCode2 size={11} /> JSON
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
