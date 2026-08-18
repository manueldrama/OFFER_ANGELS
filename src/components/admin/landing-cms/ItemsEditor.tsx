import React, { useState } from 'react';
import { Plus, Eye, EyeOff, Trash2 } from 'lucide-react';
import { LandingPageCmsService } from '../../../services/admin/landingPageCmsService';
import { LandingPagePublicService } from '../../../services/landingPagePublicService';
import { LandingPageSection, LandingPageItem } from '../../../types';
import { type FieldDef } from './sectionFieldDefs';
import { ItemFieldEditor } from './ItemFieldEditor';
import { useToast } from '../../../contexts/ToastContext';

interface ItemsEditorProps {
    section: LandingPageSection;
    itemFields: FieldDef[];
    onItemsChange: () => void;
}

export function ItemsEditor({ section, itemFields, onItemsChange }: ItemsEditorProps) {
    const { success, error: toastError } = useToast();
    const [items, setItems] = useState<LandingPageItem[]>(section.items ?? []);
    const [savingId, setSavingId] = useState<string | null>(null);

    const handleAddItem = async () => {
        try {
            const newItem = await LandingPageCmsService.createItem({
                section_id: section.id,
                title: 'Yeni oge',
                description: null,
                value_text: null,
                media_url: null,
                icon: null,
                extra: {},
                is_active: true,
                sort_order: items.length * 10,
            });
            setItems(prev => [...prev, newItem]);
            LandingPagePublicService.clearCache();
            onItemsChange();
            success('Basarili', 'Yeni oge eklendi.');
        } catch {
            toastError('Hata', 'Oge eklenemedi.');
        }
    };

    const handleUpdateItem = async (id: string, updates: Partial<LandingPageItem>) => {
        setSavingId(id);
        try {
            await LandingPageCmsService.updateItem(id, updates);
            setItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));
            LandingPagePublicService.clearCache();
            onItemsChange();
            success('Basarili', 'Oge guncellendi.');
        } catch {
            toastError('Hata', 'Oge guncellenemedi.');
        } finally {
            setSavingId(null);
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm('Bu ogeyi silmek istediginize emin misiniz?')) return;
        try {
            await LandingPageCmsService.deleteItem(id);
            setItems(prev => prev.filter(it => it.id !== id));
            LandingPagePublicService.clearCache();
            onItemsChange();
            success('Basarili', 'Oge silindi.');
        } catch {
            toastError('Hata', 'Oge silinemedi.');
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ogeler ({items.length})</p>
                <button onClick={handleAddItem} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors">
                    <Plus size={12} /> Oge Ekle
                </button>
            </div>

            {items.map((item, idx) => (
                <div key={item.id} className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">#{idx + 1}</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => handleUpdateItem(item.id, { is_active: !item.is_active })} className={`p-1 rounded ${item.is_active ? 'text-emerald-600' : 'text-slate-400'}`} title={item.is_active ? 'Aktif' : 'Pasif'}>
                                {item.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                            <button onClick={() => handleDeleteItem(item.id)} className="p-1 rounded text-red-400 hover:text-red-600">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>

                    {itemFields.map(field => (
                        <React.Fragment key={field.key}>
                            <ItemFieldEditor
                                field={field}
                                item={item}
                                saving={savingId === item.id}
                                onSave={(updates) => handleUpdateItem(item.id, updates)}
                            />
                        </React.Fragment>
                    ))}
                </div>
            ))}
        </div>
    );
}
