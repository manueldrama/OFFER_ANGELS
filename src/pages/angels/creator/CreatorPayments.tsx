// /angels/creator/payments — payout geçmişi.

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { A } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsTable, AngelsTr, AngelsTd,
    AngelsChip, AngelsEmpty, PAYOUT_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { useAngelsAuth } from '../../../components/angels/AngelsAuthProvider';
import { AngelsPortalCreatorService } from '../../../services/angels/angelsPortalCreatorService';
import { formatMoney } from '../../../types/angelsPlatform';

export default function CreatorPayments() {
    const { activeCreatorId } = useAngelsAuth();
    const [payouts, setPayouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeCreatorId) return;
        AngelsPortalCreatorService.listPayouts(activeCreatorId)
            .then(r => setPayouts(r.payouts))
            .finally(() => setLoading(false));
    }, [activeCreatorId]);

    return (
        <AngelsDashboardShell area="creator">
            <AngelsPageHeader
                eyebrow="Creator Dashboard"
                title="Payouts"
                description="Your earnings from completed collaborations, released by CAFEPASTE Angels."
            />

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : payouts.length === 0 ? (
                <AngelsEmpty
                    icon={Wallet}
                    title="No payouts yet"
                    hint="When a venue's payment is received for your project, your payout will be tracked here."
                />
            ) : (
                <AngelsTable headers={['Project', 'Amount', 'Status', 'Sent']}>
                    {payouts.map(po => (
                        <AngelsTr key={po.id}>
                            <AngelsTd><span style={{ color: A.text, fontWeight: 600 }}>{po.project?.title ?? '—'}</span></AngelsTd>
                            <AngelsTd align="right">
                                <span style={{ color: '#5BC48F', fontWeight: 700 }}>{formatMoney(po.amount, po.currency)}</span>
                            </AngelsTd>
                            <AngelsTd>
                                <AngelsChip tone={PAYOUT_STATUS_CHIP[po.payout_status as keyof typeof PAYOUT_STATUS_CHIP]?.tone}>
                                    {PAYOUT_STATUS_CHIP[po.payout_status as keyof typeof PAYOUT_STATUS_CHIP]?.label ?? po.payout_status}
                                </AngelsChip>
                            </AngelsTd>
                            <AngelsTd>{po.sent_at ? new Date(po.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</AngelsTd>
                        </AngelsTr>
                    ))}
                </AngelsTable>
            )}
        </AngelsDashboardShell>
    );
}
