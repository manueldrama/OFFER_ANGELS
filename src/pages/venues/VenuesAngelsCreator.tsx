// /venues/angels/creators/:id?t=<token> — a single approved creator profile as a
// venue/brand partner sees it, with a CTA to request a collaboration.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Camera, Loader2, Star } from 'lucide-react';
import { AngelsShell, AngelsButton, AngelsGhostButton, A } from '../../components/angels/AngelsShell';
import { useVenueToken, withToken } from '../../components/angels/useVenueToken';
import { AngelsService } from '../../services/angels/angelsService';
import type { AngelCreator } from '../../types/angels';
import { useAngelsContent } from '../../hooks/useAngelsContent';

export default function VenuesAngelsCreator() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const { state, token } = useVenueToken();
    const { getSection } = useAngelsContent('venue_creator');
    const copy = getSection('copy')?.config ?? {};

    const [creator, setCreator] = useState<AngelCreator | null>(null);
    const [loading, setLoading] = useState(true);
    const [lightbox, setLightbox] = useState<string | null>(null);

    useEffect(() => {
        if (state !== 'ok') return;
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const c = await AngelsService.getPublishedCreatorById(id);
                if (active) setCreator(c);
            } catch (e) {
                console.error('[angels] creator profile load failed', e);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [state, id]);

    if (state === 'loading' || loading) {
        return (
            <AngelsShell>
                <div className="flex items-center gap-2" style={{ color: A.textMuted }}>
                    <Loader2 size={18} className="animate-spin" /> {copy.loading || 'Loading…'}
                </div>
            </AngelsShell>
        );
    }

    if (state === 'invalid') {
        return (
            <AngelsShell>
                <div className="text-center">
                    <h1 className="font-bold" style={{ fontSize: 22, marginBottom: 10 }}>
                        {copy.gate_title || 'Private access'}
                    </h1>
                    <p style={{ color: A.textSecondary, maxWidth: 420 }}>
                        {copy.gate_body || 'Please use the private link shared by the CAFEPASTE team.'}
                    </p>
                </div>
            </AngelsShell>
        );
    }

    if (!creator) {
        return (
            <AngelsShell>
                <div className="text-center">
                    <h1 className="font-bold" style={{ fontSize: 22, marginBottom: 10 }}>
                        {copy.not_available_title || 'Creator not available'}
                    </h1>
                    <AngelsGhostButton onClick={() => navigate(withToken('/venues/angels', token))}>
                        {copy.back_label || 'Back to directory'}
                    </AngelsGhostButton>
                </div>
            </AngelsShell>
        );
    }

    return (
        <AngelsShell maxWidth={820} wordmarkSize="sm">
            <button
                onClick={() => navigate(withToken('/venues/angels', token))}
                className="self-start inline-flex items-center gap-1.5 mb-6"
                style={{ color: A.textMuted, fontSize: 14, cursor: 'pointer' }}
            >
                <ArrowLeft size={15} /> {copy.back_label || 'Back to directory'}
            </button>

            <div className="w-full flex flex-col sm:flex-row gap-6 items-start">
                <div
                    className="shrink-0 overflow-hidden"
                    style={{ width: 140, height: 140, borderRadius: 20, border: `1px solid ${A.border}`, background: A.surfaceElevated }}
                >
                    {creator.profile_image || creator.gallery_images[0] ? (
                        <img
                            src={creator.profile_image || creator.gallery_images[0]}
                            alt={creator.full_name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: A.textGhost }}>
                            <Camera size={26} />
                        </div>
                    )}
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="font-bold" style={{ fontSize: 26, letterSpacing: '-0.02em' }}>
                            {creator.full_name}
                        </h1>
                        {creator.is_featured && (
                            <span
                                className="inline-flex items-center gap-1 font-semibold uppercase"
                                style={{ fontSize: 10, letterSpacing: '0.1em', padding: '4px 9px', borderRadius: 9999, background: A.redSoft, color: A.red }}
                            >
                                <Star size={11} fill="currentColor" /> {copy.featured_label || 'Featured'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 mt-2" style={{ color: A.textMuted, fontSize: 14 }}>
                        {creator.city && (
                            <span className="inline-flex items-center gap-1">
                                <MapPin size={14} />
                                {creator.city}
                                {creator.country ? `, ${creator.country}` : ''}
                            </span>
                        )}
                        {creator.instagram && (
                            <a
                                href={`https://instagram.com/${creator.instagram.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1"
                                style={{ color: A.textSecondary }}
                            >
                                <Camera size={14} />@{creator.instagram.replace(/^@/, '')}
                            </a>
                        )}
                    </div>
                    {creator.bio && (
                        <p style={{ color: A.textSecondary, fontSize: 15, lineHeight: 1.6, marginTop: 14 }}>{creator.bio}</p>
                    )}
                    {creator.categories.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {creator.categories.map(c => (
                                <span
                                    key={c}
                                    style={{ fontSize: 12.5, padding: '5px 11px', borderRadius: 9999, border: `1px solid ${A.border}`, color: A.textSecondary }}
                                >
                                    {c}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="mt-6">
                        <AngelsButton onClick={() => navigate(withToken(`/venues/angels/request/${creator.id}`, token))}>
                            {copy.request_cta || 'Request Collaboration'}
                        </AngelsButton>
                    </div>
                </div>
            </div>

            {/* Gallery */}
            {creator.gallery_images.length > 0 && (
                <div className="w-full mt-10">
                    <h2 className="font-semibold mb-4" style={{ fontSize: 15, color: A.textSecondary }}>
                        {copy.portfolio_title || 'Portfolio'}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {creator.gallery_images.map((url, i) => (
                            <button
                                key={url + i}
                                onClick={() => setLightbox(url)}
                                className="overflow-hidden"
                                style={{ aspectRatio: '1', borderRadius: 12, border: `1px solid ${A.border}`, cursor: 'pointer' }}
                            >
                                <img src={url} alt={`Work ${i + 1}`} className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {lightbox && (
                <div
                    onClick={() => setLightbox(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}
                >
                    <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12 }} />
                </div>
            )}
        </AngelsShell>
    );
}
