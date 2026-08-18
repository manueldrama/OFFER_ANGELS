import React from 'react';

// Ayar sayfalarındaki "etiket + açıklama + anahtar" satırı.
//
// NEDEN AYRI BİR PRIMITIF: bu işaretleme AutomationSettings.tsx içinde 20'den
// fazla kez kopyalanmıştı — her kopyada boyut, renk ve odak davranışı biraz
// farklıydı. Component kuralları bunu açıkça yasaklıyor (tek seferlik stiller,
// tutarsız kart/buton varyantları). Tek kaynak: burası.
//
// Erişilebilirlik: görsel anahtar gerçek bir <input type="checkbox">'un üstüne
// çizilir; klavye odağı, ekran okuyucu ve form semantiği korunur.

export interface SettingsToggleRowProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    description?: string;
    /** Satır başında görünen küçük görsel işaret (bildirim ikonuyla eşleşir). */
    leading?: React.ReactNode;
    disabled?: boolean;
    /** Ana anahtar gibi öne çıkması gereken satırlar için daha büyük tipografi. */
    emphasis?: boolean;
}

export function SettingsToggleRow({
    checked,
    onChange,
    label,
    description,
    leading,
    disabled = false,
    emphasis = false,
}: SettingsToggleRowProps) {
    return (
        <label
            className={[
                'group flex items-start justify-between gap-4 px-5 transition-colors',
                emphasis ? 'py-5' : 'py-4',
                disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-slate-50/70',
            ].join(' ')}
        >
            <div className="flex min-w-0 items-start gap-3">
                {leading && (
                    <span
                        aria-hidden
                        className={[
                            'mt-0.5 flex shrink-0 items-center justify-center rounded-lg border transition-colors',
                            emphasis ? 'h-9 w-9 text-base' : 'h-8 w-8 text-sm',
                            checked
                                ? 'border-slate-200 bg-white'
                                : 'border-slate-100 bg-slate-50 grayscale',
                        ].join(' ')}
                    >
                        {leading}
                    </span>
                )}
                <div className="min-w-0">
                    <div
                        className={[
                            'font-medium leading-tight',
                            emphasis ? 'text-base' : 'text-sm',
                            checked ? 'text-slate-900' : 'text-slate-500',
                        ].join(' ')}
                    >
                        {label}
                    </div>
                    {description && (
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
                    )}
                </div>
            </div>

            <span className="relative mt-0.5 inline-flex shrink-0 items-center">
                <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <span
                    className={[
                        'h-6 w-11 rounded-full bg-slate-200 transition-colors',
                        'peer-checked:bg-emerald-500',
                        'peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/40 peer-focus-visible:ring-offset-2',
                        "after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full",
                        'after:border after:border-slate-300 after:bg-white after:transition-transform after:content-[""]',
                        'peer-checked:after:translate-x-full peer-checked:after:border-white',
                    ].join(' ')}
                />
            </span>
        </label>
    );
}

export default SettingsToggleRow;
