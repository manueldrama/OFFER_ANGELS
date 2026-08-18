// CAFEPASTE Angels data layer — client-side Supabase access (no new API surface).
// Mirrors the existing admin-service pattern (e.g. landingVariantService.ts) and
// relies on the RLS policies in 20260626_cafepaste_angels.sql:
//   - public INSERT for creator acceptance + venue requests
//   - anon SELECT only for published creators (token-gated venue directory)
//   - authenticated admin SELECT/UPDATE for curation
//
// The `angels-media` bucket is public, so getPublicUrl() is enough for both the
// creator gallery upload and the venue-facing image rendering.

import { supabase } from '../../lib/supabase/client';
import { compressImageToWebp } from '../../utils/imageCompress';
import type { 
    AngelInvitation, 
    AngelInvitationStatus, 
    AngelCreatorStatus, 
    AngelPhotoStatus,
    AngelPhotoExample,
    AngelCreator,
    AngelVenue,
    AngelCollaborationRequest,
    AngelAcceptancePayload,
    AngelRequestPayload,
    AngelRequestStatus,
} from '../../types/angels';

const MEDIA_BUCKET = 'angels-media';

export interface CreatorDirectoryFilters {
    city?: string;
    category?: string;
    search?: string;
}

/**
 * Effective expiry check — accepted invitations never count as expired
 * (the creator already converted; expiry only gates acceptance).
 * Tek doğruluk noktası: admin tablosu, uzatma diyaloğu ve public sayfa.
 */
export function isInvitationExpired(inv: Pick<AngelInvitation, 'status' | 'expires_at'>): boolean {
    if (inv.status === 'accepted') return false;
    if (inv.status === 'expired') return true;
    return inv.expires_at ? new Date(inv.expires_at).getTime() < Date.now() : false;
}

