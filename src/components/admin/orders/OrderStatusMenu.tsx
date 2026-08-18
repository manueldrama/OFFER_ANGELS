import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { StatusBadge } from '../../ui/StatusBadge';
import { STATUS_OPTIONS, statusLabel, statusTone, type ReservationStatus } from '../../../lib/reservations/orderStatus';

interface Props {
    /** DB'deki ham durum — menüde işaretli olan budur. */
    value: string;
    /** Müşteriye gösterilen efektif durum — rozette bu görünür. */
    effective: string;
    disabled?: boolean;
    onChange: (next: ReservationStatus) => void;
}

/**
 * Satır içi durum değiştirici.
 *
 * Native <select> yerine rozet + popover: mockup'taki durum hücresi renkli bir
 * pill, ve <select> pill görünümünü platformlar arası tutarlı taşıyamıyor.
 *
 * Rozet EFEKTİF durumu gösterir (müşterinin gördüğü), menüde işaretli olan ise
 * DB'deki ham durumdur. İkisi ayrıştığında küçük bir "otomatik" ipucu çıkar —
 * kapora cron'u henüz kaydı işlememiş demektir.
 */
export const OrderStatusMenu: React.FC<Props> = ({ value, effective, disabled, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const diverged = effective !== value;

    return (
        <div className="relative inline-flex flex-col items-start gap-1" ref={ref}>
            <button
                type="button"
                disabled={disabled}
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                className="inline-flex items-center gap-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                title="Durumu değiştir"
            >
                <StatusBadge tone={statusTone(effective)} dot>
                    {statusLabel(effective)}
                    <ChevronDown size={12} className="ml-0.5 shrink-0 opacity-60" />
                </StatusBadge>
            </button>

            {diverged && (
                <span
                    className="text-[10px] font-medium text-slate-400"
                    title={`Kayıtlı durum: ${statusLabel(value)} — kapora otomasyonu henüz işlemedi`}
                >
                    otomatik
                </span>
            )}

            {open && (
                <div
                    className="absolute z-30 top-full left-0 mt-1.5 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                    onClick={e => e.stopPropagation()}
                >
                    {STATUS_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setOpen(false); if (opt.value !== value) onChange(opt.value); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            <Check size={13} className={opt.value === value ? 'text-indigo-600 shrink-0' : 'invisible shrink-0'} />
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
