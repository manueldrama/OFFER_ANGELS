import React, { useRef, useEffect, useCallback, createElement, useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';

interface EditableTextProps {
    value: string | null | undefined;
    sectionType: string;
    fieldKey: string;
    onUpdate: (sectionType: string, fieldKey: string, value: string) => void;
    editMode: boolean;
    activeLang?: string;
    tag?: keyof HTMLElementTagNameMap;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

async function translateSingleField(text: string, targetLang: string): Promise<string> {
    const { AiTranslationService } = await import('../../services/admin/aiTranslationService');
    const results = await AiTranslationService.translateBatch([{ key: 'field', value: text }], [targetLang]);
    return results.find(r => r.key === 'field')?.value || text;
}

export function EditableText({ value, sectionType, fieldKey, onUpdate, editMode, activeLang = 'tr', tag = 'span', className = '', style, children }: EditableTextProps) {
    const ref = useRef<HTMLElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const lastValue = useRef(value);
    const [focused, setFocused] = useState(false);
    const [translating, setTranslating] = useState(false);

    useEffect(() => {
        if (ref.current && value !== lastValue.current) {
            ref.current.textContent = value || '';
            lastValue.current = value;
        }
    }, [value]);

    const handleBlur = useCallback(() => {
        // Delay to allow AI button click
        setTimeout(() => {
            if (!wrapperRef.current?.contains(document.activeElement)) {
                setFocused(false);
            }
        }, 200);
        const newValue = ref.current?.textContent?.trim() || '';
        if (newValue !== (value || '')) {
            onUpdate(sectionType, fieldKey, newValue);
        }
    }, [sectionType, fieldKey, value, onUpdate]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tag !== 'p' && tag !== 'div') {
            e.preventDefault();
            ref.current?.blur();
        }
        if (e.key === 'Escape') {
            if (ref.current) ref.current.textContent = value || '';
            ref.current?.blur();
        }
    }, [value, tag]);

    const handleTranslate = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const currentText = ref.current?.textContent?.trim() || value || '';
        if (!currentText || activeLang === 'tr') return;
        setTranslating(true);
        try {
            const translated = await translateSingleField(currentText, activeLang);
            if (ref.current) ref.current.textContent = translated;
            onUpdate(sectionType, fieldKey, translated);
        } catch (err) {
            console.error('[InlineEdit] Translate failed:', err);
        } finally {
            setTranslating(false);
        }
    };

    if (!editMode) {
        return createElement(tag, { className, style }, children ?? value);
    }

    const showAiBtn = focused && activeLang !== 'tr';

    return (
        <span ref={wrapperRef} className="relative inline">
            {createElement(tag, {
                ref,
                className: `${className} outline-none cursor-text hover:ring-2 hover:ring-indigo-300 hover:ring-offset-1 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-sm transition-shadow`,
                style,
                contentEditable: true,
                suppressContentEditableWarning: true,
                onClick: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); },
                onFocus: () => setFocused(true),
                onBlur: handleBlur,
                onKeyDown: handleKeyDown,
                'data-editable': 'true',
                'data-field': fieldKey,
                'data-section': sectionType,
            }, value || '')}
            {showAiBtn && (
                <button
                    onMouseDown={handleTranslate}
                    className="absolute -top-8 right-0 z-[200] flex items-center gap-1 px-2 py-1 bg-violet-600 text-white text-[10px] font-semibold rounded-md shadow-lg hover:bg-violet-500 transition-colors whitespace-nowrap"
                    title={`AI ile ${activeLang.toUpperCase()} diline cevir`}
                >
                    {translating ? <Loader2 size={10} className="animate-spin" /> : <Languages size={10} />}
                    {activeLang.toUpperCase()}
                </button>
            )}
        </span>
    );
}

interface EditableItemTextProps {
    value: string | null | undefined;
    sectionType: string;
    itemIndex: number;
    fieldKey: string;
    onUpdate: (sectionType: string, itemIndex: number, fieldKey: string, value: string, nested?: boolean) => void;
    editMode: boolean;
    activeLang?: string;
    nested?: boolean;
    tag?: keyof HTMLElementTagNameMap;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

export function EditableItemText({ value, sectionType, itemIndex, fieldKey, onUpdate, editMode, activeLang = 'tr', nested, tag = 'span', className = '', style, children }: EditableItemTextProps) {
    const ref = useRef<HTMLElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [focused, setFocused] = useState(false);
    const [translating, setTranslating] = useState(false);

    const handleBlur = useCallback(() => {
        setTimeout(() => {
            if (!wrapperRef.current?.contains(document.activeElement)) {
                setFocused(false);
            }
        }, 200);
        const newValue = ref.current?.textContent?.trim() || '';
        if (newValue !== (value || '')) {
            onUpdate(sectionType, itemIndex, fieldKey, newValue, nested);
        }
    }, [sectionType, itemIndex, fieldKey, value, onUpdate, nested]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tag !== 'p' && tag !== 'div') {
            e.preventDefault();
            ref.current?.blur();
        }
        if (e.key === 'Escape') {
            if (ref.current) ref.current.textContent = value || '';
            ref.current?.blur();
        }
    }, [value, tag]);

    const handleTranslate = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const currentText = ref.current?.textContent?.trim() || value || '';
        if (!currentText || activeLang === 'tr') return;
        setTranslating(true);
        try {
            const translated = await translateSingleField(currentText, activeLang);
            if (ref.current) ref.current.textContent = translated;
            onUpdate(sectionType, itemIndex, fieldKey, translated, nested);
        } catch (err) {
            console.error('[InlineEdit] Translate failed:', err);
        } finally {
            setTranslating(false);
        }
    };

    if (!editMode) {
        return createElement(tag, { className, style }, children ?? value);
    }

    const showAiBtn = focused && activeLang !== 'tr';

    return (
        <span ref={wrapperRef} className="relative inline">
            {createElement(tag, {
                ref,
                className: `${className} outline-none cursor-text hover:ring-2 hover:ring-indigo-300 hover:ring-offset-1 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-sm transition-shadow`,
                style,
                contentEditable: true,
                suppressContentEditableWarning: true,
                onClick: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); },
                onFocus: () => setFocused(true),
                onBlur: handleBlur,
                onKeyDown: handleKeyDown,
                'data-editable': 'true',
                'data-field': fieldKey,
                'data-section': sectionType,
            }, value || '')}
            {showAiBtn && (
                <button
                    onMouseDown={handleTranslate}
                    className="absolute -top-8 right-0 z-[200] flex items-center gap-1 px-2 py-1 bg-violet-600 text-white text-[10px] font-semibold rounded-md shadow-lg hover:bg-violet-500 transition-colors whitespace-nowrap"
                    title={`AI ile ${activeLang.toUpperCase()} diline cevir`}
                >
                    {translating ? <Loader2 size={10} className="animate-spin" /> : <Languages size={10} />}
                    {activeLang.toUpperCase()}
                </button>
            )}
        </span>
    );
}
