import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Zap, ChevronDown, X, Save } from 'lucide-react';
import {
    AdminAutomationRulesService,
    AutomationRule,
    AutomationRuleDraft,
    TRIGGER_EVENT_OPTIONS,
} from '../../../services/admin/automationRulesService';
import type { TemplateParam } from '../../../services/admin/automationSettingsService';
import { TemplateConfigSection } from '../../../pages/admin/AutomationSettings';
import { useToast } from '../../../contexts/ToastContext';
import { LoadingSpinner } from '../../ui/LoadingSpinner';

const EMPTY_DRAFT: AutomationRuleDraft = {
    name: '',
    description: null,
    is_enabled: true,
    trigger_event: 'link_opened',
    trigger_negate: true,
    delay_hours: 24,
    template_name: '',
    template_language: 'tr',
    template_params: [{ position: 1, variable: 'customer_name' }],
    has_header_image: false,
    header_image_url: null,
    has_url_button: false,
    url_button_path: null,
    audience_filter: null,
};

export function CustomAutomationRulesSection() {
    const { success, error } = useToast();
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<AutomationRuleDraft | null>(null);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            const data = await AdminAutomationRulesService.list();
            setRules(data);
        } catch (err: any) {
            error('Hata', 'Özel kurallar yüklenemedi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const startNew = () => {
        setEditingId('new');
        setDraft({ ...EMPTY_DRAFT });
    };

    const startEdit = (rule: AutomationRule) => {
        setEditingId(rule.id);
        setDraft({
            name: rule.name,
            description: rule.description,
            is_enabled: rule.is_enabled,
            trigger_event: rule.trigger_event,
            trigger_negate: rule.trigger_negate,
            delay_hours: rule.delay_hours,
            template_name: rule.template_name,
            template_language: rule.template_language,
            template_params: rule.template_params || [],
            has_header_image: rule.has_header_image || false,
            header_image_url: rule.header_image_url || null,
            has_url_button: rule.has_url_button || false,
            url_button_path: rule.url_button_path || null,
            audience_filter: rule.audience_filter || null,
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraft(null);
    };

    const saveRule = async () => {
        if (!draft) return;
        if (!draft.name.trim() || !draft.template_name.trim()) {
            error('Eksik bilgi', 'Kural adı ve şablon adı zorunlu.');
            return;
        }
        setSaving(true);
        try {
            if (editingId === 'new') {
                await AdminAutomationRulesService.create(draft);
                success('Eklendi', `"${draft.name}" kuralı oluşturuldu.`);
            } else if (editingId) {
                await AdminAutomationRulesService.update(editingId, draft);
                success('Güncellendi', `"${draft.name}" kuralı kaydedildi.`);
            }
            cancelEdit();
            await load();
        } catch (err: any) {
            error('Hata', err?.message || 'Kural kaydedilemedi.');
        } finally {
            setSaving(false);
        }
    };

    const toggleRule = async (rule: AutomationRule) => {
        try {
            await AdminAutomationRulesService.toggle(rule.id, !rule.is_enabled);
            await load();
        } catch (err: any) {
            error('Hata', 'Durum değiştirilemedi.');
        }
    };

    const deleteRule = async (rule: AutomationRule) => {
        if (!window.confirm(`"${rule.name}" kuralını silmek istediğinizden emin misiniz?`)) return;
        try {
            await AdminAutomationRulesService.delete(rule.id);
            success('Silindi', `"${rule.name}" kuralı silindi.`);
            await load();
        } catch (err: any) {
            error('Hata', 'Kural silinemedi.');
        }
    };

    const updateDraft = (patch: Partial<AutomationRuleDraft>) => {
        setDraft(prev => prev ? { ...prev, ...patch } : prev);
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap size={16} className="text-indigo-600" />
                    <h3 className="font-semibold text-slate-800">Özel Otomasyon Kuralları</h3>
                    <span className="text-xs text-slate-500 ml-2">{rules.length} kural</span>
                </div>
                {!editingId && (
                    <button
                        onClick={startNew}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                        <Plus size={14} /> Yeni Kural
                    </button>
                )}
            </div>

            {/* Yeni/Düzenleme formu */}
            {editingId && draft && (
                <div className="p-4 border-b border-slate-100 bg-indigo-50/30">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-slate-800">
                            {editingId === 'new' ? 'Yeni Kural Oluştur' : 'Kuralı Düzenle'}
                        </h4>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={cancelEdit}
                                disabled={saving}
                                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
                            >
                                İptal
                            </button>
                            <button
                                onClick={saveRule}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                            >
                                <Save size={14} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {/* Ad + açıklama */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-1">
                                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Kural Adı *</label>
                                <input
                                    type="text"
                                    value={draft.name}
                                    onChange={(e) => updateDraft({ name: e.target.value })}
                                    placeholder="Örn. 3 günlük sessizlik"
                                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-700 focus:border-slate-400 focus:outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Açıklama</label>
                                <input
                                    type="text"
                                    value={draft.description || ''}
                                    onChange={(e) => updateDraft({ description: e.target.value || null })}
                                    placeholder="Bu kural ne işe yarıyor?"
                                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-700 focus:border-slate-400 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Tetikleyici */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tetikleyici Event</label>
                                <select
                                    value={draft.trigger_event}
                                    onChange={(e) => {
                                        const opt = TRIGGER_EVENT_OPTIONS.find(o => o.value === e.target.value);
                                        updateDraft({ trigger_event: e.target.value as any, trigger_negate: opt?.defaultNegate ?? true });
                                    }}
                                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-700 focus:border-slate-400 focus:outline-none"
                                >
                                    {Array.from(new Set(TRIGGER_EVENT_OPTIONS.map(o => o.group))).map(groupName => (
                                        <optgroup key={groupName} label={groupName}>
                                            {TRIGGER_EVENT_OPTIONS.filter(o => o.group === groupName).map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tetikleme Mantığı</label>
                                <select
                                    value={draft.trigger_negate ? 'negate' : 'positive'}
                                    onChange={(e) => updateDraft({ trigger_negate: e.target.value === 'negate' })}
                                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-700 focus:border-slate-400 focus:outline-none"
                                >
                                    <option value="negate">Event GERÇEKLEŞMEDİYSE tetikle</option>
                                    <option value="positive">Event GERÇEKLEŞTİYSE tetikle</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Bekleme Süresi (saat)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={draft.delay_hours}
                                    onChange={(e) => updateDraft({ delay_hours: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-700 focus:border-slate-400 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Template config (reusable section) */}
                        <div className="pt-2 border-t border-slate-200">
                            <TemplateConfigSection
                                templateName={draft.template_name}
                                templateLanguage={draft.template_language}
                                templateParams={draft.template_params}
                                onChange={(updates) => {
                                    const patch: Partial<AutomationRuleDraft> = {};
                                    if (updates.template_name !== undefined) patch.template_name = updates.template_name;
                                    if (updates.template_language !== undefined) patch.template_language = updates.template_language;
                                    if (updates.template_params !== undefined) patch.template_params = updates.template_params;
                                    updateDraft(patch);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Kural listesi */}
            <div className="divide-y divide-slate-100">
                {loading ? (
                    <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                ) : rules.length === 0 && !editingId ? (
                    <div className="p-8 text-center">
                        <Zap size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500 font-medium">Henüz özel kural yok</p>
                        <p className="text-xs text-slate-400 mt-1">Yukarıdaki "Yeni Kural" butonuyla başlayın</p>
                    </div>
                ) : (
                    rules.map(rule => (
                        <div key={rule.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${!rule.is_enabled ? 'bg-slate-50' : ''}`}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={rule.is_enabled} onChange={() => toggleRule(rule)} />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                    <span className={`font-medium ${rule.is_enabled ? 'text-slate-800' : 'text-slate-500'}`}>
                                        {rule.name}
                                    </span>
                                </div>
                                {rule.description && (
                                    <p className="text-sm text-slate-500 max-w-2xl ml-12">{rule.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1.5 ml-12 flex-wrap">
                                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                        {TRIGGER_EVENT_OPTIONS.find(o => o.value === rule.trigger_event)?.label || rule.trigger_event}
                                        {rule.trigger_negate ? ' yok' : ' var'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">·</span>
                                    <span className="text-[10px] text-slate-500">{rule.delay_hours} saat sonra</span>
                                    <span className="text-[10px] text-slate-400">·</span>
                                    <span className="text-[10px] font-mono text-indigo-600">{rule.template_name}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => startEdit(rule)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                    title="Düzenle"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => deleteRule(rule)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title="Sil"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
