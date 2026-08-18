import React from 'react';
import type { ContentMap, EditorFieldId } from './schema/fields';

interface EditorContextValue {
    content: ContentMap;
    contentAlt: Partial<ContentMap>;
    dualLang: boolean;
    lang: string;
    langAlt: string;
    dirtyMap: Partial<Record<EditorFieldId, boolean>>;
    hovered: EditorFieldId | null;
    active: EditorFieldId | null;
    setHovered: (id: EditorFieldId | null) => void;
    setActive: (id: EditorFieldId | null) => void;
}

export const EditorContext = React.createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
    const ctx = React.useContext(EditorContext);
    if (!ctx) throw new Error('useEditor must be used inside <EditorContext.Provider>');
    return ctx;
}
