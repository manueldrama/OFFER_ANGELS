import React from 'react';
import {
    Globe, Languages, Undo2, Redo2, History, PanelRight, Save, RotateCcw,
} from 'lucide-react';
import type { Campaign } from '../../../../services/admin/campaignsService';
import { getSupportedLanguages, getLanguageLabels, type SupportedLanguage } from '../../../../i18n';

interface Props {
    target: string;
    onTarget: (v: string) => void;
    campaigns: Campaign[];

    language: SupportedLanguage;
    onLanguage: (lang: SupportedLanguage) => void;
    dualLang: boolean;
    onDualLang: (v: boolean) => void;

    dirty: number;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onPublish: () => void;
    onLocalSave: () => void;
    onShowHistory: () => void;
    onToggleStructure: () => void;
    structureOpen: boolean;
    publishing: boolean;

    canReset: boolean;
    onReset: () => void;
}

export function EditorTopBar({
    target, onTarget, campaigns,
    language, onLanguage, dualLang, onDualLang,
    dirty, canUndo, canRedo, onUndo, onRedo, onPublish, onLocalSave, onShowHistory,
    onToggleStructure, structureOpen, publishing,
    canReset, onReset,
}: Props) {
    const labels = getLanguageLabels();
    const langs = getSupportedLanguages();

    return (
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4">
            {/* Target selector */}
            <div className="flex items-center gap-1.5">
                <Globe size={13} className="text-slate-500" />
                <select
                    value={target}
                    onChange={(e) => onTarget(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                    <option value="global">🌍 Global Varsayılan</option>
                    <optgroup label="Kampanya Özel">
                        {campaigns.map(c => (
                            <option key={c.id} value={c.id}>🎯 {c.name}</option>
                        ))}
                    </optgroup>
                </select>
            </div>

            {/* Language selector */}
            <div className="ml-1 flex items-center gap-1.5">
                <Languages size={13} className="text-slate-500" />
                <select
                    value={language}
                    onChange={(e) => onLanguage(e.target.value as SupportedLanguage)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                    {langs.map(l => (
                        <option key={l} value={l}>{labels[l]}</option>
                    ))}
                </select>
                <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600">
                    <input
                        type="checkbox"
                        checked={dualLang}
                        onChange={(e) => onDualLang(e.target.checked)}
                        className="h-3.5 w-3.5 accent-indigo-600"
                    />
                    Çift dil
                </label>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Undo / Redo / History */}
            <div className="flex items-center gap-1">
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    title="Geri Al (⌘Z)"
                    className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                    <Undo2 size={14} />
                </button>
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    title="Yinele (⌘⇧Z)"
                    className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                    <Redo2 size={14} />
                </button>
                <button
                    onClick={onShowHistory}
                    title="Bekleyen değişiklikler"
                    className="relative grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                    <History size={14} />
                    {dirty > 0 && (
                        <span className="absolute -top-1 -right-1 grid min-w-[16px] h-4 place-items-center rounded-full bg-orange-600 px-1 text-[9px] font-bold text-white">
                            {dirty}
                        </span>
                    )}
                </button>
            </div>

            <div className="mx-1 h-5 w-px bg-slate-200" />

            <button
                onClick={onLocalSave}
                title="Yereli kaydet (⌘S)"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50"
            >
                <Save size={12} />
                Yerel
            </button>

            {canReset && (
                <button
                    onClick={onReset}
                    title="Bu kampanyayı global'e sıfırla"
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600 hover:bg-slate-50"
                >
                    <RotateCcw size={12} />
                    Sıfırla
                </button>
            )}

            <button
                onClick={onPublish}
                disabled={dirty === 0 || publishing}
                className={[
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors',
                    dirty > 0 && !publishing
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-slate-200 text-slate-500',
                ].join(' ')}
            >
                {publishing ? 'Yayınlanıyor…' : 'Yayınla'}
                {dirty > 0 && !publishing && (
                    <span className="rounded bg-white/20 px-1.5 py-[1px] text-[10px] font-bold">
                        {dirty}
                    </span>
                )}
            </button>

            <button
                onClick={onToggleStructure}
                title="Sağ paneli aç/kapat"
                className={[
                    'ml-1 grid h-8 w-8 place-items-center rounded-md border text-slate-700 hover:bg-slate-50',
                    structureOpen ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white',
                ].join(' ')}
            >
                <PanelRight size={14} />
            </button>
        </div>
    );
}
