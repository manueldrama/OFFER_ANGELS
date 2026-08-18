// CanvasTextBlock — in-place inline text editor for the Studio canvas (Faz A).
//
// Renders the SAME semantic tag the public page uses (h2/h3/p/blockquote…) as
// a contentEditable, so "where you type = how it looks". Uncontrolled: seeds
// innerHTML ONCE and never re-seeds from `value`, so parent re-renders during
// typing don't reset the caret. Inline marks are persisted via sanitizeInline
// on blur — the exact same allowlist the renderer/prerender use, so SEO/GEO
// output is unchanged.

import { useRef, useCallback, useEffect, type ElementType } from 'react';
import { sanitizeInline } from '../../../lib/seoInlineHtml';

interface CanvasTextBlockProps {
    value: string;
    onChange: (html: string) => void;
    tag?: ElementType;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    /** Enter (no shift) — caller inserts a new paragraph below. */
    onEnter?: () => void;
    /** Backspace on an empty block — caller removes it and focuses previous. */
    onDeleteEmpty?: () => void;
    /** "/" typed on an empty block — caller opens the slash menu at `rect`. */
    onSlash?: (rect: DOMRect) => void;
    onFocus?: () => void;
}

export function CanvasTextBlock({
    value,
    onChange,
    tag = 'p',
    placeholder,
    className,
    autoFocus,
    onEnter,
    onDeleteEmpty,
    onSlash,
    onFocus,
}: CanvasTextBlockProps) {
    const ref = useRef<HTMLElement>(null);
    const init = useRef(false);

    useEffect(() => {
        const el = ref.current;
        if (el && !init.current) {
            el.innerHTML = value || '';
            init.current = true;
            if (autoFocus) {
                el.focus();
                const r = document.createRange();
                r.selectNodeContents(el);
                r.collapse(false);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(r);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const emit = useCallback(() => {
        if (ref.current) onChange(ref.current.innerHTML);
    }, [onChange]);

    const isEmpty = () => !ref.current?.textContent?.trim();

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onEnter?.();
                return;
            }
            if (e.key === 'Backspace' && isEmpty()) {
                e.preventDefault();
                onDeleteEmpty?.();
                return;
            }
            if (e.key === '/' && isEmpty() && ref.current) {
                onSlash?.(ref.current.getBoundingClientRect());
            }
        },
        [onEnter, onDeleteEmpty, onSlash],
    );

    const onPaste = useCallback(
        (e: React.ClipboardEvent) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
            emit();
        },
        [emit],
    );

    const onBlur = useCallback(() => {
        if (ref.current) {
            const clean = sanitizeInline(ref.current.innerHTML);
            if (clean !== ref.current.innerHTML) ref.current.innerHTML = clean;
            onChange(clean);
        }
    }, [onChange]);

    const Tag = tag;
    return (
        <Tag
            ref={ref}
            data-canvas-text=""
            contentEditable
            suppressContentEditableWarning
            onInput={emit}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={onBlur}
            onFocus={onFocus}
            data-placeholder={placeholder}
            className={className}
        />
    );
}
