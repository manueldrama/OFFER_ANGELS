import { supabase } from '../lib/supabase/client';

export function normalizePhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('0')) {
        digits = '9' + digits;
    } else if (digits.length === 10 && !digits.startsWith('90')) {
        digits = '90' + digits;
    }
    return digits;
}

export interface LeadAttribution {
    visitor_id?: string | null;
    ip_address?: string | null;
    country?: string | null;
    city?: string | null;
    region?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_term?: string | null;
    utm_content?: string | null;
    first_utm_source?: string | null;
    first_utm_medium?: string | null;
    first_utm_campaign?: string | null;
    fbclid?: string | null;
    gclid?: string | null;
    first_fbclid?: string | null;
    first_gclid?: string | null;
    browser?: string | null;
    os?: string | null;
    referrer?: string | null;
    landing_path?: string | null;
    // Meta CAPI advanced matching — server-side CRM/Purchase olayları için kalıcı.
    fbp?: string | null;
    fbc?: string | null;
    user_agent?: string | null;
}

export interface FindOrCreateLeadInput {
    phone: string;
    customer_name: string;
    company_name?: string | null;
    business_type?: string | null;
    email?: string | null;
    source: string;
    status?: string;
    assigned_to?: string | null;
    country_code?: string | null;
    language_code?: string | null;
    /** Geo + UTM context — only persisted when creating a NEW lead, never overwrites existing rows. */
    attribution?: LeadAttribution | null;
}

export interface FindOrCreateLeadResult {
    lead: { id: string; customer_name: string; phone_number: string | null; not_interested?: boolean | null };
    isExisting: boolean;
}

export async function findOrCreateLeadByPhone(input: FindOrCreateLeadInput): Promise<FindOrCreateLeadResult> {
    const phone_normalized = normalizePhone(input.phone);
    if (!phone_normalized) {
        throw new Error('Geçersiz telefon numarası.');
    }

    const existing = await supabase
        .from('leads')
        .select('id, customer_name, phone_number, not_interested')
        .eq('phone_normalized', phone_normalized)
        .limit(1)
        .maybeSingle();

    if (existing.data) {
        return { lead: existing.data, isExisting: true };
    }

    const insertPayload: Record<string, any> = {
        customer_name: input.customer_name,
        phone_number: input.phone.trim(),
        source: input.source,
        status: input.status || 'new',
    };
    if (input.company_name) insertPayload.company_name = input.company_name;
    if (input.business_type) insertPayload.business_type = input.business_type;
    if (input.email) insertPayload.email = input.email;
    if (input.assigned_to) {
        insertPayload.assigned_to = input.assigned_to;
        insertPayload.assigned_at = new Date().toISOString();
    }
    if (input.country_code) insertPayload.country_code = input.country_code;
    if (input.language_code) insertPayload.language_code = input.language_code;
    if (input.attribution) {
        const a = input.attribution;
        // Only set keys with actual values — keep payload tidy.
        for (const [k, v] of Object.entries(a)) {
            if (v !== null && v !== undefined && v !== '') insertPayload[k] = v;
        }
    }

    const { data, error } = await supabase
        .from('leads')
        .insert([insertPayload])
        .select('id, customer_name, phone_number, not_interested')
        .single();

    if (error) {
        // 23505 = unique_violation. Yarış durumu: aramadan sonra başka bir istek aynı numarayla insert etmiş.
        if ((error as any).code === '23505') {
            const retry = await supabase
                .from('leads')
                .select('id, customer_name, phone_number, not_interested')
                .eq('phone_normalized', phone_normalized)
                .limit(1)
                .maybeSingle();
            if (retry.data) {
                return { lead: retry.data, isExisting: true };
            }
        }
        throw error;
    }

    return { lead: data, isExisting: false };
}
