// /angels/creator/spotlight — Angels Spotlight: durum + metrikler + satın alma
// sihirbazı (paket → şehirler → venue tipleri → özet + disclaimer → talep).
// MVP ödeme: manuel placeholder — "our team will contact you to complete payment".
// Dil sakin ve premium: asla "guaranteed jobs" / "ad campaign" ifadeleri yok.

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Check, Eye, MousePointerClick, MessageSquare, CalendarClock } from 'lucide-react';
import { A, AngelsButton, AngelsGhostButton } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsCard, AngelsChip,
    AngelsStatCard, PROMOTION_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { useAngelsAuth } from '../../../components/angels/AngelsAuthProvider';
import { AngelsPortalCreatorService } from '../../../services/angels/angelsPortalCreatorService';
import {
    SPOTLIGHT_CITIES, VENUE_TYPES, formatMoney,
    type SpotlightPackage, type CreatorPromotion,
} from '../../../types/angelsPlatform';

const ELIGIBILITY_MESSAGES: Record<string, string> = {
    profile_not_published: 'Your profile is not published yet.',
    profile_not_active: 'Your profile is currently paused.',
    profile_hidden: 'Your profile is hidden from venue discovery.',
    not_spotlight_eligible: 'Spotlight eligibility is granted by the Angels team.',
    profile_incomplete: 'Complete your profile (photo, bio and at least 3 portfolio images).',
};

