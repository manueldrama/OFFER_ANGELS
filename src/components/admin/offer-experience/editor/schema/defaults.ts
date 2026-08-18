import type { BlockInstance } from './blocks';

export const DEFAULT_BLOCKS: BlockInstance[] = [
    { id: 'blk_1', type: 'product', visible: true, locked: true, column: 'left' },
    { id: 'blk_2', type: 'countdown', visible: true, column: 'left' },
    { id: 'blk_3', type: 'price', visible: true, locked: true, column: 'left' },
    { id: 'blk_4', type: 'suggestions', visible: true, column: 'left' },
    { id: 'blk_5', type: 'totals', visible: true, locked: true, column: 'left' },
    { id: 'blk_6', type: 'roi', visible: true, column: 'left' },
    { id: 'blk_7', type: 'warn', visible: true, column: 'right' },
    { id: 'blk_8', type: 'payment', visible: true, locked: true, column: 'right' },
    { id: 'blk_9', type: 'trust', visible: true, column: 'right' },
    { id: 'blk_10', type: 'info_strips', visible: true, column: 'right' },
    { id: 'blk_11', type: 'approved', visible: true, column: 'right' },
    { id: 'blk_12', type: 'consent', visible: true, locked: true, column: 'right' },
];
