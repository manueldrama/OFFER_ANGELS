// Tiny {{placeholder}} substitution for CAFEPASTE Angels editable content.
// Example: applyAngelsTemplate("{{name}}, you're invited", { name: 'Ayşe' })
// Unknown placeholders are left as-is so a typo in the admin panel stays visible
// instead of silently disappearing.

export function applyAngelsTemplate(
    text: string | null | undefined,
    vars: Record<string, string | null | undefined>,
): string {
    if (!text) return '';
    return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
        const value = vars[key];
        return value === null || value === undefined ? match : value;
    });
}

// The public /angels page renders the same invite-page content but has no
// invitee, so "{{name}}, you're invited…" must degrade to "You're invited…"
// and "PRIVATE INVITATION FOR {{name}}" to "PRIVATE INVITATION".
export function stripAngelsNamePlaceholder(
    text: string | null | undefined,
    lang = 'en',
): string {
    if (!text) return '';
    const out = text
        .replace(/\{\{name\}\}[,，]\s*/g, '')
        .replace(/\s+(for|için)\s+\{\{name\}\}/gi, '')
        .replace(/,?\s*\{\{name\}\}/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
    return out ? out.charAt(0).toLocaleUpperCase(lang) + out.slice(1) : out;
}
