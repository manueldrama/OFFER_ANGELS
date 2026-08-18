import React, { useState, useRef, useEffect } from 'react';
import { Check, RotateCcw, Plus } from 'lucide-react';
import { WIDGET_META, type WidgetId } from '../../../hooks/useDashboardLayout';

interface EditModeToolbarProps {
    onDone: () => void;
    onReset: () => void;
    hiddenWidgets: readonly WidgetId[];
    onAddWidget: (id: WidgetId) => void;
}

export function EditModeToolbar({ onDone, onReset, hiddenWidgets, onAddWidget }: EditModeToolbarProps) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!pickerOpen) return;
        const onClick = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [pickerOpen]);

    const addDisabled = hiddenWidgets.length === 0;

    return (
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
            <span className="text-xs font-semibold text-indigo-700 flex-1">
                Modülleri sürükleyerek yeniden düzenleyebilir, X ile gizleyebilirsiniz
            </span>

            <div className="relative" ref={pickerRef}>
                <button
                    onClick={() => !addDisabled && setPickerOpen(p => !p)}
                    disabled={addDisabled}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                        addDisabled
                            ? 'text-slate-400 bg-white/40 cursor-not-allowed'
                            : 'text-indigo-700 bg-white hover:bg-indigo-100 cursor-pointer'
                    }`}
                    title={addDisabled ? 'Tüm modüller görünür' : 'Gizli modülleri ekle'}
                >
                    <Plus size={13} />
                    Modül Ekle
                    {!addDisabled && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                            {hiddenWidgets.length}
                        </span>
                    )}
                </button>

                {pickerOpen && !addDisabled && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gizli Modüller</p>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {hiddenWidgets.map(id => {
                                const meta = WIDGET_META[id];
                                return (
                                    <button
                                        key={id}
                                        onClick={() => { onAddWidget(id); setPickerOpen(false); }}
                                        className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 last:border-b-0"
                                    >
                                        <Plus size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-semibold text-slate-800 leading-tight">{meta.label}</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{meta.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <button
                onClick={onReset}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
            >
                <RotateCcw size={13} />
                Sıfırla
            </button>
            <button
                onClick={onDone}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
                <Check size={13} />
                Bitti
            </button>
        </div>
    );
}
