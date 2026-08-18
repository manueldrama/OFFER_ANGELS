import { supabase } from '../../lib/supabase/client';
import { sanitizeSearchTerm } from '../../utils/searchFilter';

export interface SocialPost {
    id: string;
    title: string | null;
    caption: string;
    hashtags: string[];
    platforms: string[];
    media_urls: string[];
    ai_generated_image_url: string | null;
    post_type: 'feed' | 'story' | 'reel' | 'carousel';
    first_comment: string | null;
    platform_captions: Record<string, string>;
    status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';
    scheduled_for: string | null;
    published_at: string | null;
    zernio_post_id: string | null;
    zernio_response: any;
    error_message: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface SocialAccount {
    id: string;
    platform: string;
    platform_account_name: string;
    platform_account_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SocialPostAnalytics {
    id: string;
    post_id: string;
    platform: string;
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    fetched_at: string;
}

export const SocialMediaService = {
    // ── Posts CRUD ─────────────────────────────────────────────────────
    async listPosts(filters?: { status?: string; search?: string }) {
        let query = supabase
            .from('social_posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }
        const s = sanitizeSearchTerm(filters?.search);
        if (s) {
            query = query.or(`title.ilike.%${s}%,caption.ilike.%${s}%`);
        }

        const { data, error } = await query;
        if (error) { console.error('[SocialMediaService] listPosts', error); throw error; }
        return data as SocialPost[];
    },

    async getPost(id: string) {
        const { data, error } = await supabase
            .from('social_posts')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as SocialPost;
    },

    async createPost(payload: Partial<SocialPost>) {
        const auth = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('social_posts')
            .insert([{ ...payload, created_by: auth.data.user?.id }])
            .select()
            .single();
        if (error) throw error;

        if (auth.data.user) {
            await supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'CREATE',
                entity_type: 'SOCIAL_POST',
                entity_id: data.id,
                new_values: payload
            });
        }
        return data as SocialPost;
    },

    async updatePost(id: string, updates: Partial<SocialPost>) {
        const { data, error } = await supabase
            .from('social_posts')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;

        const auth = await supabase.auth.getUser();
        if (auth.data.user) {
            await supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'UPDATE',
                entity_type: 'SOCIAL_POST',
                entity_id: id,
                new_values: updates
            });
        }
        return data as SocialPost;
    },

    async deletePost(id: string) {
        const { error } = await supabase.from('social_posts').delete().eq('id', id);
        if (error) throw error;

        const auth = await supabase.auth.getUser();
        if (auth.data.user) {
            await supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'DELETE',
                entity_type: 'SOCIAL_POST',
                entity_id: id,
                new_values: {}
            });
        }
    },

    async duplicatePost(id: string) {
        const post = await this.getPost(id);
        const { id: _, created_at, updated_at, zernio_post_id, zernio_response, published_at, error_message, ...rest } = post;
        return this.createPost({ ...rest, title: `${rest.title || 'Post'} (Kopya)`, status: 'draft' });
    },

    // ── Calendar ──────────────────────────────────────────────────────
    async getCalendarPosts(startDate: string, endDate: string) {
        const { data, error } = await supabase
            .from('social_posts')
            .select('*')
            .gte('scheduled_for', startDate)
            .lte('scheduled_for', endDate)
            .in('status', ['scheduled', 'published', 'failed', 'publishing'])
            .order('scheduled_for', { ascending: true });
        if (error) throw error;
        return data as SocialPost[];
    },

    // ── Accounts CRUD ─────────────────────────────────────────────────
    async listAccounts() {
        const { data, error } = await supabase
            .from('social_accounts')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as SocialAccount[];
    },

    async createAccount(payload: Partial<SocialAccount>) {
        const { data, error } = await supabase
            .from('social_accounts')
            .insert([payload])
            .select()
            .single();
        if (error) throw error;
        return data as SocialAccount;
    },

    async updateAccount(id: string, updates: Partial<SocialAccount>) {
        const { data, error } = await supabase
            .from('social_accounts')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as SocialAccount;
    },

    async deleteAccount(id: string) {
        const { error } = await supabase.from('social_accounts').delete().eq('id', id);
        if (error) throw error;
    },

    // ── Stats ─────────────────────────────────────────────────────────
    async getStats() {
        const { data, error } = await supabase.from('social_posts').select('status');
        if (error) throw error;
        const all = data || [];
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        return {
            total: all.length,
            scheduled: all.filter(p => p.status === 'scheduled').length,
            published: all.filter(p => p.status === 'published').length,
            failed: all.filter(p => p.status === 'failed').length,
            draft: all.filter(p => p.status === 'draft').length,
        };
    },

    // ── Analytics ─────────────────────────────────────────────────────
    async getPostAnalytics(postId: string) {
        const { data, error } = await supabase
            .from('social_post_analytics')
            .select('*')
            .eq('post_id', postId)
            .order('fetched_at', { ascending: false });
        if (error) throw error;
        return data as SocialPostAnalytics[];
    },

    // ── Settings (API Keys) ──────────────────────────────────────────
    async getSetting(key: string) {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .single();
        return data?.value || '';
    },

    async saveSetting(key: string, value: string) {
        const { error } = await supabase
            .from('app_settings')
            .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw error;
    },
};
