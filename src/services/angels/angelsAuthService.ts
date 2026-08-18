// CAFEPASTE Angels — portal auth servisi (custom auth; Supabase Auth DEĞİL).
// Opak session token localStorage'da tutulur ve /api/angels/* uçlarına
// Bearer olarak gönderilir. Sitenin admin oturumundan tamamen bağımsızdır.

import type { AngelsSessionData } from '../../types/angelsPlatform';

const TOKEN_KEY = 'angels_session';

export function getAngelsToken(): string | null {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

function setAngelsToken(token: string | null): void {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch { /* storage kapalı olabilir */ }
}

/** Angels portal API çağrısı — Bearer angels-session ekler. */
export async function angelsApiFetch<T = any>(
    path: string,
    init: { method?: string; body?: unknown } = {},
): Promise<T> {
    const token = getAngelsToken();
    const res = await fetch(`/api/angels${path}`, {
        method: init.method || (init.body !== undefined ? 'POST' : 'GET'),
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message = (data as any)?.error || `Request failed (${res.status})`;
        const err = new Error(message) as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
    return data as T;
}

export const AngelsAuthService = {
    async signIn(email: string, password: string): Promise<AngelsSessionData> {
        const data = await angelsApiFetch<AngelsSessionData & { token: string }>(
            '/auth/login', { body: { email, password } });
        setAngelsToken(data.token);
        return data;
    },

    /** Mevcut token ile oturumu çözer; geçersizse null (token temizlenir). */
    async getSession(): Promise<AngelsSessionData | null> {
        if (!getAngelsToken()) return null;
        try {
            return await angelsApiFetch<AngelsSessionData>('/auth/session');
        } catch (e: any) {
            if (e?.status === 401) setAngelsToken(null);
            return null;
        }
    },

    async signOut(): Promise<void> {
        try {
            await angelsApiFetch('/auth/logout', { method: 'POST', body: {} });
        } catch { /* idempotent */ }
        setAngelsToken(null);
    },

    /** Setup/reset linkindeki token ile şifre belirler; otomatik login yapar. */
    async setPassword(linkToken: string, password: string): Promise<AngelsSessionData> {
        const data = await angelsApiFetch<AngelsSessionData & { token: string }>(
            '/auth/set-password', { body: { token: linkToken, password } });
        setAngelsToken(data.token);
        return data;
    },

    async requestReset(email: string): Promise<void> {
        await angelsApiFetch('/auth/request-reset', { body: { email } });
    },
};
