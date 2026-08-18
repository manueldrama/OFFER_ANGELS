/**
 * Edit-mode persistence across page navigations.
 *
 * Once the user opens any page with `?edit=true`, the flag is saved to
 * sessionStorage so subsequent navigations (e.g. landing → offer → product)
 * keep edit mode active without needing the URL param on every link.
 *
 * Cleared when the user explicitly exits edit mode or when the tab/session ends.
 */

const EDIT_FLAG_KEY = 'cafepaste_edit_mode';

/** True if the user requested edit mode via URL or earlier in this session. */
export function isEditModeRequested(): boolean {
    if (typeof window === 'undefined') return false;
    const fromUrl = new URLSearchParams(window.location.search).get('edit') === 'true';
    if (fromUrl) {
        try { sessionStorage.setItem(EDIT_FLAG_KEY, '1'); } catch { /* ignore quota */ }
        return true;
    }
    if (new URLSearchParams(window.location.search).get('edit') === 'false') {
        // explicit opt-out
        exitEditMode();
        return false;
    }
    try {
        return sessionStorage.getItem(EDIT_FLAG_KEY) === '1';
    } catch {
        return false;
    }
}

/** Clear the persisted edit flag and strip ?edit=true from URL. */
export function exitEditMode(): void {
    try { sessionStorage.removeItem(EDIT_FLAG_KEY); } catch { /* */ }
    if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('edit');
        window.history.replaceState({}, '', url.toString());
    }
}
