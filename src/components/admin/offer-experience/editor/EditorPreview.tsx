import React from 'react';
import { ArrowRight, Copy, FileDown, ArrowLeft } from 'lucide-react';
import { LayoutRenderer } from './LayoutRenderer';
import { Editable } from './Editable';
import type { BlockInstance } from './schema/blocks';

const DEVICE_WIDTH: Record<string, number> = {
    mobile: 390,
    tablet: 820,
    desktop: 1240,
};

interface Props {
    blocks: BlockInstance[];
    /** Mobil/tablet önizlemede blok sırasını belirleyen bağımsız id dizisi. */
    mobileOrder: string[];
    device: 'mobile' | 'tablet' | 'desktop';
    zoom: number;
    structureMode: boolean;
    activeBlockId: string | null;
    onBlockClick?: (id: string) => void;
}

export function EditorPreview({
    blocks, mobileOrder, device, zoom, structureMode, activeBlockId, onBlockClick,
}: Props) {
    const width = DEVICE_WIDTH[device];

    return (
        <div className="flex-1 overflow-auto bg-slate-100/70 p-6">
            <div className="mx-auto" style={{ width }}>
                {/* Stage meta */}
                <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span className="font-medium uppercase tracking-wider">Canlı Önizleme</span>
                    </div>
                    <div className="font-mono text-[10.5px]">
                        {device} · {Math.round(zoom * 100)}%
                    </div>
                </div>

                <div
                    className="origin-top overflow-hidden rounded-md border border-slate-200/80 bg-slate-50/30 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.08)]"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                >
                    {/* Header — minimal sticky-style */}
                    <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
                        <div className="text-[15px] font-black tracking-tight text-slate-900">CAFEPASTE</div>
                        <nav className={`${device === 'desktop' ? 'hidden md:flex' : 'hidden'} items-center gap-6 text-[12px] font-medium text-slate-600`}>
                            <Editable id="nav1" />
                            <Editable id="nav2" />
                            <Editable id="nav3" />
                            <Editable id="nav4" />
                        </nav>
                        <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700">
                            🇩🇪 DE
                        </span>
                    </header>

                    {/* Body — two-column with real-page rhythm */}
                    <div className="bg-slate-50/60 p-6">
                        <LayoutRenderer
                            blocks={blocks}
                            mobileOrder={mobileOrder}
                            mode="editor"
                            device={device}
                            activeBlockId={activeBlockId}
                            onBlockClick={onBlockClick}
                            showStructureChrome={structureMode}
                        />
                    </div>

                    {/* Sticky bottom bar — dark glass, primary CTA */}
                    <footer className="sticky bottom-0 border-t border-slate-200/50 bg-white/90 px-6 py-3 backdrop-blur-2xl shadow-[0_-10px_40px_rgb(0,0,0,0.05)]">
                        <div className="flex items-center justify-between gap-3">
                            {/* Left actions */}
                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm">
                                    <ArrowLeft size={12} className="text-slate-400" />
                                    <Editable id="back_btn" />
                                </button>
                                <button className="flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm">
                                    <Copy size={12} className="text-slate-400" />
                                    <Editable id="copy_btn" />
                                </button>
                                <button className="flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm">
                                    <FileDown size={12} className="text-slate-400" />
                                    <Editable id="pdf_btn" />
                                </button>
                            </div>

                            {/* Right total + CTA */}
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <Editable id="bottom_total_label" className="block text-[10px] font-semibold opacity-70 text-slate-400" />
                                    <span className="text-[20px] font-bold leading-none tracking-tight tabular-nums text-slate-900">
                                        178.500 €
                                    </span>
                                </div>
                                <button className="group flex items-center gap-2.5 rounded-md bg-slate-900 px-6 py-3 text-[13px] font-bold text-white shadow-lg shadow-primary/20 active:scale-[0.98]">
                                    <Editable id="confirm_btn" />
                                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                                </button>
                            </div>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}