export default function CreatorSpotlight() {
    const { activeCreatorId } = useAngelsAuth();
    const [packages, setPackages] = useState<SpotlightPackage[]>([]);
    const [promotions, setPromotions] = useState<CreatorPromotion[]>([]);
    const [eligible, setEligible] = useState(false);
    const [reasons, setReasons] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Sihirbaz
    const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0 = kapalı
    const [pkg, setPkg] = useState<SpotlightPackage | null>(null);
    const [cities, setCities] = useState<string[]>([]);
    const [types, setTypes] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [requested, setRequested] = useState(false);

    function reload() {
        if (!activeCreatorId) return;
        AngelsPortalCreatorService.getSpotlight(activeCreatorId)
            .then(r => {
                setPackages(r.packages);
                setPromotions(r.promotions);
                setEligible(r.eligible);
                setReasons(r.reasons);
            })
            .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(reload, [activeCreatorId]);

    const active = useMemo(
        () => promotions.find(p => p.promotion_status === 'active'),
        [promotions]);
    const pendingPromo = useMemo(
        () => promotions.find(p => ['pending_payment', 'paid', 'pending_admin_review', 'scheduled'].includes(p.promotion_status)),
        [promotions]);

    const daysRemaining = active?.ends_at
        ? Math.max(0, Math.ceil((new Date(active.ends_at).getTime() - Date.now()) / 86400000))
        : null;

    function toggle(arr: string[], set: (v: string[]) => void, v: string, max: number) {
        if (arr.includes(v)) { set(arr.filter(x => x !== v)); return; }
        if (arr.length >= max) return;
        set([...arr, v]);
    }

    async function purchase() {
        if (!activeCreatorId || !pkg || busy) return;
        setBusy(true);
        setError(null);
        try {
            await AngelsPortalCreatorService.purchaseSpotlight(activeCreatorId, {
                package_id: pkg.id,
                target_cities: cities,
                target_venue_types: types,
            });
            setRequested(true);
            setStep(0);
            reload();
        } catch (e: any) {
            setError(e?.message || 'Failed to submit your Spotlight request.');
        } finally {
            setBusy(false);
        }
    }

    const chipBtn = (on: boolean): React.CSSProperties => ({
        background: on ? A.redSoft : A.bg,
        border: `1px solid ${on ? A.redLine : A.border}`,
        color: on ? A.redText : A.textSecondary,
        fontSize: 13, fontWeight: 600,
    });

    return (
        <AngelsDashboardShell area="creator">
            <AngelsPageHeader
                eyebrow="Priority Visibility"
                title="Angels Spotlight"
                description="A premium visibility feature for approved creators — appear more prominently to approved venues, hotels and luxury brands."
            />

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : (
                <div className="flex flex-col gap-6 max-w-[860px]">
                    {requested && (
                        <div className="rounded-xl px-4 py-3.5"
                            style={{ background: 'rgba(52,199,123,0.08)', border: '1px solid rgba(52,199,123,0.25)' }}>
                            <p style={{ color: '#5BC48F', fontSize: 14, fontWeight: 600 }}>
                                Your Spotlight request has been received.
                            </p>
                            <p style={{ color: A.textMuted, fontSize: 13, marginTop: 3 }}>
                                The CAFEPASTE Angels team will contact you to complete the payment and activate your placement.
                            </p>
                        </div>
                    )}

                    {/* Aktif promosyon + metrikler */}
                    {active && (
                        <AngelsCard>
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                                <div className="flex items-center gap-2.5">
                                    <Sparkles size={17} style={{ color: '#D8B65C' }} />
                                    <p style={{ color: A.text, fontSize: 16, fontWeight: 700 }}>
                                        {active.package?.name ?? 'Spotlight'} — Active
                                    </p>
                                </div>
                                <AngelsChip tone="gold">
                                    {daysRemaining != null ? `${daysRemaining} days remaining` : 'Active'}
                                </AngelsChip>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <AngelsStatCard label="Impressions" value={active.impressions} icon={Eye} />
                                <AngelsStatCard label="Profile Views" value={active.profile_views} icon={MousePointerClick} />
                                <AngelsStatCard label="Requests" value={active.collaboration_requests} icon={MessageSquare} />
                                <AngelsStatCard label="Days Left" value={daysRemaining ?? '—'} icon={CalendarClock} />
                            </div>
                            <p style={{ color: A.textGhost, fontSize: 12.5, marginTop: 14 }}>
                                Targeting: {active.target_cities.join(', ')} · {active.target_venue_types.map(t => VENUE_TYPES.find(v => v.value === t)?.label ?? t).join(', ')}
                            </p>
                        </AngelsCard>
                    )}

                    {pendingPromo && !active && (
                        <AngelsCard padding="p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p style={{ color: A.text, fontSize: 14.5, fontWeight: 600 }}>
                                    {pendingPromo.package?.name ?? 'Spotlight'} — {formatMoney(pendingPromo.price, pendingPromo.currency)}
                                </p>
                                <AngelsChip tone={PROMOTION_STATUS_CHIP[pendingPromo.promotion_status]?.tone}>
                                    {PROMOTION_STATUS_CHIP[pendingPromo.promotion_status]?.label}
                                </AngelsChip>
                            </div>
                            <p style={{ color: A.textMuted, fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
                                {pendingPromo.promotion_status === 'pending_payment'
                                    ? 'The Angels team will contact you to complete the payment.'
                                    : 'Your placement is being reviewed by the Angels team.'}
                            </p>
                        </AngelsCard>
                    )}

                    {/* Uygunluk / paketler */}
                    {!eligible ? (
                        <AngelsCard>
                            <p style={{ color: A.text, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                                Your profile is not currently eligible for Angels Spotlight.
                            </p>
                            <ul className="flex flex-col gap-1.5 mb-4">
                                {reasons.map(rs => (
                                    <li key={rs} style={{ color: A.textMuted, fontSize: 13.5 }}>
                                        · {ELIGIBILITY_MESSAGES[rs] ?? rs}
                                    </li>
                                ))}
                            </ul>
                            <p style={{ color: A.textGhost, fontSize: 13, lineHeight: 1.6 }}>
                                Complete your profile or contact the CAFEPASTE Angels team for review.
                            </p>
                        </AngelsCard>
                    ) : step === 0 ? (
                        <>
                            <p style={{
                                color: A.textMuted, fontSize: 11.5, fontWeight: 600,
                                letterSpacing: '0.08em', textTransform: 'uppercase',
                            }}>
                                Spotlight Packages
                            </p>
                            <div className="grid sm:grid-cols-3 gap-4">
                                {packages.map(sp => (
                                    <AngelsCard key={sp.id} padding="p-5">
                                        <p style={{ color: A.text, fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>{sp.name}</p>
                                        <p style={{ color: A.textMuted, fontSize: 12.5, lineHeight: 1.6, marginBottom: 14, minHeight: 40 }}>
                                            {sp.description}
                                        </p>
                                        <p style={{ color: A.text, fontSize: 22, fontWeight: 700, marginBottom: 2 }}>
                                            {formatMoney(sp.price, sp.currency)}
                                        </p>
                                        <p style={{ color: A.textGhost, fontSize: 12, marginBottom: 16 }}>
                                            {sp.duration_days} days · up to {sp.max_cities} {sp.max_cities === 1 ? 'city' : 'cities'}
                                        </p>
                                        <AngelsButton block onClick={() => {
                                            setPkg(sp); setCities([]); setTypes([]); setStep(1); setRequested(false);
                                        }}>
                                            Boost My Visibility
                                        </AngelsButton>
                                    </AngelsCard>
                                ))}
                            </div>
                            <p style={{ color: A.textGhost, fontSize: 12, lineHeight: 1.7 }}>
                                Angels Spotlight increases your profile visibility inside the CAFEPASTE Angels network.
                                It does not guarantee collaboration requests, bookings or paid projects.
                            </p>
                        </>
                    ) : (
                        /* Sihirbaz */
                        <AngelsCard>
                            <div className="flex items-center gap-2 mb-6">
                                {[1, 2, 3].map(s => (
                                    <span key={s} className="h-1 flex-1 rounded-full"
                                        style={{ background: s <= step ? A.red : A.border }} />
                                ))}
                            </div>

                            {step === 1 && pkg && (
                                <>
                                    <p style={{ color: A.text, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                                        Target cities
                                    </p>
                                    <p style={{ color: A.textMuted, fontSize: 13, marginBottom: 16 }}>
                                        {pkg.name} — choose up to {pkg.max_cities} {pkg.max_cities === 1 ? 'city' : 'cities'}.
                                    </p>
                                    <div className="flex flex-wrap gap-2.5 mb-6">
                                        {SPOTLIGHT_CITIES.map(ct => (
                                            <button key={ct}
                                                onClick={() => toggle(cities, setCities, ct, pkg.max_cities)}
                                                className="flex items-center gap-1.5 rounded-full px-4 py-2 cursor-pointer"
                                                style={chipBtn(cities.includes(ct))}>
                                                {cities.includes(ct) && <Check size={13} />} {ct}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-3">
                                        <AngelsButton disabled={!cities.length} onClick={() => setStep(2)}>Continue</AngelsButton>
                                        <AngelsGhostButton onClick={() => setStep(0)}>Cancel</AngelsGhostButton>
                                    </div>
                                </>
                            )}

                            {step === 2 && pkg && (
                                <>
                                    <p style={{ color: A.text, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                                        Venue types
                                    </p>
                                    <p style={{ color: A.textMuted, fontSize: 13, marginBottom: 16 }}>
                                        Choose up to {pkg.max_venue_types} venue {pkg.max_venue_types === 1 ? 'type' : 'types'} to appear for.
                                    </p>
                                    <div className="flex flex-wrap gap-2.5 mb-6">
                                        {VENUE_TYPES.filter(t => !['agency', 'other'].includes(t.value)).map(t => (
                                            <button key={t.value}
                                                onClick={() => toggle(types, setTypes, t.value, pkg.max_venue_types)}
                                                className="flex items-center gap-1.5 rounded-full px-4 py-2 cursor-pointer"
                                                style={chipBtn(types.includes(t.value))}>
                                                {types.includes(t.value) && <Check size={13} />} {t.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-3">
                                        <AngelsButton disabled={!types.length} onClick={() => setStep(3)}>Continue</AngelsButton>
                                        <AngelsGhostButton onClick={() => setStep(1)}>Back</AngelsGhostButton>
                                    </div>
                                </>
                            )}

                            {step === 3 && pkg && (
                                <>
                                    <p style={{ color: A.text, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                                        Review your Spotlight
                                    </p>
                                    <div className="rounded-xl p-5 mb-5" style={{ background: A.bg, border: `1px solid ${A.borderStrong}` }}>
                                        <div className="flex flex-col gap-2.5">
                                            <div className="flex justify-between">
                                                <span style={{ color: A.textMuted, fontSize: 13 }}>Package</span>
                                                <span style={{ color: A.text, fontSize: 13.5, fontWeight: 600 }}>{pkg.name} · {pkg.duration_days} days</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span style={{ color: A.textMuted, fontSize: 13 }}>Cities</span>
                                                <span style={{ color: A.text, fontSize: 13.5 }}>{cities.join(', ')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span style={{ color: A.textMuted, fontSize: 13 }}>Venue types</span>
                                                <span style={{ color: A.text, fontSize: 13.5 }}>
                                                    {types.map(t => VENUE_TYPES.find(v => v.value === t)?.label ?? t).join(', ')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between pt-2.5" style={{ borderTop: `1px solid ${A.border}` }}>
                                                <span style={{ color: A.text, fontSize: 14, fontWeight: 700 }}>Total</span>
                                                <span style={{ color: A.text, fontSize: 17, fontWeight: 700 }}>{formatMoney(pkg.price, pkg.currency)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p style={{ color: A.textGhost, fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>
                                        Angels Spotlight increases your profile visibility inside the CAFEPASTE Angels network.
                                        It does not guarantee collaboration requests, bookings or paid projects.
                                        After your request, the Angels team will contact you to complete the payment;
                                        your placement goes live after review.
                                    </p>
                                    {error && <p style={{ color: A.redText, fontSize: 13.5, marginBottom: 12 }}>{error}</p>}
                                    <div className="flex gap-3">
                                        <AngelsButton loading={busy} onClick={() => void purchase()}>
                                            Request Spotlight
                                        </AngelsButton>
                                        <AngelsGhostButton onClick={() => setStep(2)}>Back</AngelsGhostButton>
                                    </div>
                                </>
                            )}
                        </AngelsCard>
                    )}

                    {/* Geçmiş */}
                    {promotions.filter(p => ['completed', 'rejected', 'refunded'].includes(p.promotion_status)).length > 0 && (
                        <AngelsCard padding="p-5">
                            <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                                Past Promotions
                            </p>
                            <div className="flex flex-col gap-2">
                                {promotions.filter(p => ['completed', 'rejected', 'refunded'].includes(p.promotion_status)).map(p => (
                                    <div key={p.id} className="flex items-center justify-between">
                                        <span style={{ color: A.textSecondary, fontSize: 13.5 }}>
                                            {p.package?.name ?? 'Spotlight'} · {formatMoney(p.price, p.currency)}
                                        </span>
                                        <AngelsChip tone={PROMOTION_STATUS_CHIP[p.promotion_status]?.tone}>
                                            {PROMOTION_STATUS_CHIP[p.promotion_status]?.label}
                                        </AngelsChip>
                                    </div>
                                ))}
                            </div>
                        </AngelsCard>
                    )}
                </div>
            )}
        </AngelsDashboardShell>
    );
}
