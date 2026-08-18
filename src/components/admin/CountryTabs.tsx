import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Globe, HelpCircle } from 'lucide-react';
import { COUNTRIES, UNKNOWN_COUNTRY } from '../../utils/countries';
import { CountryFlag } from '../ui/CountryFlag';

interface CountryTabsProps {
    /** 'all' | ISO-2 ülke kodu | 'unknown' */
    value: string;
    onChange: (v: string) => void;
    /** ISO-2 → kayıt adedi. Eksik anahtar 0 sayılır. */
    counts: Record<string, number>;
    /** Ülkesi çözülemeyen kayıt adedi; 0 ise sekme gizlenir. */
    unknownCount?: number;
    /** 🌍 Tümü rozetindeki toplam. Sekmelerin toplamıyla karşılaştırılabilsin
     *  diye hesaplanmaz, çağıran taraftan gerçek toplam olarak gelir. */
    total: number;
}

/**
 * Pazar (ülke) geçiş satırı — Müşteri Yönetimi ve Teklif Linkleri ortak.
 *
 * COUNTRIES'in 26'sı da her zaman render edilir (kaydı olmayanlar soluk ama
 * tıklanabilir); böylece satırın düzeni veri değiştikçe kaymaz. 26 bayrak tek
 * satıra sığmadığı için kap yatay kaydırılır — sürükleyerek kaydırma davranışı
 * SegmentPills ile aynıdır.
 */
export function CountryTabs({ value, onChange, counts, unknownCount = 0, total }: CountryTabsProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragState = useRef({ startX: 0, scrollLeft: 0, moved: false });

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        const el = scrollRef.current;
        if (!el) return;
        setIsDragging(true);
        dragState.current = { startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false };
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = x - dragState.current.startX;
        if (Math.abs(walk) > 3) dragState.current.moved = true;
        scrollRef.current.scrollLeft = dragState.current.scrollLeft - walk;
    }, [isDragging]);

    const onMouseUp = useCallback(() => setIsDragging(false), []);

    // Kayıtlarda COUNTRIES dışında bir ISO kodu görülebilir: lead yakalamada
    // country_code ipapi'den geliyor ve fiyat listemizde olmayan bir ülke
    // (🇮🇳, 🇧🇷 …) dönebiliyor. Sekmesi olmasa o leadler hiçbir sekmeden
    // açılamaz ve sekme toplamları 🌍 Tümü'nü tutmazdı; sabit 26'nın ardına
    // ekleniyorlar. Bayrak, koddan kod-noktasıyla üretilir.
    const extraCodes = useMemo(() => {
        const known = new Set(COUNTRIES.map(c => c.code));
        return Object.keys(counts)
            .filter(code => code && !known.has(code) && (counts[code] || 0) > 0)
            .sort();
    }, [counts]);

    // Sürükleyerek kaydırma bitince istemsiz seçim tetiklenmesin.
    const select = (key: string) => { if (!dragState.current.moved) onChange(key); };

    const pill = (key: string, icon: React.ReactNode, label: string, count: number, dim: boolean) => {
        const on = value === key;
        return (
            <button
                key={key}
                type="button"
                aria-pressed={on}
                title={label}
                onClick={() => select(key)}
                className={[
                    'flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors',
                    on ? 'text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50',
                    !on && dim ? 'opacity-40' : '',
                ].join(' ')}
                style={on ? { background: 'var(--color-brand-600)', boxShadow: 'var(--shadow-brand)' } : undefined}
            >
                {icon}
                <span className="hidden lg:inline">{label}</span>
                <span
                    className={[
                        'rounded px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums',
                        on ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                    ].join(' ')}
                >
                    {count}
                </span>
            </button>
        );
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-[var(--shadow-card)]">
            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                className={`flex gap-1 overflow-x-auto no-scrollbar select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
                {pill('all', <Globe size={15} className="shrink-0" />, 'Tümü', total, false)}
                {COUNTRIES.map(c => {
                    const count = counts[c.code] || 0;
                    return pill(c.code, <CountryFlag code={c.code} title={c.name} />, c.name, count, count === 0);
                })}
                {extraCodes.map(code => (
                    pill(code, <CountryFlag code={code} title={code} />, code, counts[code] || 0, false)
                ))}
                {unknownCount > 0 && (
                    pill(UNKNOWN_COUNTRY, <HelpCircle size={15} className="shrink-0" />, 'Bilinmiyor', unknownCount, false)
                )}
            </div>
        </div>
    );
}
