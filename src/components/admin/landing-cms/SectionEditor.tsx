import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { LandingPageCmsService } from '../../../services/admin/landingPageCmsService';
import { LandingPagePublicService } from '../../../services/landingPagePublicService';
import { LandingPageSection } from '../../../types';
import { getConfigFields, getItemFields } from './sectionFieldDefs';
import { ImageUploadField } from './ImageUploadField';
import { ItemsEditor } from './ItemsEditor';
import { useToast } from '../../../contexts/ToastContext';

interface SectionEditorProps {
    section: LandingPageSection;
    onUpdate: (updates: Partial<LandingPageSection>) => void;
    onItemsChange: () => void;
}

export function SectionEditor({ section, onUpdate, onItemsChange }: SectionEditorProps) {
    const { success, error: toastError } = useToast();
    const [config, setConfig] = useState<Record<string, any>>(section.config ?? {});
    const [saving, setSaving] = useState(false);

    const configFields = getConfigFields(section.section_type);
    const itemFields = getItemFields(section.section_type);
    const hasItems = itemFields.length > 0;

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            await LandingPageCmsService.updateSection(section.id, { config, title: config._title || section.title });
            LandingPagePublicService.clearCache();
            onUpdate({ config });
            success('Basarili', 'Bolum ayarlari kaydedildi.');
        } catch (err: any) {
            console.error('[LandingCMS] Save failed:', err);
            toastError('Hata', err?.message || 'Ayarlar kaydedilemedi.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4">
            {configFields.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bolum Ayarlari</p>
                    {configFields.map(field => (
                        <div key={field.key}>
                            <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
                            {field.type === 'textarea' ? (
                                <textarea
                                    value={config[field.key] ?? ''}
                                    onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    rows={3}
                                />
                            ) : field.type === 'image' ? (
                                <ImageUploadField value={config[field.key] ?? ''} onChange={url => setConfig(prev => ({ ...prev, [field.key]: url }))} acceptVideo={field.acceptVideo} circularCrop={field.circularCrop} />
                            ) : field.type === 'select' ? (
                                <select
                                    value={config[field.key] ?? ''}
                                    onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                >
                                    {(field.options ?? []).map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            ) : field.type === 'number' ? (
                                <input
                                    type="number"
                                    min={field.min}
                                    max={field.max}
                                    value={config[field.key] ?? ''}
                                    onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            ) : field.type === 'boolean' ? (
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(config[field.key])}
                                        onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.checked }))}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs text-slate-600">{config[field.key] ? 'Açık' : 'Kapalı'}</span>
                                </label>
                            ) : (
                                <input
                                    type="text"
                                    value={config[field.key] ?? ''}
                                    onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            )}
                        </div>
                    ))}
                    <button onClick={handleSaveConfig} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                        <Save size={14} /> {saving ? 'Kaydediliyor...' : 'Ayarlari Kaydet'}
                    </button>
                </div>
            )}

            {hasItems && (
                <ItemsEditor section={section} itemFields={itemFields} onItemsChange={onItemsChange} />
            )}
        </div>
    );
}
