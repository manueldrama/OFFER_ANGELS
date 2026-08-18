// /angels/creator/requests/:id — talep detayı + teklif composer.
// Composer canlı ücret dökümü gösterir: "Venue pays / CAFEPASTE fee / You receive"
// (matematik SQL angels_compute_fees'te; TS'te ücret hesabı YOK).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Minus, Plus } from 'lucide-react';
import { A, AngelsButton, AngelsGhostButton } from '../../../components/angels/AngelsShell';
import { AngelsLabel, AngelsInput, AngelsTextarea } from '../../../components/angels/AngelsForm';
import {
    AngelsDashboardShell, AngelsCard, AngelsChip, REQUEST_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { NotesThread } from '../../../components/angels/dashboard/NotesThread';
import { useAngelsAuth } from '../../../components/angels/AngelsAuthProvider';
import { AngelsPortalCreatorService } from '../../../services/angels/angelsPortalCreatorService';
import {
    formatMoney, CAMPAIGN_TYPES, CONTENT_FORMAT_LABELS,
    type ContentFormat, type FeePreview,
} from '../../../types/angelsPlatform';

type Detail = Awaited<ReturnType<typeof AngelsPortalCreatorService.getRequest>>;

const OPEN_STATUSES = ['sent_to_creator', 'creator_reviewing', 'revision_requested'];

export default function CreatorRequestDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { activeCreatorId } = useAngelsAuth();
    const [data, setData] = useState<Detail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Composer state
    const [composing, setComposing] = useState(false);
    const [fee, setFee] = useState('');
    const [preview, setPreview] = useState<FeePreview | null>(null);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [dates, setDates] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    // Decline state
    const [declining, setDeclining] = useState(false);
    const [declineReason, setDeclineReason] = useState('');

    const load = useCallback(() => {
        if (!id || !activeCreatorId) return;
        AngelsPortalCreatorService.getRequest(activeCreatorId, id)
            .then(d => {
                setData(d);
                const initial: Record<string, number> = {};
                for (const del of d.request.deliverables) initial[del] = 1;
                setQuantities(q => Object.keys(q).length ? q : initial);
            })
            .catch(e => setError(e?.message || 'Failed to load.'))
            .finally(() => setLoading(false));
    }, [id, activeCreatorId]);

    useEffect(() => { load(); }, [load]);

    // Canlı ücret önizleme (debounce)
    useEffect(() => {
        const value = Number(fee);
        if (!id || !activeCreatorId || !value || value <= 0) { setPreview(null); return; }
        const t = setTimeout(() => {
            AngelsPortalCreatorService.previewFees(activeCreatorId, id, value)
                .then(r => setPreview(r.preview))
                .catch(() => setPreview(null));
        }, 350);
        return () => clearTimeout(t);
    }, [fee, id, activeCreatorId]);

    async function sendProposal() {
        if (!id || !activeCreatorId || busy) return;
        const value = Number(fee);
        if (!value || value <= 0) { setError('Enter your fee to send a proposal.'); return; }
        setBusy(true);
        setError(null);
        try {
            await AngelsPortalCreatorService.sendProposal(activeCreatorId, {
                request_id: id,
                proposed_fee: value,
                deliverables: Object.entries(quantities)
                    .filter(([, qty]) => qty > 0)
                    .map(([type, quantity]) => ({ type, quantity })),
                available_dates: dates.split(',').map(s => s.trim()).filter(Boolean),
                message: message.trim() || undefined,
            });
            navigate('/creator/proposals', { state: { justSent: true } });
        } catch (e: any) {
            setError(e?.message || 'Failed to send the proposal.');
        } finally {
            setBusy(false);
        }
    }

    async function decline() {
        if (!id || !activeCreatorId || busy) return;
        if (!declineReason.trim()) { setError('A short reason is required.'); return; }
        setBusy(true);
        setError(null);
        try {
            await AngelsPortalCreatorService.declineRequest(activeCreatorId, id, declineReason.trim());
            navigate('/creator/requests');
        } catch (e: any) {
            setError(e?.message || 'Failed to decline.');
        } finally {
            setBusy(false);
        }
    }

    const r = data?.request;
    const isOpen = r ? OPEN_STATUSES.includes(r.status) : false;

    return (
        <AngelsDashboardShell area="creator">
            <button
                onClick={() => navigate('/creator/requests')}
                className="flex items-center gap-2 mb-6 cursor-pointer"
                style={{ color: A.textMuted, fontSize: 13.5, background: 'none', border: 'none', padding: 0 }}
            >
                <ArrowLeft size={15} /> All requests
            </button>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : !r ? (
                <AngelsCard><p style={{ color: A.textSecondary }}>Request not found.</p></AngelsCard>
            ) : (
                <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
                    <div className="flex flex-col gap-5">
                        <div>
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h1 style={{ color: A.text, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em' }}>
                                    {r.project_title}
                                </h1>
                                <AngelsChip tone={REQUEST_STATUS_CHIP[r.status]?.tone}>
                                    {REQUEST_STATUS_CHIP[r.status]?.label ?? r.status}
                                </AngelsChip>
                            </div>
                            <p style={{ color: A.textMuted, fontSize: 13.5 }}>
                                {r.venue?.name} · {[r.venue?.city].filter(Boolean).join(', ')} · {CAMPAIGN_TYPES.find(t => t.value === r.campaign_type)?.label}
                            </p>
                        </div>

                        {/* Brief */}
                        <AngelsCard padding="p-5">
                            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mb-2">
                                <div>
                                    <p style={{ color: A.textGhost, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Requested Deliverables</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {r.deliverables.map(d => (
                                            <AngelsChip key={d} tone="neutral">{CONTENT_FORMAT_LABELS[d as ContentFormat] ?? d}</AngelsChip>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p style={{ color: A.textGhost, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Budget Range</p>
                                    <p style={{ color: A.text, fontSize: 14.5, fontWeight: 600 }}>
                                        {r.budget_min || r.budget_max
                                            ? `${formatMoney(r.budget_min, r.currency)} – ${formatMoney(r.budget_max, r.currency)}`
                                            : 'Open budget'}
                                    </p>
                                </div>
                                {(r.proposed_start_date || r.proposed_end_date) && (
                                    <div>
                                        <p style={{ color: A.textGhost, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Preferred Dates</p>
                                        <p className="flex items-center gap-1.5" style={{ color: A.textSecondary, fontSize: 14 }}>
                                            <CalendarDays size={14} />
                                            {[r.proposed_start_date, r.proposed_end_date].filter(Boolean).join(' → ')}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p style={{ color: A.textGhost, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Covered by Venue</p>
                                    <p style={{ color: A.textSecondary, fontSize: 14 }}>
                                        {[r.travel_covered && 'Travel', r.accommodation_covered && 'Accommodation'].filter(Boolean).join(' + ') || '—'}
                                    </p>
                                </div>
                            </div>
                            {r.brief && (
                                <p style={{ color: A.textSecondary, fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-wrap', marginTop: 10 }}>
                                    {r.brief}
                                </p>
                            )}
                        </AngelsCard>

                        {/* Aksiyonlar / composer */}
                        {isOpen && !composing && !declining && (
                            <div className="flex flex-wrap gap-3">
                                <AngelsButton onClick={() => setComposing(true)}>Send Proposal</AngelsButton>
                                <AngelsGhostButton onClick={() => setDeclining(true)}>Decline</AngelsGhostButton>
                            </div>
                        )}

                        {declining && (
                            <AngelsCard padding="p-5">
                                <AngelsLabel>Why are you declining?</AngelsLabel>
                                <AngelsTextarea value={declineReason} onChange={setDeclineReason} rows={3}
                                    placeholder="e.g. Dates don't work for me this season" />
                                <div className="flex gap-3 mt-4">
                                    <AngelsButton loading={busy} onClick={() => void decline()}>Confirm Decline</AngelsButton>
                                    <AngelsGhostButton onClick={() => setDeclining(false)}>Cancel</AngelsGhostButton>
                                </div>
                            </AngelsCard>
                        )}

                        {composing && (
                            <AngelsCard>
                                <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                                    Your Proposal
                                </p>

                                <div className="grid sm:grid-cols-2 gap-4 mb-5">
                                    <div>
                                        <AngelsLabel>Your fee ({r.currency})</AngelsLabel>
                                        <AngelsInput value={fee} onChange={setFee} type="number" placeholder="1000" />
                                    </div>
                                    <div>
                                        <AngelsLabel optional>Available dates (comma separated)</AngelsLabel>
                                        <AngelsInput value={dates} onChange={setDates} placeholder="2026-08-05, 2026-08-12" />
                                    </div>
                                </div>

                                {/* Canlı döküm */}
                                {preview && (
                                    <div
                                        className="rounded-xl p-4 mb-5"
                                        style={{ background: A.bg, border: `1px solid ${A.borderStrong}` }}
                                    >
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between">
                                                <span style={{ color: A.textMuted, fontSize: 13 }}>Venue pays</span>
                                                <span style={{ color: A.text, fontSize: 13.5, fontWeight: 600 }}>
                                                    {formatMoney(preview.total_amount, preview.currency)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span style={{ color: A.textMuted, fontSize: 13 }}>CAFEPASTE Angels fee</span>
                                                <span style={{ color: A.textSecondary, fontSize: 13.5 }}>
                                                    {formatMoney(preview.platform_fee + preview.tax_amount, preview.currency)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${A.border}` }}>
                                                <span style={{ color: A.text, fontSize: 13.5, fontWeight: 700 }}>You receive</span>
                                                <span style={{ color: '#5BC48F', fontSize: 15, fontWeight: 700 }}>
                                                    {formatMoney(preview.creator_payout, preview.currency)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Deliverable adetleri */}
                                <AngelsLabel>Deliverables included</AngelsLabel>
                                <div className="flex flex-col gap-2 mb-5">
                                    {r.deliverables.map(d => (
                                        <div key={d} className="flex items-center justify-between rounded-lg px-3.5 py-2.5"
                                            style={{ background: A.bg, border: `1px solid ${A.border}` }}>
                                            <span style={{ color: A.textSecondary, fontSize: 13.5 }}>
                                                {CONTENT_FORMAT_LABELS[d as ContentFormat] ?? d}
                                            </span>
                                            <div className="flex items-center gap-2.5">
                                                <button
                                                    onClick={() => setQuantities(qs => ({ ...qs, [d]: Math.max(0, (qs[d] ?? 1) - 1) }))}
                                                    className="p-1 rounded cursor-pointer"
                                                    style={{ color: A.textMuted, background: 'none', border: `1px solid ${A.border}` }}
                                                ><Minus size={12} /></button>
                                                <span style={{ color: A.text, fontSize: 14, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>
                                                    {quantities[d] ?? 1}
                                                </span>
                                                <button
                                                    onClick={() => setQuantities(qs => ({ ...qs, [d]: (qs[d] ?? 1) + 1 }))}
                                                    className="p-1 rounded cursor-pointer"
                                                    style={{ color: A.textMuted, background: 'none', border: `1px solid ${A.border}` }}
                                                ><Plus size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <AngelsLabel optional>Message to the venue</AngelsLabel>
                                <AngelsTextarea value={message} onChange={setMessage} rows={3}
                                    placeholder="Share your creative angle, timing notes, or anything that helps the venue decide." />

                                <div className="flex gap-3 mt-5">
                                    <AngelsButton loading={busy} onClick={() => void sendProposal()}>Send Proposal</AngelsButton>
                                    <AngelsGhostButton onClick={() => setComposing(false)}>Cancel</AngelsGhostButton>
                                </div>
                            </AngelsCard>
                        )}

                        {error && <p style={{ color: A.redText, fontSize: 14 }}>{error}</p>}
                    </div>

                    <NotesThread
                        notes={data?.notes ?? []}
                        onSend={async body => {
                            if (!activeCreatorId) return;
                            await AngelsPortalCreatorService.addNote(activeCreatorId, 'request', r.id, body);
                            load();
                        }}
                    />
                </div>
            )}
        </AngelsDashboardShell>
    );
}
