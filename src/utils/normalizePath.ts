/**
 * Collapse dynamic URL segments into stable logical paths so analytics
 * aggregations don't drown in token / UUID variants. e.g.
 *   /offer/ABC-123 → /offer/:token
 *   /offer/ABC-123/teklif/uuid → /offer/:token/teklif/:id
 *   /portal/cafepaste-ankara → /portal/:slug
 */
export function normalizePath(path: string): string {
    if (!path) return '/';
    return path
        .replace(/^\/offer\/[^/]+\/teklif\/[^/]+/, '/offer/:token/teklif/:id')
        .replace(/^\/offer\/[^/]+\/odeme\/[^/]+/, '/offer/:token/odeme/:id')
        .replace(/^\/offer\/[^/]+/, '/offer/:token')
        .replace(/^\/o\/[^/]+/, '/o/:short')
        .replace(/^\/portal\/[^/]+/, '/portal/:slug')
        .replace(/^\/(tr|en|de|fr|es|it|pl)\/(compare|guides|solutions)\/[^/]+/, '/:lang/$2/:slug')
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
        .replace(/\/[A-Z0-9]{4,}-[A-Z0-9]{4,}/g, '/:id');
}
