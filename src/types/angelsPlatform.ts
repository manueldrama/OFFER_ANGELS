// CAFEPASTE Angels — işbirliği platformu tipleri (venue/creator panelleri,
// talepler, teklifler, projeler, ödemeler, Spotlight).
// Mevcut davet/onboarding tipleri src/types/angels.ts'te DEĞİŞMEDEN durur.

// ─────────────────────────────────────────────────────────────────────────────
// Hesap + üyelik (custom auth — Supabase Auth DEĞİL)
// ─────────────────────────────────────────────────────────────────────────────
export interface AngelsAccount {
    id: string;
    email: string;
}

export type CreatorMemberRole = 'creator' | 'creator_manager';
export type VenueMemberRole = 'venue' | 'venue_team_member';

export interface CreatorMembership {
    creator_id: string;
    member_role: CreatorMemberRole;
    creator: {
        id: string;
        full_name: string;
        display_name: string | null;
        instagram: string;
        profile_image: string | null;
        status: string;
        network_status: string;
        is_visible_to_venues: boolean;
        is_spotlight_eligible: boolean;
    } | null;
}

export interface VenueMembership {
    venue_id: string;
    member_role: VenueMemberRole;
    venue: {
        id: string;
        name: string;
        city: string | null;
        country: string | null;
        venue_type: string | null;
        account_status: VenueAccountStatus;
    } | null;
}

