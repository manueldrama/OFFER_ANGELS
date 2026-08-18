/**
 * Instagram Feed Admin Service
 *
 * Wraps the two worker endpoints used to manage the landing page Instagram
 * marquee cache:
 *   - POST /api/internal/instagram/refresh  → re-fetches @cafepasteart media
 *   - GET  /api/social/instagram-feed       → reads the cached payload
 *
 * The refresh endpoint is rate-limited (1 call / 60s via KV) so it doesn't need
 * a bearer token from the admin panel — abuse window is tiny.
 */

export interface InstagramFeedItem {
    id: string;
    type: string;
    media_url: string | null;
    thumbnail_url: string | null;
    permalink: string;
    caption?: string;
    timestamp?: string;
}

export interface InstagramFeedStatus {
    status: 'ok' | 'warming' | 'unconfigured';
    items: InstagramFeedItem[];
    fetched_at: string | null;
}

export const InstagramFeedService = {
    async refresh(): Promise<{ ok: boolean; count: number }> {
        const res = await fetch('/api/internal/instagram/refresh', { method: 'POST' });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 429) {
                throw new Error(`Çok hızlı yenilediniz. ${data?.retry_after_seconds ?? 60} sn sonra tekrar deneyin.`);
            }
            const detail = data?.details || data?.error || `HTTP ${res.status}`;
            throw new Error(detail);
        }
        return { ok: !!data.ok, count: Number(data.count ?? 0) };
    },

    async status(limit = 12): Promise<InstagramFeedStatus> {
        const res = await fetch(`/api/social/instagram-feed?limit=${limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    },
};
