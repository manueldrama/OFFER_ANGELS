// CAFEPASTE® Angels — the default (original hardcoded) content of every public
// Angels page, moved verbatim out of the page JSX. Serves double duty:
//   1. Public fallback: useAngelsContent() renders these when a page has no
//      angels_page_sections rows (or the fetch fails) → zero-risk deploys.
//   2. Seed source: the admin editor's "Varsayılan içeriği yükle" button
//      upserts these into the DB, so admin edits start from the real content.
//
// Personalized strings use {{name}} / {{venue}} / {{creator}} placeholders,
// substituted at render time via applyAngelsTemplate().

import type { AngelsPageKey } from '../types/angels';

export interface AngelsDefaultItem {
    title?: string;
    description?: string;
    value_text?: string;
    media_url?: string;
    icon?: string;
    extra?: Record<string, any>;
}

export interface AngelsDefaultSection {
    section_type: string;
    sort_order: number;
    config: Record<string, any>;
    items?: AngelsDefaultItem[];
}

export const ANGELS_DEFAULT_CONTENT: Record<AngelsPageKey, AngelsDefaultSection[]> = {
    // ── /angels ──────────────────────────────────────────────────────────────
    landing: [
        {
            section_type: 'hero',
            sort_order: 0,
            config: {
                badge_text: 'PRIVATE CREATOR NETWORK',
                headline: 'Where selected creators meet premium venues.',
                subheadline: 'CAFEPASTE® Angels is an exclusive creator network connecting selected creators with premium hospitality venues, hotels, and brand experiences powered by CAFEPASTE®.',
                launch_date: 'OFFICIAL LAUNCH — SEPTEMBER 15, 2026',
                bg_image_url: '/hero-desktop.webp',
                show_marquee: true,
                venues_label: 'Premium Partners',
                cta_apply_label: 'Submit Creator Profile',
                cta_venue_label: 'Venue Partnership'
            },
            items: [
                { title: 'CAFÉS' },
                { title: 'HOTELS' },
                { title: 'RESTAURANTS' },
                { title: 'EVENTS' }
            ]
        },
        {
            section_type: 'how_it_works',
            sort_order: 10,
            config: {
                eyebrow: 'HOW IT WORKS',
                title: 'A New Way to Collaborate',
                p1: 'Instead of traditional influencer campaigns, CAFEPASTE Angels creates ongoing access to premium venues and personalized experiences.'
            },
            items: [
                {
                    value_text: '01',
                    title: 'Submit Your Profile',
                    description: 'Share your portfolio and preferred categories. Our team reviews every creator individually.',
                    media_url: '/flow_creator.png'
                },
                {
                    value_text: '02',
                    title: 'Join the Network',
                    description: 'If approved, your profile becomes visible to our curated list of luxury venues.',
                    media_url: '/flow_network.png'
                },
                {
                    value_text: '03',
                    title: 'Experience & Create',
                    description: 'Venues can request to collaborate with you for exclusive visits and personalized drink moments.',
                    media_url: '/flow_venues.png'
                }
            ]
        },
        // Copy overrides applied on top of the shared invite sections when they
        // render on the public /angels page (invitation wording → application
        // wording). Never rendered as its own block.
        {
            section_type: 'landing_overrides',
            sort_order: 15,
            config: {
                badge_text: 'PRIVATE CREATOR NETWORK',
                hero_cta_label: 'Apply to Join',
                hero_secondary_cta_label: 'Venue Partnership',
                confirm_eyebrow: 'CREATOR APPLICATION',
                confirm_title: 'Apply to Join CAFEPASTE Angels',
                confirm_subtitle: 'Submit your creator profile. Our team reviews every application individually.',
                confirm_statement: 'By applying, you’re expressing your interest in joining CAFEPASTE Angels and exploring future hospitality collaborations.',
                confirm_cta_label: 'Apply Now',
                confirm_footnote: 'Applying expresses interest only. Every profile is reviewed individually by the CAFEPASTE team.',
            },
        },
        {
            section_type: 'application_form',
            sort_order: 20,
            config: {
                eyebrow: 'CREATOR APPLICATION',
                title: 'Apply to join CAFEPASTE Angels'
            }
        },
        {
            section_type: 'venue_partnership',
            sort_order: 30,
            config: {
                eyebrow: 'FOR PREMIUM VENUES',
                title: 'Become a CAFEPASTE venue partner'
            }
        }
    ],

    // ── /angels/invite/:token ────────────────────────────────────────────────
    invite: [
        {
            section_type: 'header',
            sort_order: 0,
            config: { pill_text: 'PRIVATE INVITATION' },
        },
        {
            section_type: 'hero',
            sort_order: 10,
            config: {
                badge_text: 'PRIVATE INVITATION',
                headline: "{{name}}, you're invited to\nCAFEPASTE Angels.",
                subheadline: 'The Premium Creator Network of CAFEPASTE',
                description: 'CAFEPASTE Angels connects luxury venues with selected creators for premium content and branded drink experiences.',
                cta_primary_label: 'Accept My Invitation',
                cta_secondary_label: 'See How It Works',
                trust_left: 'Private & secure',
                trust_right: 'Created for you',
                active_until_line: 'Your private invitation is active until {{date}}.',
                bg_image_url: '/hero-desktop.webp',
                show_venue_tags: true,
                venues_label: 'Collaborating Premium Venues',
                show_marquee: true,
            },
            items: [
                { title: 'CAFÉS' },
                { title: 'HOTELS' },
                { title: 'RESTAURANTS' },
                { title: 'EVENTS' },
            ]
        },
        {
            section_type: 'what_is_cafepaste',
            sort_order: 20,
            config: {
                eyebrow: 'THE EXPERIENCE',
                title: 'What is CAFEPASTE?',
                subtitle: 'CAFEPASTE transforms drinks into personalized visual experiences.',
                p1: 'Hospitality brands can serve coffees, cocktails and signature drinks with custom images, logos or creator visuals on top.',
                p2: 'For creators, this creates elegant, shareable lifestyle content around a unique drink moment.',
                closing_line: 'This experience is the foundation of CAFEPASTE Angels.',
                cta_label: 'Discover CAFEPASTE',
                bg_image_url: '/cafepaste_experience.png',
            },
        },
        {
            section_type: 'what_is',
            sort_order: 30,
            config: {
                eyebrow: 'THE NETWORK',
                title: 'What is CAFEPASTE Angels?',
                p1: 'CAFEPASTE Angels is a private circle connecting lifestyle creators with distinct hospitality and event experiences.\n\nAs a member, your profile may be considered for future collaborations.',
            },
            items: [
                {
                    value_text: '01',
                    title: 'Selected Creator Profile',
                    description: 'Your profile becomes part of the CAFEPASTE Angels network.',
                    media_url: '/flow_creator.png',
                },
                {
                    value_text: '02',
                    title: 'Venue Access',
                    description: 'Your profile may be presented to selected cafés, hotels, restaurants and events.',
                    media_url: '/flow_venues.png',
                },
                {
                    value_text: '03',
                    title: 'Brand Experiences',
                    description: 'You may be considered for future lifestyle, launch, opening and brand activation collaborations.',
                    media_url: '/flow_network.png',
                },
            ],
        },
        {
            section_type: 'why_invited',
            sort_order: 40,
            config: {
                eyebrow: 'PERSONALLY SELECTED',
                title: 'Why We Selected You',
                subtitle: '{{name}}, your profile matches the lifestyle, visual quality and atmosphere we’re building for CAFEPASTE Angels.',
            },
            items: [
                {
                    value_text: '01',
                    title: 'Aesthetic Alignment',
                    description: 'Your content aligns with the visual world of our venues, drinks and lifestyle moments.',
                },
                {
                    value_text: '02',
                    title: 'Visual Quality',
                    description: 'Your profile reflects the elegant content style we want inside CAFEPASTE Angels.',
                },
                {
                    value_text: '03',
                    title: 'Collaboration Potential',
                    description: 'We believe your profile can fit future venue, event and brand experiences.',
                },
            ],
        },
        {
            section_type: 'joining_network',
            sort_order: 80,
            config: {
                eyebrow: 'THE NEXT STEP',
                title: 'How to Join CAFEPASTE Angels',
                lead: 'To join CAFEPASTE Angels, simply accept your private invitation.',
                body: 'After confirmation, our team will contact you and prepare your first personalized CAFEPASTE drink moment.',
                footnote: 'No long application. No complicated production. Just a simple confirmation to join.',
            },
            items: [
                { title: 'Accept your private invitation' },
                { title: 'CAFEPASTE team contacts you' },
                { title: 'Your personalized drink concept is prepared' },
                { title: 'Your first lifestyle content moment begins' },
            ],
        },
        {
            section_type: 'moments',
            sort_order: 60,
            config: {
                eyebrow: 'THE EXPERIENCE',
                title: 'CAFEPASTE Angels Moments',
                subtitle:
                    'Personalized drink experiences created for selected creators, elegant venues and brand moments.',
                drag_hint: 'Drag to explore',
            },
            items: [
                { value_text: 'BEVERAGE ART', title: 'Personalized drink art', media_url: '/moments_beverage_art_1784140922512.png' },
                { value_text: 'VENUE', title: 'Luxury lounge atmosphere', media_url: '/moments_venue_1784140938072.png' },
                { value_text: 'SELECTED CREATOR', title: 'A face of the network', media_url: '/moments_creator_1784140949037.png' },
                { value_text: 'BRAND MOMENT', title: 'Event & activation', media_url: '/moments_brand_1784140955713.png' },
                { value_text: 'CONTENT', title: 'Instagram-ready moment', media_url: '/moments_content_1784140964855.png' },
            ],
        },
        {
            section_type: 'confirm',
            sort_order: 90,
            config: {
                eyebrow: 'PRIVATE INVITATION FOR {{name}}',
                title: 'Confirm Your Invitation',
                subtitle: 'Accept your private invitation to join CAFEPASTE Angels. After confirmation, our team will contact you with the next steps.',
                statement: 'You’re confirming your interest in joining CAFEPASTE Angels and exploring future hospitality collaborations.',
                checkbox_label: 'I would like to join CAFEPASTE Angels.',
                cta_label: 'Accept My Invitation',
                footnote: 'This confirms your interest only. Future collaborations are reviewed individually by the CAFEPASTE team.',
                agree_error: 'Please confirm the statement above to accept your invitation.',
            },
            items: [],
        },
        {
            section_type: 'status_copy',
            sort_order: 80,
            config: {
                loading_title: 'Loading your invitation…',
                invalid_title: 'Invitation not found',
                invalid_body:
                    'This private link is invalid. Please check the link you received, or contact the CAFEPASTE team.',
                expired_title: 'This invitation has expired',
                expired_body:
                    'Your private link is no longer active. Reach out to the CAFEPASTE team for a fresh invitation.',
                expired_badge: 'INVITATION EXPIRED',
                expired_until_line: 'Your private CAFEPASTE Angels invitation was reserved until {{date}}.',
                expired_request_button: 'Request New Invitation',
                expired_contact_button: 'Contact CAFEPASTE Team',
                expired_requested_title: 'Request received',
                expired_requested_body:
                    'Thank you — the CAFEPASTE team has been notified. If your invitation is renewed, this same private link will become active again.',
                accepted_title: 'Thank you, {{name}}.\n\nYour CAFEPASTE Angels invitation has been confirmed.',
                accepted_body: 'Our team will contact you with the next steps and share details about your first personalized CAFEPASTE drink moment.',
            },
        },
    ],

    // ── /angels/accept/:token (form fields stay code-driven) ────────────────
    accept: [
        {
            section_type: 'intro',
            sort_order: 0,
            config: {
                eyebrow: 'Complete your profile',
                title: 'Join CAFEPASTE® Angels',
                subtitle:
                    'Tell us about you and share a few photos. Our team reviews every profile before it joins the private network.',
            },
        },
        {
            section_type: 'form_copy',
            sort_order: 10,
            config: {
                photos_title: 'Your photos',
                photos_desc: 'A profile photo plus a few of your best coffee, cocktail or lifestyle shots.',
                categories_title: 'Preferred collaboration categories',
                categories_desc: 'Pick everything that fits your work.',
                bio_label: 'A few words about you',
                bio_placeholder: 'Your style, the venues and brands you love working with…',
                submit_label: 'Send My Photos',
                disclaimer:
                    'By submitting, you agree your profile may be shown to selected CAFEPASTE® venues and brand partners.',
                // Form chrome — labels, states and errors (kept EN in code; translated via i18n)
                full_name_label: 'Full name',
                full_name_placeholder: 'Your name',
                instagram_label: 'Instagram username',
                email_label: 'Email',
                whatsapp_label: 'WhatsApp',
                city_label: 'City',
                country_label: 'Country',
                profile_photo_title: 'Profile photo',
                profile_photo_hint: 'A clear portrait works best.',
                gallery_add_label: 'Add',
                loading_text: 'Loading…',
                error_full_name: 'Please enter your full name.',
                error_instagram: 'Please enter your Instagram username.',
                error_email: 'Please enter a valid email.',
                error_photos: 'Please add at least one photo.',
                error_categories: 'Please select at least one collaboration category.',
                error_submit: 'Something went wrong while submitting. Please try again.',
                upload_error: 'Upload failed. Please try again.',
            },
        },
        {
            section_type: 'invalid_copy',
            sort_order: 20,
            config: {
                title: 'Invitation not available',
                body: 'This private link is invalid or has expired. Please contact the CAFEPASTE® team.',
            },
        },
    ],

    // ── /angels/thank-you ────────────────────────────────────────────────────
    thank_you: [
        {
            section_type: 'main',
            sort_order: 0,
            config: {
                eyebrow: 'Profile received',
                title: 'Welcome to the network',
                body: 'Thank you. Our team reviews every CAFEPASTE® Angels profile by hand. Once you’re approved, you’ll join the private network — and selected premium venues and brand partners may invite you for collaborations.',
            },
        },
        {
            section_type: 'next_steps',
            sort_order: 10,
            config: { title: 'What happens next' },
            // Numbers are rendered from the index, so reordering renumbers automatically.
            items: [
                { title: 'Our team reviews your profile and photos.' },
                { title: 'Approved creators are published to the private Angels network.' },
                { title: 'Premium venues and brands can request a collaboration with you.' },
            ],
        },
    ],

    // ── /venues/angels?t=<token> ─────────────────────────────────────────────
    venue_directory: [
        {
            section_type: 'intro',
            sort_order: 0,
            config: {
                eyebrow_with_venue: 'Welcome, {{venue}}',
                eyebrow_fallback: 'Approved creators',
                title: 'The CAFEPASTE® Angels network',
                subtitle: 'Browse approved creators and request a collaboration. Our team handles every introduction.',
                search_placeholder: 'Search by name, handle or city',
                all_cities_label: 'All cities',
                all_categories_label: 'All categories',
                empty_text: 'No creators match these filters yet.',
            },
        },
        {
            section_type: 'gate_copy',
            sort_order: 10,
            config: {
                verifying: 'Verifying access…',
                title: 'Private access',
                body: 'This area is reserved for CAFEPASTE® venue and brand partners. Please use the private link shared by the CAFEPASTE® team.',
            },
        },
    ],

    // ── /venues/angels/creators/:id ──────────────────────────────────────────
    venue_creator: [
        {
            section_type: 'copy',
            sort_order: 0,
            config: {
                loading: 'Loading…',
                back_label: 'Back to directory',
                featured_label: 'Featured',
                portfolio_title: 'Portfolio',
                request_cta: 'Request Collaboration',
                not_available_title: 'Creator not available',
                gate_title: 'Private access',
                gate_body: 'Please use the private link shared by the CAFEPASTE® team.',
            },
        },
    ],

    // ── /venues/angels/request/:creatorId ────────────────────────────────────
    venue_request: [
        {
            section_type: 'intro',
            sort_order: 0,
            config: {
                eyebrow: 'Collaboration request',
                title_with_creator: 'Invite {{creator}}',
                title_fallback: 'Request a collaboration',
                subtitle: 'Share a few details and our team will coordinate the introduction.',
            },
        },
        {
            section_type: 'disclaimer',
            sort_order: 10,
            config: {
                back_label: 'Back',
                submit_label: 'Send Request',
                text: 'The CAFEPASTE® team manages every collaboration personally.',
                error_venue_name: 'Please enter your venue or brand name.',
                error_generic: 'Something went wrong. Please try again.',
            },
        },
        {
            section_type: 'success_copy',
            sort_order: 20,
            config: {
                title: 'Request sent',
                body: 'Thank you. The CAFEPASTE® team will review your request for {{creator}} and coordinate the introduction.',
                back_label: 'Back to directory',
            },
        },
        {
            section_type: 'gate_copy',
            sort_order: 30,
            config: {
                title: 'Private access',
                body: 'Please use the private link shared by the CAFEPASTE® team.',
            },
        },
    ],
};
