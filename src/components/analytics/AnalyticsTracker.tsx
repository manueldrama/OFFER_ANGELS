import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageview, captureUtm, getOrCreateSession } from '../../services/analyticsService';

/**
 * Mounted once at app root inside BrowserRouter. Captures UTM on first load
 * and records a pageview on every route change. Skips /admin and /portal —
 * those are authenticated areas and shouldn't pollute traffic stats.
 */
export function AnalyticsTracker() {
    const location = useLocation();

    useEffect(() => {
        captureUtm();
        // Warm up the session immediately so first pageview has a session_id.
        void getOrCreateSession();
        // We only need to do this once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const path = location.pathname;
        // /team = personel portali ve calisan giris kapisi. Musteri yuzeyi
        // degildir; pazarlama analitigine yazilmasi ziyaretci sayilarini
        // kendi ekibimizle sisirir.
        if (path.startsWith('/admin') || path.startsWith('/portal')
            || path.startsWith('/login') || path.startsWith('/team')) return;
        void trackPageview(path);
    }, [location.pathname]);

    return null;
}
