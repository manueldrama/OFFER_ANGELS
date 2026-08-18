// Admin read access to contract_acceptances (legal evidence log).
// Writes happen via /api/contract-acceptance (service_role); RLS blocks anon writes.

import { supabase } from '../../lib/supabase/client';

export interface ContractAcceptance {
    id: string;
    offer_token: string | null;
    offer_code: string | null;
    lead_id: string | null;
    reservation_id: string | null;
    customer_name: string;
    company_name: string | null;
    phone: string | null;
    email: string | null;
    ip_address: string | null;
    user_agent: string | null;
    country_code: string | null;
    language_code: string | null;
    pre_info_title: string | null;
    pre_info_html: string | null;
    pre_info_hash: string | null;
    distance_sales_title: string | null;
    distance_sales_html: string | null;
    distance_sales_hash: string | null;
    accepted_at: string;
    created_at: string;
}

export interface ContractAcceptanceFilters {
    from?: string;            // ISO date
    to?: string;              // ISO date
    country?: string;
    language?: string;
    search?: string;          // matches customer_name, phone, offer_code, ip_address
    limit?: number;
    offset?: number;
}

export const ContractAcceptancesService = {
    async list(filters: ContractAcceptanceFilters = {}): Promise<{ rows: ContractAcceptance[]; count: number | null }> {
        let q = supabase
            .from('contract_acceptances')
            .select('*', { count: 'exact' })
            .order('accepted_at', { ascending: false });

        if (filters.from) q = q.gte('accepted_at', filters.from);
        if (filters.to) q = q.lte('accepted_at', filters.to);
        if (filters.country) q = q.eq('country_code', filters.country.toUpperCase());
        if (filters.language) q = q.eq('language_code', filters.language.toLowerCase());
        if (filters.search?.trim()) {
            const s = filters.search.trim().replace(/[%,]/g, '');
            q = q.or(
                `customer_name.ilike.%${s}%,phone.ilike.%${s}%,offer_code.ilike.%${s}%,ip_address.ilike.%${s}%,email.ilike.%${s}%`
            );
        }

        const limit = filters.limit ?? 100;
        const offset = filters.offset ?? 0;
        q = q.range(offset, offset + limit - 1);

        const { data, error, count } = await q;
        if (error) throw error;
        return { rows: (data ?? []) as ContractAcceptance[], count: count ?? null };
    },

    async getById(id: string): Promise<ContractAcceptance | null> {
        const { data, error } = await supabase
            .from('contract_acceptances')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return (data as ContractAcceptance) || null;
    },
};
