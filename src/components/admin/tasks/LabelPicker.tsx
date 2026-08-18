import { useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { labelColor } from '../../../types/hrTasks';

// Serbest metin etiket girişi — kayıt tablosu yok, renk metinden türetilir
// (labelColor). suggestions: yüklü görevlerde halihazırda kullanılan etiketler;
// yazım tutarlılığını (acil/Acil/ACİL) öneriyle çözer, zorlamayla değil.

export function LabelChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${labelColor(label)}`}>
            {label}
            {onRemove && (
                <button onClick={onRemove} className="hover:opacity-70 cursor-pointer" aria-label={`${label} etiketini kaldır`}>
                    <X size={10} />
                </button>
            )}
        </span>
    );
}

export function LabelPicker({ value, onChange, suggestions = [] }: {
    value: string[];
    onChange: (labels: string[]) => void;
    suggestions?: string[];
}) {
    const [input, setInput] = useState('');

    const filtered = useMemo(() => {
        const q = input.trim().toLocaleLowerCase('tr');
        return suggestions
            .filter(s => !value.includes(s))
            .filter(s => !q || s.toLocaleLowerCase('tr').includes(q))
            .slice(0, 6);
    }, [suggestions, value, input]);

    const add = (label: string) => {
        const clean = label.trim();
        if (!clean || value.includes(clean)) return;
        onChange([...value, clean]);
        setInput('');
    };

    return (
        <div>
            <div className="flex flex-wrap items-center gap-1.5">
                {value.map(l => (
                    <LabelChip key={l} label={l} onRemove={() => onChange(value.filter(x => x !== l))} />
                ))}
                <div className="inline-flex items-center gap-1">
                    <input
                        className="border border-slate-200 rounded-lg px-2 py-1 text-[12px] outline-none focus:border-slate-400 w-28"
                        placeholder="Etiket ekle…"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); add(input); }
                            if (e.key === 'Backspace' && !input && value.length) onChange(value.slice(0, -1));
                        }}
                    />
                    {input.trim() && (
                        <button onClick={() => add(input)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Etiketi ekle">
                            <Plus size={13} />
                        </button>
                    )}
                </div>
            </div>
            {filtered.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {filtered.map(s => (
                        <button key={s} onClick={() => add(s)} className="cursor-pointer opacity-70 hover:opacity-100">
                            <LabelChip label={s} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
