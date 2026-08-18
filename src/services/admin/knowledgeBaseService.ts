import { supabase } from '../../lib/supabase/client';
import { KnowledgeArticle } from '../../types';

export const KnowledgeBaseService = {
    async listArticles(filters?: { category?: string; search?: string }) {
        let query = supabase
            .from('knowledge_articles')
            .select('*')
            .order('sort_order');

        if (filters?.category) query = query.eq('category', filters.category);
        if (filters?.search) query = query.ilike('title', `%${filters.search}%`);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as KnowledgeArticle[];
    },

    async getArticle(id: string) {
        const { data, error } = await supabase
            .from('knowledge_articles')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as KnowledgeArticle;
    },

    async createArticle(article: Omit<KnowledgeArticle, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('knowledge_articles')
            .insert(article)
            .select()
            .single();
        if (error) throw error;
        return data as KnowledgeArticle;
    },

    async updateArticle(id: string, updates: Partial<KnowledgeArticle>) {
        const { error } = await supabase
            .from('knowledge_articles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    async deleteArticle(id: string) {
        const { error } = await supabase
            .from('knowledge_articles')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async togglePublish(id: string, isPublished: boolean) {
        const { error } = await supabase
            .from('knowledge_articles')
            .update({ is_published: isPublished, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    }
};