export const AngelsService = {
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — creator invitation + acceptance
    // ═══════════════════════════════════════════════════════════════════════

    /** Read a personalized invitation from its capability token or instagram handle. */
    async getInvitationByToken(identifier: string): Promise<AngelInvitation | null> {
        if (!identifier || identifier.length < 2) return null;

        if (identifier.length === 36 && identifier.includes('-')) {
            const { data, error } = await supabase
                .from('angels_invitations')
                .select('*')
                .eq('token', identifier)
                .maybeSingle();
            if (error) throw error;
            return (data as AngelInvitation) ?? null;
        }

        // Custom slug tokens win over the instagram-handle fallback.
        const byToken = await supabase
            .from('angels_invitations')
            .select('*')
            .eq('token', identifier)
            .maybeSingle();
        if (byToken.error) throw byToken.error;
        if (byToken.data) return byToken.data as AngelInvitation;

        const { data, error } = await supabase
            .from('angels_invitations')
            .select('*')
            .eq('instagram', identifier)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return (data as AngelInvitation) ?? null;
    },

    /**
     * Creator on an expired invite asks for a fresh window. Idempotent: the
     * .is('renewal_requested_at', null) filter makes repeat clicks no-ops.
     * Admin approves by extending/reactivating, which clears these fields.
     */
    async requestInvitationRenewal(identifier: string, note?: string): Promise<void> {
        const inv = await this.getInvitationByToken(identifier);
        if (!inv) throw new Error('Invitation not found.');
        if (inv.renewal_requested_at) return;
        const { error } = await supabase
            .from('angels_invitations')
            .update({
                renewal_requested_at: new Date().toISOString(),
                renewal_note: note?.trim() || null,
            })
            .eq('id', inv.id)
            .is('renewal_requested_at', null);
        if (error) throw error;
    },

    /** Stamp the invitation as opened (first view). Best-effort, never throws. */
    async markInvitationOpened(identifier: string): Promise<void> {
        try {
            const inv = await this.getInvitationByToken(identifier);
            if (!inv) return;
            await supabase
                .from('angels_invitations')
                .update({ status: 'opened', opened_at: new Date().toISOString() })
                .eq('id', inv.id)
                .eq('status', 'invited');
        } catch (e) {
            console.warn('[angels] markInvitationOpened failed', e);
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ONBOARDING
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Called when the user clicks 'Accept My Invitation' on the hero page.
     * Starts the onboarding process by activating the 7-day photo window.
     */
    async confirmInvitation(identifier: string): Promise<void> {
        const invitation = await this.getInvitationByToken(identifier);
        if (!invitation) throw new Error('Invitation not found or expired.');

        const now = new Date();
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 7);

        const { error } = await supabase
            .from('angels_invitations')
            .update({
                status: 'accepted',
                accepted_at: now.toISOString(),
                photo_status: 'photos_pending',
                photo_deadline_at: deadline.toISOString(),
            })
            .eq('id', invitation.id);
        
        if (error) throw error;
    },

    /**
     * Submits photos during the onboarding flow. Creates the creator profile.
     */
    async submitPhotos(identifier: string, payload: AngelAcceptancePayload): Promise<AngelCreator> {
        const invitation = await this.getInvitationByToken(identifier);
        if (!invitation) throw new Error('Invitation not found or expired.');

        const { data: creator, error: insertError } = await supabase
            .from('angels_creators')
            .insert({
                invitation_id: invitation.id,
                full_name: payload.full_name,
                instagram: payload.instagram,
                email: payload.email,
                whatsapp: payload.whatsapp || null,
                gallery_images: payload.gallery_images ?? [],
                bio: payload.bio || null,
                status: 'photos_received',
            })
            .select()
            .single();
        if (insertError) throw insertError;

        try {
            const now = new Date().toISOString();
            await supabase
                .from('angels_invitations')
                .update({
                    photo_status: 'photos_submitted',
                    photos_submitted_at: now,
                    creator_id: (creator as AngelCreator).id,
                })
                .eq('id', invitation.id);
        } catch (e) {
            console.warn('[angels] linking invitation to creator failed', e);
        }

        return creator as AngelCreator;
    },

    async saveLaterPreference(identifier: string, email?: string): Promise<void> {
        const invitation = await this.getInvitationByToken(identifier);
        if (!invitation) throw new Error('Invitation not found or expired.');

        const updateData: any = { photo_status: 'photos_pending' };
        if (email) updateData.reminder_email = email;

        const { error } = await supabase
            .from('angels_invitations')
            .update(updateData)
            .eq('id', invitation.id);
        if (error) throw error;
    },

    async saveRepresentativeDetails(identifier: string, details: any): Promise<void> {
        const invitation = await this.getInvitationByToken(identifier);
        if (!invitation) throw new Error('Invitation not found or expired.');

        const { error } = await supabase
            .from('angels_invitations')
            .update({
                photo_status: 'extended', // stop the deadline pressure
                rep_name: details.name,
                rep_contact_person: details.contact_person || null,
                rep_email: details.email,
                rep_whatsapp: details.whatsapp || null,
                rep_notes: details.notes || null,
            })
            .eq('id', invitation.id);
        if (error) throw error;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN — invitation expiry management
    // ═══════════════════════════════════════════════════════════════════════

    /** Update an invitation's expiry date (admin). Extending also counts as
     *  approving a pending renewal request, so those fields are cleared. */
    async updateInvitationExpiry(id: string, newExpiry: string): Promise<void> {
        const { error } = await supabase
            .from('angels_invitations')
            .update({
                expires_at: newExpiry,
                renewal_requested_at: null,
                renewal_note: null,
            })
            .eq('id', id);
        if (error) throw error;
    },

    /** Reactivate an expired invitation with a new expiry date (admin). */
    async reactivateInvitation(id: string, newExpiryIso: string): Promise<void> {
        const { error } = await supabase
            .from('angels_invitations')
            .update({
                status: 'reactivated',
                reactivated_at: new Date().toISOString(),
                expires_at: newExpiryIso,
                renewal_requested_at: null,
                renewal_note: null,
            })
            .eq('id', id);
        if (error) throw error;
    },

    /** Upload a profile/gallery image to the public angels-media bucket. */
    async uploadImage(file: File): Promise<string> {
        let uploadBlob: Blob = file;
        let ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        let contentType = file.type || 'application/octet-stream';

        if (file.type.startsWith('image/')) {
            const r = await compressImageToWebp(file);
            if (r.format === 'webp') {
                uploadBlob = r.blob;
                ext = 'webp';
                contentType = 'image/webp';
            }
        }

        const fileName = `angels-${Math.random().toString(36).substring(2, 12)}_${Date.now()}.${ext}`;
        const { error } = await supabase.storage
            .from(MEDIA_BUCKET)
            .upload(fileName, uploadBlob, { contentType, cacheControl: '3600' });
        if (error) throw error;

        const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(fileName);
        return data.publicUrl;
    },

    /** List all media uploaded to the public angels-media bucket. */
    async listMedia(): Promise<{ name: string; url: string; created_at: string; kind: 'image' | 'video' }[]> {
        const { data, error } = await supabase.storage
            .from(MEDIA_BUCKET)
            .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
        if (error) {
            console.error('[angels] listMedia error:', error.message);
            return [];
        }
        const IMG_EXT = /\.(jpg|jpeg|png|webp|gif|svg)$/i;
        const VID_EXT = /\.(mp4|webm|mov|quicktime)$/i;
        return (data || [])
            .filter(f => IMG_EXT.test(f.name) || VID_EXT.test(f.name))
            .map(f => {
                const { data: u } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(f.name);
                return {
                    name: f.name,
                    url: u.publicUrl,
                    created_at: f.created_at || '',
                    kind: VID_EXT.test(f.name) ? 'video' as const : 'image' as const,
                };
            });
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — venue directory (token-gated, no login)
    // ═══════════════════════════════════════════════════════════════════════

    /** Validate a venue token; returns null when missing/inactive.
     *  Tek-satır SECURITY DEFINER RPC — tüm venue tablosunu anon'a açan eski
     *  SELECT politikası kaldırıldı (20260722e), token sızıntısı kapandı. */
    async getVenueByToken(token: string): Promise<AngelVenue | null> {
        if (!token || token.length < 8) return null;
        const { data, error } = await supabase
            .rpc('angels_get_venue_by_token', { p_token: token });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        return (row as AngelVenue) ?? null;
    },

    /** Published creators only — güvenli-kolon view'ından okur (email/whatsapp
     *  gibi özel alanlar dizine hiç çıkmaz; 20260722e). */
    async getPublishedCreators(filters: CreatorDirectoryFilters = {}): Promise<AngelCreator[]> {
        let query = supabase
            .from('angels_creators_directory')
            .select('*')
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false });

        if (filters.city) query = query.eq('city', filters.city);
        if (filters.category) query = query.contains('categories', [filters.category]);

        const { data, error } = await query;
        if (error) throw error;
        let rows = (data as AngelCreator[]) ?? [];

        if (filters.search) {
            const q = filters.search.toLowerCase();
            rows = rows.filter(
                c =>
                    c.full_name.toLowerCase().includes(q) ||
                    c.instagram.toLowerCase().includes(q) ||
                    (c.city ?? '').toLowerCase().includes(q),
            );
        }
        return rows;
    },

    /** A single published creator profile (venue view) — güvenli view'dan. */
    async getPublishedCreatorById(id: string): Promise<AngelCreator | null> {
        const { data, error } = await supabase
            .from('angels_creators_directory')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return (data as AngelCreator) ?? null;
    },

    /** Venue submits a collaboration request. */
    async submitCollaborationRequest(payload: AngelRequestPayload): Promise<void> {
        const { error } = await supabase.from('angels_collaboration_requests').insert({
            creator_id: payload.creator_id,
            venue_id: payload.venue_id,
            venue_name: payload.venue_name,
            request_type: payload.request_type,
            proposed_date: payload.proposed_date || null,
            message: payload.message || null,
            status: 'new',
        });
        if (error) throw error;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN — invitations
    // ═══════════════════════════════════════════════════════════════════════

    async listInvitations(): Promise<AngelInvitation[]> {
        const { data, error } = await supabase
            .from('angels_invitations')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as AngelInvitation[]) ?? [];
    },

    async createInvitation(input: {
        creator_name?: string;
        instagram?: string;
        email?: string;
        personal_note?: string;
        expires_at?: string | null;
        token?: string;
    }): Promise<AngelInvitation> {
        let cleanInsta: string | null = null;
        if (input.instagram) {
            cleanInsta = input.instagram.replace(/^@/, '').trim();
            if (cleanInsta) {
                // Check for duplicates
                const { data: existing, error: checkError } = await supabase
                    .from('angels_invitations')
                    .select('id')
                    .eq('instagram', cleanInsta)
                    .maybeSingle();

                if (checkError) throw checkError;

                if (existing) {
                    throw new Error(`An invitation for @${cleanInsta} already exists.`);
                }
            }
        }

        const customToken = input.token?.trim().toLowerCase() || null;
        if (customToken) {
            if (!/^[a-z0-9-]{2,64}$/.test(customToken)) {
                throw new Error('Özel link sadece küçük harf, rakam ve tire içerebilir (2-64 karakter).');
            }
            const { data: tokenTaken, error: tokenError } = await supabase
                .from('angels_invitations')
                .select('id')
                .eq('token', customToken)
                .maybeSingle();
            if (tokenError) throw tokenError;
            if (tokenTaken) {
                throw new Error(`"${customToken}" linki zaten kullanılıyor.`);
            }
        }

        const insertData: any = {
            creator_name: input.creator_name || null,
            instagram: cleanInsta || null,
            email: input.email || null,
            personal_note: input.personal_note || null,
            expires_at: input.expires_at || null,
            // Omit token when empty so the DB default generates a uuid.
            ...(customToken ? { token: customToken } : {}),
        };

        const { data, error } = await supabase
            .from('angels_invitations')
            .insert(insertData)
            .select()
            .single();
        if (error) throw error;
        return data as AngelInvitation;
    },

    async deleteInvitation(id: string): Promise<void> {
        // .select() so an RLS-blocked delete (0 rows) surfaces as an error
        // instead of silently succeeding.
        const { data, error } = await supabase
            .from('angels_invitations')
            .delete()
            .eq('id', id)
            .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error('Davet silinemedi — yetki (RLS) engeli veya kayıt bulunamadı.');
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN — creators
    // ═══════════════════════════════════════════════════════════════════════

    async listCreators(status?: AngelCreatorStatus): Promise<AngelCreator[]> {
        let query = supabase
            .from('angels_creators')
            .select('*')
            .order('created_at', { ascending: false });
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw error;
        return (data as AngelCreator[]) ?? [];
    },

    async getCreatorById(id: string): Promise<AngelCreator | null> {
        const { data, error } = await supabase
            .from('angels_creators')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return (data as AngelCreator) ?? null;
    },

    async updateCreatorStatus(id: string, status: AngelCreatorStatus): Promise<void> {
        const { error } = await supabase
            .from('angels_creators')
            .update({ status })
            .eq('id', id);
        if (error) throw error;
    },

    async toggleFeatured(id: string, isFeatured: boolean): Promise<void> {
        const { error } = await supabase
            .from('angels_creators')
            .update({ is_featured: isFeatured })
            .eq('id', id);
        if (error) throw error;
    },

    async updateCreator(id: string, patch: Partial<AngelCreator>): Promise<void> {
        const { error } = await supabase.from('angels_creators').update(patch).eq('id', id);
        if (error) throw error;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN — venues
    // ═══════════════════════════════════════════════════════════════════════

    async listVenues(): Promise<AngelVenue[]> {
        const { data, error } = await supabase
            .from('angels_venues')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as AngelVenue[]) ?? [];
    },

    async createVenue(input: {
        name: string;
        city?: string;
        country?: string;
        category?: string;
        contact_person?: string;
        email?: string;
        phone?: string;
        device_status?: string;
    }): Promise<AngelVenue> {
        const { data, error } = await supabase
            .from('angels_venues')
            .insert({
                name: input.name,
                city: input.city || null,
                country: input.country || null,
                category: input.category || null,
                contact_person: input.contact_person || null,
                email: input.email || null,
                phone: input.phone || null,
                device_status: input.device_status || null,
            })
            .select()
            .single();
        if (error) throw error;
        return data as AngelVenue;
    },

    async setVenueActive(id: string, isActive: boolean): Promise<void> {
        const { error } = await supabase
            .from('angels_venues')
            .update({ is_active: isActive })
            .eq('id', id);
        if (error) throw error;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN — collaboration requests
    // ═══════════════════════════════════════════════════════════════════════

    async listRequests(): Promise<AngelCollaborationRequest[]> {
        const { data, error } = await supabase
            .from('angels_collaboration_requests')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data as AngelCollaborationRequest[]) ?? [];
    },

    async updateRequestStatus(id: string, status: AngelRequestStatus): Promise<void> {
        const { error } = await supabase
            .from('angels_collaboration_requests')
            .update({ status })
            .eq('id', id);
        if (error) throw error;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN — overview counts
    // ═══════════════════════════════════════════════════════════════════════

    async getOverviewStats(): Promise<{
        invitations: number;
        pendingReview: number;
        published: number;
        newRequests: number;
    }> {
        const [inv, pending, published, requests] = await Promise.all([
            supabase.from('angels_invitations').select('id', { count: 'exact', head: true }),
            supabase
                .from('angels_creators')
                .select('id', { count: 'exact', head: true })
                .in('status', ['accepted', 'photos_received', 'approved']),
            supabase
                .from('angels_creators')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'published'),
            supabase
                .from('angels_collaboration_requests')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'new'),
        ]);
        return {
            invitations: inv.count ?? 0,
            pendingReview: pending.count ?? 0,
            published: published.count ?? 0,
            newRequests: requests.count ?? 0,
        };
    },

    /** Get active photo examples ordered by sort_order */
    async getActivePhotoExamples(): Promise<AngelPhotoExample[]> {
        const { data, error } = await supabase
            .from('angels_photo_examples')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return data as AngelPhotoExample[];
    },

    /** Admin: Get all photo examples */
    async getAllPhotoExamples(): Promise<AngelPhotoExample[]> {
        const { data, error } = await supabase
            .from('angels_photo_examples')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return data as AngelPhotoExample[];
    },

    /** Admin: Create a new photo example */
    async createPhotoExample(params: Partial<AngelPhotoExample>): Promise<AngelPhotoExample> {
        const { data, error } = await supabase
            .from('angels_photo_examples')
            .insert([params])
            .select('*')
            .single();
        if (error) throw error;
        return data as AngelPhotoExample;
    },

    /** Admin: Update a photo example */
    async updatePhotoExample(id: string, params: Partial<AngelPhotoExample>): Promise<void> {
        const { error } = await supabase
            .from('angels_photo_examples')
            .update(params)
            .eq('id', id);
        if (error) throw error;
    },

    /** Admin: Delete a photo example */
    async deletePhotoExample(id: string): Promise<void> {
        const { error } = await supabase
            .from('angels_photo_examples')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    /** Admin: Update sort orders for multiple examples */
    async updatePhotoExampleSortOrders(updates: { id: string, sort_order: number }[]): Promise<void> {
        // We'll update them one by one since bulk updates in supabase-js requires upsert or RPC.
        // It's a small list, so concurrent updates are fine.
        await Promise.all(
            updates.map(u => 
                supabase.from('angels_photo_examples').update({ sort_order: u.sort_order }).eq('id', u.id)
            )
        );
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — creator applications
    // ═══════════════════════════════════════════════════════════════════════

    async submitApplication(
        payload: Omit<import('../../types/angels').AngelApplication, 'id' | 'status' | 'created_at' | 'updated_at' | 'internal_notes'>
    ): Promise<void> {
        let cleanInsta = payload.instagram.replace(/^@/, '').trim();
        const { error } = await supabase.from('angels_applications').insert({
            ...payload,
            instagram: cleanInsta,
            status: 'new'
        });
        if (error) throw error;
    },

    async listApplications(): Promise<import('../../types/angels').AngelApplication[]> {
        const { data, error } = await supabase
            .from('angels_applications')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as import('../../types/angels').AngelApplication[];
    },

    async updateApplicationStatus(id: string, status: import('../../types/angels').AngelApplicationStatus): Promise<void> {
        const { error } = await supabase.from('angels_applications').update({ status }).eq('id', id);
        if (error) throw error;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC — venue partnerships
    // ═══════════════════════════════════════════════════════════════════════

    async submitVenuePartnership(
        payload: Omit<import('../../types/angels').AngelVenuePartnership, 'id' | 'status' | 'created_at' | 'updated_at' | 'internal_notes'>
    ): Promise<void> {
        const { error } = await supabase.from('angels_venue_partnerships').insert({
            ...payload,
            status: 'new'
        });
        if (error) throw error;
    },

    async listVenuePartnerships(): Promise<import('../../types/angels').AngelVenuePartnership[]> {
        const { data, error } = await supabase
            .from('angels_venue_partnerships')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as import('../../types/angels').AngelVenuePartnership[];
    },

    async updateVenuePartnershipStatus(id: string, status: import('../../types/angels').AngelVenueStatus): Promise<void> {
        const { error } = await supabase.from('angels_venue_partnerships').update({ status }).eq('id', id);
        if (error) throw error;
    }
};

/** Build the absolute private invite URL for an invitation (admin copy-link). */
export function buildInviteUrl(tokenOrInstagram: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/angels/invite/${tokenOrInstagram}`;
}

/** Build the absolute token-gated venue directory URL. */
export function buildVenueUrl(token: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/venues/angels?t=${token}`;
}
