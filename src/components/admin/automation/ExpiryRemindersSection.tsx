import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, X, Save, Hourglass, BellRing, Clock, ChevronDown } from 'lucide-react';
import type { ExpiryReminder, TemplateParam, TemplateNameOverrides } from '../../../services/admin/automationSettingsService';
import { TemplateConfigSection } from '../../../pages/admin/AutomationSettings';
import { TemplateOverridesEditor } from './TemplateOverridesEditor';

interface ExpiryRemindersSectionProps {
    enabled: boolean;
    reminders: ExpiryReminder[];
    onToggleEnabled: () => void;
    onChangeReminders: (reminders: ExpiryReminder[]) => void;
}

const EMPTY_DRAFT = (): ExpiryReminderDraft => ({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `r_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    label: '',
    timing_type: 'before',
    hours_offset: 24,
    template_name: '',
    template_language: 'tr',
    template_params: [{ position: 1, variable: 'customer_name' }],
    template_name_overrides: {},
    enabled: true,
    position: 0,
});

interface ExpiryReminderDraft extends ExpiryReminder {}

function formatTiming(reminder: ExpiryReminder): string {
    const verb = reminder.timing_type === 'before' ? 'önce' : 'sonra';
    const h = reminder.hours_offset;
    if (h < 1) return `${Math.round(h * 60)} dakika ${verb}`;
    if (h < 24) return `${h} saat ${verb}`;
    const days = Math.floor(h / 24);
    const rem = h % 24;
    return rem === 0 ? `${days} gün ${verb}` : `${days} gün ${rem} saat ${verb}`;
}

export function ExpiryRemindersSection({ enabled, reminders, onToggleEnabled, onChangeReminders }: ExpiryRemindersSectionProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<ExpiryReminderDraft | null>(null);

    const sortedReminders = [...reminders].sort((a, b) => (a.position || 0) - (b.position || 0));

    const startNew = () => {
        const next = EMPTY_DRAFT();
        next.position = (reminders.reduce((m, r) => Math.max(m, r.position || 0), 0) || 0) + 1;
        setEditingId('new');
        setDraft(next);
    };

    const startEdit = (r: ExpiryReminder) => {
        setEditingId(r.id);
        setDraft({ ...r, template_params: [...(r.template_params || [])], template_name_overrides: { ...(r.template_name_overrides || {}) } });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraft(null);
    };

    const saveDraft = () => {
        if (!draft) return;
        if (!draft.label.trim() || !draft.template_name.trim() || !draft.hours_offset) return;
        if (editingId === 'new') {
            onChangeReminders([...reminders, draft]);
        } else if (editingId) {
            onChangeReminders(reminders.map(r => r.id === editingId ? draft : r));
        }
        cancelEdit();
    };

    const deleteReminder = (r: ExpiryReminder) => {
        if (!window.confirm(`"${r.label}" hatırlatmasını silmek istediğinize emin misiniz?`)) return;
        onChangeReminders(reminders.filter(x => x.id !== r.id));
    };

    const toggleReminder = (r: ExpiryReminder) => {
        onChangeReminders(reminders.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x));
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Header — master toggle */}
            <div className={`p-4 border-b border-slate-100 transition-colors ${enabled ? 'bg-emerald-50/30' : 'bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Hourglass size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-800">Süre Bazlı Hatırlatmalar</h3>
                                {enabled && (
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">
                                        Zamanlı
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
                                Tekliflerin geçerlilik süresine göre otomatik WhatsApp hatırlatması gönderir.
                                Birden fazla pencere ekleyebilirsin (1 gün önce, 3 saat önce, 1 saat sonra vb.).
                            </p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input type="checkbox" className="sr-only peer" checked={enabled} onChange={onToggleEnabled} />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>
            </div>

            {/* List of reminders */}
            <div className="p-4 space-y-2">
                {sortedReminders.length === 0 && editingId === null && (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                        <BellRing size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">Henüz hatırlatma penceresi tanımlanmadı.</p>
                        <p className="text-xs text-slate-400 mt-1">Aşağıdan ilk hatırlatmayı ekleyin (örn. "1 gün önce").</p>
                    </div>
                )}

                {sortedReminders.map(r => (
                    <div
                        key={r.id}
                        className={`border rounded-lg p-3 transition-colors ${r.enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" className="sr-only peer" checked={r.enabled} onChange={() => toggleReminder(r)} />
                                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Clock size={14} className={r.enabled ? 'text-indigo-500 shrink-0' : 'text-slate-400 shrink-0'} />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-sm font-medium truncate ${r.enabled ? 'text-slate-800' : 'text-slate-500'}`}>
                                                {r.label || '(adsız)'}
                                            </span>
                                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                                r.timing_type === 'before' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                                            }`}>
                                                {formatTiming(r)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                            <span className="font-mono">{r.template_name}</span>
                                            <span className="text-slate-300"> · </span>
                                            <span>{r.template_language}</span>
                                            {Object.keys(r.template_name_overrides || {}).length > 0 && (
                                                <>
                                                    <span className="text-slate-300"> · </span>
                                                    <span>{Object.keys(r.template_name_overrides).length} ülke override</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => startEdit(r)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                    title="Düzenle"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => deleteReminder(r)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                    title="Sil"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Edit / new form */}
                <AnimatePresence initial={false}>
                    {editingId && draft && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="border-2 border-indigo-200 bg-indigo-50/30 rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-slate-800">
                                        {editingId === 'new' ? 'Yeni Hatırlatma' : 'Hatırlatma Düzenle'}
                                    </h4>
                                    <button onClick={cancelEdit} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-slate-600 mb-1.5 block">Etiket</label>
                                        <input
                                            type="text"
                                            value={draft.label}
                                            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                                            placeholder="Örn. 1 gün öncesi hatırlatma"
                                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-700 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-600 mb-1.5 block">Zaman</label>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                min={1}
                                                value={draft.hours_offset}
                                                onChange={(e) => setDraft({ ...draft, hours_offset: parseInt(e.target.value) || 1 })}
                                                className="w-20 px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-700 focus:border-slate-400 focus:outline-none"
                                            />
                                            <span className="text-xs text-slate-500">saat</span>
                                            <select
                                                value={draft.timing_type}
                                                onChange={(e) => setDraft({ ...draft, timing_type: e.target.value as 'before' | 'after' })}
                                                className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-700 focus:border-slate-400 focus:outline-none"
                                            >
                                                <option value="before">önce</option>
                                                <option value="after">sonra</option>
                                            </select>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {draft.timing_type === 'before'
                                                ? 'Süre dolmadan önce gönderilir'
                                                : 'Süre dolduktan sonra gönderilir'}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <TemplateConfigSection
                                        templateName={draft.template_name}
                                        templateLanguage={draft.template_language}
                                        templateParams={draft.template_params}
                                        onChange={(updates) => {
                                            const next = { ...draft };
                                            if (updates.template_name !== undefined) next.template_name = updates.template_name;
                                            if (updates.template_language !== undefined) next.template_language = updates.template_language;
                                            if (updates.template_params !== undefined) next.template_params = updates.template_params;
                                            setDraft(next);
                                        }}
                                    />
                                </div>

                                <TemplateOverridesEditor
                                    overrides={draft.template_name_overrides}
                                    defaultTemplateName={draft.template_name}
                                    onChange={(overrides: TemplateNameOverrides) => setDraft({ ...draft, template_name_overrides: overrides })}
                                />

                                <div className="flex items-center justify-between gap-2 pt-3 border-t border-indigo-200">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={draft.enabled}
                                            onChange={() => setDraft({ ...draft, enabled: !draft.enabled })}
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs text-slate-600">Bu hatırlatma aktif</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={cancelEdit}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                                        >
                                            İptal
                                        </button>
                                        <button
                                            onClick={saveDraft}
                                            disabled={!draft.label.trim() || !draft.template_name.trim() || !draft.hours_offset}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:hover:bg-indigo-600"
                                        >
                                            <Save size={12} />
                                            Kaydet
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* + Add button (only if not currently editing) */}
                {!editingId && (
                    <button
                        onClick={startNew}
                        disabled={!enabled}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-sm font-medium text-slate-500 hover:text-indigo-600 rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-slate-200 disabled:cursor-not-allowed"
                    >
                        <Plus size={14} />
                        Yeni Hatırlatma Ekle
                    </button>
                )}
            </div>
        </div>
    );
}
