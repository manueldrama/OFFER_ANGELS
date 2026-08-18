import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Loader2, Check, Sparkles, RefreshCw, Pencil, Languages as LanguagesIcon, LogOut } from 'lucide-react';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { isEditModeRequested, exitEditMode } from '../../hooks/editModeFlag';
import { getI18nUsage, subscribeI18nUsage, clearI18nUsage, updateI18nUsageValue, I18nUsage } from '../../hooks/i18nUsageTracker';
import { supabase } from '../../lib/supabase/client';
import { LanguageService } from '../../services/admin/languageService';

/**
 * Universal Edit Overlay — sidebar drawer that lists every i18n key rendered
 * on the current page and lets admins edit each value inline.
 *
 * Toggle: Ctrl+Shift+E (admin + ?edit=true required).
 *
 * Solves the problem where t() calls assigned to variables (e.g. option.label = t(...))
 * don't get caught by the EditableI18nText codemod — those still appear here.
 */
export function UniversalEditOverlay() {
    const { i18n } = useTranslation();
    const { isAdmin } = useIsAdmin();
    const editMode = isAdmin && isEditModeRequested();

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [nsFilter, setNsFilter] = useState<string>('all');
    const [, setTick] = useState(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [savingId, setSavingId] = useState<string | null>(null);
    const [savedFlash, setSavedFlash] = useState<Record<string, number>>({});
    const [aiBusy, setAiBusy] = useState<string | null>(null);

    const lang = i18n.language?.split('-')[0] || 'tr';

    // Subscribe to usage updates
    useEffect(() => {
        return subscribeI18nUsage(() => setTick(t => t + 1));
    }, []);

    // Keyboard shortcut Alt+E (Ctrl+Shift+E conflicts with browser shortcuts)
    useEffect(() => {
        if (!editMode) return;
        const handler = (e: KeyboardEvent) => {
            if (e.altKey && (e.key === 'E' || e.key === 'e')) {
                e.preventDefault();
                setOpen(o => !o);
            }
            if (e.key === 'Escape' && open) setOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [editMode, open]);

    const usage = getI18nUsage();
    const namespaces = useMemo(() => {
        const set = new Set(usage.map(u => u.namespace));
        return Array.from(set).sort();
    }, [usage]);

    if (!editMode) return null;

    const filtered = usage.filter(u => {
        if (u.language !== lang) return false;
        if (nsFilter !== 'all' && u.namespace !== nsFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            return u.key.toLowerCase().includes(q) ||
                u.value.toLowerCase().includes(q) ||
                u.namespace.toLowerCase().includes(q);
        }
        return true;
    });

    const idOf = (u: I18nUsage) => `${u.namespace}::${u.key}`;

    const startEdit = (u: I18nUsage) => {
        setEditingId(idOf(u));
        setEditValue(u.value);
    };
    const cancelEdit = () => {
        setEditingId(null);
        setEditValue('');
    };
    const saveEdit = async (u: I18nUsage) => {
        const id = idOf(u);
        if (editValue === u.value) { cancelEdit(); return; }
        setSavingId(id);
        try {
            const { error } = await supabase
                .from('translations')
                .upsert(
                    { namespace: u.namespace, key: u.key, language_code: u.language, value: editValue, updated_at: new Date().toISOString() },
                    { onConflict: 'namespace,key,language_code' }
                );
            if (error) throw error;
            LanguageService.clearTranslationCache(u.language);
            updateI18nUsageValue(u.namespace, u.key, u.language, editValue);
            // Force i18next to refresh resources for current language so live page updates
            try { await i18n.reloadResources([u.language], [u.namespace]); } catch { /* */ }
            setSavedFlash(s => ({ ...s, [id]: Date.now() }));
            setTimeout(() => setSavedFlash(s => { const c = { ...s }; delete c[id]; return c; }), 1500);
            cancelEdit();
        } catch (err: any) {
            console.error('[UniversalEditOverlay] save failed:', err?.message || err);
        } finally {
            setSavingId(null);
        }
    };

    const aiTranslate = async (u: I18nUsage) => {
        setAiBusy(idOf(u));
        try {
            const { AiTranslationService } = await import('../../services/admin/aiTranslationService');
            // Need TR source to translate from — fetch
            const { data: trRow } = await supabase
                .from('translations')
                .select('value')
                .eq('namespace', u.namespace)
                .eq('key', u.key)
                .eq('language_code', 'tr')
                .single();
            const source = trRow?.value || u.value;
            const res = await AiTranslationService.translateBatch([{ key: 'one', value: source }], [u.language]);
            const translated = res.find(r => r.key === 'one')?.value?.trim();
            if (!translated) return;
            await supabase
                .from('translations')
                .upsert(
                    { namespace: u.namespace, key: u.key, language_code: u.language, value: translated, updated_at: new Date().toISOString() },
                    { onConflict: 'namespace,key,language_code' }
                );
            LanguageService.clearTranslationCache(u.language);
            updateI18nUsageValue(u.namespace, u.key, u.language, translated);
            try { await i18n.reloadResources([u.language], [u.namespace]); } catch { /* */ }
        } catch (err: any) {
            console.error('[UniversalEditOverlay] AI translate failed:', err?.message || err);
        } finally {
            setAiBusy(null);
        }
    };

    return (
        <>
            {/* Floating toggle button (always visible in edit mode) */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-4 right-4 z-[9998] flex items-center gap-2 px-4 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl transition-colors font-semibold text-sm"
                    title="Sayfadaki tüm metinleri düzenle (Alt+E)"
                    style={{ boxShadow: '0 8px 24px rgba(79,70,229,0.5)' }}
                >
                    <Pencil size={16} />
                    <span>Metinleri Düzenle</span>
                    <kbd className="text-[9px] font-mono bg-white/20 px-1.5 py-0.5 rounded">Alt+E</kbd>
                </button>
            )}

            {/* Drawer */}
            {open && (
                <div className="fixed top-0 right-0 bottom-0 z-[9998] w-full md:w-[440px] bg-white shadow-2xl flex flex-col border-l border-slate-200">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-2 min-w-0">
                            <Pencil size={15} className="text-indigo-600 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-800">Sayfada Editlenebilen Metinler</div>
                                <div className="text-[11px] text-slate-500">{filtered.length} / {usage.filter(u => u.language === lang).length} key · dil: <span className="uppercase font-mono">{lang}</span></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => clearI18nUsage()} title="Listeyi temizle (sayfada yeniden render olunca tekrar dolar)" className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded">
                                <RefreshCw size={14} />
                            </button>
                            <button
                                onClick={() => {
                                    if (!confirm('Edit modundan çıkmak istiyor musun?')) return;
                                    exitEditMode();
                                    window.location.reload();
                                }}
                                title="Edit modundan çık"
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                                <LogOut size={14} />
                            </button>
                            <button onClick={() => setOpen(false)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded">
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 shrink-0">
                        <select
                            value={nsFilter}
                            onChange={e => setNsFilter(e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded text-xs bg-white"
                        >
                            <option value="all">Tüm namespace</option>
                            {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                        </select>
                        <div className="relative flex-1">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="key veya metin ara..."
                                className="w-full pl-7 pr-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-400">
                                {usage.length === 0
                                    ? 'Henüz hiçbir t() çağrısı yakalanmadı. Sayfayı kullanmaya başla — overlay otomatik dolar.'
                                    : 'Filtrelere uyan key yok.'}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filtered.map(u => {
                                    const id = idOf(u);
                                    const isEditing = editingId === id;
                                    const isSaving = savingId === id;
                                    const justSaved = !!savedFlash[id];
                                    const isAi = aiBusy === id;
                                    return (
                                        <div key={id} className={`px-4 py-2.5 group ${justSaved ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[9px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">{u.namespace}</span>
                                                <span className="text-[10px] font-mono text-slate-700 truncate flex-1" title={u.key}>{u.key}</span>
                                                {u.count > 1 && (
                                                    <span className="text-[9px] text-slate-400 shrink-0" title={`${u.count}x render`}>×{u.count}</span>
                                                )}
                                                {justSaved && (
                                                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 shrink-0">
                                                        <Check size={11} /> kaydedildi
                                                    </span>
                                                )}
                                            </div>
                                            {isEditing ? (
                                                <div className="flex items-start gap-1.5">
                                                    <textarea
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        rows={Math.max(1, Math.ceil(editValue.length / 50))}
                                                        autoFocus
                                                        className="flex-1 text-xs px-2 py-1.5 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-y"
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(u); }
                                                            if (e.key === 'Escape') cancelEdit();
                                                        }}
                                                    />
                                                    <button onClick={() => saveEdit(u)} disabled={isSaving} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded disabled:opacity-50">
                                                        {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                                    </button>
                                                    <button onClick={cancelEdit} className="p-1.5 bg-slate-50 text-slate-500 hover:bg-slate-100 rounded">
                                                        <X size={13} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => startEdit(u)}
                                                    className="text-xs text-slate-800 cursor-pointer hover:text-indigo-600 break-words py-0.5"
                                                >
                                                    {u.value || <span className="text-slate-300 italic">boş</span>}
                                                </div>
                                            )}
                                            {!isEditing && (
                                                <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => startEdit(u)}
                                                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                                        title="Düzenle"
                                                    >
                                                        <Pencil size={11} />
                                                    </button>
                                                    {u.language !== 'tr' && (
                                                        <button
                                                            onClick={() => aiTranslate(u)}
                                                            disabled={isAi}
                                                            className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded disabled:opacity-50"
                                                            title="AI ile yeniden çevir"
                                                        >
                                                            {isAi ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer hint */}
                    <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 shrink-0 flex items-center gap-1.5">
                        <LanguagesIcon size={10} /> Dil değiştirmek için sayfa üstündeki dil seçicisini kullan · <kbd className="px-1 py-0.5 bg-slate-100 rounded font-mono">Alt+E</kbd> aç/kapa
                    </div>
                </div>
            )}
        </>
    );
}
