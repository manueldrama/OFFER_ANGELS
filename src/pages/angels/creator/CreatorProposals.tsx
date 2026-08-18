// /angels/creator/proposals — gönderilen teklifler.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { A } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsTable, AngelsTr, AngelsTd,
    AngelsChip, AngelsEmpty, PROPOSAL_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { useAngelsAuth } from '../../../components/angels/AngelsAuthProvider';
import { AngelsPortalCreatorService } from '../../../services/angels/angelsPortalCreatorService';
import { formatMoney, type PlatformProposal } from '../../../types/angelsPlatform';

export default function CreatorProposals() {
    const navigate = useNavigate();
    const location = useLocation();
    const { activeCreatorId } = useAngelsAuth();
    const [proposals, setProposals] = useState<PlatformProposal[]>([]);
    const [loading, setLoading] = useState(true);
    const justSent = (location.state as any)?.justSent;

    useEffect(() => {
        if (!activeCreatorId) return;
        AngelsPortalCreatorService.listProposals(activeCreatorId)
            .then(r => setProposals(r.proposals))
            .finally(() => setLoading(false));
    }, [activeCreatorId]);

    return (
        <AngelsDashboardShell area="creator">
            <AngelsPageHeader
                eyebrow="Creator Dashboard"
                title="Proposals"
                description="Your proposals and the venue's responses."
            />

            {justSent && (
                <div className="rounded-xl px-4 py-3.5 mb-6"
                    style={{ background: 'rgba(52,199,123,0.08)', border: '1px solid rgba(52,199,123,0.25)' }}>
                    <p style={{ color: '#5BC48F', fontSize: 14, fontWeight: 600 }}>Your proposal has been sent to the venue.</p>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : proposals.length === 0 ? (
                <AngelsEmpty
                    icon={FileText}
                    title="No proposals yet"
                    hint="Open a collaboration request and send your first proposal."
                />
            ) : (
                <AngelsTable headers={['Project', 'Venue', 'You receive', 'Status', 'Valid until']}>
                    {proposals.map(p => (
                        <AngelsTr key={p.id} onClick={() => p.request && navigate(`/creator/requests/${p.request_id}`)}>
                            <AngelsTd><span style={{ color: A.text, fontWeight: 600 }}>{p.request?.project_title ?? '—'}</span></AngelsTd>
                            <AngelsTd>{(p.request as any)?.venue?.name ?? '—'}</AngelsTd>
                            <AngelsTd align="right">
                                <span style={{ color: '#5BC48F', fontWeight: 700 }}>{formatMoney(p.creator_payout, p.currency)}</span>
                            </AngelsTd>
                            <AngelsTd>
                                <AngelsChip tone={PROPOSAL_STATUS_CHIP[p.status]?.tone}>
                                    {PROPOSAL_STATUS_CHIP[p.status]?.label ?? p.status}
                                </AngelsChip>
                            </AngelsTd>
                            <AngelsTd>
                                {p.valid_until ? new Date(p.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                            </AngelsTd>
                        </AngelsTr>
                    ))}
                </AngelsTable>
            )}
        </AngelsDashboardShell>
    );
}
