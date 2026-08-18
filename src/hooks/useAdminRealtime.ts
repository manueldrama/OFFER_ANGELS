import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useAdminRealtime(
    tables: string[],
    onDataChange: () => void,
    debounceMs: number = 500
) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const debouncedRefresh = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onDataChange();
        }, debounceMs);
    }, [onDataChange, debounceMs]);

    const tablesKey = tables.join(',');

    useEffect(() => {
        if (tables.length === 0) return;

        const channelName = `admin-realtime-${tables.join('-')}`;
        let channel = supabase.channel(channelName);

        for (const table of tables) {
            channel = channel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table },
                debouncedRefresh
            );
        }

        channel.subscribe();
        channelRef.current = channel;

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [tablesKey, debouncedRefresh]);
}
