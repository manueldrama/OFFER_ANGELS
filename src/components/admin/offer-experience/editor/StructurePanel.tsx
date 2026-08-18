import React, { useMemo } from 'react';
import {
    DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
    type DragEndEvent, type DragStartEvent,
    type CollisionDetection, closestCenter, pointerWithin, getFirstCollision,
    rectIntersection,
} from '@dnd-kit/core';
import {
    SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical, Lock, Eye, EyeOff, Copy, X, ArrowLeftRight, ChevronDown, ChevronRight,
    LayoutTemplate, Plus, Unlock, Monitor, Smartphone,
} from 'lucide-react';
import type { BlockColumn, BlockInstance } from './schema/blocks';
import { BLOCK_TYPES, resolveMobileOrder } from './schema/blocks';
import { BLOCK_FIELDS, HEADER_FIELDS, FOOTER_FIELDS } from './schema/blocks';
import { FIELDS, type EditorFieldId } from './schema/fields';

type Mode = 'content' | 'structure';

interface Props {
    blocks: BlockInstance[];
    setBlocks: (blocks: BlockInstance[]) => void;

    /** Mobil gorunum icin bagimsiz blok id siralamasi. */
    mobileOrder: string[];
    setMobileOrder: (ids: string[]) => void;

    mode: Mode;
    onMode: (m: Mode) => void;
    canStructure: boolean;

    activeBlockId: string | null;
    onActiveBlock: (id: string | null) => void;

    dirtyMap: Partial<Record<EditorFieldId, boolean>>;
    onPickField: (id: EditorFieldId) => void;

    onAddBlock: (col: BlockColumn) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
    onToggleVisible: (id: string) => void;
    onToggleLock: (id: string) => void;
    onSwapColumn: (id: string) => void;

    onClose: () => void;
}

export function StructurePanel(props: Props) {
    const { mode } = props;
    return (
        <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-3">
                <div className="flex items-center gap-2">
                    <LayoutTemplate size={14} className="text-slate-700" />
                    <span className="text-[13px] font-semibold text-slate-900">Sayfa Yapısı</span>
                </div>
                <button onClick={props.onClose} className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50">
                    <X size={12} />
                </button>
            </div>

            {/* Mode tabs */}
            <div className="border-b border-slate-200 bg-slate-50/50 px-3 py-2.5">
                <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
                    <button
                        onClick={() => props.onMode('content')}
                        className={[
                            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-colors',
                            mode === 'content' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                        ].join(' ')}
                    >
                        İçerik
                    </button>
                    <button
                        onClick={() => props.canStructure && props.onMode('structure')}
                        disabled={!props.canStructure}
                        className={[
                            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-colors',
                            mode === 'structure' && props.canStructure ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                            !props.canStructure ? 'opacity-50' : '',
                        ].join(' ')}
                    >
                        Yapı {!props.canStructure && <Lock size={10} />}
                    </button>
                </div>
            </div>

            {mode === 'structure' && props.canStructure ? (
                <StructureMode {...props} />
            ) : (
                <ContentMode {...props} />
            )}
        </aside>
    );
}

