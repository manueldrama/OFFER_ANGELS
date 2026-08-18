/**
 * CAFEPASTE — canonical design tokens (JS side)
 * ==============================================
 *
 * This is the single source of truth for colours used from **JavaScript**
 * (inline `style={{...}}`, template literals, canvas, chart configs).
 * Its twin is the `@theme` block in `src/index.css`, which is the source of
 * truth for **CSS/Tailwind** utility classes. The two MUST stay in sync —
 * every value here has a matching `--color-*` there.
 *
 * ─── Why hex strings and not `var(--color-x)` ──────────────────────────────
 * Several call sites append a two-digit alpha channel directly to the hex,
 * e.g. `` `1px solid ${P.primary}40` `` → `#C41E2A40`. That trick only works
 * on a literal hex. Swapping in `var(--color-primary)` would silently produce
 * `var(--color-primary)40` — invalid CSS that fails without an error, quietly
 * dropping the border or shadow. So JS-side tokens stay literal hex.
 *
 * Use `alpha()` below instead of hand-appending, so those sites are greppable
 * when we later migrate them to `color-mix()`.
 *
 * ─── Grey ramp ────────────────────────────────────────────────────────────
 * The neutral values below are the sRGB hex form of Tailwind's default
 * `neutral` scale, which the landing page had already converged on by hand
 * without naming it. Tailwind v4 declares that scale in OKLCH, so a utility
 * class may differ from the hex here by an imperceptible rounding step — the
 * two are interchangeable in practice, but do not mix them inside one
 * component where a seam would show (e.g. a border meeting a fill).
 *
 * NOT in this file, on purpose: third-party brand colours (Instagram gradient,
 * WhatsApp green, Google blue/green). Those are other companies' marks — they
 * are not ours to re-theme, and must never be folded into a ramp.
 */

/** Append an alpha channel to a literal hex token. `alpha(C.primary, 0.25)` */
export function alpha(hex: string, amount: number): string {
    const clamped = Math.max(0, Math.min(1, amount));
    const channel = Math.round(clamped * 255).toString(16).padStart(2, '0');
    return `${hex}${channel}`;
}

/** Neutral ramp — identical to Tailwind's default `neutral`. */
export const neutral = {
    0:   '#FFFFFF',
    50:  '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
} as const;

/** Near-blacks below neutral-900. Used for text and dark surfaces. */
export const ink = {
    /** Primary text colour on light surfaces. */
    DEFAULT: '#111111',
    /** Darkest surface — hero/footer backgrounds. */
    deep:    '#0C0C0C',
} as const;

/** Brand red. `bg` is the pale tint used behind badges and callouts. */
export const brand = {
    DEFAULT: '#C41E2A',
    hover:   '#A31822',
    bg:      '#FEF2F2',
} as const;

/** Warm off-white — the secondary section background. Slightly warmer than
 *  neutral-50, which is what stops the page reading as clinical grey. */
export const surface = {
    warm: '#FBFAF9',
} as const;

/** Semantic status colours. */
export const status = {
    success: '#16A34A',
    amber:   '#F59E0B',
} as const;

/**
 * `P` — the palette shape the public site has consumed since day one.
 * Re-exported from `src/components/landing/primitives.tsx` for compatibility;
 * ~20 files import it from there.
 *
 * Every value below is unchanged from the original literal definition. This
 * file only gives those literals a name and one place to live.
 */
export const P = {
    bg:            neutral[50],
    card:          neutral[0],
    secondary:     surface.warm,
    dark:          ink.deep,
    darkSurface:   neutral[900],
    darkElevated:  neutral[800],
    fg:            ink.DEFAULT,
    body:          neutral[700],
    muted:         neutral[500],
    light:         neutral[50],
    lightMuted:    neutral[400],
    border:        neutral[200],
    borderDark:    neutral[800],
    primary:       brand.DEFAULT,
    primaryHover:  brand.hover,
    primaryBg:     brand.bg,
    ctaLight:      neutral[50],
    ctaLightHover: neutral[200],
    success:       status.success,
    amber:         status.amber,
} as const;
