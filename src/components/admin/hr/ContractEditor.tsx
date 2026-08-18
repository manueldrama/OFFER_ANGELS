import { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
    Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Undo2, Redo2,
    AlignLeft, AlignCenter, AlignRight, AlignJustify, Table as TableIcon,
    Code2, Heading2, Heading3, Minus, Trash2, Columns3, Rows3,
} from 'lucide-react';
import {
    HR_CONTRACT_PLACEHOLDERS, PLACEHOLDER_GROUP_LABELS, type PlaceholderDef,
} from '../../../lib/hr/contractPlaceholders';

// Sözleşme metni editörü — Word benzeri düzenleme + yer tutucu çipleri.
//
// TASARIM KARARLARI:
//
//  · TABLO ŞART: ücret/prim maddeleri ve KPI bantları tablo ister. StarterKit
//    tablo içermez, dört ayrı eklenti gerekir.
//  · HTML KAYNAK MODU: mevcut SimpleRichEditor'deki htmlMode fikri korundu —
//    dışarıdan gelen metni yapıştırmanın en güvenilir yolu.
//  · YER TUTUCU ÇİPİ: İK'nın token'ı elle doğru yazmasını beklemek hata
//    kaynağıdır ({{adsoyad}} yazılırsa sessizce dolmaz). Tıklamayla eklenir.

interface Props {
    value: string;
    onChange: (html: string) => void;
    /** Doldurulmuş final metinde çip paneli anlamsızdır. */
    showPlaceholders?: boolean;
    editable?: boolean;
    minHeight?: number;
    /** Araç çubuğunun sağına gömülen eylemler (Kaydet, AI ile Üret…). */
    toolbarExtra?: React.ReactNode;
}

const BTN = 'p-1.5 rounded border text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent';
const BTN_ON = 'bg-slate-900 text-white border-slate-900 hover:bg-slate-900';
const BTN_OFF = 'bg-white border-slate-200';

