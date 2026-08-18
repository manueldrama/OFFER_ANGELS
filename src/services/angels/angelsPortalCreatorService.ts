// Creator/manager portal servisi — /api/angels/creator/* uçlarının sarmalayıcısı.
// Manager modeli: her çağrı aktif creator_id taşır (AngelsAuthProvider'dan gelir).

import { angelsApiFetch } from './angelsAuthService';
import type {
    PlatformRequest, PlatformProposal, PlatformProject, PlatformPayout,
    SpotlightPackage, CreatorPromotion, FeePreview, AngelsNote,
} from '../../types/angelsPlatform';

const q = (creatorId: string) => `?creator_id=${encodeURIComponent(creatorId)}`;

export const AngelsPortalCreatorService = {
    getOverview: (creatorId: string) => angelsApiFetch<{
        newRequests: number; openProposals: number; activeProjects: number;
        pendingPayoutTotal: number; pendingPayoutCurrency: string;
        activePromotion: { id: string; ends_at: string | null } | null;
        recentRequests: PlatformRequest[];
        profile: any;
    }>(`/creator/overview${q(creatorId)}`),

    listRequests: (creatorId: string) =>
        angelsApiFetch<{ requests: PlatformRequest[] }>(`/creator/requests${q(creatorId)}`),

    getRequest: (creatorId: string, id: string) =>
        angelsApiFetch<{ request: PlatformRequest; proposals: PlatformProposal[]; notes: AngelsNote[] }>(
            `/creator/requests/${id}${q(creatorId)}`),

    declineRequest: (creatorId: string, id: string, reason: string) =>
        angelsApiFetch<{ ok: boolean }>(`/creator/requests/${id}/decline`, {
            body: { creator_id: creatorId, reason },
        }),

    previewFees: (creatorId: string, requestId: string, proposedFee: number) =>
        angelsApiFetch<{ preview: FeePreview }>('/creator/fees/preview', {
            body: { creator_id: creatorId, request_id: requestId, proposed_fee: proposedFee },
        }),

    sendProposal: (creatorId: string, payload: {
        request_id: string; proposed_fee: number;
        deliverables?: { type: string; quantity: number; note?: string }[];
        available_dates?: string[]; message?: string;
    }) => angelsApiFetch<{ proposal_id: string }>('/creator/proposals', {
        body: { creator_id: creatorId, ...payload },
    }),

    listProposals: (creatorId: string) =>
        angelsApiFetch<{ proposals: PlatformProposal[] }>(`/creator/proposals${q(creatorId)}`),

    listProjects: (creatorId: string) =>
        angelsApiFetch<{ projects: PlatformProject[] }>(`/creator/projects${q(creatorId)}`),

    getProject: (creatorId: string, id: string) =>
        angelsApiFetch<{
            project: PlatformProject;
            payout: Pick<PlatformPayout, 'id' | 'amount' | 'currency' | 'payout_status' | 'sent_at'> | null;
            payment: { id: string; payment_status: string; paid_at: string | null } | null;
            notes: AngelsNote[];
        }>(`/creator/projects/${id}${q(creatorId)}`),

    getProjectContacts: (creatorId: string, id: string) =>
        angelsApiFetch<{ contacts: any }>(`/creator/projects/${id}/contacts${q(creatorId)}`),

    submitContent: (creatorId: string, projectId: string, links: { url: string; label?: string }[]) =>
        angelsApiFetch<{ ok: boolean }>(`/creator/projects/${projectId}/content`, {
            body: { creator_id: creatorId, links },
        }),

    listPayouts: (creatorId: string) =>
        angelsApiFetch<{ payouts: (PlatformPayout & { project?: { id: string; title: string } })[] }>(
            `/creator/payments${q(creatorId)}`),

    getProfile: (creatorId: string) =>
        angelsApiFetch<{ creator: any }>(`/creator/profile${q(creatorId)}`),

    updateProfile: (creatorId: string, patch: Record<string, unknown>) =>
        angelsApiFetch<{ creator: any }>('/creator/profile', {
            method: 'PATCH', body: { creator_id: creatorId, ...patch },
        }),

    /** Yeni fotoğraflar admin onayına gider; onaylanana dek canlı profil değişmez. */
    submitPhotos: (creatorId: string, profileImage: string | null, galleryImages: string[]) =>
        angelsApiFetch<{ ok: boolean }>('/creator/photos/submit', {
            body: { creator_id: creatorId, profile_image: profileImage, gallery_images: galleryImages },
        }),

    getSpotlight: (creatorId: string) =>
        angelsApiFetch<{
            packages: SpotlightPackage[]; promotions: CreatorPromotion[];
            eligible: boolean; reasons: string[];
        }>(`/creator/spotlight${q(creatorId)}`),

    purchaseSpotlight: (creatorId: string, payload: {
        package_id: string; target_cities: string[]; target_venue_types: string[];
    }) => angelsApiFetch<{ promotion: CreatorPromotion }>('/creator/spotlight/purchase', {
        body: { creator_id: creatorId, ...payload },
    }),

    addNote: (creatorId: string, subjectType: 'request' | 'proposal' | 'project', subjectId: string, body: string) =>
        angelsApiFetch<{ note: AngelsNote }>('/creator/notes', {
            body: { creator_id: creatorId, subject_type: subjectType, subject_id: subjectId, body },
        }),
};
