// Convert ISO-3166 alpha-2 country code → flag emoji.
// e.g. "TR" → "🇹🇷". Returns empty string for invalid input.
export function countryFlag(code: string | null | undefined): string {
    if (!code || code.length !== 2) return '';
    const c = code.toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) return '';
    const A = 0x1f1e6;
    return String.fromCodePoint(A + (c.charCodeAt(0) - 65), A + (c.charCodeAt(1) - 65));
}

/** Compose a "Country / City" label, picking what's available. */
export function geoLabel(country: string | null | undefined, city: string | null | undefined): string {
    const parts: string[] = [];
    if (city) parts.push(city);
    if (country) parts.push(country);
    return parts.join(', ');
}

/** Compose "utm_source/utm_medium" — returns null if neither is set. */
export function utmShortLabel(source: string | null | undefined, medium: string | null | undefined): string | null {
    if (!source && !medium) return null;
    if (source && medium) return `${source}/${medium}`;
    return source || medium || null;
}
