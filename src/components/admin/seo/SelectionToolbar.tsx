// SelectionToolbar — floating format bar shown when text is selected inside a
// Studio canvas text block (Faz C). Operates on the live selection via
// execCommand and dispatches a native 'input' event so the owning
// CanvasTextBlock commits the change through its normal onInput path.

import { useCallback, useEffect, useState } from 'react';
import { Bold, Italic, Link2, Code, Eraser } from 'lucide-react';

function activeTextEl(): Element | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const node = sel.anchorNode;
    const el = node instanceof Element ? node : node?.parentElement;
    return el?.closest('[data-canvas-text]') ?? null;
}

export function SelectionToolbar() {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        const onSel = () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
                setPos(null);
                return;
            }
            if (!activeTextEl()) {
                setPos(null);
                return;
            }
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                setPos(null);
                return;
            }
            setPos({ top: rect.top - 46, left: rect.left + rect.width / 2 });
        };
        document.addEventListener('selectionchange', onSel);
        return () => document.removeEventListener('selectionchange', onSel);
    }, []);

    const cmd = useCallback((c: string, val?: string) => {
        document.execCommand(c, false, val);
        activeTextEl()?.dispatchEvent(new Event('input', { bubbles: true }));
    }, []);

    const addLink = useCallback(() => {
        const url = window.prompt('Bağlantı URL\'si (https://…, /sayfa, mailto:…):', 'https://');
        if (url) cmd('createLink', url);
    }, [cmd]);

    const wrapCode = useCallback(() => {
        const sel = window.getSelection();
        const text = sel?.toString();
        if (text) cmd('insertHTML', `<code>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`);
    }, [cmd]);

    if (!pos) return null;

    const tools = [
        { icon: Bold, label: 'Kalın', run: () => cmd('bold') },
        { icon: Italic, label: 'İtalik', run: () => cmd('italic') },
        { icon: Link2, label: 'Bağlantı', run: addLink },
        { icon: Code, label: 'Kod', run: wrapCode },
        { icon: Eraser, label: 'Temizle', run: () => cmd('removeFormat') },
    ];

    return (
        <div className="seo-sel-toolbar" style={{ top: pos.top, left: pos.left }}>
            {tools.map((t) => (
                <button
                    key={t.label}
                    type="button"
                    title={t.label}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        t.run();
                    }}
                >
                    <t.icon size={14} />
                </button>
            ))}
        </div>
    );
}
