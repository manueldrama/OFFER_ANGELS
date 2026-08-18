import { supabase } from '../../lib/supabase/client';
import { PortalDocument } from '../../types';

export const PortalDocumentsService = {
    async listDocuments(filters?: { type?: string; search?: string }): Promise<PortalDocument[]> {
        let query = supabase
            .from('portal_documents')
            .select('*, lead:leads(company_name)')
            .order('created_at', { ascending: false });

        if (filters?.type) query = query.eq('document_type', filters.type);
        if (filters?.search) query = query.ilike('title', `%${filters.search}%`);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as PortalDocument[];
    },

    async createDocument(doc: Partial<PortalDocument>): Promise<void> {
        const { error } = await supabase.from('portal_documents').insert(doc);
        if (error) throw error;
    },

    async deleteDocument(id: string): Promise<void> {
        const { error } = await supabase.from('portal_documents').delete().eq('id', id);
        if (error) throw error;
    }
};
