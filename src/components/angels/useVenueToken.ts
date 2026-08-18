// Shared token gate for the venue-facing Angels pages. The capability token is
// passed as ?t=<uuid> on the directory link the CAFEPASTE team shares; we persist
// it to sessionStorage so deep links (creator profile, request form) keep working
// as the venue navigates without re-appending the query each time.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AngelsService } from '../../services/angels/angelsService';
import type { AngelVenue } from '../../types/angels';

const STORAGE_KEY = 'angels_venue_token';

export function readVenueToken(search: URLSearchParams): string {
    const fromUrl = search.get('t');
    if (fromUrl) {
        try {
            sessionStorage.setItem(STORAGE_KEY, fromUrl);
        } catch {
            /* ignore */
        }
        return fromUrl;
    }
    try {
        return sessionStorage.getItem(STORAGE_KEY) || '';
    } catch {
        return '';
    }
}

/** `?t=` helper so deep links between venue pages keep the token. */
export function withToken(path: string, token: string): string {
    return token ? `${path}${path.includes('?') ? '&' : '?'}t=${token}` : path;
}

export function useVenueToken() {
    const [search] = useSearchParams();
    const [state, setState] = useState<'loading' | 'ok' | 'invalid'>('loading');
    const [venue, setVenue] = useState<AngelVenue | null>(null);
    const token = readVenueToken(search);

    useEffect(() => {
        let active = true;
        (async () => {
            if (!token) {
                setState('invalid');
                return;
            }
            try {
                const v = await AngelsService.getVenueByToken(token);
                if (!active) return;
                if (!v) {
                    setState('invalid');
                    return;
                }
                setVenue(v);
                setState('ok');
            } catch (e) {
                console.error('[angels] venue token validation failed', e);
                if (active) setState('invalid');
            }
        })();
        return () => {
            active = false;
        };
    }, [token]);

    return { state, venue, token };
}
