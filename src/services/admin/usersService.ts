import { supabase } from '../../lib/supabase/client';

export interface SalesUser {
    id: string;
    full_name: string | null;
    email: string | null;
    role: 'super_admin' | 'sales_admin' | 'support_admin' | 'technician' | 'logistics' | 'finance';
    is_active: boolean;
    last_assigned_at: string | null;
    created_at: string;
}

export const AdminUsersService = {
    async listUsers(): Promise<SalesUser[]> {
        const { data, error } = await supabase
            .from('sales_users')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []) as SalesUser[];
    },

    async listActiveSalesReps(): Promise<SalesUser[]> {
        const { data, error } = await supabase
            .from('sales_users')
            .select('id, full_name, email, role, is_active, last_assigned_at, created_at')
            .eq('role', 'sales_admin')
            .eq('is_active', true)
            .order('full_name', { ascending: true });
        if (error) throw error;
        return (data || []) as SalesUser[];
    },

    async createUser(payload: { full_name: string; email: string; role: string; is_active?: boolean }): Promise<SalesUser> {
        // Must go through backend — Supabase Auth user creation requires service role key
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Kullanıcı oluşturulamadı.');
        return json.user as SalesUser;
    },

    async updateUser(id: string, payload: Partial<{ full_name: string; email: string; role: string; is_active: boolean }>): Promise<SalesUser> {
        const { data, error } = await supabase
            .from('sales_users')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as SalesUser;
    },

    async deleteUser(id: string): Promise<void> {
        // Backend deletes from both auth.users and sales_users
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`/api/admin/users/${id}`, {
            method: 'DELETE',
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Kullanıcı silinemedi.');
    },

    async getLeadCountPerUser(): Promise<Record<string, number>> {
        const { data, error } = await supabase
            .from('leads')
            .select('assigned_to')
            .not('assigned_to', 'is', null);
        if (error) throw error;
        const counts: Record<string, number> = {};
        (data || []).forEach((row: any) => {
            if (row.assigned_to) {
                counts[row.assigned_to] = (counts[row.assigned_to] || 0) + 1;
            }
        });
        return counts;
    }
};
