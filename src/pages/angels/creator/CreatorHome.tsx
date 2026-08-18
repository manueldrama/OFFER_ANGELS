// /angels/creator — creator kokpiti: yeni talepler, açık teklifler, aktif
// projeler, bekleyen payout + profil/Spotlight durumu.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, FileText, FolderCheck, Wallet, Sparkles } from 'lucide-react';
import { A, AngelsGhostButton } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsStatCard, AngelsTable, AngelsTr,
    AngelsTd, AngelsChip, AngelsEmpty, AngelsCard, REQUEST_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { useAngelsAuth } from '../../../components/angels/AngelsAuthProvider';
import { AngelsPortalCreatorService } from '../../../services/angels/angelsPortalCreatorService';
import { creatorDisplayName, formatMoney, CAMPAIGN_TYPES } from '../../../types/angelsPlatform';

export default function CreatorHome() {
    const navigate = useNavigate();
    const { activeCreatorId } = useAngelsAuth();
    const [data, setData] = useState<Awaited<ReturnType<typeof AngelsPortalCreatorService.getOverview>> | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!activeCreatorId) return;
        AngelsPortalCreatorService.getOverview(activeCreatorId)
            .then(setData)
            .catch(e => setError(e?.message || 'Failed to load.'));
    }, [activeCreatorId]);

    const profile = data?.profile;
    const isLive = profile?.status === 'published' && profile?.is_visible_to_venues && profile?.network_status === 'active';
    const completeness = profile
        ? [profile.profile_image, profile.bio, (profile.gallery_images?.length ?? 0) >= 3, profile.rate_min != null]
            .filter(Boolean).length / 4
        : 0;

    return (
        <AngelsDashboardShell area="creator">
            <AngelsPageHeader
                eyebrow="Creator Dashboard"
                title={profile ? `Welcome, ${creatorDisplayName(profile)}` : 'Welcome'}
                description="Your private space inside the CAFEPASTE Angels network."
            />

            {error && <p style={{ color: A.redText, fontSize: 14, marginBottom: 16 }}>{error}</p>}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <AngelsStatCard label="New Requests" value={data?.newRequests ?? '—'} icon={Inbox} />
                <AngelsStatCard label="Open Proposals" value={data?.openProposals ?? '—'} icon={FileText} />
                <AngelsStatCard label="Active Projects" value={data?.activeProjects ?? '—'} icon={FolderCheck} />
                <AngelsStatCard
                    label="Pending Payout"
                    value={data ? formatMoney(data.pendingPayoutTotal, data.pendingPayoutCurrency) : '—'}
                    icon={Wallet}
                />
            </div>

            {/* Durum kartları */}
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
                <AngelsCard padding="p-5">
                    <div className="flex items-center justify-between mb-2">
                        <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            Profile Visibility
                        </p>
                        <AngelsChip tone={isLive ? 'success' : 'warning'}>
                            {isLive ? 'Visible to venues' : 'Not visible yet'}
                        </AngelsChip>
                    </div>
                    <p style={{ color: A.textSecondary, fontSize: 13.5, lineHeight: 1.6 }}>
                        {isLive
                            ? 'Approved venues can discover your profile and send collaboration requests.'
                            : 'Your profile is being curated by the CAFEPASTE Angels team.'}
                    </p>
                    {completeness < 1 && (
                        <p style={{ color: A.textGhost, fontSize: 12.5, marginTop: 8 }}>
                            Profile completeness: {Math.round(completeness * 100)}% — complete it to maximise discovery.
                        </p>
                    )}
                </AngelsCard>

                <AngelsCard padding="p-5">
                    <div className="flex items-center justify-between mb-2">
                        <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            Angels Spotlight
                        </p>
                        {data?.activePromotion
                            ? <AngelsChip tone="gold">Active</AngelsChip>
                            : <AngelsChip tone="neutral">Not active</AngelsChip>}
                    </div>
                    <p style={{ color: A.textSecondary, fontSize: 13.5, lineHeight: 1.6, marginBottom: 12 }}>
                        {data?.activePromotion
                            ? `Your Spotlight placement is live${data.activePromotion.ends_at ? ` until ${new Date(data.activePromotion.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}.`
                            : 'Increase your visibility to approved venues with a Spotlight placement.'}
                    </p>
                    <AngelsGhostButton onClick={() => navigate('/creator/spotlight')}>
                        <Sparkles size={15} /> {data?.activePromotion ? 'View Spotlight' : 'Explore Spotlight'}
                    </AngelsGhostButton>
                </AngelsCard>
            </div>

            <p style={{
                color: A.textMuted, fontSize: 11.5, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12,
            }}>
                Latest Requests
            </p>

            {data && data.recentRequests.length === 0 ? (
                <AngelsEmpty
                    icon={Inbox}
                    title="No collaboration requests yet"
                    hint="When an approved venue requests a collaboration with you, it will appear here."
                />
            ) : (
                <AngelsTable headers={['Project', 'Venue', 'Campaign', 'Status']}>
                    {(data?.recentRequests ?? []).map(r => (
                        <AngelsTr key={r.id} onClick={() => navigate(`/creator/requests/${r.id}`)}>
                            <AngelsTd><span style={{ color: A.text, fontWeight: 600 }}>{r.project_title}</span></AngelsTd>
                            <AngelsTd>{r.venue?.name ?? '—'}</AngelsTd>
                            <AngelsTd>{CAMPAIGN_TYPES.find(t => t.value === r.campaign_type)?.label ?? r.campaign_type}</AngelsTd>
                            <AngelsTd>
                                <AngelsChip tone={REQUEST_STATUS_CHIP[r.status]?.tone}>
                                    {REQUEST_STATUS_CHIP[r.status]?.label ?? r.status}
                                </AngelsChip>
                            </AngelsTd>
                        </AngelsTr>
                    ))}
                </AngelsTable>
            )}
        </AngelsDashboardShell>
    );
}
