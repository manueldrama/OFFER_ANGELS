import React, { useState } from 'react';
import { Save, X, Loader2, Check, Plus, LogOut } from 'lucide-react';
import { getSupportedLanguages, getLanguageFlags, getLanguageLabels } from '../../i18n';
import { AddSectionMenu } from './AddSectionMenu';
import { exitEditMode } from '../../hooks/editModeFlag';

interface EditToolbarProps {
    editMode: boolean;
    activeLang: string;
    onLangChange: (lang: string) => void;
    onSave: () => Promise<boolean>;
    onDiscard: () => void;
    hasChanges: boolean;
    saving: boolean;
    changeCount: number;
    onAddSection?: (sectionType: string) => void;
    existingSectionTypes?: string[];
}

export function EditToolbar({ editMode, activeLang, onLangChange, onSave, onDiscard, hasChanges, saving, changeCount, onAddSection, existingSectionTypes }: EditToolbarProps) {
    if (!editMode) return null;

    const languages = getSupportedLanguages();
    const flags = getLanguageFlags();
    const labels = getLanguageLabels();
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        const ok = await onSave();
        if (ok) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-slate-900/95 backdrop-blur-sm text-white h-12 flex items-center justify-between px-4 shadow-lg">
            {/* Left: language selector */}
            <div className="flex items-center gap-1">
                {languages.map(lang => (
                    <button
                        key={lang}
                        onClick={() => onLangChange(lang)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                            activeLang === lang
                                ? 'bg-white/20 text-white'
                                : 'text-white/50 hover:text-white/80'
                        }`}
                    >
                        <span className="text-sm">{flags[lang]}</span>
                        <span className="uppercase">{lang}</span>
                    </button>
                ))}
            </div>

            {/* Center: status */}
            <div className="flex items-center gap-2">
                {hasChanges && (
                    <span className="text-xs text-amber-400 font-medium">
                        {changeCount} degisiklik
                    </span>
                )}
                {saved && (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <Check size={12} /> Kaydedildi
                    </span>
                )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
                {onAddSection && (
                    <AddSectionMenuToolbar onAdd={onAddSection} existingTypes={existingSectionTypes} />
                )}
                <button
                    onClick={() => {
                        if (hasChanges && !confirm('Kaydedilmemiş değişiklikler var. Yine de çıkmak ister misin?')) return;
                        exitEditMode();
                        window.location.reload();
                    }}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    title="Edit modundan çık"
                >
                    <LogOut size={14} /> Çıkış
                </button>
                <button
                    onClick={onDiscard}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X size={14} /> Iptal
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        hasChanges
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                            : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }`}
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
            </div>
        </div>
    );
}

const TPL_LIST: { type: string; label: string }[] = [
    { type: 'hero', label: 'Hero' },
    { type: 'stats', label: 'İstatistikler' },
    { type: 'how_it_works', label: 'Nasıl Çalışır' },
    { type: 'usage_scenarios', label: 'Kullanım Senaryoları' },
    { type: 'revenue_model', label: 'Gelir Modeli' },
    { type: 'roi_calculator', label: 'ROI Hesaplayıcı' },
    { type: 'use_cases', label: 'Kullanım Alanları' },
    { type: 'features', label: 'Özellikler' },
    { type: 'visual_proof', label: 'Görsel Kanıt' },
    { type: 'testimonials', label: 'Müşteri Sonuçları' },
    { type: 'footer_cta', label: 'Footer CTA' },
    { type: 'faq', label: 'SSS' },
];

function AddSectionMenuToolbar({ onAdd, existingTypes = [] }: { onAdd: (t: string) => void; existingTypes?: string[] }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
            >
                <Plus size={14} /> Bölüm Ekle
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-lg border border-slate-200 shadow-xl py-1 w-60 max-h-96 overflow-y-auto">
                        {TPL_LIST.map(t => {
                            const exists = existingTypes.includes(t.type);
                            return (
                                <button
                                    key={t.type}
                                    onClick={() => { onAdd(t.type); setOpen(false); }}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left text-xs text-slate-700"
                                >
                                    <span>{t.label}</span>
                                    {exists && <span className="text-[9px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded font-medium">Mevcut</span>}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
