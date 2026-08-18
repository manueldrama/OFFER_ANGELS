import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, ChevronUp, ChevronDown, Keyboard, Loader2 } from 'lucide-react';
import { FIELDS, type EditorFieldId } from './schema/fields';
import { getBrandHints } from './schema/brandHints';

interface Props {
    activeId: EditorFieldId | null;
    value: string;
    valueAlt: string;
    dualLang: boolean;
    lang: string;
    langAlt: string;
    dirty: boolean;
    anchorRect: DOMRect | null;
    onChange: (v: string) => void;
    onChangeAlt: (v: string) => void;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    onAiTranslate: () => void;
    translating?: boolean;
}

const EDITOR_WIDTH = 380;
const MARGIN = 12;

export function InlineEditorPopover({
    activeId, value, valueAlt, dualLang, lang, langAlt, dirty,
    anchorRect, onChange, onChangeAlt, onClose, onPrev, onNext, onAiTranslate, translating,
}: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

    useEffect(() => {
        if (activeId) {
            // Defer to allow position to settle
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [activeId]);

    const position = useMemo(() => {
        if (!anchorRect) return null;
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        let left = anchorRect.right + MARGIN;
        let top = anchorRect.top;
        if (left + EDITOR_WIDTH > vw - 16) {
            left = anchorRect.left - EDITOR_WIDTH - MARGIN;
        }
        if (left < 16) {
            left = Math.max(16, Math.min(anchorRect.left, vw - EDITOR_WIDTH - 16));
            top = anchorRect.bottom + MARGIN;
        }
        top = Math.max(16, Math.min(top, vh - 360));
        return { left, top };
    }, [anchorRect]);

    if (!activeId || !anchorRect || !position) return null;
    const meta = FIELDS[activeId];
    if (!meta) return null;

    const max = meta.max ?? 80;
    const len = (value ?? '').length;
    const lenAlt = (valueAlt ?? '').length;
    const overlimit = len > max;

    const brandHints = getBrandHints(activeId, value);

    const FieldEl = meta.multiline ? 'textarea' : 'input';

    const popover = (
        <>
            {/* Connector line */}
            <div
                className="fixed z-[90] pointer-events-none h-0.5"
                style={{
                    left: anchorRect.right,
                    top: anchorRect.top + anchorRect.height / 2 - 1,
                    width: Math.max(0, position.left - anchorRect.right),
                    background: 'linear-gradient(90deg, rgb(79 70 229), rgb(79 70 229 / 0.2))',
                }}
            />

            <div
                ref={ref}
                data-inline-editor
                className="fixed z-[95] w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-16px_rgba(15,12,40,0.25),0_4px_12px_-4px_rgba(15,12,40,0.08)]"
                style={{ left: position.left, top: position.top }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Head */}
                <div className="flex items-center gap-2 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-3 py-2.5">
                    <div className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
                        Metin
                    </div>
                    <div className="flex-1 truncate text-[13px] font-semibold text-slate-900">{meta.label}</div>
                    <button onClick={onPrev} title="Önceki alan" className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
                        <ChevronUp size={13} />
                    </button>
                    <button onClick={onNext} title="Sonraki alan" className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
                        <ChevronDown size={13} />
                    </button>
                    <button onClick={onClose} title="Kapat (Esc)" className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
                        <X size={13} />
                    </button>
                </div>

                {/* Path breadcrumb */}
                {meta.path && (
                    <div className="px-3 pt-2 font-mono text-[10.5px] text-slate-500">
                        › {meta.path}
                    </div>
                )}

                <div className="p-3">
                    {/* TR row */}
                    <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-700">
                            <span>🇹🇷</span> {lang.toUpperCase()}
                            {dirty && <span className="rounded bg-orange-50 px-1.5 py-[2px] text-[9.5px] font-semibold uppercase tracking-wide text-orange-700">düzenlendi</span>}
                        </div>
                        <div className={`font-mono text-[11px] ${overlimit ? 'text-orange-600' : 'text-slate-500'}`}>{len}/{max}</div>
                    </div>
                    <FieldEl
                        ref={inputRef as any}
                        autoFocus
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        rows={meta.multiline ? 3 : undefined}
                        className={[
                            'w-full rounded-lg border-[1.5px] bg-white px-3 py-2.5 text-[13.5px] text-slate-900 outline-none transition-colors',
                            'focus:border-indigo-600',
                            overlimit ? 'border-orange-600' : 'border-slate-200',
                            meta.multiline ? 'min-h-[64px] resize-y' : '',
                        ].join(' ')}
                    />

                    {meta.hint && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11.5px] text-slate-600">
                            <span>💡</span>
                            <span>{meta.hint}</span>
                        </div>
                    )}

                    {brandHints.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {brandHints.map((h, i) => (
                                <div
                                    key={i}
                                    className={[
                                        'flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px]',
                                        h.severity === 'warn'
                                            ? 'bg-orange-50 text-orange-800'
                                            : 'bg-amber-50 text-amber-800',
                                    ].join(' ')}
                                >
                                    <span>⚠</span>
                                    <span>{h.rule}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Dual-lang section */}
                    {dualLang && (
                        <>
                            <div className="mt-3.5 flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-700">
                                    <span>🇫🇷</span> {langAlt.toUpperCase()}
                                    {!valueAlt && <span className="rounded bg-orange-50 px-1.5 py-[2px] text-[9.5px] font-semibold text-orange-700">çeviri eksik</span>}
                                </div>
                                <button
                                    onClick={onAiTranslate}
                                    disabled={translating || !value}
                                    className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                                >
                                    {translating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                    {translating ? 'Çevriliyor…' : 'AI ile çevir'}
                                </button>
                            </div>
                            <FieldEl
                                value={valueAlt ?? ''}
                                onChange={(e) => onChangeAlt(e.target.value)}
                                rows={meta.multiline ? 3 : undefined}
                                placeholder={`${langAlt.toUpperCase()} çeviri…`}
                                className={[
                                    'mt-1.5 w-full rounded-lg border-[1.5px] border-slate-200 bg-slate-50 px-3 py-2.5 text-[13.5px] text-slate-900 outline-none focus:border-indigo-600',
                                    meta.multiline ? 'min-h-[64px] resize-y' : '',
                                ].join(' ')}
                            />
                            <div className="mt-1 text-right font-mono text-[10.5px] text-slate-400">{lenAlt} char</div>
                        </>
                    )}

                    <div className="mt-2.5 border-t border-slate-200 pt-2.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
                            <Keyboard size={11} />
                            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-[1px] font-mono text-[9.5px] text-slate-600">Esc</kbd>
                            <span>kapat</span>
                            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-[1px] font-mono text-[9.5px] text-slate-600">Tab</kbd>
                            <span>sonraki</span>
                            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-[1px] font-mono text-[9.5px] text-slate-600">⌘S</kbd>
                            <span>kaydet</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(popover, document.body);
}
