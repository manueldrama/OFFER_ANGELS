import { useContext } from 'react';
import { AuthContext, UserRole } from '../components/auth/AuthProvider';

const ADMIN_ROLES: UserRole[] = ['super_admin', 'sales_admin', 'support_admin'];

/**
 * Returns true when the current Supabase user is logged in with an admin role.
 * Used by inline editor on customer-facing pages to gate edit mode behind auth.
 *
 * Falls back to false during loading and when no session exists.
 */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
    const { session, role, isLoading } = useContext(AuthContext);
    const isAdmin = !!session && ADMIN_ROLES.includes(role);
    return { isAdmin, isLoading };
}