export interface AngelsSessionData {
    account: AngelsAccount;
    creatorMemberships: CreatorMembership[];
    venueMemberships: VenueMembership[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Venue hesabı
// ─────────────────────────────────────────────────────────────────────────────
export type VenueType =
    | 'cafe' | 'restaurant' | 'hotel' | 'cocktail_bar' | 'beach_club'
    | 'event' | 'luxury_brand' | 'agency' | 'other';

export type VenueAccountStatus = 'pending_review' | 'approved' | 'active' | 'suspended' | 'archived';
export type VenueVerificationStatus = 'unverified' | 'pending' | 'verified';

export const VENUE_TYPES: { value: VenueType; label: string }[] = [
    { value: 'cafe', label: 'Café' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'hotel', label: 'Hotel' },
    { value: 'cocktail_bar', label: 'Cocktail Bar' },
    { value: 'beach_club', label: 'Beach Club' },
    { value: 'event', label: 'Event' },
    { value: 'luxury_brand', label: 'Luxury Brand' },
    { value: 'agency', label: 'Agency' },
    { value: 'other', label: 'Other' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Creator platform alanları (angels_creators'a eklenen kolonlar)
// ─────────────────────────────────────────────────────────────────────────────
export type CreatorTier = 'celebrity' | 'premium_creator' | 'emerging_creator';
export type CreatorNetworkStatus = 'active' | 'paused' | 'archived';

export const CREATOR_TIERS: { value: CreatorTier; label: string }[] = [
    { value: 'celebrity', label: 'Celebrity' },
    { value: 'premium_creator', label: 'Premium Creator' },
    { value: 'emerging_creator', label: 'Emerging Creator' },
];

export const CONTENT_FORMATS = [
    'instagram_story', 'instagram_feed_post', 'reel', 'tiktok', 'ugc_content',
    'event_attendance', 'photo_usage_rights', 'video_usage_rights',
] as const;
export type ContentFormat = typeof CONTENT_FORMATS[number];

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
    instagram_story: 'Instagram Story',
    instagram_feed_post: 'Instagram Feed Post',
    reel: 'Reel',
    tiktok: 'TikTok',
    ugc_content: 'UGC Content',
    event_attendance: 'Event Attendance',
    photo_usage_rights: 'Photo Usage Rights',
    video_usage_rights: 'Video Usage Rights',
};

// ─────────────────────────────────────────────────────────────────────────────
// İşbirliği talepleri (angels_requests — yeni platform hattı)
// ─────────────────────────────────────────────────────────────────────────────
export type CampaignType =
    | 'venue_visit' | 'opening_event' | 'cocktail_launch' | 'hotel_experience'
    | 'beach_club_activation' | 'restaurant_collaboration' | 'brand_moment'
    | 'private_event' | 'cafepaste_drink_presentation';

export const CAMPAIGN_TYPES: { value: CampaignType; label: string }[] = [
    { value: 'venue_visit', label: 'Venue Visit' },
    { value: 'opening_event', label: 'Opening Event' },
    { value: 'cocktail_launch', label: 'Cocktail Launch' },
    { value: 'hotel_experience', label: 'Hotel Experience' },
    { value: 'beach_club_activation', label: 'Beach Club Activation' },
    { value: 'restaurant_collaboration', label: 'Restaurant Collaboration' },
    { value: 'brand_moment', label: 'Brand Moment' },
    { value: 'private_event', label: 'Private Event' },
    { value: 'cafepaste_drink_presentation', label: 'CAFEPASTE Drink Presentation' },
];

export type PlatformRequestStatus =
    | 'draft' | 'request_sent' | 'admin_review' | 'sent_to_creator'
    | 'creator_reviewing' | 'proposal_sent' | 'revision_requested'
    | 'declined' | 'expired' | 'accepted';

export interface PlatformRequest {
    id: string;
    venue_id: string;
    creator_id: string;
    project_title: string;
    campaign_type: CampaignType;
    deliverables: ContentFormat[];
    usage_rights: string | null;
    brief: string | null;
    budget_min: number | null;
    budget_max: number | null;
    currency: string;
    travel_covered: boolean;
    accommodation_covered: boolean;
    proposed_start_date: string | null;
    proposed_end_date: string | null;
    status: PlatformRequestStatus;
    declined_reason: string | null;
    admin_notes: string | null;
    expires_at: string | null;
    submitted_at: string | null;
    created_at: string;
    updated_at: string;
    // joins
    creator?: { id: string; full_name: string; display_name: string | null; instagram: string; profile_image: string | null } | null;
    venue?: { id: string; name: string; city: string | null; venue_type: string | null } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Teklifler
// ─────────────────────────────────────────────────────────────────────────────
export type ProposalStatus =
    | 'draft' | 'sent' | 'viewed' | 'revision_requested'
    | 'accepted' | 'declined' | 'expired';

export interface ProposalDeliverable {
    type: ContentFormat | string;
    quantity: number;
    note?: string;
}

export interface PlatformProposal {
    id: string;
    request_id: string;
    creator_id: string;
    venue_id: string;
    proposed_fee: number;
    venue_service_fee: number;
    creator_commission: number;
    platform_fee: number;
    total_amount: number;
    creator_payout: number;
    currency: string;
    deliverables: ProposalDeliverable[];
    available_dates: string[];
    message: string | null;
    valid_until: string | null;
    status: ProposalStatus;
    revision_note: string | null;
    viewed_at: string | null;
    responded_at: string | null;
    created_at: string;
    updated_at: string;
    request?: PlatformRequest | null;
}

export interface FeePreview {
    fee_model: 'venue_service_fee' | 'creator_commission' | 'managed_package';
    proposed_fee: number;
    venue_service_fee: number;
    creator_commission: number;
    tax_amount: number;
    platform_fee: number;
    total_amount: number;
    creator_payout: number;
    currency: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Projeler
// ─────────────────────────────────────────────────────────────────────────────
export type ProjectStatus =
    | 'proposal_accepted' | 'payment_pending' | 'payment_received' | 'confirmed'
    | 'scheduled' | 'in_progress' | 'content_submitted' | 'under_review'
    | 'completed' | 'cancelled' | 'disputed';

export interface PlatformProject {
    id: string;
    request_id: string | null;
    proposal_id: string | null;
    venue_id: string;
    creator_id: string;
    title: string;
    campaign_type: string | null;
    deliverables: ProposalDeliverable[];
    status: ProjectStatus;
    scheduled_date: string | null;
    content_due_at: string | null;
    content_links: { url: string; label?: string; submitted_at?: string }[];
    cancelled_reason: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    creator?: { id: string; full_name: string; display_name: string | null; instagram: string; profile_image: string | null } | null;
    venue?: { id: string; name: string; city: string | null; venue_type: string | null } | null;
    payment?: PlatformPayment | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ödemeler + payout'lar
// ─────────────────────────────────────────────────────────────────────────────
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
export type PayoutStatus = 'pending' | 'ready' | 'sent' | 'failed' | 'cancelled';

export interface PlatformPayment {
    id: string;
    project_id: string;
    venue_id: string;
    creator_id: string;
    amount: number;
    currency: string;
    platform_fee: number;
    creator_payout: number;
    payment_status: PaymentStatus;
    provider: string;
    transaction_id: string | null;
    invoice_url: string | null;
    paid_at: string | null;
    notes: string | null;
    created_at: string;
}

export interface PlatformPayout {
    id: string;
    payment_id: string | null;
    project_id: string;
    creator_id: string;
    amount: number;
    currency: string;
    payout_status: PayoutStatus;
    method: string | null;
    reference: string | null;
    sent_at: string | null;
    notes: string | null;
    created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Angels Spotlight
// ─────────────────────────────────────────────────────────────────────────────
export type PlacementType =
    | 'discovery_featured' | 'city_spotlight' | 'category_spotlight'
    | 'homepage_featured' | 'venue_recommendation_boost';

export type PromotionStatus =
    | 'draft' | 'pending_payment' | 'paid' | 'pending_admin_review'
    | 'scheduled' | 'active' | 'paused' | 'completed' | 'rejected' | 'refunded';

export type PromotionPaymentStatus = 'pending' | 'paid' | 'refunded';

export interface SpotlightPackage {
    id: string;
    name: string;
    description: string | null;
    duration_days: number;
    price: number;
    currency: string;
    placement_type: PlacementType;
    max_cities: number;
    max_venue_types: number;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface CreatorPromotion {
    id: string;
    creator_id: string;
    package_id: string;
    placement_type: PlacementType;
    target_cities: string[];
    target_venue_types: string[];
    price: number;
    currency: string;
    payment_status: PromotionPaymentStatus;
    promotion_status: PromotionStatus;
    starts_at: string | null;
    ends_at: string | null;
    impressions: number;
    profile_views: number;
    collaboration_requests: number;
    clicks: number;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
    package?: SpotlightPackage | null;
    creator?: { id: string; full_name: string; display_name: string | null; instagram: string } | null;
}

export const SPOTLIGHT_CITIES = [
    'Dubai', 'London', 'Paris', 'Milan', 'Istanbul', 'Bodrum',
    'Mykonos', 'New York', 'Los Angeles',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Notlar (chat yerine yapılandırılmış iletişim)
// ─────────────────────────────────────────────────────────────────────────────
export interface AngelsNote {
    id: string;
    subject_type: 'request' | 'proposal' | 'project';
    subject_id: string;
    author_kind: 'venue' | 'creator' | 'admin';
    body: string;
    visibility: 'all' | 'admin_only';
    created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ortak yardımcılar
// ─────────────────────────────────────────────────────────────────────────────
export function creatorDisplayName(c: { full_name?: string | null; display_name?: string | null } | null | undefined): string {
    if (!c) return '';
    return c.display_name || c.full_name || '';
}

export function formatMoney(amount: number | null | undefined, currency: string = 'USD'): string {
    if (amount == null) return '—';
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
        }).format(amount);
    } catch {
        return `${currency} ${amount}`;
    }
}
