import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from './AuthProvider';

interface RequireRoleProps {
    allowedRoles: string[];
    children: React.ReactNode;
    fallbackPath?: string;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ allowedRoles, children, fallbackPath = '/admin' }) => {
    const { role, isLoading } = useContext(AuthContext);

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">Yetkiler kontrol ediliyor...</div>;
    }

    // Check authorization based on allowed roles
    const isAuthorized = role && allowedRoles.includes(role);
    if (!isAuthorized) {
        return (
            <div className="p-4 md:p-8 max-w-2xl mx-auto mt-10">
                <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl text-center shadow-sm">
                    <h2 className="text-xl font-bold mb-2">Yetkisiz Erişim</h2>
                    <p>Bu ekranı (*{window.location.pathname}*) görüntülemek için yetkiniz bulunmuyor.</p>
                    <div className="mt-4 text-sm bg-white/50 inline-block px-4 py-2 rounded-lg border border-red-100">
                        <span className="block mb-1">Mevcut Rolünüz: <strong>{role || 'Atanmamış (Bilinmiyor)'}</strong></span>
                        <span className="block">Gerekli Roller: <strong>{allowedRoles.join(', ')}</strong></span>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
