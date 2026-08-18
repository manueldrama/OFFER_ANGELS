// CAFEPASTE Angels — portal auth context + route guard'ları.
// Sitenin AuthProvider'ından (admin Supabase oturumu) TAMAMEN bağımsızdır;
// yalnızca /angels/login, /angels/set-password, /angels/creator/*,
// /angels/venue/* alt ağacına mount edilir. Public davet sayfaları etkilenmez.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AngelsAuthService } from '../../services/angels/angelsAuthService';
import type {
    AngelsAccount,
    AngelsSessionData,
    CreatorMembership,
    VenueMembership,
} from '../../types/angelsPlatform';
import { A, AngelsShell, AngelsButton, AngelsGhostButton } from './AngelsShell';

const ACTIVE_CREATOR_KEY = 'angels_active_creator';

interface AngelsAuthContextValue {
    isLoading: boolean;
    account: AngelsAccount | null;
    creatorMemberships: CreatorMembership[];
    venueMemberships: VenueMembership[];
    /** Manager birden çok creator yönetebilir — aktif creator seçimi */
    activeCreatorId: string | null;
    setActiveCreatorId: (id: string) => void;
    activeVenueId: string | null;
    signIn: (email: string, password: string) => Promise<AngelsSessionData>;
    adoptSession: (data: AngelsSessionData) => void;
    signOut: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AngelsAuthContext = createContext<AngelsAuthContextValue>({
    isLoading: true,
    account: null,
    creatorMemberships: [],
    venueMemberships: [],
    activeCreatorId: null,
    setActiveCreatorId: () => {},
    activeVenueId: null,
    signIn: async () => { throw new Error('not mounted'); },
    adoptSession: () => {},
    signOut: async () => {},
    refresh: async () => {},
});

export function useAngelsAuth(): AngelsAuthContextValue {
    return useContext(AngelsAuthContext);
}

export function AngelsAuthProvider({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<AngelsSessionData | null>(null);
    const [activeCreatorId, setActiveCreatorIdState] = useState<string | null>(() => {
        try { return localStorage.getItem(ACTIVE_CREATOR_KEY); } catch { return null; }
    });

    const applySession = useCallback((data: AngelsSessionData | null) => {
        setSession(data);
        if (data && data.creatorMemberships.length > 0) {
            const stored = (() => {
                try { return localStorage.getItem(ACTIVE_CREATOR_KEY); } catch { return null; }
            })();
            const valid = data.creatorMemberships.some(m => m.creator_id === stored);
            const next = valid ? stored : data.creatorMemberships[0].creator_id;
            setActiveCreatorIdState(next);
            try { localStorage.setItem(ACTIVE_CREATOR_KEY, next!); } catch { /* noop */ }
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        AngelsAuthService.getSession().then(data => {
            if (cancelled) return;
            applySession(data);
            setIsLoading(false);
        });
        return () => { cancelled = true; };
    }, [applySession]);

    const setActiveCreatorId = useCallback((id: string) => {
        setActiveCreatorIdState(id);
        try { localStorage.setItem(ACTIVE_CREATOR_KEY, id); } catch { /* noop */ }
    }, []);

    const value = useMemo<AngelsAuthContextValue>(() => ({
        isLoading,
        account: session?.account ?? null,
        creatorMemberships: session?.creatorMemberships ?? [],
        venueMemberships: session?.venueMemberships ?? [],
        activeCreatorId,
        setActiveCreatorId,
        activeVenueId: session?.venueMemberships?.[0]?.venue_id ?? null,
        signIn: async (email, password) => {
            const data = await AngelsAuthService.signIn(email, password);
            applySession(data);
            return data;
        },
        adoptSession: (data) => applySession(data),
        signOut: async () => {
            await AngelsAuthService.signOut();
            setSession(null);
        },
        refresh: async () => {
            applySession(await AngelsAuthService.getSession());
        },
    }), [isLoading, session, activeCreatorId, setActiveCreatorId, applySession]);

    return <AngelsAuthContext.Provider value={value}>{children}</AngelsAuthContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard'lar
// ─────────────────────────────────────────────────────────────────────────────
function DarkLoading() {
    return (
        <div
            className="min-h-[100dvh] w-full flex items-center justify-center"
            style={{ background: A.bg }}
        >
            <div
                className="w-8 h-8 rounded-full animate-spin"
                style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }}
            />
        </div>
    );
}

function NoAccessScreen({ message }: { message: string }) {
    const { signOut } = useAngelsAuth();
    return (
        <AngelsShell maxWidth={480}>
            <div
                className="w-full rounded-2xl p-8 text-center"
                style={{ background: A.surface, border: `1px solid ${A.border}` }}
            >
                <p style={{ color: A.text, fontSize: 17, fontWeight: 600, marginBottom: 10 }}>
                    Access unavailable
                </p>
                <p style={{ color: A.textSecondary, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                    {message}
                </p>
                <div className="flex flex-col gap-3">
                    <AngelsButton block onClick={() => { window.location.href = 'mailto:angels@cafepaste.com'; }}>
                        Contact the Angels Team
                    </AngelsButton>
                    <AngelsGhostButton block onClick={() => { void signOut().then(() => { window.location.href = '/login'; }); }}>
                        Sign out
                    </AngelsGhostButton>
                </div>
            </div>
        </AngelsShell>
    );
}

// NOT: Oturum token'ı tarayıcı başına TEKTİR (localStorage). Aynı tarayıcıda
// önce creator sonra venue hesabıyla giriş yapılırsa eski sekme diğer alanın
// oturumuyla kalır. Bu yüzden guard'lar ölü ekran yerine hesabın GERÇEKTEN
// erişebildiği alana otomatik yönlendirir; "no access" yalnızca hesabın hiçbir
// üyeliği yokken görünür.
export function RequireAngelsVenue({ children }: { children: React.ReactNode }) {
    const { isLoading, account, venueMemberships, creatorMemberships } = useAngelsAuth();
    const location = useLocation();
    if (isLoading) return <DarkLoading />;
    if (!account) return <Navigate to="/login" state={{ from: location }} replace />;
    if (venueMemberships.length === 0) {
        if (creatorMemberships.length > 0) {
            // Bu oturum bir creator hesabına ait — doğru panele taşı
            return <Navigate to="/creator" replace />;
        }
        return <NoAccessScreen message="This account does not have venue access. If you believe this is a mistake, contact the CAFEPASTE Angels team." />;
    }
    const status = venueMemberships[0]?.venue?.account_status;
    if (status === 'suspended' || status === 'archived') {
        return <NoAccessScreen message="Your venue account is currently suspended. Please contact the CAFEPASTE Angels team to restore access." />;
    }
    return <>{children}</>;
}

export function RequireAngelsCreator({ children }: { children: React.ReactNode }) {
    const { isLoading, account, creatorMemberships, venueMemberships } = useAngelsAuth();
    const location = useLocation();
    if (isLoading) return <DarkLoading />;
    if (!account) return <Navigate to="/login" state={{ from: location }} replace />;
    if (creatorMemberships.length === 0) {
        if (venueMemberships.length > 0) {
            // Bu oturum bir venue hesabına ait — doğru panele taşı
            return <Navigate to="/venue" replace />;
        }
        return <NoAccessScreen message="This account does not have creator access. If you believe this is a mistake, contact the CAFEPASTE Angels team." />;
    }
    return <>{children}</>;
}