function ToolButton({ onClick, active, disabled, title, children }: {
    onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
    return (
        <button
            type="button" onClick={onClick} disabled={disabled} title={title}
            className={`${BTN} ${active ? BTN_ON : BTN_OFF}`}
        >
            {children}
        </button>
    );
}

function Toolbar({ editor, onToggleSource, sourceMode, extra }: {
    editor: Editor; onToggleSource: () => void; sourceMode: boolean; extra?: React.ReactNode;
}) {
    const inTable = editor.isActive('table');
    return (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 bg-slate-50">
            <ToolButton title="Geri al" onClick={() => editor.chain().focus().undo().run()}
                disabled={sourceMode || !editor.can().undo()}><Undo2 className="w-4 h-4" /></ToolButton>
            <ToolButton title="İleri al" onClick={() => editor.chain().focus().redo().run()}
                disabled={sourceMode || !editor.can().redo()}><Redo2 className="w-4 h-4" /></ToolButton>

            <span className="w-px h-5 bg-slate-200 mx-1" />

            <ToolButton title="Madde başlığı" active={editor.isActive('heading', { level: 2 })} disabled={sourceMode}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></ToolButton>
            <ToolButton title="Alt başlık" active={editor.isActive('heading', { level: 3 })} disabled={sourceMode}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></ToolButton>

            <span className="w-px h-5 bg-slate-200 mx-1" />

            <ToolButton title="Kalın" active={editor.isActive('bold')} disabled={sourceMode}
                onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></ToolButton>
            <ToolButton title="İtalik" active={editor.isActive('italic')} disabled={sourceMode}
                onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></ToolButton>
            <ToolButton title="Altı çizili" active={editor.isActive('underline')} disabled={sourceMode}
                onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-4 h-4" /></ToolButton>

            <span className="w-px h-5 bg-slate-200 mx-1" />

            <ToolButton title="Madde listesi" active={editor.isActive('bulletList')} disabled={sourceMode}
                onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></ToolButton>
            <ToolButton title="Numaralı liste" active={editor.isActive('orderedList')} disabled={sourceMode}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></ToolButton>

            <span className="w-px h-5 bg-slate-200 mx-1" />

            <ToolButton title="Sola hizala" active={editor.isActive({ textAlign: 'left' })} disabled={sourceMode}
                onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="w-4 h-4" /></ToolButton>
            <ToolButton title="Ortala" active={editor.isActive({ textAlign: 'center' })} disabled={sourceMode}
                onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="w-4 h-4" /></ToolButton>
            <ToolButton title="Sağa hizala" active={editor.isActive({ textAlign: 'right' })} disabled={sourceMode}
                onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="w-4 h-4" /></ToolButton>
            <ToolButton title="İki yana yasla" active={editor.isActive({ textAlign: 'justify' })} disabled={sourceMode}
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="w-4 h-4" /></ToolButton>

            <span className="w-px h-5 bg-slate-200 mx-1" />

            <ToolButton title="Tablo ekle (3×3, başlıklı)" disabled={sourceMode}
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                <TableIcon className="w-4 h-4" />
            </ToolButton>
            {inTable && !sourceMode && (
                <>
                    <ToolButton title="Sütun ekle" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                        <Columns3 className="w-4 h-4" /></ToolButton>
                    <ToolButton title="Satır ekle" onClick={() => editor.chain().focus().addRowAfter().run()}>
                        <Rows3 className="w-4 h-4" /></ToolButton>
                    <ToolButton title="Tabloyu sil" onClick={() => editor.chain().focus().deleteTable().run()}>
                        <Trash2 className="w-4 h-4" /></ToolButton>
                </>
            )}
            <ToolButton title="Yatay çizgi" disabled={sourceMode}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="w-4 h-4" /></ToolButton>

            <span className="w-px h-5 bg-slate-200 mx-1" />

            <ToolButton title="HTML kaynağı" active={sourceMode} onClick={onToggleSource}>
                <Code2 className="w-4 h-4" />
            </ToolButton>

            {extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
        </div>
    );
}

function PlaceholderPanel({ onInsert }: { onInsert: (p: PlaceholderDef) => void }) {
    const groups = useMemo(() => {
        const map = new Map<PlaceholderDef['group'], PlaceholderDef[]>();
        for (const p of HR_CONTRACT_PLACEHOLDERS) {
            const list = map.get(p.group) ?? [];
            list.push(p);
            map.set(p.group, list);
        }
        return [...map.entries()];
    }, []);

    return (
        <div className="border-t border-slate-200 bg-slate-50 p-3 space-y-3">
            <p className="text-[11px] text-slate-500">
                Tıkladığınız alan imlecin bulunduğu yere eklenir. Bu alanlar sözleşme
                gönderilirken çalışanın gerçek bilgileriyle dolar — şablonda boş kalmaları normaldir.
            </p>
            {groups.map(([group, items]) => (
                <div key={group}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        {PLACEHOLDER_GROUP_LABELS[group]}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {items.map(p => (
                            <button
                                key={p.token} type="button" title={p.description}
                                onClick={() => onInsert(p)}
                                className="px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-mono text-slate-700 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
                            >
                                {p.description}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function ContractEditor({
    value, onChange, showPlaceholders = true, editable = true, minHeight = 420, toolbarExtra,
}: Props) {
    const [sourceMode, setSourceMode] = useState(false);
    const [sourceText, setSourceText] = useState(value);

    const editor = useEditor({
        editable,
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Table.configure({ resizable: true }),
            TableRow, TableHeader, TableCell,
        ],
        content: value || '<p></p>',
        onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none px-5 py-4 hr-contract-body',
                style: `min-height:${minHeight}px`,
            },
        },
    });

    // Dışarıdan gelen değişiklik (AI üretimi, "Doldur", şablon seçimi) editöre
    // yansımalı. Kullanıcının kendi yazdığı harf geri yüklenmesin diye mevcut
    // içerikle kıyaslanır.
    useEffect(() => {
        if (!editor || sourceMode) return;
        if (value !== editor.getHTML()) {
            // emitUpdate=false: onChange tetiklenirse döngü olur.
            editor.commands.setContent(value || '<p></p>', false);
        }
    }, [value, editor, sourceMode]);

    useEffect(() => {
        if (editor) editor.setEditable(editable);
    }, [editable, editor]);

    if (!editor) {
        return <div className="border border-slate-200 rounded-lg p-6 text-sm text-slate-400">Editör yükleniyor…</div>;
    }

    const toggleSource = () => {
        if (sourceMode) {
            editor.commands.setContent(sourceText || '<p></p>', false);
            onChange(editor.getHTML());
            setSourceMode(false);
        } else {
            setSourceText(editor.getHTML());
            setSourceMode(true);
        }
    };

    const insertPlaceholder = (p: PlaceholderDef) => {
        if (sourceMode) {
            setSourceText(prev => `${prev}{{${p.token}}}`);
            return;
        }
        editor.chain().focus().insertContent(`{{${p.token}}}`).run();
    };

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <Toolbar editor={editor} sourceMode={sourceMode} onToggleSource={toggleSource} extra={toolbarExtra} />

            {sourceMode ? (
                <textarea
                    value={sourceText}
                    onChange={e => setSourceText(e.target.value)}
                    spellCheck={false}
                    className="w-full font-mono text-[12px] leading-relaxed p-4 outline-none resize-y"
                    style={{ minHeight }}
                />
            ) : (
                <EditorContent editor={editor} />
            )}

            {showPlaceholders && editable && <PlaceholderPanel onInsert={insertPlaceholder} />}
        </div>
    );
}
