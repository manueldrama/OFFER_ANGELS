import { supabase } from '../../lib/supabase/client';

export interface PaymentSettingsMap {
    [key: string]: any;
}

export const PaymentSettingsService = {
    async getAll(): Promise<PaymentSettingsMap> {
        const { data, error } = await supabase
            .from('payment_settings')
            .select('key, value, description, updated_at');
        if (error) throw error;
        const map: PaymentSettingsMap = {};
        (data || []).forEach((row: any) => {
            map[row.key] = { value: row.value, description: row.description, updated_at: row.updated_at };
        });
        return map;
    },

    async update(key: string, value: any): Promise<void> {
        const { error } = await supabase
            .from('payment_settings')
            .update({ value, updated_at: new Date().toISOString() })
            .eq('key', key);
        if (error) throw error;
    },
};
