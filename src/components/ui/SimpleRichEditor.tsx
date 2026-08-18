import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Code, SeparatorHorizontal, Undo, Redo, AlignLeft, AlignCenter, Minus } from 'lucide-react';

interface SimpleRichEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: string;
}

export function SimpleRichEditor({ value, onChange, placeholder = 'İçerik girin...', minHeight = '160px' }: SimpleRichEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const initializedRef = useRef(false);
    const [htmlMode, setHtmlMode] = useState(false);
    const [htmlSource, setHtmlSource] = useState(value);

    // Set initial content only once
    useEffect(() => {
        if (editorRef.current && !initializedRef.current) {
            editorRef.current.innerHTML = value || '';
            initializedRef.current = true;
        }
    }, []);

    // Sync external value changes (e.g. switching from HTML mode)
    useEffect(() => {
        if (!htmlMode && editorRef.current && initializedRef.current) {
            // Only update if content actually differs (avoid cursor jump)
            if (editorRef.current.innerHTML !== value) {
                editorRef.current.innerHTML = value || '';
            }
        }
    }, [htmlMode]);

    const execCommand = useCallback((command: string, val?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, val);
        // Read back after command
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    }, [onChange]);

    const handleInput = useCallback(() => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    }, [onChange]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        if (html) {
            // Clean up pasted HTML — keep basic formatting
            const temp = document.createElement('div');
            temp.innerHTML = html;
            // Remove scripts, styles, etc.
            temp.querySelectorAll('script, style, meta, link').forEach(el => el.remove());
            document.execCommand('insertHTML', false, temp.innerHTML);
        } else {
            const text = e.clipboardData.getData('text/plain');
            // Convert newlines to <br>
            const htmlText = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>');
            document.execCommand('insertHTML', false, htmlText);
        }
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    }, [onChange]);

    const handleHtmlSourceChange = useCallback((newHtml: string) => {
        setHtmlSource(newHtml);
        onChange(newHtml);
    }, [onChange]);

    const switchToVisual = useCallback(() => {
        // Apply HTML source to visual editor
        if (editorRef.current) {
            editorRef.current.innerHTML = htmlSource;
        }
        setHtmlMode(false);
    }, [htmlSource]);

    const switchToHtml = useCallback(() => {
        // Read current visual content into source
        if (editorRef.current) {
            setHtmlSource(editorRef.current.innerHTML);
        }
        setHtmlMode(true);
    }, []);

    const toolbarGroups = [
        [
            { icon: Bold, command: 'bold', label: 'Kalın (Ctrl+B)' },
            { icon: Italic, command: 'italic', label: 'İtalik (Ctrl+I)' },
        ],
        [
            { icon: Heading2, command: 'formatBlock', value: '<h2>', label: 'Büyük Başlık' },
            { icon: Heading3, command: 'formatBlock', value: '<h3>', label: 'Alt Başlık' },
            { icon: AlignLeft, command: 'formatBlock', value: '<p>', label: 'Normal Paragraf' },
        ],
        [
            { icon: List, command: 'insertUnorderedList', label: 'Madde İşareti' },
            { icon: ListOrdered, command: 'insertOrderedList', label: 'Numaralı Liste' },
        ],
        [
            { icon: SeparatorHorizontal, command: 'insertHorizontalRule', label: 'Ayırıcı Çizgi' },
            { icon: AlignCenter, command: 'justifyCenter', label: 'Ortala' },
        ],
        [
            { icon: Undo, command: 'undo', label: 'Geri Al' },
            { icon: Redo, command: 'redo', label: 'İleri Al' },
            { icon: Minus, command: 'removeFormat', label: 'Formatı Temizle' },
        ],
    ];

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-300 transition-all">
            {/* Toolbar */}
            <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50/80">
                {!htmlMode && toolbarGroups.map((group, gi) => (
                    <React.Fragment key={gi}>
                        {gi > 0 && <div className="w-px h-5 bg-slate-200 mx-0.5" />}
                        {group.map(btn => (
                            <button
                                key={btn.command + (btn.value || '')}
                                type="button"
                                onMouseDown={e => {
                                    e.preventDefault();
                                    execCommand(btn.command, btn.value);
                                }}
                                title={btn.label}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded transition-colors"
                            >
                                <btn.icon size={14} />
                            </button>
                        ))}
                    </React.Fragment>
                ))}

                <div className="flex-1" />

                <button
                    type="button"
                    onClick={htmlMode ? switchToVisual : switchToHtml}
                    title={htmlMode ? 'Görsel Editöre Dön' : 'HTML Kaynağı Düzenle'}
                    className={`px-2 py-1 rounded transition-colors flex items-center gap-1 text-[10px] font-semibold ${
                        htmlMode
                            ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-white'
                    }`}
                >
                    <Code size={13} />
                    {htmlMode ? 'Görsel' : 'HTML'}
                </button>
            </div>

            {htmlMode ? (
                /* HTML Source Editor */
                <textarea
                    value={htmlSource}
                    onChange={e => handleHtmlSourceChange(e.target.value)}
                    placeholder="<h3>Başlık</h3>&#10;<p>Paragraf metni...</p>&#10;<ul><li>Madde 1</li></ul>"
                    className="w-full px-3 py-2.5 text-xs font-mono text-slate-700 leading-relaxed outline-none resize-y bg-slate-50/30"
                    style={{ minHeight }}
                    spellCheck={false}
                />
            ) : (
                /* Visual WYSIWYG Editor */
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onPaste={handlePaste}
                    data-placeholder={placeholder}
                    className="px-3 py-2.5 text-sm text-slate-700 leading-relaxed outline-none overflow-y-auto
                        empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 empty:before:pointer-events-none empty:before:absolute
                        [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-3 [&_h2]:mb-1.5
                        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-2.5 [&_h3]:mb-1
                        [&_p]:my-1 [&_p]:text-sm [&_p]:text-slate-700
                        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5
                        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5
                        [&_li]:text-sm [&_li]:text-slate-600 [&_li]:my-0.5
                        [&_b]:font-semibold [&_strong]:font-semibold
                        [&_i]:italic [&_em]:italic
                        [&_hr]:my-3 [&_hr]:border-slate-200
                        [&_br]:leading-relaxed
                        relative"
                    style={{ minHeight }}
                />
            )}
        </div>
    );
}
