// /angels/venue/payments — venue ödeme geçmişi (venue-safe kolonlar).

import { useEffect, useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import { A } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsTable, AngelsTr, AngelsTd,
    AngelsChip, AngelsEmpty, PAYMENT_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { AngelsPortalVenueService } from '../../../services/angels/angelsPortalVenueService';
import { formatMoney } from '../../../types/angelsPlatform';

export default function VenuePayments() {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        AngelsPortalVenueService.listPayments()
            .then(r => setPayments(r.payments))
            .finally(() => setLoading(false));
    }, []);

    return (
        <AngelsDashboardShell area="venue">
            <AngelsPageHeader
                eyebrow="Collaboration Desk"
                title="Payments"
                description="All project payments are processed through CAFEPASTE Angels."
            />

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : payments.length === 0 ? (
                <AngelsEmpty
                    icon={CreditCard}
                    title="No payments yet"
                    hint="When you accept a proposal, the project payment will be tracked here."
                />
            ) : (
                <AngelsTable headers={['Project', 'Amount', 'Status', 'Paid', 'Invoice']}>
                    {payments.map(pay => (
                        <AngelsTr key={pay.id}>
                            <AngelsTd><span style={{ color: A.text, fontWeight: 600 }}>{pay.project?.title ?? '—'}</span></AngelsTd>
                            <AngelsTd align="right">
                                <span style={{ color: A.text, fontWeight: 700 }}>{formatMoney(pay.amount, pay.currency)}</span>
                            </AngelsTd>
                            <AngelsTd>
                                <AngelsChip tone={PAYMENT_STATUS_CHIP[pay.payment_status as keyof typeof PAYMENT_STATUS_CHIP]?.tone}>
                                    {PAYMENT_STATUS_CHIP[pay.payment_status as keyof typeof PAYMENT_STATUS_CHIP]?.label ?? pay.payment_status}
                                </AngelsChip>
                            </AngelsTd>
                            <AngelsTd>{pay.paid_at ? new Date(pay.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</AngelsTd>
                            <AngelsTd>
                                {pay.invoice_url ? (
                                    <a href={pay.invoice_url} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1.5"
                                        style={{ color: A.redText, fontWeight: 600 }}>
                                        View <ExternalLink size={13} />
                                    </a>
                                ) : '—'}
                            </AngelsTd>
                        </AngelsTr>
                    ))}
                </AngelsTable>
            )}
        </AngelsDashboardShell>
    );
}
