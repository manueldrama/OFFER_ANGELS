// InlineRichField — single-field inline rich-text editor (Faz 2).
//
// Unlike SimpleRichEditor (which produces block-level h2/ul/etc.), this edits
// ONE text field and only emits INLINE marks: bold, italic, link, code. Block
// structure is already handled by the SEO block editor, so authoring inline
// formatting inside a paragraph/callout/list item maps 1:1 to what
// sanitizeInline() allows on render — users get a WordPress-like writing feel
// without polluting the structured-block model.
//
// Output is raw contentEditable HTML; the renderer (RichText / prerender) runs
// it through the shared allowlist sanitizer, so anything unexpected is stripped
// at display time. We also sanitize on blur to keep the stored value tidy.

import { useRef, useCallback, useEffect } from 'react';
import { Bold, Italic, Link2, Code, Eraser } from 'lucide-react';
import { sanitizeInline } from '../../lib/seoInlineHtml';

interface InlineRichFieldProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    /** Render as a single-line field (Enter is suppressed). Default false. */
    singleLine?: boolean;
    minHeight?: string;
    className?: string;
}

export function InlineRichField({
    value,
    onChange,
    placeholder = 'Metin girin…',
    singleLine = false,
    minHeight = '44px',
    className = '',
}: InlineRichFieldProps) {
    const ref = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);

    // Seed content once; afterwards contentEditable owns the DOM so we avoid
    // re-writing innerHTML on every keystroke (which would reset the caret).
    useEffect(() => {
        if (ref.current && !initialized.current) {
            ref.current.innerHTML = value || '';
            initialized.current = true;
        }
    }, [value]);

    const emit = useCallback(() => {
        if (ref.current) onChange(ref.current.innerHTML);
    }, [onChange]);

    const exec = useCallback(
        (command: string, arg?: string) => {
            ref.current?.focus();
            document.execCommand(command, false, arg);
            emit();
        },
        [emit],
    );

    const addLink = useCallback(() => {
        const url = window.prompt('Bağlantı URL\'si (https://…, /sayfa, mailto:…):', 'https://');
        if (!url) return;
        // execCommand needs a selection; if none, createLink wraps nothing.
        document.execCommand('createLink', false, url);
        emit();
    }, [emit]);

    const wrapCode = useCallback(() => {
        const sel = window.getSelection();
        const text = sel?.toString();
        if (text) {
            document.execCommand('insertHTML', false, `<code>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`);
            emit();
        }
    }, [emit]);

    const handlePaste = useCallback(
        (e: React.ClipboardEvent) => {
            // Paste as plain text — keeps junk markup (Word/Docs spans) out.
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
            emit();
        },
        [emit],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (singleLine && e.key === 'Enter') e.preventDefault();
        },
        [singleLine],
    );

    const handleBlur = useCallback(() => {
        // Normalize the stored value to the allowlist so the DB stays clean.
        if (ref.current) {
            const clean = sanitizeInline(ref.current.innerHTML);
            if (clean !== ref.current.innerHTML) {
                ref.current.innerHTML = clean;
                onChange(clean);
            }
        }
    }, [onChange]);

    const tools = [
        { icon: Bold, label: 'Kalın (Ctrl+B)', run: () => exec('bold') },
        { icon: Italic, label: 'İtalik (Ctrl+I)', run: () => exec('italic') },
        { icon: Link2, label: 'Bağlantı ekle', run: addLink },
        { icon: Code, label: 'Kod', run: wrapCode },
        { icon: Eraser, label: 'Biçimi temizle', run: () => exec('removeFormat') },
    ];

    return (
        <div className={`border border-neutral-200 rounded bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-300 transition-all ${className}`}>
            <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-neutral-100 bg-neutral-50/70">
                {tools.map((t) => (
                    <button
                        key={t.label}
                        type="button"
                        title={t.label}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            t.run();
                        }}
                        className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-white rounded transition-colors"
                    >
                        <t.icon size={13} />
                    </button>
                ))}
            </div>
            <div
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                onInput={emit}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                data-placeholder={placeholder}
                className="px-2.5 py-1.5 text-sm text-neutral-700 leading-relaxed outline-none overflow-y-auto
                    empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-300 empty:before:pointer-events-none
                    [&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic
                    [&_a]:text-indigo-600 [&_a]:underline
                    [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_code]:font-mono"
                style={{ minHeight }}
            />
        </div>
    );
}
