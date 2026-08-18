import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { PortalSession, CustomerDevice, ServiceRequest, ServiceSubscription, ConsumableOrder, OnboardingChecklist, CartridgeSubscription, PortalDocument } from '../types';
import { CustomerPortalService } from '../services/customerPortalService';
import { PortalUser, PortalUsersService } from '../services/portalUsersService';
import { supabase } from '../lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface PortalData {
    lead: any;
    devices: CustomerDevice[];
    requests: ServiceRequest[];
    subscriptions: ServiceSubscription[];
    orders: ConsumableOrder[];
    onboardingChecklist: OnboardingChecklist[];
    cartridgeSubscriptions: CartridgeSubscription[];
    documents: PortalDocument[];
}

interface PortalContextType {
    session: PortalSession | null;
    portal: any | null;
    data: PortalData | null;
    loading: boolean;
    error: string | null;
    isAuthenticated: boolean;
    authenticate: (pin: string, email?: string) => Promise<boolean>;
    refreshData: () => Promise<void>;
    isVip: boolean;
    portalUser: PortalUser | null;
    isOwner: boolean;
    hasDevices: boolean;
    onboardingPercent: number;
    isSetupComplete: boolean;
}

const PortalContext = createContext<PortalContextType | null>(null);

export function usePortal() {
    const ctx = useContext(PortalContext);
    if (!ctx) throw new Error('usePortal must be used within PortalProvider');
    return ctx;
}

interface PortalProviderProps {
    slug: string;
    children: ReactNode;
}

