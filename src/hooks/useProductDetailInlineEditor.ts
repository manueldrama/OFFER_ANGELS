import { useState, useCallback, useEffect, useRef } from 'react';
import { ProductDetailSection } from '../types';
import { AdminProductContentService } from '../services/admin/productContentService';
import { useIsAdmin } from './useIsAdmin';
import { isEditModeRequested } from './editModeFlag';

interface PendingChange {
    sectionId: string;
    fieldKey: string;
    value: any;
    isItem?: boolean;
    itemId?: string;
    nested?: boolean;
}

/**
 * Inline editor for the product detail content (product_detail_sections + product_detail_items).
 * Mirrors useInlineEditor for landing but targets the product_detail_* tables.
 */
export function useProductDetailInlineEditor(
    sections: ProductDetailSection[],
    productId: string,
    lang: string,
) {
    const { isAdmin, isLoading: authLoading } = useIsAdmin();
    const hasEditParam = isEditModeRequested();

    const [editMode, setEditMode] = useState(false);
    const [activeLang, setActiveLang] = useState(lang);
    const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
    const pendingRef = useRef<PendingChange[]>([]);
    const [saving, setSaving] = useState(false);
    const [localSections, setLocalSections] = useState<ProductDetailSection[]>(sections);
    const localRef = useRef<ProductDetailSection[]>(sections);

    useEffect(() => {
        if (authLoading) return;
        setEditMode(isEditModeRequested() && isAdmin);
    }, [authLoading, isAdmin]);

    useEffect(() => {
        if (!saving) setLocalSections(sections);
    }, [sections, saving]);

    useEffect(() => { pendingRef.current = pendingChanges; }, [pendingChanges]);
    useEffect(() => { localRef.current = localSections; }, [localSections]);

    const updateField = useCallback((sectionType: string, fieldKey: string, value: any) => {
        const section = localSections.find(s => s.section_type === sectionType);
        if (!section) return;
        setLocalSections(prev => prev.map(s =>
            s.section_type === sectionType ? { ...s, [fieldKey]: value } as any : s
        ));
        setPendingChanges(prev => {
            const idx = prev.findIndex(c => c.sectionId === section.id && c.fieldKey === fieldKey && !c.isItem);
            const change: PendingChange = { sectionId: section.id, fieldKey, value };
            if (idx >= 0) { const next = [...prev]; next[idx] = change; return next; }
            return [...prev, change];
        });
    }, [localSections]);

    const updateItemField = useCallback((sectionType: string, itemIndex: number, fieldKey: string, value: any, nested?: boolean) => {
        const section = localSections.find(s => s.section_type === sectionType);
        if (!section?.items?.[itemIndex]) return;
        const item = section.items[itemIndex];
        setLocalSections(prev => prev.map(s => {
            if (s.section_type !== sectionType) return s;
            const items = [...(s.items || [])];
            if (nested) {
                items[itemIndex] = { ...items[itemIndex], extra: { ...(items[itemIndex].extra || {}), [fieldKey]: value } };
            } else {
                items[itemIndex] = { ...items[itemIndex], [fieldKey]: value };
            }
            return { ...s, items };
        }));
        setPendingChanges(prev => {
            const idx = prev.findIndex(c => c.sectionId === section.id && c.isItem && c.itemId === item.id && c.fieldKey === fieldKey);
            const change: PendingChange = { sectionId: section.id, fieldKey, value, isItem: true, itemId: item.id, nested };
            if (idx >= 0) { const next = [...prev]; next[idx] = change; return next; }
            return [...prev, change];
        });
    }, [localSections]);

    const saveAllChanges = useCallback(async (): Promise<boolean> => {
        await new Promise(r => setTimeout(r, 200));
        const changes = pendingRef.current;
        if (changes.length === 0) return true;
        setSaving(true);
        try {
            const sectionUpdates = new Map<string, Record<string, any>>();
            const itemUpdates = new Map<string, Record<string, any>>();

            for (const c of changes) {
                if (c.isItem && c.itemId) {
                    const cur = itemUpdates.get(c.itemId) || {};
                    if (c.nested) {
                        const sec = localRef.current.find(s => s.id === c.sectionId);
                        const item = sec?.items?.find(i => i.id === c.itemId);
                        cur.extra = { ...(item?.extra || {}), ...cur.extra, [c.fieldKey]: c.value };
                    } else {
                        cur[c.fieldKey] = c.value;
                    }
                    itemUpdates.set(c.itemId, cur);
                } else {
                    const cur = sectionUpdates.get(c.sectionId) || {};
                    cur[c.fieldKey] = c.value;
                    sectionUpdates.set(c.sectionId, cur);
                }
            }

            for (const [sid, fields] of sectionUpdates) {
                await AdminProductContentService.updateSection(sid, fields);
            }
            for (const [iid, fields] of itemUpdates) {
                await AdminProductContentService.updateItem(iid, fields);
            }

            setPendingChanges([]);
            await new Promise(r => setTimeout(r, 300));
            window.location.reload();
            return true;
        } catch (e) {
            console.error('[ProductDetailInlineEditor] save failed:', e);
            return false;
        } finally {
            setSaving(false);
        }
    }, []);

    const discardChanges = useCallback(() => {
        setPendingChanges([]);
        setLocalSections(sections);
    }, [sections]);

    // Structural ops
    const addSection = useCallback(async (sectionType: string) => {
        const maxOrder = localSections.reduce((m, s) => Math.max(m, s.sort_order || 0), 0);
        try {
            const sec = await AdminProductContentService.createSection({
                product_id: productId,
                language_code: activeLang,
                section_type: sectionType,
                is_active: true,
                sort_order: maxOrder + 10,
            });
            setLocalSections(prev => [...prev, { ...sec, items: [] } as any]);
        } catch (e) {
            console.error('[ProductDetailInlineEditor] addSection failed:', e);
        }
    }, [localSections, productId, activeLang]);

    const removeSection = useCallback(async (sectionId: string) => {
        const prev = localSections;
        setLocalSections(prevSecs => prevSecs.map(s => s.id === sectionId ? { ...s, is_active: false } : s));
        try {
            await AdminProductContentService.updateSection(sectionId, { is_active: false });
        } catch {
            setLocalSections(prev);
        }
    }, [localSections]);

    const addItem = useCallback(async (sectionId: string) => {
        const section = localSections.find(s => s.id === sectionId);
        if (!section) return;
        const maxOrder = (section.items || []).reduce((m: number, i: any) => Math.max(m, i.sort_order || 0), 0);
        try {
            const newItem = await AdminProductContentService.createItem({
                section_id: sectionId,
                title: 'Yeni öğe',
                is_active: true,
                sort_order: maxOrder + 10,
            });
            setLocalSections(prev => prev.map(s => s.id === sectionId ? { ...s, items: [...(s.items || []), newItem] } : s));
        } catch (e) {
            console.error('[ProductDetailInlineEditor] addItem failed:', e);
        }
    }, [localSections]);

    const removeItem = useCallback(async (itemId: string) => {
        const prev = localSections;
        setLocalSections(prevSecs => prevSecs.map(s => ({
            ...s,
            items: (s.items || []).filter((i: any) => i.id !== itemId),
        })));
        try {
            await AdminProductContentService.deleteItem(itemId);
        } catch {
            setLocalSections(prev);
        }
    }, [localSections]);

    const toggleSectionVisibility = useCallback(async (sectionType: string) => {
        const section = localSections.find(s => s.section_type === sectionType);
        if (!section) return;
        setLocalSections(prev => prev.map(s => s.section_type === sectionType ? { ...s, is_active: !s.is_active } : s));
        try {
            await AdminProductContentService.updateSection(section.id, { is_active: !section.is_active });
        } catch { /* revert on failure */ }
    }, [localSections]);

    const moveSection = useCallback(async (sectionType: string, direction: 'up' | 'down') => {
        const idx = localSections.findIndex(s => s.section_type === sectionType);
        if (idx < 0) return;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= localSections.length) return;
        const reordered = [...localSections];
        [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
        setLocalSections(reordered);
        try {
            await AdminProductContentService.reorderSections(reordered.map(s => s.id));
        } catch {
            setLocalSections(localSections);
        }
    }, [localSections]);

    return {
        editMode,
        setEditMode,
        activeLang,
        setActiveLang,
        pendingChanges,
        saving,
        localSections,
        updateField,
        updateItemField,
        saveAllChanges,
        discardChanges,
        addSection,
        removeSection,
        addItem,
        removeItem,
        toggleSectionVisibility,
        moveSection,
        hasChanges: pendingChanges.length > 0,
    };
}
