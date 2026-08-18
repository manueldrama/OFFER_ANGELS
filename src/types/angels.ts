// CAFEPASTE Angels — shared types & constants for the curated creator network.
// Tables: angels_invitations, angels_creators, angels_venues,
//         angels_collaboration_requests (see 20260626_cafepaste_angels.sql).

export type AngelInvitationStatus = 
    | 'invited' 
    | 'opened' 
    | 'accepted' 
    | 'expired'
    | 'reactivated';

export type AngelPhotoStatus =
    | 'not_started'
    | 'photos_pending'
    | 'photos_submitted'
    | 'photos_expired'
    | 'extended';

export type AngelCreatorStatus =
    | 'invited'
    | 'accepted'
    | 'photos_received'
    | 'approved'
    | 'published'
    | 'rejected';

export type AngelRequestStatus =
    | 'new'
    | 'reviewing'
    | 'forwarded'
    | 'accepted'
    | 'declined';

export interface AngelPhotoExample {
    id: string;
    title: string;
    description: string;
    category: string;
    image_url: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// Creator collaboration interests (profile tags).
export const ANGEL_CATEGORIES = [
    'Coffee',
    'Cocktail',
    'Dessert',
    'Hotel',
    'Restaurant',
    'Event',
    'Luxury Brand',
    'Travel',
    'Nightlife',
] as const;
export type AngelCategory = (typeof ANGEL_CATEGORIES)[number];

// What a venue can request from a creator.
export const ANGEL_REQUEST_TYPES = [
    'Coffee Content',
    'Cocktail Content',
    'Dessert Content',
    'Hotel Visit',
    'Restaurant Collaboration',
    'Launch Event',
    'Brand Activation',
] as const;
export type AngelRequestType = (typeof ANGEL_REQUEST_TYPES)[number];

// Venue categories surfaced in the admin "create venue" form.
export const ANGEL_VENUE_CATEGORIES = [
    'Hotel',
    'Restaurant',
    'Cocktail Bar',
    'Cafe',
    'Event Space',
    'Luxury Brand',
] as const;
export type AngelVenueCategory = (typeof ANGEL_VENUE_CATEGORIES)[number];

export interface AngelInvitation {
    id: string;
    token: string;
    creator_name: string | null;
    instagram: string | null;
    email: string | null;
    personal_note: string | null;
    status: AngelInvitationStatus;
    photo_status: AngelPhotoStatus;
    creator_id: string | null;
    expires_at: string | null;
    opened_at: string | null;
    accepted_at: string | null;
    photo_deadline_at: string | null;
    photos_submitted_at: string | null;
    reactivated_at: string | null;
    renewal_requested_at: string | null;
    renewal_note: string | null;
    reminder_email: string | null;
    rep_name: string | null;
    rep_contact_person: string | null;
    rep_email: string | null;
    rep_whatsapp: string | null;
    rep_notes: string | null;
    created_by: string | null;
    created_at: string;
}

export interface AngelCreator {
    id: string;
    invitation_id: string | null;
    full_name: string;
    instagram: string;
    email: string;
    whatsapp: string | null;
    city: string | null;
    country: string | null;
    profile_image: string | null;
    gallery_images: string[];
    bio: string | null;
    categories: string[];
    status: AngelCreatorStatus;
    is_featured: boolean;
    internal_notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface AngelVenue {
    id: string;
    token: string;
    name: string;
    city: string | null;
    country: string | null;
    category: string | null;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    device_status: string | null;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
}

export interface AngelCollaborationRequest {
    id: string;
    creator_id: string | null;
    venue_id: string | null;
    venue_name: string | null;
    request_type: string | null;
    proposed_date: string | null;
    message: string | null;
    status: AngelRequestStatus;
    created_at: string;
}

// Payload the public acceptance form submits.
export interface AngelAcceptancePayload {
    full_name: string;
    instagram: string;
    email: string;
    whatsapp?: string;
    gallery_images: string[];
    bio?: string;
}

// Payload a token-gated venue submits when requesting a collaboration.
export interface AngelRequestPayload {
    creator_id: string;
    venue_id: string | null;
    venue_name: string;
    request_type: string;
    proposed_date?: string;
    message?: string;
}

// Human-readable labels + tones for creator status badges (admin UI).
export const ANGEL_CREATOR_STATUS_META: Record<
    AngelCreatorStatus,
    { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }
> = {
    invited: { label: 'Invited', tone: 'neutral' },
    accepted: { label: 'Accepted', tone: 'info' },
    photos_received: { label: 'Photos Received', tone: 'info' },
    approved: { label: 'Approved', tone: 'warning' },
    published: { label: 'Published', tone: 'success' },
    rejected: { label: 'Rejected', tone: 'danger' },
};

export const ANGEL_REQUEST_STATUS_META: Record<
    AngelRequestStatus,
    { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }
> = {
    new: { label: 'New', tone: 'warning' },
    reviewing: { label: 'Reviewing', tone: 'info' },
    forwarded: { label: 'Forwarded', tone: 'info' },
    accepted: { label: 'Accepted', tone: 'success' },
    declined: { label: 'Declined', tone: 'danger' },
};

// ═══════════════════════════════════════════════════════════════════════════
// Editable page content (angels_page_sections / angels_page_items).
// See 20260716_angels_page_content.sql + src/content/angelsDefaultContent.ts.
// ═══════════════════════════════════════════════════════════════════════════

export const ANGELS_PAGE_KEYS = [
    'landing',
    'invite',
    'accept',
    'thank_you',
    'venue_directory',
    'venue_creator',
    'venue_request',
] as const;
export type AngelsPageKey = (typeof ANGELS_PAGE_KEYS)[number];

export interface AngelsPageItem {
    id: string;
    section_id: string;
    title: string | null;
    description: string | null;
    value_text: string | null;
    media_url: string | null;
    icon: string | null;
    extra: Record<string, any>;
    item_i18n: Record<string, any>;
    is_active: boolean;
    sort_order: number;
    created_at?: string;
}

export interface AngelsPageSection {
    id: string;
    page_key: AngelsPageKey;
    section_type: string;
    is_active: boolean;
    sort_order: number;
    config: Record<string, any>;
    config_i18n: Record<string, any>;
    items?: AngelsPageItem[];
    created_at?: string;
    updated_at?: string;
}

// The resolved shape both the public renderers and the defaults share.
// `id === null` means "rendered from code defaults" (no DB row yet).
// The *_i18n maps ({ lang: { field: value } }) ride along untouched; language
// resolution happens at render time in useAngelsContent (base content is EN).
export interface ResolvedAngelsItem {
    id: string | null;
    title: string | null;
    description: string | null;
    value_text: string | null;
    media_url: string | null;
    icon: string | null;
    extra: Record<string, any>;
    item_i18n?: Record<string, Record<string, any>>;
}

export interface ResolvedAngelsSection {
    id: string | null;
    section_type: string;
    sort_order: number;
    config: Record<string, any>;
    config_i18n?: Record<string, Record<string, any>>;
    items: ResolvedAngelsItem[];
}

export type AngelApplicationStatus = 'new' | 'reviewing' | 'shortlisted' | 'invited' | 'declined';

export interface AngelApplication {
    id: string;
    full_name: string;
    instagram: string;
    tiktok: string | null;
    email: string;
    whatsapp: string | null;
    country: string;
    city: string;
    category: string[];
    language: string | null;
    introduction: string | null;
    profile_image_url: string | null;
    gallery_urls: string[] | null;
    status: AngelApplicationStatus;
    internal_notes: string | null;
    created_at: string;
    updated_at: string;
}

export type AngelVenueStatus = 'new' | 'contacted' | 'approved' | 'declined';

export interface AngelVenuePartnership {
    id: string;
    venue_name: string;
    contact_person: string;
    email: string;
    phone: string | null;
    country: string;
    city: string;
    message: string;
    status: AngelVenueStatus;
    internal_notes: string | null;
    created_at: string;
    updated_at: string;
}

export const ANGEL_APPLICATION_STATUS_META: Record<
    AngelApplicationStatus,
    { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }
> = {
    new: { label: 'New', tone: 'warning' },
    reviewing: { label: 'Reviewing', tone: 'info' },
    shortlisted: { label: 'Shortlisted', tone: 'info' },
    invited: { label: 'Invited', tone: 'success' },
    declined: { label: 'Declined', tone: 'danger' },
};

export const ANGEL_VENUE_STATUS_META: Record<
    AngelVenueStatus,
    { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }
> = {
    new: { label: 'New', tone: 'warning' },
    contacted: { label: 'Contacted', tone: 'info' },
    approved: { label: 'Approved', tone: 'success' },
    declined: { label: 'Declined', tone: 'danger' },
};
