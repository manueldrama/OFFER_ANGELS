import React, { useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';

// 'employee' = personel portali (/team) kullanicisi. Admin panelinde HICBIR
// sayfaya erisemez (role_permissions'ta bos dizi, AdminLayout'ta yonlendirme).
export type UserRole =
    | 'super_admin' | 'sales_admin' | 'support_admin'
    | 'technician' | 'logistics' | 'finance'
    | 'employee'
    | null;

/**
 * GIRISTEN SONRAKI EV — rolun tek kaynagi.
 *
 * Kapi (hangi giris ekrani kullanildi) DEGIL, ROL belirler. Satis temsilcisi
 * yonetim giris ekranindan girse bile kendi portaline duser: "calisan admin
 * gibi hissetmesin" karari kapiyla degil rolle uygulanir, aksi halde eski
 * /login yer imini kullanan herkes yine admin panelinde acilirdi.
 *
 * YALNIZ super_admin YONETICIDIR; diger HERKES calisandir.
 *
 * Bu bir yetki karari DEGILDIR - satis temsilcisi, finans, lojistik, teknik ve
 * destek rolleri admin panelini kullanmaya devam eder ve girisi kisitlanmaz.
 * Karar yalnizca "giristen sonra ilk ekran ne olsun" sorusuna aittir: bu
 * kisiler once KENDI kayitlarini (puantaj, izin, bordro, KPI) gorur, yonetime
 * portal basligindaki "Yonetim Paneli" baglantisiyla gecer.
 *
 * Liste TEK DEGISTIRME NOKTASIDIR: burada olan rol /admin'de, olmayan herkes
 * /team'de acilir.
 */
const MANAGEMENT_HOME_ROLES: Exclude<UserRole, null>[] = ['super_admin'];

export function homeForRole(role: UserRole): string {
    return role && MANAGEMENT_HOME_ROLES.includes(role) ? '/admin' : '/team';
}

/**
 * Giris ANINDA evi cozer.
 *
 * NEDEN BURADA, EKRANDA DEGIL: giris ekrani ProtectedRoute'un fallback'idir;
 * oturum acilir acilmaz unmount olur ve yerine korunan sayfa gelir. Yonlendirme
 * ekranin render'inda yazilsaydi hic calisamaz, satis temsilcisi yine /admin'de
 * acilirdi.
 *
 * NEDEN HER ZIYARETTE DEGIL: satis temsilcisi /admin'e GIREBILIR (leadler,
 * teklifler onun isi). Karar yalnizca "girdikten sonra ilk nerede acilsin"
 * sorusudur; her /admin ziyaretinde uygulansaydi "Yonetim Paneli" baglantisi
 * sonsuz donguye duserdi.
 *
 * Rol burada bir kez daha okunur cunku AuthProvider'in kendi okumasi asenkron
 * ve heniiz bitmemis olabilir. Karar tek yerdedir (homeForRole); tekrarlanan
 * sey yalnizca sorgudur.
 */
export async function landingForUser(userId: string): Promise<string> {
    try {
        const { data } = await supabase
            .from('sales_users').select('role').eq('id', userId).single();
        return homeForRole((data?.role as UserRole) ?? null);
    } catch {
        // Rol okunamadiysa portal guvenli varsayilandir: yetkisi olan oradan
        // yonetime gecebilir, olmayan zaten admin panelini goremezdi.
        return '/team';
    }
}

export const AuthContext = React.createContext<{
    session: any | null,
    role: UserRole,
    isLoading: boolean,
    setSession?: React.Dispatch<any>,
    setRole?: React.Dispatch<React.SetStateAction<UserRole>>
}>({ session: null, role: null, isLoading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = React.useState<any | null>(null);
    const [role, setRole] = React.useState<UserRole>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    // KRITIK: Bu ref'ler closure-stale problemini cozer. onAuthStateChange
    // callback'i AuthProvider mount'unda kuruluyor; React state'leri o anki
    // closure'da donduruluyor. Ayni user icin SIGNED_IN tekrar emit edildiginde
    // (tab focus / realtime auth refresh) "varolan rol yuklu mu" sorusunu
    // cevaplamak icin guncel degerleri ref'ten okumamiz lazim.
    const userIdRef = useRef<string | null>(null);
    const initializedRef = useRef(false);
    // "Rol YUKLENDI mi" ile "rol DOLU mu" ayri sorulardir. Fail-closed'a
    // gecince rol mesru olarak null kalabiliyor; asagidaki SIGNED_IN re-emit
    // korumasi roleRef !== null'a bakiyor olsaydi, rolsuz kullanicida her tab
    // fokusunda isLoading true olur ve tum admin agaci remount ederdi
    // (yorumda anlatilan "sayfa surekli restart atiyor" semptomu).
    const roleLoadedRef = useRef(false);


    // FAIL-CLOSED. Eskiden rol okunamadiginda 'sales_admin' veriliyordu ve
    // yanina "safe fallback" yazilmisti. Guvenli olan buydu sanildi ama hata
    // modu "YETKI VER" demekti: sales_users satiri olmayan ya da rolu bos olan
    // her oturum satis yoneticisi oluyordu.
    //
    // Personel portali (/team) acilirken bu kritik hale geldi: portal icin
    // acilan her hesap admin paneline girerdi.
    //
    // Rol okunamiyorsa null kalir. Her iki guard (RequireRole, RequirePage) ve
    // canAccess() null rolde zaten reddediyor; kullanici disari atilmaz, sadece
    // hicbir sey goremez ve durum ekranda "Atanmamis" olarak GORUNUR.
    const fetchUserRole = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('sales_users')
                .select('role, is_active')
                .eq('id', userId)
                .single();

            // PASIF HESAP OTURUMDAN DUSURULUR - rolu bosaltmak YETMEZ.
            //
            // is_active girişte hiç kontrol edilmiyordu: İK'da personeli
            // pasife almak ya da isten cikarmak, kisinin giris yapmasini
            // engellemiyordu. Pasiflestirme tamamen sustu.
            //
            // Neden signOut, neden sadece role=null degil: /team portali
            // YALNIZ OTURUM ister (ProtectedRoute), rol istemez. Rolu
            // bosaltsaydik ayrilan personel admin paneline giremezdi ama
            // kendi maasini, bordrosunu ve belgelerini okumaya devam ederdi.
            if (!error && data && data.is_active === false) {
                setRole(null);
                await supabase.auth.signOut();
                return;
            }

            setRole(!error && data?.role ? (data.role as UserRole) : null);
        } catch {
            setRole(null);
        } finally {
            roleLoadedRef.current = true;
        }
    };

    React.useEffect(() => {
        // Clean up any leftover mock bypass from previous mock login flow.
        // (We removed the bypass to make RLS auth.uid() work properly.)
        if (localStorage.getItem('admin_bypass')) {
            localStorage.removeItem('admin_bypass');
        }

        // Initialize the session from Supabase
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                userIdRef.current = session.user.id;
                fetchUserRole(session.user.id).finally(() => {
                    setIsLoading(false);
                    initializedRef.current = true;
                });
            } else {
                setIsLoading(false);
                initializedRef.current = true;
            }
        }).catch(() => {
            // Failsafe for missing keys
            setSession(null);
            setIsLoading(false);
            initializedRef.current = true;
        });

        // Listen for auth changes.
        // KRITIK: TOKEN_REFRESHED / USER_UPDATED / INITIAL_SESSION / hatta
        // SIGNED_IN event'leri Supabase v2'de tab fokuslandiginda, storage
        // event ile baska sekmedeki refresh ile, ve realtime auth yenilenince
        // tekrar emit edilebiliyor. Eskiden her SIGNED_IN'de setIsLoading(true)
        // yapip rol'u yeniden fetch'liyorduk → ProtectedRoute spinner
        // gosteriyordu → tum admin layout (Outlet, RequireRole, route
        // component'leri, iframe'ler dahil) unmount olup remount oluyordu →
        // "sayfa surekli restart atiyor" semptomu (admin/heatmap'te bu
        // ozellikle yikici cunku iframe sifirdan /lp yukluyordu).
        //
        // Cozum: SIGNED_IN ayni user icin tekrar emit edildiginde sessizce
        // session reference'ini guncelle, isLoading'e dokunma.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            // Tani: production'da kac kez ve hangi event'in fire ettigini
            // gormek icin. Bir kac gun sonra silinebilir.
            try { console.debug('[auth-diag]', event, session?.user?.id?.slice(0, 8) || 'no-user'); } catch { /* swallow */ }

            setSession(session);
            if (event === 'SIGNED_IN') {
                if (!session?.user) return;
                const sameUser = userIdRef.current === session.user.id;
                const hasRole = roleLoadedRef.current;
                if (initializedRef.current && sameUser && hasRole) {
                    // Initial yukleme tamam + ayni user + rol yuklu →
                    // bu SIGNED_IN tab focus / storage / realtime kaynakli
                    // re-emit'tir, gercek bir yeni login degil. isLoading'e
                    // dokunma; aksi halde tum admin tree unmount olur.
                    return;
                }
                userIdRef.current = session.user.id;
                setIsLoading(true);
                fetchUserRole(session.user.id).finally(() => {
                    setIsLoading(false);
                    initializedRef.current = true;
                });
            } else if (event === 'SIGNED_OUT') {
                userIdRef.current = null;
                roleLoadedRef.current = false;
                setRole(null);
                setIsLoading(false);
            }
            // TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY, INITIAL_SESSION:
            // session zaten setSession ile guncellendi; isLoading'e dokunma.
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ session, role, isLoading, setSession, setRole }}>
            {children}
        </AuthContext.Provider>
    );
};

export const ProtectedRoute = ({ children, fallback, loginPath = '/admin' }: {
    children: React.ReactNode;
    /**
     * Oturum yoksa ADRESI DEGISTIRMEDEN gosterilecek giris ekrani.
     *
     * GIRIS EKRANI ARTIK KAPININ KENDISINDE YASAR: yonetim girisi /admin,
     * calisan girisi /team adresindedir. Ayri bir /login adresine atmak
     * kullaniciyi gittigi yerden kopariyordu ve "hangi adresten giriliyor"
     * sorusunun iki farkli cevabi oluyordu.
     *
     * Bonus: /admin/leads gibi derin bir yer imine oturumsuz gidildiginde
     * adres korunur, giris sonrasi kisi tam olarak gitmek istedigi yerde acilir.
     */
    fallback?: React.ReactNode;
    /** fallback verilmediginde gidilecek kapi. */
    loginPath?: string;
}) => {
    const { session, isLoading } = React.useContext(AuthContext);
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!session) {
        // Giris ekrani bu adresin KENDISINDE acilir; yoksa eski davranis.
        if (fallback) return <>{fallback}</>;
        return <Navigate to={loginPath} state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
