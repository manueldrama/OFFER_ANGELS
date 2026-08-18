import React from 'react';
import { Info } from 'lucide-react';

interface Props {
    text: string;
    className?: string;
}

export const InfoHint: React.FC<Props> = ({ text, className = '' }) => (
    <span
        role="img"
        aria-label={text}
        title={text}
        className={`inline-flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-help align-middle ${className}`}
    >
        <Info size={11} strokeWidth={2.25} />
    </span>
);
