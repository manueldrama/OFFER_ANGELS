import React from 'react';
import { EyeOff } from 'lucide-react';
import type { BlockInstance, BlockTypeId } from './schema/blocks';
import { BLOCK_TYPES, resolveMobileOrder } from './schema/blocks';
import {
    ProductBlock, CountdownBlock, PriceBlock, SuggestionsBlock, TotalsBlock,
    RoiBlock, WarnBlock, PaymentBlock, TrustBlock, InfoStripsBlock,
    ApprovedBlock, ConsentBlock, PlaceholderBlock,
} from './blocks/blocks';

const REGISTRY: Partial<Record<BlockTypeId, React.ComponentType>> = {
    product: ProductBlock,
    countdown: CountdownBlock,
    price: PriceBlock,
    suggestions: SuggestionsBlock,
    totals: TotalsBlock,
    roi: RoiBlock,
    warn: WarnBlock,
    payment: PaymentBlock,
    trust: TrustBlock,
    info_strips: InfoStripsBlock,
    approved: ApprovedBlock,
    consent: ConsentBlock,
};

interface Props {
    blocks: BlockInstance[];
    /**
     * Mobil/tablet önizlemede blok sırasını belirleyen bağımsız id dizisi.
     * Boş ise [...left, ...right] fallback uygulanır.
     */
    mobileOrder?: string[];
    /** Editor mode — shows hidden-block overlays. In 'production', hidden blocks are skipped. */
    mode?: 'editor' | 'production';
    /** Called when a block container is clicked in structure mode. */
    onBlockClick?: (id: string) => void;
    /** Highlight ring around a block in structure mode. */
    activeBlockId?: string | null;
    /** Subtle structure-mode chrome (dashed outline + label). */
    showStructureChrome?: boolean;
    /**
     * Simulated device for the editor preview. The preview is a fixed-width scaled
     * div, not a real viewport, so Tailwind's `lg:` breakpoint can't be used to
     * collapse the two-column layout. When 'mobile' or 'tablet', force single column.
     * Default 'desktop' preserves the original two-column behavior for any other caller.
     */
    device?: 'mobile' | 'tablet' | 'desktop';
}

export function LayoutRenderer({
    blocks,
    mobileOrder = [],
    mode = 'editor',
    onBlockClick,
    activeBlockId,
    showStructureChrome,
    device = 'desktop',
}: Props) {
    const visible = (b: BlockInstance) => mode === 'production' ? b.visible : true;
    const visibleBlocks = blocks.filter(visible);
    const left = visibleBlocks.filter(b => b.column === 'left');
    const right = visibleBlocks.filter(b => b.column === 'right');

    const shell = (b: BlockInstance) => (
        <BlockShell
            key={b.id}
            block={b}
            onClick={onBlockClick}
            active={activeBlockId === b.id}
            showChrome={showStructureChrome}
        />
    );

    // Mobil/tablet önizleme: tek kolon, mobileOrder sırasıyla (boşsa eski fallback).
    if (device !== 'desktop') {
        const mobileList = mobileOrder.length
            ? resolveMobileOrder(visibleBlocks, mobileOrder)
            : [...left, ...right];
        return (
            <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-3">
                    {mobileList.map(shell)}
                </div>
            </div>
        );
    }

    // Masaüstü: iki kolon (değişmedi).
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">{left.map(shell)}</div>
            <div className="flex flex-col gap-3">{right.map(shell)}</div>
        </div>
    );
}

type BlockShellProps = React.Attributes & {
    block: BlockInstance;
    onClick?: (id: string) => void;
    active?: boolean;
    showChrome?: boolean;
};

function BlockShell({ block, onClick, active, showChrome }: BlockShellProps) {
    const meta = BLOCK_TYPES[block.type];
    const Comp = REGISTRY[block.type];

    const inner = Comp ? <Comp /> : (
        <PlaceholderBlock
            title={meta?.label ?? block.type}
            hint={meta?.desc ?? 'Önizleme henüz tanımlı değil.'}
        />
    );

    return (
        <div
            data-block-id={block.id}
            onClick={onClick ? () => onClick(block.id) : undefined}
            className={[
                'relative transition-all',
                showChrome ? 'rounded-2xl outline-2 outline-dashed outline-indigo-300/60 outline-offset-4' : '',
                active ? 'outline outline-2 outline-indigo-600 outline-offset-4' : '',
                !block.visible ? 'opacity-50' : '',
            ].join(' ')}
        >
            {!block.visible && (
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    <EyeOff size={11} /> Gizli
                </div>
            )}
            {inner}
        </div>
    );
}
