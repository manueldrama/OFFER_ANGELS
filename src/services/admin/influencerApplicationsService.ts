import { supabase } from '../../lib/supabase/client';

export type InfluencerApplicationStatus = 'new' | 'reviewing' | 'approved' | 'rejected' | 'archived';

export interface InfluencerApplication {
    id: string;
    created_at: string;
    updated_at: string;
    full_name: string;
    email: string;
    phone: string;
    city: string | null;
    language: string;
    instagram_handle: string;
    tiktok_handle: string | null;
    youtube_handle: string | null;
    follower_range: string;
    engagement_rate: string | null;
    niches: string[];
    prior_collab: boolean;
    collab_types: string[];
    pitch_message: string;
    media_kit_path: string | null;
    media_kit_name: string | null;
    media_kit_size: number | null;
    media_kit_mime: string | null;
    status: InfluencerApplicationStatus;
    admin_notes: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    kvkk_accepted: boolean;
    ip_address: string | null;
    user_agent: string | null;
}

async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const isBypass = localStorage.getItem('admin_bypass') === 'true';
    const token = session?.access_token || (isBypass ? 'mock-admin-bypass' : '');
    if (!token) throw new Error('Oturum bulunamadı');
    return { Authorization: `Bearer ${token}` };
}

export const InfluencerApplicationsService = {
    async list({
        status = 'all',
        search = '',
        page = 1,
        limit = 25,
    }: {
        status?: 'all' | InfluencerApplicationStatus;
        search?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<{ applications: InfluencerApplication[]; count: number }> {
        const headers = await getAuthHeader();
        const qs = new URLSearchParams();
        if (status && status !== 'all') qs.set('status', status);
        if (search) qs.set('search', search);
        qs.set('page', String(page));
        qs.set('limit', String(limit));

        const res = await fetch(`/api/influencer-applications/admin?${qs.toString()}`, { headers });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Listeleme başarısız');
        return { applications: json.applications, count: json.count };
    },

    async updateStatus(id: string, status: InfluencerApplicationStatus): Promise<InfluencerApplication> {
        const headers = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
        const res = await fetch(`/api/influencer-applications/admin/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Güncelleme başarısız');
        return json;
    },

    async updateNotes(id: string, admin_notes: string): Promise<InfluencerApplication> {
        const headers = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };
        const res = await fetch(`/api/influencer-applications/admin/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ admin_notes }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Not güncellenemedi');
        return json;
    },

    async getMediaKitUrl(id: string): Promise<{ url: string; name: string | null }> {
        const headers = await getAuthHeader();
        const res = await fetch(`/api/influencer-applications/admin/${id}/media-kit`, { headers });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Dosya URL alınamadı');
        return { url: json.url, name: json.name };
    },

    async delete(id: string): Promise<void> {
        const headers = await getAuthHeader();
        const res = await fetch(`/api/influencer-applications/admin/${id}`, {
            method: 'DELETE',
            headers,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Silme başarısız');
    },
};
