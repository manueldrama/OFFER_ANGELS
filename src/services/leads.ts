import { supabase } from '../lib/supabase/client';

export type LeadStatus = 'new' | 'contacted' | 'offer_sent' | 'won' | 'lost';

export interface Lead {
    id: string;
    assigned_to?: string;
    customer_name: string;
    company_name?: string;
    phone_number?: string;
    email?: string;
    status: LeadStatus;
    source: string;
    created_at: string;
}

/**
 * Service to manage Leads (Admin CRM operations)
 */
export const LeadsService = {

    // List all leads with optional filtering
    async listLeads(filters?: { status?: LeadStatus }): Promise<Lead[]> {
        let query = supabase.from('leads').select('*').order('created_at', { ascending: false });

        if (filters?.status) {
            query = query.eq('status', filters.status);
        }

        const { data, error } = await query;
        if (error) {
            console.error('[LeadsService] Error fetching leads', error);
            return [];
        }
        return data;
    },

    // Get single lead details
    async getLeadById(id: string): Promise<Lead | null> {
        const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
        if (error) {
            console.error(`[LeadsService] Error fetching lead ${id}`, error);
            return null;
        }
        return data;
    },

    // Create a new lead (used manually or via Webhook)
    async createLead(input: Partial<Lead>): Promise<Lead | null> {
        const { data, error } = await supabase.from('leads').insert([input]).select().single();
        if (error) {
            console.error('[LeadsService] Error creating lead', error);
            return null;
        }
        return data;
    },

    // Update a Lead's core fields or status
    async updateLeadStatus(id: string, status: LeadStatus): Promise<boolean> {
        const { error } = await supabase.from('leads').update({ status }).eq('id', id);
        if (error) {
            console.error(`[LeadsService] Error updating status for lead ${id}`, error);
            return false;
        }
        return true;
    },

    // Append a timeline note for sales tracking
    async addLeadNote(leadId: string, content: string, authorId?: string): Promise<boolean> {
        const { error } = await supabase.from('lead_notes').insert([{
            lead_id: leadId,
            note_content: content,
            author_id: authorId,
            is_system_generated: false
        }]);

        if (error) {
            console.error(`[LeadsService] Error adding note to lead ${leadId}`, error);
            return false;
        }
        return true;
    }
};
