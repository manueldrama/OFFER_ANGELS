import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, User } from 'lucide-react';
import { Chip, DEPARTMENT_META } from '../../../pages/admin/hr/_shared';
import { avatarColor } from '../../../types/hrTasks';
import { PILL, PILL_ACTIVE } from './_ui';
import type { HrDepartment } from '../../../types/hr';

// Aranabilir, avatar'lı çalışan seçici — repo'daki düz <select>'lerin
// (TaskFormModal, ServiceRequestDetail vb.) yerini görev yüzeylerinde alır.
// Yüzlerce çalışanda da çalışır: liste istemcide süzülür, options zaten
// tek listEmployees çağrısından gelir.

export interface AssigneeOption {
    id: string;
    label: string;
    department?: HrDepartment | null;
}

function initials(name: string): string {
    return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toLocaleUpperCase('tr');
}

export function EmployeeSelect({ value, onChange, options, placeholder = 'Seçin…', disabled, allowEmpty, emptyLabel = 'Atanmamış', variant = 'input' }: {
    value: string;
    onChange: (id: string) => void;
    options: AssigneeOption[];
    placeholder?: string;
    disabled?: boolean;
    allowEmpty?: boolean;
    emptyLabel?: string;
    /** 'pill' = composer'daki kompakt özellik pill'i; 'input' = form alanı. */
    variant?: 'input' | 'pill';
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = options.find(o => o.id === value) ?? null;

    useEffect(() => {
        if (!open) return;
        setQuery('');
        // Açılınca aramaya odaklan — klavye akışı kesilmesin.
        setTimeout(() => inputRef.current?.focus(), 0);
        const onClick = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLocaleLowerCase('tr');
        if (!q) return options;
        return options.filter(o => o.label.toLocaleLowerCase('tr').includes(q));
    }, [options, query]);

    const pick = (id: string) => {
        onChange(id);
        setOpen(false);
    };

    return (
        <div ref={rootRef} className={variant === 'pill' ? 'relative inline-block' : 'relative'}>
            {variant === 'pill' ? (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setOpen(v => !v)}
                    className={`${selected ? PILL_ACTIVE : PILL} disabled:opacity-50`}
                >
                    {selected ? (
                        <>
                            <span className={`w-4 h-4 rounded-full text-white text-[8px] font-bold inline-flex items-center justify-center shrink-0 ${avatarColor(selected.label)}`}>
                                {initials(selected.label)}
                            </span>
                            <span className="truncate max-w-[130px]">{selected.label}</span>
                        </>
                    ) : (
                        <>
                            <User size={13} className="text-slate-400" />
                            {value === '' && allowEmpty ? emptyLabel : placeholder}
                        </>
                    )}
                </button>
            ) : (
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(v => !v)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13.5px] bg-white flex items-center gap-2 cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 focus:border-slate-400 outline-none"
            >
                {selected ? (
                    <>
                        <span className={`w-5 h-5 rounded-full text-white text-[9px] font-bold inline-flex items-center justify-center shrink-0 ${avatarColor(selected.label)}`}>
                            {initials(selected.label)}
                        </span>
                        <span className="truncate flex-1 text-left text-slate-800">{selected.label}</span>
                    </>
                ) : (
                    <span className="flex-1 text-left text-slate-400">{value === '' && allowEmpty ? emptyLabel : placeholder}</span>
                )}
                <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>
            )}

            {open && (
                <div className={`absolute left-0 top-full mt-1 z-[70] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden ${
                    variant === 'pill' ? 'w-[260px]' : 'right-0'
                }`}>
                    <div className="relative border-b border-slate-100">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            ref={inputRef}
                            className="w-full pl-8 pr-3 py-2 text-[13px] outline-none"
                            placeholder="Çalışan ara…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
                                if (e.key === 'Enter' && filtered.length === 1) { e.preventDefault(); pick(filtered[0].id); }
                            }}
                        />
                    </div>
                    <ul className="max-h-64 overflow-y-auto py-1">
                        {allowEmpty && (
                            <li>
                                <button type="button" onClick={() => pick('')} className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 text-left">
                                    <span className="w-6 h-6 rounded-full bg-slate-100 shrink-0" />
                                    <span className="text-[13px] text-slate-500 flex-1">{emptyLabel}</span>
                                    {value === '' && <Check size={13} className="text-sky-600" />}
                                </button>
                            </li>
                        )}
                        {filtered.map(o => (
                            <li key={o.id}>
                                <button type="button" onClick={() => pick(o.id)} className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 text-left">
                                    <span className={`w-6 h-6 rounded-full text-white text-[10px] font-bold inline-flex items-center justify-center shrink-0 ${avatarColor(o.label)}`}>
                                        {initials(o.label)}
                                    </span>
                                    <span className="text-[13px] text-slate-800 truncate flex-1">{o.label}</span>
                                    {o.department && <Chip meta={DEPARTMENT_META[o.department]} />}
                                    {value === o.id && <Check size={13} className="text-sky-600 shrink-0" />}
                                </button>
                            </li>
                        ))}
                        {filtered.length === 0 && (
                            <li className="px-3 py-4 text-center text-[12px] text-slate-400">Sonuç yok</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
