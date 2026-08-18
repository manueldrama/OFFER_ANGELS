// /angels/creator/profile — creator profil editörü.
// Küratörlük alanları (tier, görünürlük, Spotlight uygunluğu) read-only
// "curated by CAFEPASTE" olarak gösterilir; yalnız admin değiştirir.

import { useCallback, useEffect, useState } from 'react';
import { Check, Camera } from 'lucide-react';
import { A, AngelsButton, AngelsGhostButton } from '../../../components/angels/AngelsShell';
import {
    AngelsLabel, AngelsInput, AngelsTextarea, ProfileImageUploader, GalleryUploader,
} from '../../../components/angels/AngelsForm';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsCard, AngelsChip,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { useAngelsAuth } from '../../../components/angels/AngelsAuthProvider';
import { AngelsPortalCreatorService } from '../../../services/angels/angelsPortalCreatorService';
import {
    CONTENT_FORMATS, CONTENT_FORMAT_LABELS, CREATOR_TIERS, SPOTLIGHT_CITIES,
} from '../../../types/angelsPlatform';

/** Fotoğraf yönetimi: canlı set + admin onayına giden güncelleme akışı.
 *  Yeni fotoğraflar onaylanana kadar dizinde ESKİ set görünmeye devam eder. */
function PhotosSection({ creator, creatorId, onSubmitted }: {
    creator: any; creatorId: string; onSubmitted: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [gallery, setGallery] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reviewStatus: string | null = creator.photo_review_status ?? null;
    const isPending = reviewStatus === 'pending';

    function startEditing() {
        // Bekleyen bir set varsa onun üzerinden devam et; yoksa canlı setten başla
        setProfileImage(creator.pending_profile_image ?? creator.profile_image ?? null);
        setGallery(
            (creator.pending_gallery_images?.length ? creator.pending_gallery_images : creator.gallery_images) ?? [],
        );
        setEditing(true);
        setError(null);
    }

    async function submit() {
        if (busy) return;
        if (!profileImage && !gallery.length) { setError('Add at least one photo.'); return; }
        setBusy(true);
        setError(null);
        try {
            await AngelsPortalCreatorService.submitPhotos(creatorId, profileImage, gallery);
            setEditing(false);
            onSubmitted();
        } catch (e: any) {
            setError(e?.message || 'Failed to submit photos.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <AngelsCard>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Photos
                </p>
                {isPending ? (
                    <AngelsChip tone="warning">In review</AngelsChip>
                ) : reviewStatus === 'rejected' ? (
                    <AngelsChip tone="danger">Changes requested</AngelsChip>
                ) : null}
            </div>

            {/* Durum banner'ları */}
            {isPending && !editing && (
                <p style={{ color: A.textSecondary, fontSize: 13.5, lineHeight: 1.6, marginBottom: 16 }}>
                    Your new photos are being reviewed by the CAFEPASTE Angels team.
                    Until they're approved, venues continue to see your current set.
                </p>
            )}
            {reviewStatus === 'rejected' && !editing && (
                <div className="rounded-lg px-3.5 py-3 mb-4" style={{ background: A.redSoft, border: `1px solid ${A.redLine}` }}>
                    <p style={{ color: A.redText, fontSize: 13.5, fontWeight: 600 }}>
                        The Angels team requested changes to your photos.
                    </p>
                    {creator.photo_review_note && (
                        <p style={{ color: A.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
                            “{creator.photo_review_note}”
                        </p>
                    )}
                </div>
            )}

            {!editing ? (
                <>
                    {/* Canlı set */}
                    <div className="flex flex-wrap gap-3 mb-5">
                        {creator.profile_image && (
                            <div className="relative">
                                <img
                                    src={creator.profile_image}
                                    alt="Profile"
                                    className="object-cover"
                                    style={{ width: 96, height: 96, borderRadius: 16, border: `1px solid ${A.redLine}` }}
                                />
                                <span
                                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5"
                                    style={{ background: A.bg, border: `1px solid ${A.border}`, color: A.textMuted, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
                                >
                                    Profile
                                </span>
                            </div>
                        )}
                        {(creator.gallery_images ?? []).map((url: string, i: number) => (
                            <img
                                key={url + i}
                                src={url}
                                alt={`Photo ${i + 1}`}
                                className="object-cover"
                                style={{ width: 96, height: 96, borderRadius: 16, border: `1px solid ${A.border}` }}
                            />
                        ))}
                        {!creator.profile_image && !(creator.gallery_images ?? []).length && (
                            <p style={{ color: A.textGhost, fontSize: 13.5 }}>No photos yet.</p>
                        )}
                    </div>

                    {/* Bekleyen set önizlemesi */}
                    {isPending && (creator.pending_profile_image || (creator.pending_gallery_images ?? []).length > 0) && (
                        <div className="mb-5">
                            <p style={{ color: A.textGhost, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                                Submitted — awaiting approval
                            </p>
                            <div className="flex flex-wrap gap-2.5" style={{ opacity: 0.65 }}>
                                {creator.pending_profile_image && (
                                    <img src={creator.pending_profile_image} alt="" className="object-cover"
                                        style={{ width: 68, height: 68, borderRadius: 12, border: `1px dashed ${A.borderStrong}` }} />
                                )}
                                {(creator.pending_gallery_images ?? []).map((url: string, i: number) => (
                                    <img key={url + i} src={url} alt="" className="object-cover"
                                        style={{ width: 68, height: 68, borderRadius: 12, border: `1px dashed ${A.borderStrong}` }} />
                                ))}
                            </div>
                        </div>
                    )}

                    <AngelsGhostButton onClick={startEditing}>
                        <Camera size={15} /> {isPending ? 'Edit Submission' : 'Update Photos'}
                    </AngelsGhostButton>
                </>
            ) : (
                <div className="flex flex-col gap-5">
                    <ProfileImageUploader value={profileImage} onChange={setProfileImage} />
                    <div>
                        <AngelsLabel>Portfolio gallery</AngelsLabel>
                        <GalleryUploader images={gallery} onChange={setGallery} max={9} />
                    </div>
                    {error && <p style={{ color: A.redText, fontSize: 13.5 }}>{error}</p>}
                    <div className="flex flex-wrap gap-3">
                        <AngelsButton loading={busy} onClick={() => void submit()}>Submit for Review</AngelsButton>
                        <AngelsGhostButton onClick={() => setEditing(false)}>Cancel</AngelsGhostButton>
                    </div>
                    <p style={{ color: A.textGhost, fontSize: 12, lineHeight: 1.6 }}>
                        New photos go live after a quick review by the CAFEPASTE Angels team —
                        venues keep seeing your current set until then.
                    </p>
                </div>
            )}
        </AngelsCard>
    );
}

export default function CreatorProfile() {
    const { activeCreatorId } = useAngelsAuth();
    const [creator, setCreator] = useState<any | null>(null);
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [styleDescription, setStyleDescription] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [languages, setLanguages] = useState('');
    const [formats, setFormats] = useState<string[]>([]);
    const [cities, setCities] = useState<string[]>([]);
    const [travel, setTravel] = useState(false);
    const [rateMin, setRateMin] = useState('');
    const [rateMax, setRateMax] = useState('');
    const [currency, setCurrency] = useState('USD');

    const loadProfile = useCallback(() => {
        if (!activeCreatorId) return;
        AngelsPortalCreatorService.getProfile(activeCreatorId).then(r => {
            const c = r.creator;
            setCreator(c);
            setDisplayName(c.display_name ?? '');
            setBio(c.bio ?? '');
            setStyleDescription(c.style_description ?? '');
            setCity(c.city ?? '');
            setCountry(c.country ?? '');
            setLanguages((c.languages ?? []).join(', '));
            setFormats(c.content_formats ?? []);
            setCities(c.preferred_collaboration_cities ?? []);
            setTravel(!!c.travel_available);
            setRateMin(c.rate_min != null ? String(c.rate_min) : '');
            setRateMax(c.rate_max != null ? String(c.rate_max) : '');
            setCurrency(c.currency ?? 'USD');
        });
    }, [activeCreatorId]);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    async function save() {
        if (!activeCreatorId || busy) return;
        setBusy(true);
        setSaved(false);
        setError(null);
        try {
            await AngelsPortalCreatorService.updateProfile(activeCreatorId, {
                display_name: displayName.trim() || null,
                bio: bio.trim() || null,
                style_description: styleDescription.trim() || null,
                city: city.trim() || null,
                country: country.trim() || null,
                languages: languages.split(',').map(s => s.trim()).filter(Boolean),
                content_formats: formats,
                preferred_collaboration_cities: cities,
                travel_available: travel,
                rate_min: rateMin ? Number(rateMin) : null,
                rate_max: rateMax ? Number(rateMax) : null,
                currency,
            });
            setSaved(true);
        } catch (e: any) {
            setError(e?.message || 'Failed to save.');
        } finally {
            setBusy(false);
        }
    }

    const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
        set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

    const tierLabel = CREATOR_TIERS.find(t => t.value === creator?.tier)?.label;

    return (
        <AngelsDashboardShell area="creator">
            <AngelsPageHeader
                eyebrow="Creator Dashboard"
                title="My Profile"
                description="This is how approved venues see you in the private discovery."
            />

            {!creator ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : (
                <div className="max-w-[720px] flex flex-col gap-5">
                    {/* Küratörlük durumu — read only */}
                    <AngelsCard padding="p-5">
                        <div className="flex flex-wrap items-center gap-2.5">
                            {tierLabel && <AngelsChip tone="gold">{tierLabel}</AngelsChip>}
                            <AngelsChip tone={creator.status === 'published' ? 'success' : 'warning'}>
                                {creator.status === 'published' ? 'Published' : 'In curation'}
                            </AngelsChip>
                            <AngelsChip tone={creator.is_visible_to_venues ? 'success' : 'neutral'}>
                                {creator.is_visible_to_venues ? 'Visible to venues' : 'Hidden'}
                            </AngelsChip>
                        </div>
                        <p style={{ color: A.textGhost, fontSize: 12.5, marginTop: 10, lineHeight: 1.6 }}>
                            Tier and visibility are curated by CAFEPASTE Angels.
                        </p>
                    </AngelsCard>

                    {/* Fotoğraflar: canlı set + onaya giden güncelleme */}
                    <PhotosSection creator={creator} creatorId={activeCreatorId!} onSubmitted={loadProfile} />

                    <AngelsCard>
                        <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                            Identity
                        </p>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <AngelsLabel optional>Display name</AngelsLabel>
                                <AngelsInput value={displayName} onChange={setDisplayName} placeholder={creator.full_name} />
                            </div>
                            <div>
                                <AngelsLabel>Instagram</AngelsLabel>
                                <AngelsInput value={`@${creator.instagram}`} onChange={() => {}} />
                            </div>
                            <div>
                                <AngelsLabel>City</AngelsLabel>
                                <AngelsInput value={city} onChange={setCity} />
                            </div>
                            <div>
                                <AngelsLabel>Country</AngelsLabel>
                                <AngelsInput value={country} onChange={setCountry} />
                            </div>
                            <div className="sm:col-span-2">
                                <AngelsLabel optional>Languages (comma separated)</AngelsLabel>
                                <AngelsInput value={languages} onChange={setLanguages} placeholder="English, Turkish" />
                            </div>
                            <div className="sm:col-span-2">
                                <AngelsLabel optional>Style in one line</AngelsLabel>
                                <AngelsInput value={styleDescription} onChange={setStyleDescription} placeholder="Warm, editorial lifestyle content with a luxury hospitality feel" />
                            </div>
                            <div className="sm:col-span-2">
                                <AngelsLabel optional>Bio</AngelsLabel>
                                <AngelsTextarea value={bio} onChange={setBio} rows={4} />
                            </div>
                        </div>
                    </AngelsCard>

                    <AngelsCard>
                        <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                            Collaboration Preferences
                        </p>
                        <AngelsLabel>Content formats</AngelsLabel>
                        <div className="flex flex-wrap gap-2 mb-5">
                            {CONTENT_FORMATS.map(f => {
                                const on = formats.includes(f);
                                return (
                                    <button key={f} onClick={() => toggle(formats, setFormats, f)}
                                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 cursor-pointer"
                                        style={{
                                            background: on ? A.redSoft : A.bg,
                                            border: `1px solid ${on ? A.redLine : A.border}`,
                                            color: on ? A.redText : A.textSecondary, fontSize: 12.5, fontWeight: 600,
                                        }}>
                                        {on && <Check size={12} />} {CONTENT_FORMAT_LABELS[f]}
                                    </button>
                                );
                            })}
                        </div>
                        <AngelsLabel>Preferred collaboration cities</AngelsLabel>
                        <div className="flex flex-wrap gap-2 mb-5">
                            {SPOTLIGHT_CITIES.map(ct => {
                                const on = cities.includes(ct);
                                return (
                                    <button key={ct} onClick={() => toggle(cities, setCities, ct)}
                                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 cursor-pointer"
                                        style={{
                                            background: on ? A.redSoft : A.bg,
                                            border: `1px solid ${on ? A.redLine : A.border}`,
                                            color: on ? A.redText : A.textSecondary, fontSize: 12.5, fontWeight: 600,
                                        }}>
                                        {on && <Check size={12} />} {ct}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => setTravel(!travel)}
                            className="flex items-center gap-2 cursor-pointer"
                            style={{ background: 'none', border: 'none', padding: 0, color: A.textSecondary, fontSize: 13.5 }}
                        >
                            <span className="inline-flex items-center justify-center rounded"
                                style={{ width: 18, height: 18, background: travel ? A.red : A.bg, border: `1px solid ${travel ? A.red : A.borderStrong}` }}>
                                {travel && <Check size={12} color="#fff" />}
                            </span>
                            Available for travel
                        </button>
                    </AngelsCard>

                    <AngelsCard>
                        <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                            Rates
                        </p>
                        <div className="grid sm:grid-cols-3 gap-4">
                            <div>
                                <AngelsLabel optional>From</AngelsLabel>
                                <AngelsInput value={rateMin} onChange={setRateMin} type="number" placeholder="500" />
                            </div>
                            <div>
                                <AngelsLabel optional>Up to</AngelsLabel>
                                <AngelsInput value={rateMax} onChange={setRateMax} type="number" placeholder="2500" />
                            </div>
                            <div>
                                <AngelsLabel>Currency</AngelsLabel>
                                <select value={currency} onChange={e => setCurrency(e.target.value)}
                                    style={{ background: A.surface, border: `1px solid ${A.border}`, color: A.text, borderRadius: 10, padding: '13px 15px', fontSize: 15, width: '100%', outline: 'none' }}>
                                    {['USD', 'EUR', 'GBP', 'TRY', 'AED'].map(cur => <option key={cur} value={cur}>{cur}</option>)}
                                </select>
                            </div>
                        </div>
                        <p style={{ color: A.textGhost, fontSize: 12.5, marginTop: 10 }}>
                            Venues see "Collaborations from {currency}" — exact pricing is agreed per proposal.
                        </p>
                    </AngelsCard>

                    {error && <p style={{ color: A.redText, fontSize: 14 }}>{error}</p>}
                    {saved && <p style={{ color: '#5BC48F', fontSize: 14 }}>Profile saved.</p>}

                    <div>
                        <AngelsButton loading={busy} onClick={() => void save()}>Save Profile</AngelsButton>
                    </div>
                </div>
            )}
        </AngelsDashboardShell>
    );
}
