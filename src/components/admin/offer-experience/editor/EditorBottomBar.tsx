import React from 'react';
import { Smartphone, Tablet, Monitor, Check } from 'lucide-react';

interface Props {
    device: 'mobile' | 'tablet' | 'desktop';
    onDevice: (d: 'mobile' | 'tablet' | 'desktop') => void;
    zoom: number;
    onZoom: (z: number) => void;
    dirty: number;
    lastSavedLabel: string;
}

const DEVICES: Array<{ id: 'mobile' | 'tablet' | 'desktop'; label: string; Icon: typeof Smartphone }> = [
    { id: 'mobile', label: 'Mobil', Icon: Smartphone },
    { id: 'tablet', label: 'Tablet', Icon: Tablet },
    { id: 'desktop', label: 'Desktop', Icon: Monitor },
];

export function EditorBottomBar({ device, onDevice, zoom, onZoom, dirty, lastSavedLabel }: Props) {
    return (
        <div className="flex h-12 shrink-0 items-center gap-4 border-t border-slate-200 bg-white px-4">
            <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
                {DEVICES.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        onClick={() => onDevice(id)}
                        className={[
                            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                            device === id
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700',
                        ].join(' ')}
                    >
                        <Icon size={13} />
                        {label}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => onZoom(Math.max(0.4, zoom - 0.1))}
                    className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                    −
                </button>
                <span className="w-10 text-center font-mono text-[11.5px] text-slate-700">
                    {Math.round(zoom * 100)}%
                </span>
                <button
                    onClick={() => onZoom(Math.min(1.5, zoom + 0.1))}
                    className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                    +
                </button>
                <button
                    onClick={() => onZoom(0.8)}
                    className="ml-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                >
                    Sığdır
                </button>
            </div>

            <div className="ml-auto flex items-center gap-3">
                {dirty > 0 ? (
                    <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-orange-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-600" />
                        {dirty} bekleyen değişiklik
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-700">
                        <Check size={12} />
                        Senkronize
                    </span>
                )}
                <span className="text-[11px] text-slate-500">{lastSavedLabel}</span>
            </div>
        </div>
    );
}
