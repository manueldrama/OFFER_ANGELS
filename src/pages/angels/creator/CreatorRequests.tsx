// /angels/creator/requests — gelen işbirliği talepleri.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { A } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsTable, AngelsTr, AngelsTd,
    AngelsChip, AngelsEmpty, REQUEST_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { useAngelsAuth } from '../../../components/angels/AngelsAuthProvider';
import { AngelsPortalCreatorService } from '../../../services/angels/angelsPortalCreatorService';
import { CAMPAIGN_TYPES, formatMoney, type PlatformRequest } from '../../../types/angelsPlatform';

export default function CreatorRequests() {
    const navigate = useNavigate();
    const { activeCreatorId } = useAngelsAuth();
    const [requests, setRequests] = useState<PlatformRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeCreatorId) return;
        AngelsPortalCreatorService.listRequests(activeCreatorId)
            .then(r => setRequests(r.requests))
            .finally(() => setLoading(false));
    }, [activeCreatorId]);

    return (
        <AngelsDashboardShell area="creator">
            <AngelsPageHeader
                eyebrow="Creator Dashboard"
                title="Collaboration Requests"
                description="Requests from approved venues, screened by the CAFEPASTE Angels team."
            />

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : requests.length === 0 ? (
                <AngelsEmpty
                    icon={Inbox}
                    title="No requests yet"
                    hint="Requests from venues appear here after the Angels team screens them."
                />
            ) : (
                <AngelsTable headers={['Project', 'Venue', 'Campaign', 'Budget', 'Status', 'Date']}>
                    {requests.map(r => (
                        <AngelsTr key={r.id} onClick={() => navigate(`/creator/requests/${r.id}`)}>
                            <AngelsTd><span style={{ color: A.text, fontWeight: 600 }}>{r.project_title}</span></AngelsTd>
                            <AngelsTd>{r.venue?.name ?? '—'}</AngelsTd>
                            <AngelsTd>{CAMPAIGN_TYPES.find(t => t.value === r.campaign_type)?.label ?? r.campaign_type}</AngelsTd>
                            <AngelsTd>
                                {r.budget_min || r.budget_max
                                    ? `${formatMoney(r.budget_min, r.currency)}–${formatMoney(r.budget_max, r.currency)}`
                                    : 'Open'}
                            </AngelsTd>
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
