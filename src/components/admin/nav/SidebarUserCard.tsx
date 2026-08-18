import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';

// Users.tsx ile AYNI etiketler — iki ekran aynı rolü farklı adlandırmasın.
const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Süper Admin',
    sales_admin: 'Satış Temsilcisi',
    support_admin: 'Servis / Operasyon',
    technician: 'Teknisyen',
    logistics: 'Lojistik',
    finance: 'Finans',
};

/** "Menajer Kadıoğlu" → "MK". Tek kelimede ilk iki harf. */
function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr');
    return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr');
}

type Props = {
    userId: string | null;
    email: string | null;
    role: string | null;
    onLogout: () => void;
};

/**
 * Sol menü alt bloğu: kim olarak bağlıyım + tek tıkla çıkış.
 *
 * İsim sales_users'tan çekilir; gelmezse e-postanın @ öncesine düşer — profil
 * bloğunun boş görünmesindense zayıf da olsa bir kimlik göstermek yeğdir.
 */
export function SidebarUserCard({ userId, email, role, onLogout }: Props) {
    const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        (async () => {
            try {
                const { data } = await supabase
                    .from('sales_users')
                    .select('full_name, avatar_url')
                    .eq('id', userId)
                    .maybeSingle();
                if (!cancelled && data) setProfile(data as any);
            } catch {
                /* profil çekilemedi — e-posta yedeği devrede */
            }
        })();
        return () => { cancelled = true; };
    }, [userId]);

    const name = profile?.full_name?.trim() || email?.split('@')[0] || 'Kullanıcı';
    const roleLabel = role ? (ROLE_LABELS[role] ?? role) : '—';

    return (
        <div className="flex items-center gap-2.5 px-2 py-2">
            {profile?.avatar_url ? (
                <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                />
            ) : (
                <span className="w-9 h-9 rounded-full shrink-0 bg-slate-100 text-slate-500 text-[12px] font-bold inline-flex items-center justify-center ring-1 ring-slate-200">
                    {initialsOf(name)}
                </span>
            )}

            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 truncate" title={email ?? undefined}>
                    {name}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{roleLabel}</p>
            </div>

            <button
                onClick={onLogout}
                title="Oturumu kapat"
                aria-label="Oturumu kapat"
                className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
                <LogOut size={16} />
            </button>
        </div>
    );
}
