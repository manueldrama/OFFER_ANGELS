import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase/client';
import { useIsAdmin } from './useIsAdmin';
import { isEditModeRequested } from './editModeFlag';

interface PendingOfferChange {
    fieldKey: string;
    value: any;
}

/**
 * Inline editor for the customer offer page.
 *
 * `offer_experiences` is a flat row (no sections / items) so this hook is simpler
 * than `useInlineEditor` for landing — only field-level update + save.
 *
 * Each row is identified by (campaign_id, language_code). When the active
 * language changes, `experienceId` should refresh (fetched by the caller).
 */
export function useOfferInlineEditor(
    experience: { id?: string; campaign_id?: string | null; language_code?: string } | null,
    lang: string,
) {
    const { isAdmin, isLoading: authLoading } = useIsAdmin();
    const hasEditParam = isEditModeRequested();

    const [editMode, setEditMode] = useState(false);
    const [activeLang, setActiveLang] = useState(lang);
    const [pendingChanges, setPendingChanges] = useState<PendingOfferChange[]>([]);
    const pendingRef = useRef<PendingOfferChange[]>([]);
    const [saving, setSaving] = useState(false);
    const [localFields, setLocalFields] = useState<Record<string, any>>({});

    useEffect(() => {
        if (authLoading) return;
        setEditMode(isEditModeRequested() && isAdmin);
    }, [authLoading, isAdmin]);

    useEffect(() => { pendingRef.current = pendingChanges; }, [pendingChanges]);

    const updateField = useCallback((_sectionType: string, fieldKey: string, value: any) => {
        setLocalFields(prev => ({ ...prev, [fieldKey]: value }));
        setPendingChanges(prev => {
            const idx = prev.findIndex(c => c.fieldKey === fieldKey);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { fieldKey, value };
                return next;
            }
            return [...prev, { fieldKey, value }];
        });
    }, []);

    const saveAllChanges = useCallback(async (): Promise<boolean> => {
        await new Promise(r => setTimeout(r, 200));
        const changes = pendingRef.current;
        if (changes.length === 0) return true;
        if (!experience?.id && !experience?.campaign_id) {
            console.warn('[OfferInlineEditor] no experience id/campaign — cannot save');
            return false;
        }

        setSaving(true);
        try {
            const updates = Object.fromEntries(changes.map(c => [c.fieldKey, c.value]));

            if (experience.id) {
                // Update by id
                const { error } = await supabase
                    .from('offer_experiences')
                    .update({ ...updates, updated_at: new Date().toISOString() })
                    .eq('id', experience.id);
                if (error) throw error;
            } else {
                // Upsert by (campaign_id, language_code)
                const { error } = await supabase
                    .from('offer_experiences')
                    .upsert({
                        campaign_id: experience.campaign_id ?? null,
                        language_code: experience.language_code || activeLang,
                        ...updates,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'campaign_id,language_code' });
                if (error) throw error;
            }

            setPendingChanges([]);
            // Reload to refetch fresh data
            await new Promise(r => setTimeout(r, 300));
            window.location.reload();
            return true;
        } catch (e) {
            console.error('[OfferInlineEditor] save failed:', e);
            return false;
        } finally {
            setSaving(false);
        }
    }, [experience, activeLang]);

    const discardChanges = useCallback(() => {
        setPendingChanges([]);
        setLocalFields({});
    }, []);

    const getFieldValue = useCallback((key: string, fallback: any) => {
        return localFields[key] !== undefined ? localFields[key] : fallback;
    }, [localFields]);

    return {
        editMode,
        setEditMode,
        activeLang,
        setActiveLang,
        pendingChanges,
        saving,
        updateField,
        saveAllChanges,
        discardChanges,
        getFieldValue,
        hasChanges: pendingChanges.length > 0,
    };
}
