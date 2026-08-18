import { supabase } from '../../lib/supabase/client';

export interface Product {
    id: string;
    name: string;
    tagline: string | null;
    description: string | null;
    base_price: number;
    old_price: number | null;
    image_url: string | null;
    stock_status: string | null;
    is_best_seller: boolean;
    created_at: string;
    updated_at: string;
}

export const AdminPricingService = {
    async listProducts() {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[AdminPricingService]', error);
            throw error;
        }
        return data as Product[];
    },

    async createProduct(payload: Partial<Product>) {
        // Fallback for ID if empty since it's text in schema
        if (!payload.id) {
            payload.id = payload.name?.toLowerCase().replace(/\s+/g, '-') || `prod-${Date.now()}`;
        }

        const { data, error } = await supabase
            .from('products')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        // Log audit
        const auth = await supabase.auth.getUser();
        if (auth.data.user) {
            await supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'CREATE',
                entity_type: 'PRODUCT',
                entity_id: data.id,
                new_values: payload
            });
        }

        return data as Product;
    },

    async updateProduct(id: string, updates: Partial<Product>) {
        const { data, error } = await supabase
            .from('products')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Log audit
        const auth = await supabase.auth.getUser();
        if (auth.data.user) {
            await supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'UPDATE',
                entity_type: 'PRODUCT',
                entity_id: id,
                new_values: updates
            });
        }

        return data as Product;
    }
};
