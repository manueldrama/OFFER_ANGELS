import { supabase } from '../lib/supabase/client';

export type PortalUserRole = 'owner' | 'staff';

export interface PortalUser {
    id: string;
    portal_id: string;
    name: string;
    email: string;
    pin_hash?: string;
    role: PortalUserRole;
    is_active: boolean;
    created_at: string;
}

export const PortalUsersService = {
    /**
     * List all users for a portal.
     */
    async listUsers(portalId: string): Promise<PortalUser[]> {
        const { data, error } = await supabase
            .from('portal_users')
            .select('id, portal_id, name, email, role, is_active, created_at')
            .eq('portal_id', portalId)
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return (data || []) as PortalUser[];
    },

    /**
     * Add a staff user to a portal. Only owners should call this.
     */
    async addUser(data: {
        portal_id: string;
        name: string;
        email: string;
        pin: string;
        role?: PortalUserRole;
    }): Promise<PortalUser> {
        // Hash PIN via the API (same pattern as portal PIN)
        const res = await fetch('/api/portal/set-user-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                portalId: data.portal_id,
                name: data.name,
                email: data.email,
                pin: data.pin,
                role: data.role || 'staff',
            }),
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.message || 'Kullanıcı eklenemedi');
        }
        const json = await res.json();
        return json.user as PortalUser;
    },

    /**
     * Deactivate (soft-delete) a portal user.
     */
    async removeUser(id: string): Promise<void> {
        const { error } = await supabase
            .from('portal_users')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Verify login credentials for a multi-user portal.
     * Returns the matched PortalUser if valid, null otherwise.
     */
    async verifyUser(portalId: string, email: string, pin: string): Promise<PortalUser | null> {
        try {
            const res = await fetch('/api/portal/verify-user-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portalId, email, pin }),
            });
            const json = await res.json();
            if (json.valid && json.user) {
                return json.user as PortalUser;
            }
            return null;
        } catch {
            return null;
        }
    },

    /**
     * Get portal user by portal_id and email (for checking if user exists).
     */
    async getUserByEmail(portalId: string, email: string): Promise<PortalUser | null> {
        const { data, error } = await supabase
            .from('portal_users')
            .select('id, portal_id, name, email, role, is_active, created_at')
            .eq('portal_id', portalId)
            .eq('email', email)
            .eq('is_active', true)
            .maybeSingle();

        if (error) throw error;
        return data as PortalUser | null;
    },
};
