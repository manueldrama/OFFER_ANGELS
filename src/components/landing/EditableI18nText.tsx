import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase/client';
import { LanguageService } from '../../services/admin/languageService';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { isEditModeRequested } from '../../hooks/editModeFlag';

interface Props {
    /** Full i18n key including namespace, e.g. 'offer:hero.title' */
    i18nKey: string;
    value: string;
    /** Optional override; if not provided, derived from useTranslation() */
    lang?: string;
    /** Optional override; if not provided, derived from auth + sessionStorage */
    editMode?: boolean;
    tag?: keyof React.JSX.IntrinsicElements;
    className?: string;
    style?: React.CSSProperties;
    /** If true uses dangerouslySetInnerHTML (for <br /> support, etc.) */
    asHtml?: boolean;
    children?: React.ReactNode;
}

/**
 * Inline-editable text bound to the `translations` table.
 * Self-contained: derives editMode (admin + ?edit=true) and lang from i18next/auth.
 * Click in edit mode → contentEditable → blur saves to DB for the current language.
 */
export function EditableI18nText({ i18nKey, value, lang: langOverride, editMode: editModeOverride, tag = 'span', className = '', style, asHtml, children }: Props) {
    const { i18n } = useTranslation();
    const { isAdmin } = useIsAdmin();
    const ref = useRef<HTMLElement>(null);
    const [saving, setSaving] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);

    const lang = langOverride || (i18n.language?.split('-')[0] || 'tr');
    const editMode = editModeOverride !== undefined ? editModeOverride : (isAdmin && isEditModeRequested());

    useEffect(() => {
        if (ref.current && !asHtml) {
            ref.current.textContent = value;
        }
    }, [value, asHtml]);

    if (!editMode) {
        const Tag = tag as any;
        return asHtml
            ? <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: value }} />
            : <Tag className={className} style={style}>{children ?? value}</Tag>;
    }

    const handleBlur = async (e: React.FocusEvent) => {
        const newValue = (e.currentTarget as HTMLElement).innerText;
        if (newValue === value || saving) return;
        setSaving(true);
        try {
            const [namespace, key] = i18nKey.includes(':')
                ? i18nKey.split(':') as [string, string]
                : ['common', i18nKey];
            const { error } = await supabase
                .from('translations')
                .upsert(
                    { namespace, key, language_code: lang, value: newValue, updated_at: new Date().toISOString() },
                    { onConflict: 'namespace,key,language_code' }
                );
            if (error) throw error;
            LanguageService.clearTranslationCache(lang);
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1200);
        } catch (err: any) {
            console.error('[EditableI18nText] save failed:', err?.message || err);
        } finally {
            setSaving(false);
        }
    };

    const Tag = tag as any;
    const editClass = `${className} outline-none transition-shadow ${savedFlash ? 'ring-2 ring-emerald-400/60 rounded' : 'hover:ring-2 hover:ring-indigo-400/40 hover:rounded focus:ring-2 focus:ring-indigo-500 focus:rounded'}`;
    return (
        <Tag
            ref={ref}
            className={editClass}
            style={style}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
            spellCheck={false}
            data-i18n-key={i18nKey}
            dangerouslySetInnerHTML={asHtml ? { __html: value } : undefined}
        >
            {asHtml ? undefined : (children ?? value)}
        </Tag>
    );
}
