// Visual E-E-A-T score badge: 0-4 dots colored by score, with a tooltip
// breakdown showing which of the four signals is present.
//
// Used in:
//   - SeoPageEditor (live as the user edits the page)
//   - SeoRoadmap (next to each language column for a published/draft cell)
//
// Score semantics from seoAdminService.calculateEeatScore:
//   1 — Experience       (stat block with source)
//   2 — Expertise        (named author)
//   3 — Authoritativeness(outbound markdown link)
//   4 — Trustworthiness  (published + updated_at)

interface EeatScoreProps {
    score: number; // 0-4
    /** Optional per-signal breakdown to show in the tooltip. */
    detail?: {
        experience: boolean;
        expertise: boolean;
        authoritativeness: boolean;
        trustworthiness: boolean;
    };
    /** Compact: fewer dots, smaller. Default false. */
    compact?: boolean;
}

const COLOR_BY_SCORE: Record<number, string> = {
    0: 'bg-red-500',
    1: 'bg-red-400',
    2: 'bg-amber-400',
    3: 'bg-emerald-400',
    4: 'bg-emerald-600',
};

export function EeatScore({ score, detail, compact = false }: EeatScoreProps) {
    const clamped = Math.max(0, Math.min(4, score));
    const tooltipLines: string[] = [`E-E-A-T: ${clamped}/4`];
    if (detail) {
        tooltipLines.push(`Experience (kanıt verisi):    ${detail.experience ? '✓' : '—'}`);
        tooltipLines.push(`Expertise (yazar):            ${detail.expertise ? '✓' : '—'}`);
        tooltipLines.push(`Authoritativeness (dış link): ${detail.authoritativeness ? '✓' : '—'}`);
        tooltipLines.push(`Trustworthiness (yayında):    ${detail.trustworthiness ? '✓' : '—'}`);
    }
    const tooltip = tooltipLines.join('\n');

    const dotSize = compact ? 'w-1.5 h-1.5' : 'w-2 h-2';
    return (
        <div
            className="inline-flex items-center gap-0.5 cursor-help"
            title={tooltip}
            aria-label={tooltip}
        >
            {[0, 1, 2, 3].map((i) => (
                <span
                    key={i}
                    className={`${dotSize} rounded-full ${i < clamped ? COLOR_BY_SCORE[clamped] : 'bg-neutral-200'}`}
                />
            ))}
            {!compact && <span className="ml-1 text-[10px] font-semibold text-neutral-600">{clamped}/4</span>}
        </div>
    );
}