export function PortalProvider({ slug, children }: PortalProviderProps) {
    const [session, setSession] = useState<PortalSession | null>(null);
    const [portal, setPortal] = useState<any | null>(null);
    const [data, setData] = useState<PortalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
    const lastAccessStampedRef = useRef(false);

    // Check if already authenticated for this slug
    const isAuthenticated = !!session?.authenticated;
    const isOwner = portalUser?.role === 'owner' || (!portalUser && isAuthenticated);

    useEffect(() => {
        loadPortal();
    }, [slug]);

    const loadPortal = async () => {
        setLoading(true);
        setError(null);
        try {
            const portalRes = await CustomerPortalService.getPortalBySlug(slug);
            setPortal(portalRes);

            // If no PIN is set, auto-authenticate (backwards compatible)
            const hasPin = !!portalRes.pin_hash;
            const storedAuth = sessionStorage.getItem(`portal_auth_${slug}`);

            if (!hasPin || storedAuth === 'true') {
                // Restore portal user from session storage if available
                const storedUser = sessionStorage.getItem(`portal_user_${slug}`);
                if (storedUser) {
                    try {
                        const parsedUser = JSON.parse(storedUser) as PortalUser;
                        setPortalUser(parsedUser);
                    } catch { /* ignore */ }
                }
                await authenticateAndLoad(portalRes);
            } else {
                setLoading(false);
            }
        } catch (err) {
            console.error('Portal load error:', err);
            setError('Portal bulunamadı veya bir hata oluştu.');
            setLoading(false);
        }
    };

    const authenticateAndLoad = async (portalData: any, user?: PortalUser) => {
        // "Son erişim" damgası — PIN'siz portallar hiçbir API ucuna uğramadan
        // auto-authenticate olduğu için client'tan yazılır (RLS izinli; admin
        // paneli "Son erişim" kolonu ve health score portal aktivitesi bunu okur).
        // Mount başına 1 kez; giriş asla bunun üzerinde bloklanmaz.
        if (!lastAccessStampedRef.current) {
            lastAccessStampedRef.current = true;
            supabase.from('customer_portals')
                .update({ last_accessed_at: new Date().toISOString() })
                .eq('id', portalData.id)
                .then(({ error: stampErr }) => {
                    if (stampErr) console.warn('[Portal] last_accessed damgası yazılamadı:', stampErr.message);
                });
        }

        setSession({
            portalId: portalData.id,
            leadId: portalData.lead_id,
            slug: portalData.slug,
            authenticated: true,
            ...(user ? {
                portalUserId: user.id,
                portalUserRole: user.role,
                portalUserName: user.name,
            } : {}),
        });
        sessionStorage.setItem(`portal_auth_${slug}`, 'true');
        if (user) {
            setPortalUser(user);
            sessionStorage.setItem(`portal_user_${slug}`, JSON.stringify(user));
        }

        // Initialize onboarding if not done yet
        if (!portalData.onboarding_completed) {
            try {
                await CustomerPortalService.initializeOnboarding(portalData.lead_id, portalData.id);
            } catch (e) {
                console.warn('Onboarding init skipped:', e);
            }
        }

        // Load full data
        await loadFullData(portalData.lead_id);
    };

    const loadFullData = async (leadId: string) => {
        try {
            const fullData = await CustomerPortalService.getPortalFullData(leadId);
            setData(fullData);

            // Update session with customer name
            setSession(prev => prev ? {
                ...prev,
                customerName: fullData.lead?.customer_name,
                companyName: fullData.lead?.company_name,
            } : null);
        } catch (err) {
            console.error('Portal data error:', err);
            setError('Veriler yüklenirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const authenticate = async (pin: string, email?: string): Promise<boolean> => {
        try {
            // If email is provided, try multi-user authentication first
            if (email) {
                const user = await PortalUsersService.verifyUser(portal.id, email, pin);
                if (user) {
                    await authenticateAndLoad(portal, user);
                    return true;
                }
                return false;
            }

            // Fallback: legacy single-PIN auth (treated as owner)
            const valid = await CustomerPortalService.verifyPin(portal.id, pin);
            if (valid) {
                await authenticateAndLoad(portal);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    };

    const refreshData = async () => {
        if (session?.leadId) {
            await loadFullData(session.leadId);
        }
    };

    // ─── Supabase Realtime Subscriptions ─────────────────────────
    const channelRef = useRef<RealtimeChannel | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const leadIdRef = useRef<string | null>(null);

    // Keep leadId ref in sync
    useEffect(() => {
        leadIdRef.current = session?.leadId || null;
    }, [session?.leadId]);

    useEffect(() => {
        if (!session?.leadId || !session?.authenticated) return;

        const leadId = session.leadId;
        console.log('[Portal Realtime] Setting up channel for lead:', leadId);

        // Debounced refresh using ref to avoid stale closures
        const handleChange = (payload: any) => {
            const table = payload?.table || 'unknown';
            const newRecord = payload?.new as any;
            const oldRecord = payload?.old as any;

            // Client-side filter: only refresh if this change belongs to our lead
            const recordLeadId = newRecord?.lead_id || oldRecord?.lead_id;
            if (recordLeadId && recordLeadId !== leadId) return;

            console.log('[Portal Realtime] Change received:', table, payload?.eventType);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                const currentLeadId = leadIdRef.current;
                if (currentLeadId) {
                    loadFullData(currentLeadId);
                }
            }, 500);
        };

        // Listen to all tables without server-side filters (more reliable)
        const tables = [
            'customer_devices', 'service_requests', 'service_subscriptions',
            'consumable_orders', 'onboarding_checklists', 'cartridge_subscriptions',
            'portal_documents', 'customer_portals', 'service_notes',
            'device_registration_requests', 'portal_notifications'
        ];

        let channel = supabase.channel(`portal-realtime-${leadId}`);
        for (const table of tables) {
            channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, handleChange);
        }
        channel.subscribe((status, err) => {
            console.log('[Portal Realtime] Status:', status, err ? err.message || err : '');
        });

        channelRef.current = channel;

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [session?.leadId, session?.authenticated]);

    const isVip = data?.subscriptions?.some(s => s.package_type === 'vip_priority' && s.status === 'active') ?? false;
    const hasDevices = (data?.devices?.length ?? 0) > 0;
    const onboardingChecklist = data?.onboardingChecklist ?? [];
    const onboardingTotal = onboardingChecklist.length;
    const onboardingDone = onboardingChecklist.filter(s => s.completed).length;
    const onboardingPercent = onboardingTotal > 0 ? Math.round((onboardingDone / onboardingTotal) * 100) : 0;
    const isSetupComplete = hasDevices && onboardingPercent >= 100;

    return (
        <PortalContext.Provider value={{
            session,
            portal,
            data,
            loading,
            error,
            isAuthenticated,
            authenticate,
            refreshData,
            isVip,
            portalUser,
            isOwner,
            hasDevices,
            onboardingPercent,
            isSetupComplete,
        }}>
            {children}
        </PortalContext.Provider>
    );
}
