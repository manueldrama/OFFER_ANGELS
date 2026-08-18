// /angels/venue/requests — talepler + teklif durumları listesi.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { A, AngelsButton } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsTable, AngelsTr, AngelsTd,
    AngelsChip, AngelsEmpty, REQUEST_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { AngelsPortalVenueService } from '../../../services/angels/angelsPortalVenueService';
import { creatorDisplayName, CAMPAIGN_TYPES, type PlatformRequest } from '../../../types/angelsPlatform';

export default function VenueRequests() {
    const navigate = useNavigate();
    const location = useLocation();
    const [requests, setRequests] = useState<PlatformRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const justSent = (location.state as any)?.justSent;

    useEffect(() => {
        AngelsPortalVenueService.listRequests()
            .then(r => setRequests(r.requests))
            .finally(() => setLoading(false));
    }, []);

    return (
        <AngelsDashboardShell area="venue">
            <AngelsPageHeader
                eyebrow="Collaboration Desk"
                title="Requests & Proposals"
                description="Every request is reviewed by the CAFEPASTE Angels team before reaching the creator."
            />

            {justSent && (
                <div
                    className="rounded-xl px-4 py-3.5 mb-6"
                    style={{ background: 'rgba(52,199,123,0.08)', border: '1px solid rgba(52,199,123,0.25)' }}
                >
                    <p style={{ color: '#5BC48F', fontSize: 14, fontWeight: 600 }}>
                        Your collaboration request has been sent.
                    </p>
                    <p style={{ color: A.textMuted, fontSize: 13, marginTop: 3 }}>
                        The Angels team will review it and forward it to the creator. You'll see the proposal here.
                    </p>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : requests.length === 0 ? (
                <AngelsEmpty
                    icon={MessageSquare}
                    title="No requests yet"
                    hint="Discover creators and send your first collaboration request."
                    action={<AngelsButton onClick={() => navigate('/venue/discover')}>Discover Creators</AngelsButton>}
                />
            ) : (
                <AngelsTable headers={['Project', 'Creator', 'Campaign', 'Status', 'Date']}>
                    {requests.map(r => (
                        <AngelsTr key={r.id} onClick={() => navigate(`/venue/requests/${r.id}`)}>
                            <AngelsTd><span style={{ color: A.text, fontWeight: 600 }}>{r.project_title}</span></AngelsTd>
                            <AngelsTd>{creatorDisplayName(r.creator)}</AngelsTd>
                            <AngelsTd>{CAMPAIGN_TYPES.find(t => t.value === r.campaign_type)?.label ?? r.campaign_type}</AngelsTd>
                            <AngelsTd>
                                <AngelsChip tone={REQUEST_STATUS_CHIP[r.status]?.tone}>
                                    {REQUEST_STATUS_CHIP[r.status]?.label ?? r.status}
                                </AngelsChip>
                            </AngelsTd>
                            <AngelsTd>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</AngelsTd>
                        </AngelsTr>
                    ))}
                </AngelsTable>
            )}
        </AngelsDashboardShell>
    );
}
