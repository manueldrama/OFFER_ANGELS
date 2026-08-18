import React, { useState } from 'react';
import { Link2, Copy, Check } from 'lucide-react';

interface OfferCodePillProps {
    /** Teklif kodu / token. */
    code: string;
    /** Kopyalama sonrası bildirim (toast) için. */
    onCopy?: (code: string) => void;
}

/** Kopyalanabilir mono teklif kodu pill'i — referans CodePill. */
export const OfferCodePill: React.FC<OfferCodePillProps> = ({ code, onCopy }) => {
    const [copied, setCopied] = useState(false);

    const copy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(code);
        setCopied(true);
        onCopy?.(code);
        setTimeout(() => setCopied(false), 1200);
    };

    return (
        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-1.5 font-mono text-xs font-semibold tracking-wide text-slate-900">
            <Link2 size={13} className="text-slate-400 shrink-0" />
            {code}
            <button
                onClick={copy}
                title="Kodu kopyala"
                className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-500 transition-colors hover:bg-brand-100 hover:text-brand-700"
            >
                {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
        </span>
    );
};
