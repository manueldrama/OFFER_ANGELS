// /angels/venue — venue kokpiti: açık talepler, bekleyen teklifler, aktif
// projeler, bekleyen ödemeler + son talepler.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, FileText, FolderCheck, CreditCard, Search } from 'lucide-react';
import { A, AngelsButton } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsStatCard, AngelsTable, AngelsTr,
    AngelsTd, AngelsChip, AngelsEmpty, REQUEST_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { AngelsPortalVenueService } from '../../../services/angels/angelsPortalVenueService';
import { creatorDisplayName } from '../../../types/angelsPlatform';

export default function VenueHome() {
    const navigate = useNavigate();
    const [data, setData] = useState<Awaited<ReturnType<typeof AngelsPortalVenueService.getOverview>> | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        AngelsPortalVenueService.getOverview()
            .then(setData)
            .catch(e => setError(e?.message || 'Failed to load.'));
    }, []);

    return (
        <AngelsDashboardShell area="venue">
            <AngelsPageHeader
                eyebrow="Collaboration Desk"
                title={data?.venue?.name ? `Welcome, ${data.venue.name}` : 'Welcome'}
                description="Your private desk for working with selected creators — managed by CAFEPASTE Angels."
                action={<AngelsButton onClick={() => navigate('/venue/discover')}>Discover Creators</AngelsButton>}
            />

            {error && <p style={{ color: A.redText, fontSize: 14, marginBottom: 16 }}>{error}</p>}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <AngelsStatCard label="Open Requests" value={data?.openRequests ?? '—'} icon={MessageSquare} />
                <AngelsStatCard label="Proposals to Review" value={data?.proposalsAwaiting ?? '—'} icon={FileText} />
                <AngelsStatCard label="Active Projects" value={data?.activeProjects ?? '—'} icon={FolderCheck} />
                <AngelsStatCard label="Payments Pending" value={data?.paymentsPending ?? '—'} icon={CreditCard} />
            </div>

            <p style={{
                color: A.textMuted, fontSize: 11.5, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12,
            }}>
                Recent Requests
            </p>

            {data && data.recentRequests.length === 0 ? (
                <AngelsEmpty
                    icon={Search}
                    title="No collaboration requests yet"
                    hint="Browse the curated creator network and send your first collaboration request."
                    action={<AngelsButton onClick={() => navigate('/venue/discover')}>Discover Creators</AngelsButton>}
                />
            ) : (
                <AngelsTable headers={['Project', 'Creator', 'Status', 'Date']}>
                    {(data?.recentRequests ?? []).map(r => (
                        <AngelsTr key={r.id} onClick={() => navigate(`/venue/requests/${r.id}`)}>
                            <AngelsTd><span style={{ color: A.text, fontWeight: 600 }}>{r.project_title}</span></AngelsTd>
                            <AngelsTd>{creatorDisplayName(r.creator)}</AngelsTd>
                            <AngelsTd>
                                <AngelsChip tone={REQUEST_STATUS_CHIP[r.status]?.tone}>
                                    {REQUEST_STATUS_CHIP[r.status]?.label ?? r.status}
                                </AngelsChip>
                            </AngelsTd>
                            <AngelsTd>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</AngelsTd>
                        </AngelsTr>
                    ))}
                </AngelsTable>
            )}
        </AngelsDashboardShell>
    );
}
