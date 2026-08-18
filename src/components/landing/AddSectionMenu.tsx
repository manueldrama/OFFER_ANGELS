import React, { useState } from 'react';
import { Plus, Globe, BarChart3, HelpCircle, Layers, Calculator, Building2, Sparkles, ImageIcon, MessageSquareQuote, Megaphone } from 'lucide-react';

const SECTION_TEMPLATES: { type: string; label: string; icon: React.ElementType }[] = [
    { type: 'hero', label: 'Ana Sayfa (Hero)', icon: Globe },
    { type: 'stats', label: 'İstatistikler', icon: BarChart3 },
    { type: 'how_it_works', label: 'Nasıl Çalışır?', icon: HelpCircle },
    { type: 'usage_scenarios', label: 'Kullanım Senaryoları', icon: Layers },
    { type: 'revenue_model', label: 'Gelir Modeli', icon: BarChart3 },
    { type: 'roi_calculator', label: 'ROI Hesaplayıcı', icon: Calculator },
    { type: 'use_cases', label: 'Kullanım Alanları', icon: Building2 },
    { type: 'features', label: 'Özellikler', icon: Sparkles },
    { type: 'visual_proof', label: 'Görsel Kanıt', icon: ImageIcon },
    { type: 'testimonials', label: 'Müşteri Sonuçları', icon: MessageSquareQuote },
    { type: 'footer_cta', label: 'Footer CTA', icon: Megaphone },
    { type: 'faq', label: 'SSS', icon: HelpCircle },
];

interface Props {
    onAdd: (sectionType: string) => void;
    /** Existing section types to mark as already-present */
    existingTypes?: string[];
}

export function AddSectionMenu({ onAdd, existingTypes = [] }: Props) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative my-2 flex justify-center">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-indigo-600 border border-indigo-200 rounded-full shadow-sm hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
            >
                <Plus size={14} />
                Bölüm Ekle
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute top-full mt-2 z-40 bg-white rounded-lg border border-slate-200 shadow-xl py-1 w-64 max-h-96 overflow-y-auto">
                        {SECTION_TEMPLATES.map(t => {
                            const TIcon = t.icon;
                            const exists = existingTypes.includes(t.type);
                            return (
                                <button
                                    key={t.type}
                                    onClick={() => { onAdd(t.type); setOpen(false); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 text-left text-sm text-slate-700"
                                >
                                    <TIcon size={16} className="text-slate-400 shrink-0" />
                                    <span className="flex-1">{t.label}</span>
                                    {exists && (
                                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">Zaten Var</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
