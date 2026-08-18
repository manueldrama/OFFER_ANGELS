import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Globe } from 'lucide-react';
import type { TemplateNameOverrides } from '../../../services/admin/automationSettingsService';
import { AdminWhatsAppTemplatesService } from '../../../services/admin/whatsappTemplatesUIService';

// Sabit ülke listesi — country_payment_settings'teki ülkelerle uyumlu.
// Frontend bu listeden seçim yaptırır; arka uçta override key olarak country_code kullanılır.
const COUNTRY_OPTIONS: Array<{ code: string; label: string }> = [
    { code: 'TR', label: 'Türkiye' },
    { code: 'DE', label: 'Almanya' },
    { code: 'AT', label: 'Avusturya' },
    { code: 'CH', label: 'İsviçre' },
    { code: 'FR', label: 'Fransa' },
    { code: 'BE', label: 'Belçika' },
    { code: 'NL', label: 'Hollanda' },
    { code: 'IT', label: 'İtalya' },
    { code: 'ES', label: 'İspanya' },
    { code: 'PT', label: 'Portekiz' },
    { code: 'GB', label: 'İngiltere' },
    { code: 'IE', label: 'İrlanda' },
    { code: 'GR', label: 'Yunanistan' },
    { code: 'PL', label: 'Polonya' },
    { code: 'US', label: 'ABD' },
    { code: 'CA', label: 'Kanada' },
    { code: 'SA', label: 'Suudi Arabistan' },
    { code: 'AE', label: 'BAE' },
];

interface TemplateOverridesEditorProps {
    overrides: TemplateNameOverrides;
    defaultTemplateName: string;
    onChange: (overrides: TemplateNameOverrides) => void;
}

/**
 * Per-country template adı override editörü.
 * { TR: 'foo_tr', DE: 'foo_de' } formatında bir map'i KV editör olarak gösterir.
 * Boş bir override eklerken zaten kullanılmış ülkeyi disable eder.
 */
export function TemplateOverridesEditor({ overrides, defaultTemplateName, onChange }: TemplateOverridesEditorProps) {
    const [newCountry, setNewCountry] = useState<string>('');
    const [newTemplate, setNewTemplate] = useState<string>('');
    const [approvedTemplates, setApprovedTemplates] = useState<Array<{ name: string; language: string }>>([]);

    useEffect(() => {
        // Aynı modul-level cache zaten AutomationSettings'te var ama burada da
        // listApproved çağrısı cached şekilde hızlı döner.
        AdminWhatsAppTemplatesService.listApproved()
            .then(list => setApprovedTemplates(list.map(t => ({ name: t.name, language: t.meta_language_code || t.language || 'tr' }))))
            .catch(() => setApprovedTemplates([]));
    }, []);

    const entries = Object.entries(overrides || {});
    const usedCountries = new Set(entries.map(([c]) => c));
    const datalistId = `wa-tpl-override-${Math.random().toString(36).slice(2, 9)}`;

    const addOverride = () => {
        if (!newCountry || !newTemplate.trim()) return;
        onChange({ ...overrides, [newCountry]: newTemplate.trim() });
        setNewCountry('');
        setNewTemplate('');
    };

    const removeOverride = (country: string) => {
        const next = { ...overrides };
        delete next[country];
        onChange(next);
    };

    const updateOverride = (country: string, templateName: string) => {
        onChange({ ...overrides, [country]: templateName });
    };

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <Globe size={12} className="text-slate-500" />
                        <p className="text-xs font-medium text-slate-700">Ülke Bazlı Şablon Override'ları</p>
                    </div>
                    <p className="text-[10px] text-slate-400">
                        Belirli ülkelere farklı template gönder. Boşsa varsayılan{' '}
                        <span className="font-mono">{defaultTemplateName || '—'}</span> kullanılır.
                    </p>
                </div>
            </div>

            {entries.length > 0 && (
                <div className="space-y-1.5">
                    {entries.map(([country, templateName]) => {
                        const label = COUNTRY_OPTIONS.find(c => c.code === country)?.label || country;
                        return (
                            <div key={country} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded w-10 text-center">
                                    {country}
                                </span>
                                <span className="text-xs text-slate-500 hidden md:inline w-24 truncate">{label}</span>
                                <span className="text-xs text-slate-400">→</span>
                                <input
                                    type="text"
                                    list={datalistId}
                                    value={templateName}
                                    onChange={(e) => updateOverride(country, e.target.value)}
                                    placeholder="template_adi"
                                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-700 placeholder-slate-400 focus:border-slate-400 focus:outline-none font-mono"
                                />
                                <button
                                    onClick={() => removeOverride(country)}
                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="Override'ı sil"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <select
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-700 focus:border-slate-400 focus:outline-none w-32"
                >
                    <option value="">Ülke seç...</option>
                    {COUNTRY_OPTIONS.filter(c => !usedCountries.has(c.code)).map(c => (
                        <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                    ))}
                </select>
                <input
                    type="text"
                    list={datalistId}
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                    placeholder="override şablon adı"
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-700 placeholder-slate-400 focus:border-slate-400 focus:outline-none font-mono"
                />
                <button
                    onClick={addOverride}
                    disabled={!newCountry || !newTemplate.trim()}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                >
                    <Plus size={12} /> Ekle
                </button>
            </div>
            <datalist id={datalistId}>
                {approvedTemplates.map(t => (
                    <option key={t.name} value={t.name}>{t.language}</option>
                ))}
            </datalist>
        </div>
    );
}
