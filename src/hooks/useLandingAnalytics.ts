import { useEffect, useRef, useCallback } from 'react';
import { LandingAnalyticsService } from '../services/landingAnalyticsService';

/**
 * Tracks landing page analytics: page views, clicks, scroll depth, section views.
 * All events are tagged with the current A/B test variant ID.
 */
export function useLandingAnalytics(variantId: string | null, loading: boolean) {
    const trackedRef = useRef({ pageView: false, scrollMilestones: new Set<number>(), sections: new Set<string>() });

    // ── Page view ──
    useEffect(() => {
        if (loading || trackedRef.current.pageView) return;
        trackedRef.current.pageView = true;
        LandingAnalyticsService.trackPageView(variantId);
    }, [variantId, loading]);

    // ── Click tracking (x%, y% coordinates) ──
    useEffect(() => {
        if (loading) return;
        const handler = (e: MouseEvent) => {
            const xPct = Math.round((e.clientX / window.innerWidth) * 100);
            const yPct = Math.round((e.clientY / window.innerHeight) * 100);

            // Find closest section
            const target = e.target as HTMLElement;
            const sectionEl = target.closest<HTMLElement>('[data-section-type]');
            const sectionType = sectionEl?.dataset.sectionType ?? 'unknown';

            // Element identifier
            const tag = target.tagName.toLowerCase();
            const cls = target.className?.toString().slice(0, 60) ?? '';
            const text = (target.textContent ?? '').slice(0, 30).trim();
            const element = `${tag}${cls ? '.' + cls.split(' ')[0] : ''}${text ? ':' + text : ''}`;

            LandingAnalyticsService.trackClick(variantId, sectionType, xPct, yPct, element);
        };

        document.addEventListener('click', handler, { passive: true });
        return () => document.removeEventListener('click', handler);
    }, [variantId, loading]);

    // ── Scroll depth milestones (0, 25, 50, 75, 100) ──
    useEffect(() => {
        if (loading) return;
        const handler = () => {
            const scrollContainer = document.querySelector('.snap-y') as HTMLElement | null;
            const el = scrollContainer ?? document.documentElement;
            const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
            const scrollHeight = el.scrollHeight - el.clientHeight;
            if (scrollHeight <= 0) return;

            const depth = Math.round((scrollTop / scrollHeight) * 100);
            const milestones = [0, 25, 50, 75, 100];

            for (const m of milestones) {
                if (depth >= m && !trackedRef.current.scrollMilestones.has(m)) {
                    trackedRef.current.scrollMilestones.add(m);
                    LandingAnalyticsService.trackScrollDepth(variantId, m);
                }
            }
        };

        // Listen on both window and snap container
        const scrollContainer = document.querySelector('.snap-y') as HTMLElement | null;
        if (scrollContainer) scrollContainer.addEventListener('scroll', handler, { passive: true });
        window.addEventListener('scroll', handler, { passive: true });

        // Fire initial check
        handler();

        return () => {
            if (scrollContainer) scrollContainer.removeEventListener('scroll', handler);
            window.removeEventListener('scroll', handler);
        };
    }, [variantId, loading]);

    // ── Section view tracking ──
    const trackSectionView = useCallback((sectionType: string) => {
        if (!sectionType || trackedRef.current.sections.has(sectionType)) return;
        trackedRef.current.sections.add(sectionType);
        LandingAnalyticsService.trackSectionView(variantId, sectionType);
    }, [variantId]);

    // ── Section duration tracking (IntersectionObserver) ──
    useEffect(() => {
        if (loading) return;

        const sectionTimers = new Map<string, number>();
        const sentDurations = new Set<string>();

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const el = entry.target as HTMLElement;
                    const sectionType = el.dataset.sectionType;
                    if (!sectionType) continue;

                    if (entry.isIntersecting) {
                        // Section entered viewport — start timer
                        if (!sectionTimers.has(sectionType)) {
                            sectionTimers.set(sectionType, Date.now());
                        }
                    } else {
                        // Section left viewport — record duration
                        const startTime = sectionTimers.get(sectionType);
                        if (startTime && !sentDurations.has(sectionType)) {
                            const duration = Date.now() - startTime;
                            if (duration > 500) { // Only track if >500ms
                                sentDurations.add(sectionType);
                                LandingAnalyticsService.trackSectionDuration(variantId, sectionType, duration);
                            }
                        }
                        sectionTimers.delete(sectionType);
                    }
                }
            },
            { threshold: 0.3 }
        );

        // Observe all sections with data-section-type
        const sections = document.querySelectorAll<HTMLElement>('[data-section-type]');
        sections.forEach((el) => observer.observe(el));

        // On unmount, flush any remaining timers
        return () => {
            observer.disconnect();
            for (const [sectionType, startTime] of sectionTimers.entries()) {
                if (!sentDurations.has(sectionType)) {
                    const duration = Date.now() - startTime;
                    if (duration > 500) {
                        LandingAnalyticsService.trackSectionDuration(variantId, sectionType, duration);
                    }
                }
            }
        };
    }, [variantId, loading]);

    // ── CTA click tracking ──
    const trackCtaClick = useCallback((sectionType: string, label: string) => {
        LandingAnalyticsService.trackCtaClick(variantId, sectionType, label);
    }, [variantId]);

    // ── Form submit tracking ──
    const trackFormSubmit = useCallback(() => {
        LandingAnalyticsService.trackFormSubmit(variantId);
    }, [variantId]);

    return { trackSectionView, trackCtaClick, trackFormSubmit };
}
