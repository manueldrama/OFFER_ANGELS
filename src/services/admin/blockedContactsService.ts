import { supabase } from '../../lib/supabase/client';

export interface BlockedContact {
    id: string;
    phone_number: string;
    reason: string | null;
    created_by: string | null;
    created_at: string;
}

export const BlockedContactsService = {
    async listBlockedContacts(): Promise<BlockedContact[]> {
        const { data, error } = await supabase
            .from('blocked_contacts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching blocked contacts:', error);
            throw error;
        }

        return data || [];
    },

    async blockContact(phone_number: string, reason?: string, userId?: string): Promise<BlockedContact> {
        // Enforce + prefix
        const formattedPhone = phone_number.startsWith('+') ? phone_number : `+${phone_number.replace(/\D/g, '')}`;

        const { data, error } = await supabase
            .from('blocked_contacts')
            .insert({
                phone_number: formattedPhone,
                reason: reason || null,
                created_by: userId || null
            })
            .select()
            .single();

        if (error) {
            console.error('Error blocking contact:', error);
            throw error;
        }

        return data;
    },

    async unblockContact(phone_number: string): Promise<void> {
        const { error } = await supabase
            .from('blocked_contacts')
            .delete()
            .or(`phone_number.eq.${phone_number},phone_number.eq.+${phone_number.replace(/\D/g, '')}`);

        if (error) {
            console.error('Error unblocking contact:', error);
            throw error;
        }
    },

    async isBlocked(phone_number: string): Promise<boolean> {
        if (!phone_number) return false;
        
        // Check for + stripped and formatted versions due to variable input hygiene
        const cleanPhone = phone_number.replace(/\D/g, '');
        const withPlus = `+${cleanPhone}`;

        const { count, error } = await supabase
            .from('blocked_contacts')
            .select('*', { count: 'exact', head: true })
            .or(`phone_number.eq.${phone_number},phone_number.eq.${withPlus},phone_number.eq.${cleanPhone}`);

        if (error) {
            console.error('Error checking block status:', error);
            return false;
        }

        return (count ?? 0) > 0;
    }
};
