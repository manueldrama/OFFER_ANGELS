import { supabase } from '../../lib/supabase/client';
import { fetchInChunks } from '../../lib/supabase/paginate';

export type TagColor = 'slate' | 'red' | 'orange' | 'amber' | 'emerald' | 'indigo' | 'violet' | 'rose';

export interface LeadTag {
    id: string;
    name: string;
    color: TagColor;
    is_default: boolean;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export const leadTagsService = {
    async listAll(): Promise<LeadTag[]> {
        const { data, error } = await supabase
            .from('lead_tags')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as LeadTag[];
    },

    async create(payload: { name: string; color: TagColor }): Promise<LeadTag> {
        const auth = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('lead_tags')
            .insert({
                name: payload.name.trim(),
                color: payload.color,
                is_default: false,
                sort_order: 100,
                created_by: auth.data.user?.id ?? null,
            })
            .select()
            .single();
        if (error) throw error;
        return data as LeadTag;
    },

    async remove(id: string): Promise<void> {
        const { error } = await supabase.from('lead_tags').delete().eq('id', id);
        if (error) throw error;
    },

    // ----- Assignments -----

    async listForLead(leadId: string): Promise<LeadTag[]> {
        const { data, error } = await supabase
            .from('lead_tag_assignments')
            .select('tag_id, lead_tags!inner(*)')
            .eq('lead_id', leadId);
        if (error) throw error;
        return ((data || []) as any[]).map(r => r.lead_tags as LeadTag);
    },

    /** Bulk-fetch assignments for many leads at once (sidebar render için). */
    async listForLeads(leadIds: string[]): Promise<Record<string, LeadTag[]>> {
        if (leadIds.length === 0) return {};
        const data = await fetchInChunks<any>(
            leadIds,
            (chunk, from, to) => supabase
                .from('lead_tag_assignments')
                .select('lead_id, lead_tags!inner(*)')
                .in('lead_id', chunk)
                .order('lead_id', { ascending: true })
                .range(from, to),
        );
        const map: Record<string, LeadTag[]> = {};
        data.forEach(row => {
            if (!map[row.lead_id]) map[row.lead_id] = [];
            map[row.lead_id].push(row.lead_tags as LeadTag);
        });
        return map;
    },

    async assign(leadId: string, tagId: string): Promise<void> {
        const auth = await supabase.auth.getUser();
        const { error } = await supabase
            .from('lead_tag_assignments')
            .insert({ lead_id: leadId, tag_id: tagId, assigned_by: auth.data.user?.id ?? null });
        if (error && (error as any).code !== '23505') {
            // 23505 = unique_violation — already assigned, treat as no-op
            throw error;
        }
    },

    async unassign(leadId: string, tagId: string): Promise<void> {
        const { error } = await supabase
            .from('lead_tag_assignments')
            .delete()
            .eq('lead_id', leadId)
            .eq('tag_id', tagId);
        if (error) throw error;
    },
};
