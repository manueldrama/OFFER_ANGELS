import React, { useState } from 'react';
import { type FieldDef } from './sectionFieldDefs';
import { ImageUploadField } from './ImageUploadField';
import { AVAILABLE_ICONS } from '../../landing/iconMap';
import { LandingPageItem } from '../../../types';

interface ItemFieldEditorProps {
    field: FieldDef;
    item: LandingPageItem;
    saving: boolean;
    onSave: (updates: Partial<LandingPageItem>) => void;
}

export function ItemFieldEditor({ field, item, saving, onSave }: ItemFieldEditorProps) {
    const getValue = (): string => {
        if (field.nested) {
            return (item.extra?.[field.key] as string) ?? '';
        }
        return ((item as any)[field.key] as string) ?? '';
    };

    const [value, setValue] = useState(getValue());
    const [dirty, setDirty] = useState(false);

    const handleBlur = () => {
        if (!dirty) return;
        if (field.nested) {
            onSave({ extra: { ...item.extra, [field.key]: value } });
        } else {
            onSave({ [field.key]: value || null });
        }
        setDirty(false);
    };

    return (
        <div>
            <label className="block text-xs font-medium text-slate-500 mb-0.5">{field.label}</label>
            {field.type === 'textarea' ? (
                <textarea
                    value={value}
                    onChange={e => { setValue(e.target.value); setDirty(true); }}
                    onBlur={handleBlur}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    rows={2}
                />
            ) : field.type === 'image' ? (
                <ImageUploadField value={value} acceptVideo={field.acceptVideo} circularCrop={field.circularCrop} onChange={url => { setValue(url); setDirty(true); setTimeout(() => { if (field.nested) { onSave({ extra: { ...item.extra, [field.key]: url } }); } else { onSave({ [field.key]: url || null }); } }, 0); }} />
            ) : field.type === 'select' ? (
                <select
                    value={value}
                    onChange={e => {
                        setValue(e.target.value); setDirty(true);
                        setTimeout(() => {
                            if (field.nested) { onSave({ extra: { ...item.extra, [field.key]: e.target.value } }); }
                            else { onSave({ [field.key]: e.target.value || null }); }
                        }, 0);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                >
                    {(field.options ?? []).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            ) : field.type === 'icon' ? (
                <select
                    value={value}
                    onChange={e => { setValue(e.target.value); setDirty(true); setTimeout(() => onSave({ [field.key]: e.target.value || null }), 0); }}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                    <option value="">Seciniz...</option>
                    {AVAILABLE_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={e => { setValue(e.target.value); setDirty(true); }}
                    onBlur={handleBlur}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
            )}
        </div>
    );
}
