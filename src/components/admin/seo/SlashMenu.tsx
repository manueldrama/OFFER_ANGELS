// SlashMenu — block-type picker opened by typing "/" on an empty canvas block
// (Faz C). Uses a focused search field for robust filtering (instead of parsing
// the contentEditable), with arrow/enter keyboard navigation.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface SlashItem {
    type: string;
    label: string;
    hint?: string;
    icon: LucideIcon;
}

interface SlashMenuProps {
    position: { top: number; left: number };
    items: SlashItem[];
    onPick: (type: string) => void;
    onClose: () => void;
}

export function SlashMenu({ position, items, onPick, onClose }: SlashMenuProps) {
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((it) => it.label.toLowerCase().includes(q) || it.type.includes(q));
    }, [items, query]);

    useEffect(() => {
        setActive(0);
    }, [query]);

    const choose = (i: number) => {
        const it = filtered[i];
        if (it) onPick(it.type);
    };

    return (
        <>
            {/* click-away backdrop */}
            <div className="fixed inset-0 z-[59]" onMouseDown={onClose} />
            <div
                className="seo-slash-menu"
                style={{ top: position.top, left: position.left }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setActive((a) => Math.min(a + 1, filtered.length - 1));
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setActive((a) => Math.max(a - 1, 0));
                        } else if (e.key === 'Enter') {
                            e.preventDefault();
                            choose(active);
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            onClose();
                        }
                    }}
                    placeholder="Blok ara… (ör. görsel, başlık, video)"
                    className="seo-slash-search"
                />
                <div className="seo-slash-list">
                    {filtered.length === 0 ? (
                        <div className="seo-slash-empty">Sonuç yok</div>
                    ) : (
                        filtered.map((it, i) => (
                            <button
                                key={it.type}
                                type="button"
                                onMouseEnter={() => setActive(i)}
                                onClick={() => onPick(it.type)}
                                className={`seo-slash-item ${i === active ? 'is-active' : ''}`}
                            >
                                <span className="seo-slash-ico">
                                    <it.icon size={15} />
                                </span>
                                <span className="seo-slash-text">
                                    <span className="seo-slash-label">{it.label}</span>
                                    {it.hint && <span className="seo-slash-hint">{it.hint}</span>}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
