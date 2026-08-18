import React, { useContext } from 'react';
import { AuthContext } from './AuthProvider';
import { usePermissions } from '../../contexts/PermissionsContext';

interface RequirePageProps {
    pageKey: string;
    children: React.ReactNode;
}

// Yetki-bazlı route guard: role_permissions.allowed_pages üzerinden sayfa erişimi
// kontrol eder (super_admin bypass'ı canAccess içinde). RequireRole rol listesiyle
// çalışır; bu guard ise Yetki Yönetimi'ndeki checkbox'lara bağlıdır — sidebar'da
// gizlenen sayfa direkt URL ile de açılamaz.
export const RequirePage: React.FC<RequirePageProps> = ({ pageKey, children }) => {
    const { role, isLoading: authLoading } = useContext(AuthContext);
    const { canAccess, isLoading: permsLoading } = usePermissions();

    // İki context de yüklenmeden karar verme — erken deny meşru kullanıcıya
    // "Yetkisiz Erişim" flash'ı gösterir.
    if (authLoading || permsLoading) {
        return <div className="p-8 text-center text-slate-500">Yetkiler kontrol ediliyor...</div>;
    }

    if (!canAccess(role, pageKey)) {
        return (
            <div className="p-4 md:p-8 max-w-2xl mx-auto mt-10">
                <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl text-center shadow-sm">
                    <h2 className="text-xl font-bold mb-2">Yetkisiz Erişim</h2>
                    <p>Bu ekranı (*{window.location.pathname}*) görüntülemek için yetkiniz bulunmuyor.</p>
                    <div className="mt-4 text-sm bg-white/50 inline-block px-4 py-2 rounded-lg border border-red-100">
                        <span className="block mb-1">Mevcut Rolünüz: <strong>{role || 'Atanmamış (Bilinmiyor)'}</strong></span>
                        <span className="block">Bu sayfa Yetki Yönetimi'nden rolünüze açılmalıdır.</span>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
