import { supabase } from '../../lib/supabase/client';
import { sanitizeSearchTerm } from '../../utils/searchFilter';
import { ConsumableOrder } from '../../types';

export const AdminConsumableOrdersService = {
    // 1) List Consumables (with filtering)
    async listOrders(
        params: { search?: string; status?: string; type?: string; page?: number; limit?: number }
    ) {
        const { search, status, type, page = 1, limit = 20 } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase.from('consumable_orders').select(`
            *,
            leads(customer_name, phone_number),
            customer_devices(product_model, serial_number)
        `, { count: 'exact' });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        if (type && type !== 'all') {
            query = query.eq('item_type', type);
        }
        const s = sanitizeSearchTerm(search);
        if (s) {
            query = query.or(`notes.ilike.%${s}%`);
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[AdminConsumableOrdersService] Error listing orders:', error);
            throw error;
        }

        return {
            orders: data as (ConsumableOrder & {
                leads: { customer_name: string; phone_number: string };
                customer_devices?: { product_model: string; serial_number: string } | null;
            })[],
            count: count || 0
        };
    },

    // 2) Get Consumables for a Lead
    async getOrdersByLead(leadId: string): Promise<ConsumableOrder[]> {
        const { data, error } = await supabase
            .from('consumable_orders')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[AdminConsumableOrdersService] Error fetching orders for lead:', error);
            throw error;
        }

        return data as ConsumableOrder[];
    },

    // 3) Create Order
    async createOrder(orderData: Omit<ConsumableOrder, 'id' | 'created_at' | 'updated_at'>) {
        const { error, data } = await supabase
            .from('consumable_orders')
            .insert([orderData])
            .select()
            .single();

        if (error) {
            console.error('[AdminConsumableOrdersService] Error creating order:', error);
            throw error;
        }

        return data;
    },

    // 4) Update Order Status
    async updateOrder(orderId: string, updates: Partial<ConsumableOrder>) {
        const { error, data } = await supabase
            .from('consumable_orders')
            .update(updates)
            .eq('id', orderId)
            .select()
            .single();

        if (error) {
            console.error('[AdminConsumableOrdersService] Error updating order:', error);
            throw error;
        }

        return data;
    }
};
