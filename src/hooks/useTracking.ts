import { useCallback } from 'react';
import { tracker, TrackingEventType } from '../services/tracking';

/**
 * A hook wrapper around the TrackingService to easily dispatch events from components.
 * Can be extended to automatically inject component-level metadata if needed.
 */
export const useTracking = () => {
    const trackEvent = useCallback((eventName: TrackingEventType, metadata?: Record<string, any>) => {
        tracker.track(eventName, metadata);
    }, []);

    return { trackEvent };
};
