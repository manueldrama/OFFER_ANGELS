import { supabase } from '../../lib/supabase/client';

export interface QuickReply {
    id: string;
    title: string;
    body: string;
    sort_order: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export const quickRepliesService = {
    async list(): Promise<QuickReply[]> {
        const { data, error } = await supabase
            .from('quick_replies')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[quickRepliesService] list error:', error);
            throw error;
        }
        return (data || []) as QuickReply[];
    },

    async create(payload: { title: string; body: string; sort_order?: number }): Promise<QuickReply> {
        const auth = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('quick_replies')
            .insert({
                title: payload.title.trim(),
                body: payload.body.trim(),
                sort_order: payload.sort_order ?? 100,
                created_by: auth.data.user?.id ?? null,
            })
            .select()
            .single();

        if (error) {
            console.error('[quickRepliesService] create error:', error);
            throw error;
        }
        return data as QuickReply;
    },

    async update(id: string, patch: { title?: string; body?: string; sort_order?: number }): Promise<QuickReply> {
        const update: Record<string, any> = {};
        if (patch.title !== undefined) update.title = patch.title.trim();
        if (patch.body !== undefined) update.body = patch.body.trim();
        if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;

        const { data, error } = await supabase
            .from('quick_replies')
            .update(update)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[quickRepliesService] update error:', error);
            throw error;
        }
        return data as QuickReply;
    },

    async remove(id: string): Promise<void> {
        const { error } = await supabase
            .from('quick_replies')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[quickRepliesService] remove error:', error);
            throw error;
        }
    },
};