// ────────────────────────────── Content mode ──────────────────────────────
function ContentMode({
    blocks, dirtyMap, activeBlockId, onActiveBlock, onPickField,
}: Props) {
    const sections: Array<{ id: string; label: string; fields: EditorFieldId[] }> = [
        { id: 'header', label: 'Header & Navigation', fields: HEADER_FIELDS },
        ...blocks.map(b => ({
            id: b.id,
            label: BLOCK_TYPES[b.type]?.label ?? b.type,
            fields: BLOCK_FIELDS[b.type] ?? [],
        })),
        { id: 'footer', label: 'Footer & Sticky Bar', fields: FOOTER_FIELDS },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-2">
            {sections.map(section => {
                const dirtyCount = section.fields.filter(f => dirtyMap[f]).length;
                const isActive = activeBlockId === section.id;
                if (section.fields.length === 0) return null;
                return (
                    <div key={section.id} className="mb-1">
                        <button
                            onClick={() => onActiveBlock(isActive ? null : section.id)}
                            className={[
                                'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                                isActive ? 'bg-indigo-50' : 'hover:bg-slate-50',
                            ].join(' ')}
                        >
                            {isActive ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-400" />}
                            <span className="flex-1 text-[12.5px] font-medium text-slate-800">{section.label}</span>
                            {dirtyCount > 0 && (
                                <span className="rounded-full bg-orange-600 px-1.5 py-[1px] text-[10px] font-bold text-white">
                                    {dirtyCount}
                                </span>
                            )}
                        </button>
                        {isActive && (
                            <div className="ml-3 mt-1 border-l border-dashed border-slate-200 pl-3">
                                {section.fields.map(f => (
                                    <button
                                        key={f}
                                        onClick={() => onPickField(f)}
                                        className={[
                                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11.5px] transition-colors',
                                            dirtyMap[f] ? 'text-orange-700 font-medium' : 'text-slate-600 hover:bg-slate-50',
                                        ].join(' ')}
                                    >
                                        <span className="flex-1 truncate">{FIELDS[f]?.label ?? f}</span>
                                        {dirtyMap[f] && <span className="h-1.5 w-1.5 rounded-full bg-orange-600" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ────────────────────────────── Structure mode ─────────────────────────────
// İki alt-görünüm: "Masaüstü Kolonları" (sol/sağ kolon DnD) ve "Mobil Sıra"
// (kolonlardan bağımsız tek liste — mobil render sırasını belirler).
function StructureMode(props: Props) {
    const [view, setView] = React.useState<'desktop' | 'mobile'>('desktop');
    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/50 px-3 py-2">
                <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
                    <button
                        onClick={() => setView('desktop')}
                        className={[
                            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                            view === 'desktop' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                        ].join(' ')}
                    >
                        <Monitor size={12} /> Masaüstü Kolonları
                    </button>
                    <button
                        onClick={() => setView('mobile')}
                        className={[
                            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                            view === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                        ].join(' ')}
                    >
                        <Smartphone size={12} /> Mobil Sıra
                    </button>
                </div>
            </div>
            {view === 'desktop' ? <DesktopColumnsView {...props} /> : <MobileOrderView {...props} />}
        </div>
    );
}

// ── Masaüstü: sol/sağ kolon sürükle-bırak (mevcut davranış, değişmedi) ──────
function DesktopColumnsView(props: Props) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
    const [draggingId, setDraggingId] = React.useState<string | null>(null);

    const left = useMemo(() => props.blocks.filter(b => b.column === 'left'), [props.blocks]);
    const right = useMemo(() => props.blocks.filter(b => b.column === 'right'), [props.blocks]);

    const findColumn = (id: string): BlockColumn | null =>
        props.blocks.find(b => b.id === id)?.column ?? null;

    const handleDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));

    const collisionDetection: CollisionDetection = (args) => {
        const inter = pointerWithin(args);
        if (inter.length > 0) return inter;
        const rectInt = rectIntersection(args);
        if (rectInt.length > 0) return rectInt;
        return closestCenter(args);
    };

    const handleDragEnd = (e: DragEndEvent) => {
        setDraggingId(null);
        const { active, over } = e;
        if (!over) return;
        const activeId = String(active.id);
        const overId = String(over.id);

        const activeCol = findColumn(activeId);
        if (!activeCol) return;

        // Dropped on a column header → move to that column at end
        if (overId === 'col-left' || overId === 'col-right') {
            const targetCol: BlockColumn = overId === 'col-left' ? 'left' : 'right';
            if (activeCol === targetCol) return;
            props.setBlocks(props.blocks.map(b => b.id === activeId ? { ...b, column: targetCol } : b));
            return;
        }

        const overCol = findColumn(overId);
        if (!overCol) return;

        if (activeCol === overCol) {
            const colItems = props.blocks.filter(b => b.column === activeCol);
            const oldIndex = colItems.findIndex(b => b.id === activeId);
            const newIndex = colItems.findIndex(b => b.id === overId);
            if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
            const reordered = arrayMove(colItems, oldIndex, newIndex);

            const otherItems = props.blocks.filter(b => b.column !== activeCol);
            // Splice reordered block into the original blocks order, preserving other column.
            const next: BlockInstance[] = [];
            let leftCursor = 0, rightCursor = 0;
            for (const b of props.blocks) {
                if (b.column === activeCol) {
                    next.push(reordered[leftCursor++]);
                } else {
                    next.push(otherItems[rightCursor++]);
                }
            }
            props.setBlocks(next);
        } else {
            // Cross-column move: insert before the over item in the new column.
            const moved = props.blocks.find(b => b.id === activeId);
            if (!moved) return;
            const without = props.blocks.filter(b => b.id !== activeId);
            const insertIdx = without.findIndex(b => b.id === overId);
            const next = [...without];
            next.splice(insertIdx >= 0 ? insertIdx : next.length, 0, { ...moved, column: overCol });
            props.setBlocks(next);
        }
    };

    return (
        <>
            <div className="grid grid-cols-2 gap-1.5 border-b border-slate-200 bg-slate-50/50 p-2.5">
                <button
                    onClick={() => props.onAddBlock('left')}
                    className="flex items-center justify-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                >
                    <Plus size={11} /> Sol kolon
                </button>
                <button
                    onClick={() => props.onAddBlock('right')}
                    className="flex items-center justify-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                >
                    <Plus size={11} /> Sağ kolon
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={collisionDetection}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <ColumnList id="col-left" label="Sol Kolon" blocks={left} {...props} />
                    <ColumnList id="col-right" label="Sağ Kolon" blocks={right} {...props} />

                    <DragOverlay>
                        {draggingId ? (() => {
                            const b = props.blocks.find(x => x.id === draggingId);
                            if (!b) return null;
                            const meta = BLOCK_TYPES[b.type];
                            return (
                                <div className="cursor-grabbing rounded-lg border-2 border-indigo-600 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-900 shadow-xl">
                                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded bg-indigo-100 text-indigo-700">·</span>
                                    {meta?.label ?? b.type}
                                </div>
                            );
                        })() : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </>
    );
}

// ── Mobil: kolonlardan bağımsız tek sıralı liste ────────────────────────────
function MobileOrderView(props: Props) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
    const [draggingId, setDraggingId] = React.useState<string | null>(null);

    // resolveMobileOrder: bayat id'leri eler, listede olmayan blokları sona ekler.
    const list = useMemo(
        () => resolveMobileOrder(props.blocks, props.mobileOrder),
        [props.blocks, props.mobileOrder],
    );
    const ids = list.map(b => b.id);

    const handleDragEnd = (e: DragEndEvent) => {
        setDraggingId(null);
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const oldIndex = list.findIndex(b => b.id === active.id);
        const newIndex = list.findIndex(b => b.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        props.setMobileOrder(arrayMove(list, oldIndex, newIndex).map(b => b.id));
    };

    return (
        <>
            <div className="border-b border-slate-200 bg-indigo-50/40 px-3 py-2.5">
                <p className="text-[10.5px] leading-snug text-slate-500">
                    Bu sıra yalnızca <span className="font-semibold text-slate-700">mobil görünümü</span> belirler.
                    Masaüstü kolonları “Masaüstü Kolonları” sekmesinden ayarlanır.
                </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={(e) => setDraggingId(String(e.active.id))}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                        {list.map(b => <MobileSortableRow key={b.id} block={b} />)}
                    </SortableContext>

                    <DragOverlay>
                        {draggingId ? (() => {
                            const b = props.blocks.find(x => x.id === draggingId);
                            if (!b) return null;
                            const meta = BLOCK_TYPES[b.type];
                            return (
                                <div className="cursor-grabbing rounded-lg border-2 border-indigo-600 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-900 shadow-xl">
                                    {meta?.label ?? b.type}
                                </div>
                            );
                        })() : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </>
    );
}

function MobileSortableRow({ block }: { block: BlockInstance }) {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({ id: block.id });

    const meta = BLOCK_TYPES[block.type];
    const hidden = !block.visible;

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={[
                'mb-1.5 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5',
                hidden ? 'opacity-55' : '',
            ].join(' ')}
        >
            <button
                {...attributes}
                {...listeners}
                title="Sürükle"
                className="grid h-6 w-6 shrink-0 cursor-grab place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
            >
                <GripVertical size={12} />
            </button>

            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-900">
                {meta?.label ?? block.type}
            </span>

            {hidden && (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    Gizli
                </span>
            )}
            <span
                className={[
                    'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                    block.column === 'left' ? 'bg-sky-50 text-sky-600' : 'bg-violet-50 text-violet-600',
                ].join(' ')}
                title="Masaüstü kolonu"
            >
                {block.column === 'left' ? 'Sol' : 'Sağ'}
            </span>
        </div>
    );
}

interface ColumnListProps extends Props {
    id: string;
    label: string;
    blocks: BlockInstance[];
}

function ColumnList(props: ColumnListProps) {
    const ids = props.blocks.map(b => b.id);
    return (
        <div className="mb-3" id={props.id}>
            <div className="mb-1.5 px-2 text-[9.5px] font-bold uppercase tracking-[0.08em] text-slate-500">
                {props.label}
            </div>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {props.blocks.map(b => {
                    const { id: _colId, label: _colLabel, blocks: _colBlocks, ...rest } = props;
                    return <SortableBlockRow key={b.id} block={b} {...rest} />;
                })}
            </SortableContext>
        </div>
    );
}

// ColumnList, satıra `blocks`/`id`/`label` geçirmez — bu yüzden `blocks` omit edilir.
type SortableRowProps = React.Attributes & Omit<Props, 'blocks'> & { block: BlockInstance };

function SortableBlockRow({
    block, activeBlockId, onActiveBlock, onToggleVisible, onSwapColumn, onDuplicate, onDelete, onToggleLock,
}: SortableRowProps) {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({ id: block.id, disabled: !!block.locked });

    const meta = BLOCK_TYPES[block.type];
    const locked = !!block.locked;
    const hidden = !block.visible;
    const isActive = activeBlockId === block.id;

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={() => onActiveBlock(block.id)}
            className={[
                'group mb-1.5 flex items-center gap-1.5 rounded-lg border px-1.5 py-1.5 transition-colors',
                isActive ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white hover:border-slate-300',
                hidden ? 'opacity-55' : '',
            ].join(' ')}
        >
            <button
                {...attributes}
                {...listeners}
                disabled={locked}
                onClick={(e) => e.stopPropagation()}
                title={locked ? 'Bu blok kilitli' : 'Sürükle'}
                className={[
                    'grid h-6 w-6 shrink-0 place-items-center rounded text-slate-400',
                    locked ? 'cursor-not-allowed text-slate-300' : 'cursor-grab hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing',
                ].join(' ')}
            >
                {locked ? <Lock size={11} /> : <GripVertical size={12} />}
            </button>

            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-900">
                {meta?.label ?? block.type}
            </span>

            <div className="flex shrink-0 items-center opacity-50 transition-opacity group-hover:opacity-100">
                <IconBtn title={hidden ? 'Göster' : 'Gizle'} onClick={(e) => { e.stopPropagation(); onToggleVisible(block.id); }}>
                    {hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                </IconBtn>
                <IconBtn title="Diğer kolona taşı" onClick={(e) => { e.stopPropagation(); onSwapColumn(block.id); }}>
                    <ArrowLeftRight size={11} />
                </IconBtn>
                <IconBtn
                    title={locked ? 'Kilidi aç' : 'Kilitle'}
                    onClick={(e) => { e.stopPropagation(); onToggleLock(block.id); }}
                >
                    {locked ? <Unlock size={11} /> : <Lock size={11} />}
                </IconBtn>
                {!locked && (
                    <>
                        <IconBtn title="Kopyala" onClick={(e) => { e.stopPropagation(); onDuplicate(block.id); }}>
                            <Copy size={11} />
                        </IconBtn>
                        <IconBtn title="Sil" danger onClick={(e) => { e.stopPropagation(); onDelete(block.id); }}>
                            <X size={11} />
                        </IconBtn>
                    </>
                )}
            </div>
        </div>
    );
}

function IconBtn({
    children, onClick, title, danger,
}: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    title?: string;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={[
                'grid h-6 w-6 place-items-center rounded',
                danger ? 'text-orange-700 hover:bg-orange-50' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
            ].join(' ')}
        >
            {children}
        </button>
    );
}
