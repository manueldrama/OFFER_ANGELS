import React from 'react';

interface AiScoreRingProps {
    /** 0–100 AI skoru; null → skor yok. */
    score: number | null;
    /** Sağdaki "Sıcak / AI skoru" meta bloğunu gizler. */
    compact?: boolean;
    size?: number;
}

/** AI skorundan renk + sıcaklık sözcüğü (LeadTemperatureCell ile aynı eşikler). */
function tone(score: number | null): { color: string; word: string } {
    if (score == null) return { color: 'var(--color-cold)', word: 'Skor yok' };
    if (score >= 80) return { color: 'var(--color-hot)', word: 'Sıcak' };
    if (score >= 40) return { color: 'var(--color-warm)', word: 'Ilık' };
    return { color: 'var(--color-ice)', word: 'Soğuk' };
}

/** Renkli halka içinde AI skoru — referans atoms.jsx AiScore. */
export const AiScoreRing: React.FC<AiScoreRingProps> = ({ score, compact, size = 34 }) => {
    const { color, word } = tone(score);
    const r = (size - 6) / 2;
    const c = 2 * Math.PI * r;
    const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
    const center = size / 2;

    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className="relative shrink-0" style={{ width: size, height: size }}>
                <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={center} cy={center} r={r} stroke="var(--color-slate-200)" strokeWidth="3" fill="none" />
                    <circle
                        cx={center} cy={center} r={r} stroke={color} strokeWidth="3" fill="none"
                        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset .4s ease' }}
                    />
                </svg>
                <div
                    className="absolute inset-0 grid place-items-center text-[11px] font-extrabold tracking-tight"
                    style={{ color }}
                >
                    {score ?? '—'}
                </div>
            </div>
            {!compact && (
                <div className="min-w-0">
                    <div className="text-[11.5px] font-bold leading-tight truncate" style={{ color }}>{word}</div>
                    <div className="text-[10px] text-slate-400 leading-tight">AI skoru</div>
                </div>
            )}
        </div>
    );
};
