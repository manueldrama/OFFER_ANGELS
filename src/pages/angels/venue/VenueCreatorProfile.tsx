// /angels/venue/creators/:id — creator profili (venue görünümü).
// Özel iletişim bilgisi YOK; tek kırmızı CTA: Request Collaboration.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Globe2, Plane, Sparkles } from 'lucide-react';
import { A, AngelsButton } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsCard, AngelsChip,
} from '../../../components/angels/dashboard/AngelsDashboard';
import {
    AngelsPortalVenueService, type DirectoryCreator,
} from '../../../services/angels/angelsPortalVenueService';
import { CONTENT_FORMAT_LABELS, CREATOR_TIERS, formatMoney, type ContentFormat } from '../../../types/angelsPlatform';

export default function VenueCreatorProfile() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [creator, setCreator] = useState<DirectoryCreator | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        AngelsPortalVenueService.getDirectoryCreator(id)
            .then(c => {
                setCreator(c);
                // Spotlight profil görüntüleme metriği (keşiften promosyonla gelindiyse)
                const promotionId = (location.state as any)?.promotionId;
                if (c && promotionId) AngelsPortalVenueService.recordProfileView(promotionId);
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const tierLabel = CREATOR_TIERS.find(t => t.value === creator?.tier)?.label;

    return (
        <AngelsDashboardShell area="venue">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 mb-6 cursor-pointer"
                style={{ color: A.textMuted, fontSize: 13.5, background: 'none', border: 'none', padding: 0 }}
            >
                <ArrowLeft size={15} /> Back to discovery
            </button>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : !creator ? (
                <AngelsCard>
                    <p style={{ color: A.textSecondary, fontSize: 14 }}>
                        This creator is not currently available for collaborations.
                    </p>
                </AngelsCard>
            ) : (
                <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
                    {/* Sol: görsel + CTA */}
                    <div className="flex flex-col gap-4">
                        <div
                            className="rounded-2xl overflow-hidden"
                            style={{ border: `1px solid ${A.border}`, aspectRatio: '4 / 5', background: A.surface }}
                        >
                            {creator.profile_image ? (
                                <img src={creator.profile_image} alt={creator.display_name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Sparkles size={26} style={{ color: A.textGhost }} />
                                </div>
                            )}
                        </div>
                        <AngelsButton block onClick={() => navigate(`/venue/requests/new/${creator.id}`)}>
                            Request Collaboration
                        </AngelsButton>
                        <p style={{ color: A.textGhost, fontSize: 12, lineHeight: 1.7, textAlign: 'center' }}>
                            Collaboration requests are managed through CAFEPASTE Angels.
                        </p>
                    </div>

                    {/* Sağ: bilgiler */}
                    <div className="flex flex-col gap-5">
                        <div>
                            <div className="flex flex-wrap items-center gap-3 mb-1.5">
                                <h1 style={{ color: A.text, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
                                    {creator.display_name}
                                </h1>
                                {tierLabel && <AngelsChip tone="gold">{tierLabel}</AngelsChip>}
                                {creator.is_featured && <AngelsChip tone="neutral">Featured</AngelsChip>}
                            </div>
                            <p style={{ color: A.redText, fontSize: 14.5, fontWeight: 600 }}>@{creator.instagram}</p>
                            <div className="flex flex-wrap gap-4 mt-3">
                                <span className="flex items-center gap-1.5" style={{ color: A.textMuted, fontSize: 13 }}>
                                    <MapPin size={14} /> {[creator.city, creator.country].filter(Boolean).join(', ') || '—'}
                                </span>
                                {creator.languages?.length > 0 && (
                                    <span className="flex items-center gap-1.5" style={{ color: A.textMuted, fontSize: 13 }}>
                                        <Globe2 size={14} /> {creator.languages.join(', ')}
                                    </span>
                                )}
                                {creator.travel_available && (
                                    <span className="flex items-center gap-1.5" style={{ color: A.textMuted, fontSize: 13 }}>
                                        <Plane size={14} /> Available for travel
                                    </span>
                                )}
                            </div>
                        </div>

                        {(creator.bio || creator.style_description) && (
                            <AngelsCard padding="p-5">
                                {creator.style_description && (
                                    <p style={{ color: A.s1, fontSize: 14.5, lineHeight: 1.7, marginBottom: creator.bio ? 10 : 0, fontStyle: 'italic' }}>
                                        “{creator.style_description}”
                                    </p>
                                )}
                                {creator.bio && (
                                    <p style={{ color: A.textSecondary, fontSize: 14, lineHeight: 1.75 }}>{creator.bio}</p>
                                )}
                            </AngelsCard>
                        )}

                        {/* Kategoriler + formatlar + ücret bandı */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <AngelsCard padding="p-5">
                                <p style={{ color: A.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                                    Categories
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {(creator.categories?.length ? creator.categories : ['—']).map(cat => (
                                        <AngelsChip key={cat} tone="neutral">{cat}</AngelsChip>
                                    ))}
                                </div>
                            </AngelsCard>
                            <AngelsCard padding="p-5">
                                <p style={{ color: A.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                                    Content Formats
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {(creator.content_formats?.length ? creator.content_formats : []).map(f => (
                                        <AngelsChip key={f} tone="neutral">
                                            {CONTENT_FORMAT_LABELS[f as ContentFormat] ?? f}
                                        </AngelsChip>
                                    ))}
                                    {!creator.content_formats?.length && (
                                        <span style={{ color: A.textGhost, fontSize: 13 }}>Defined per collaboration</span>
                                    )}
                                </div>
                            </AngelsCard>
                        </div>

                        {(creator.rate_min != null || creator.preferred_collaboration_cities?.length > 0) && (
                            <div className="grid sm:grid-cols-2 gap-4">
                                {creator.rate_min != null && (
                                    <AngelsCard padding="p-5">
                                        <p style={{ color: A.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                                            Collaborations From
                                        </p>
                                        <p style={{ color: A.text, fontSize: 20, fontWeight: 700 }}>
                                            {formatMoney(creator.rate_min, creator.currency)}
                                        </p>
                                        <p style={{ color: A.textGhost, fontSize: 12, marginTop: 4 }}>
                                            Final pricing is confirmed per proposal.
                                        </p>
                                    </AngelsCard>
                                )}
                                {creator.preferred_collaboration_cities?.length > 0 && (
                                    <AngelsCard padding="p-5">
                                        <p style={{ color: A.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                                            Preferred Cities
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {creator.preferred_collaboration_cities.map(ct => (
                                                <AngelsChip key={ct} tone="neutral">{ct}</AngelsChip>
                                            ))}
                                        </div>
                                    </AngelsCard>
                                )}
                            </div>
                        )}

                        {/* Galeri */}
                        {creator.gallery_images?.length > 0 && (
                            <div>
                                <p style={{ color: A.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                                    Portfolio
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {creator.gallery_images.slice(0, 9).map((img, i) => (
                                        <div
                                            key={i}
                                            className="rounded-xl overflow-hidden"
                                            style={{ border: `1px solid ${A.border}`, aspectRatio: '1', background: A.surface }}
                                        >
                                            <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AngelsDashboardShell>
    );
}
