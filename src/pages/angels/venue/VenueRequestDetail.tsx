// /angels/venue/requests/:id — talep detayı + teklif inceleme paneli.
// Teklifte venue YALNIZ toplam tutarı görür (creator payı/platform payı asla).
// Aksiyonlar: Accept Proposal (kırmızı ana CTA) / Request Changes / Decline.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check } from 'lucide-react';
import { A, AngelsButton, AngelsGhostButton } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsCard, AngelsChip,
    REQUEST_STATUS_CHIP, PROPOSAL_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { NotesThread } from '../../../components/angels/dashboard/NotesThread';
import { AngelsPortalVenueService } from '../../../services/angels/angelsPortalVenueService';
import {
    creatorDisplayName, formatMoney, CAMPAIGN_TYPES,
    CONTENT_FORMAT_LABELS, type ContentFormat,
} from '../../../types/angelsPlatform';

type Detail = Awaited<ReturnType<typeof AngelsPortalVenueService.getRequest>>;

export default function VenueRequestDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<Detail | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [noteMode, setNoteMode] = useState<null | 'revision' | 'decline'>(null);
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        if (!id) return;
        AngelsPortalVenueService.getRequest(id)
            .then(setData)
            .catch(e => setError(e?.message || 'Failed to load.'))
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const activeProposal = data?.proposals.find(p => ['sent', 'viewed', 'revision_requested'].includes(p.status))
        ?? data?.proposals[0];

    async function respond(action: 'accept' | 'decline' | 'revision') {
        if (!activeProposal || busy) return;
        if ((action === 'revision' || action === 'decline') && !note.trim()) {
            setError('Please add a short note explaining your decision.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const res = await AngelsPortalVenueService.respondProposal(activeProposal.id, action, note.trim() || undefined);
            if (action === 'accept' && res.project_id) {
                navigate(`/venue/projects/${res.project_id}`, { state: { justAccepted: true } });
                return;
            }
            setNoteMode(null);
            setNote('');
            load();
        } catch (e: any) {
            setError(e?.message || 'Action failed. Please try again.');
        } finally {
            setBusy(false);
        }
    }

    const r = data?.request;

    return (
        <AngelsDashboardShell area="venue">
            <button
                onClick={() => navigate('/venue/requests')}
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
                    {/* Sol — talep + teklif */}
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
                                {creatorDisplayName(r.creator)} · {CAMPAIGN_TYPES.find(t => t.value === r.campaign_type)?.label}
                            </p>
                        </div>

                        <AngelsCard padding="p-5">
                            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                                <div>
                                    <p style={{ color: A.textGhost, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Deliverables</p>
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
                                            : 'Open'}
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
                                {r.usage_rights && (
                                    <div>
                                        <p style={{ color: A.textGhost, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Usage Rights</p>
                                        <p style={{ color: A.textSecondary, fontSize: 14 }}>{r.usage_rights}</p>
                                    </div>
                                )}
                            </div>
                            {r.brief && (
                                <p style={{ color: A.textSecondary, fontSize: 14, lineHeight: 1.75, marginTop: 16, whiteSpace: 'pre-wrap' }}>
                                    {r.brief}
                                </p>
                            )}
                        </AngelsCard>

                        {/* Teklif paneli */}
                        {activeProposal && (
                            <AngelsCard>
                                <div className="flex items-center justify-between mb-4">
                                    <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                        Proposal
                                    </p>
                                    <AngelsChip tone={PROPOSAL_STATUS_CHIP[activeProposal.status as keyof typeof PROPOSAL_STATUS_CHIP]?.tone}>
                                        {PROPOSAL_STATUS_CHIP[activeProposal.status as keyof typeof PROPOSAL_STATUS_CHIP]?.label ?? activeProposal.status}
                                    </AngelsChip>
                                </div>

                                <div
                                    className="rounded-xl p-5 mb-4"
                                    style={{ background: A.bg, border: `1px solid ${A.borderStrong}` }}
                                >
                                    <p style={{ color: A.textGhost, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                                        Total Investment
                                    </p>
                                    <p style={{ color: A.text, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>
                                        {formatMoney(activeProposal.total_amount, activeProposal.currency)}
                                    </p>
                                    <p style={{ color: A.textGhost, fontSize: 12, marginTop: 6 }}>
                                        Managed end-to-end by CAFEPASTE Angels — creator fee, coordination and delivery included.
                                        {activeProposal.valid_until && (
                                            <> Valid until {new Date(activeProposal.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.</>
                                        )}
                                    </p>
                                </div>

                                {Array.isArray(activeProposal.deliverables) && activeProposal.deliverables.length > 0 && (
                                    <div className="mb-4">
                                        <p style={{ color: A.textGhost, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Included Deliverables</p>
                                        <div className="flex flex-col gap-1.5">
                                            {activeProposal.deliverables.map((d: any, i: number) => (
                                                <p key={i} className="flex items-center gap-2" style={{ color: A.s2, fontSize: 13.5 }}>
                                                    <Check size={14} style={{ color: A.redText }} />
                                                    {d.quantity && d.quantity > 1 ? `${d.quantity}× ` : ''}
                                                    {CONTENT_FORMAT_LABELS[d.type as ContentFormat] ?? d.type}
                                                    {d.note ? <span style={{ color: A.textGhost }}> — {d.note}</span> : null}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeProposal.available_dates?.length > 0 && (
                                    <p style={{ color: A.textSecondary, fontSize: 13.5, marginBottom: 10 }}>
                                        <span style={{ color: A.textGhost }}>Available dates: </span>
                                        {activeProposal.available_dates.join(', ')}
                                    </p>
                                )}
                                {activeProposal.message && (
                                    <p style={{ color: A.textSecondary, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 14 }}>
                                        {activeProposal.message}
                                    </p>
                                )}

                                {['sent', 'viewed'].includes(activeProposal.status) && (
                                    <>
                                        {noteMode ? (
                                            <div className="flex flex-col gap-3">
                                                <textarea
                                                    value={note}
                                                    onChange={e => setNote(e.target.value)}
                                                    rows={3}
                                                    placeholder={noteMode === 'revision'
                                                        ? 'What would you like to change? (dates, deliverables, budget…)'
                                                        : 'A short reason helps the creator and our team.'}
                                                    className="w-full rounded-lg p-3.5"
                                                    style={{ background: A.bg, border: `1px solid ${A.border}`, color: A.text, fontSize: 14, outline: 'none', resize: 'vertical' }}
                                                />
                                                <div className="flex gap-3">
                                                    <AngelsButton loading={busy} onClick={() => void respond(noteMode)}>
                                                        {noteMode === 'revision' ? 'Send Change Request' : 'Confirm Decline'}
                                                    </AngelsButton>
                                                    <AngelsGhostButton onClick={() => { setNoteMode(null); setNote(''); }}>
                                                        Cancel
                                                    </AngelsGhostButton>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-3">
                                                <AngelsButton loading={busy} onClick={() => void respond('accept')}>
                                                    Accept Proposal
                                                </AngelsButton>
                                                <AngelsGhostButton onClick={() => setNoteMode('revision')}>
                                                    Request Changes
                                                </AngelsGhostButton>
                                                <AngelsGhostButton onClick={() => setNoteMode('decline')}>
                                                    Decline
                                                </AngelsGhostButton>
                                            </div>
                                        )}
                                    </>
                                )}
                                {activeProposal.status === 'revision_requested' && (
                                    <p style={{ color: A.textMuted, fontSize: 13.5 }}>
                                        Your change request was sent — the creator is preparing an updated proposal.
                                    </p>
                                )}
                            </AngelsCard>
                        )}

                        {error && <p style={{ color: A.redText, fontSize: 14 }}>{error}</p>}
                    </div>

                    {/* Sağ — notlar */}
                    <NotesThread
                        notes={data?.notes ?? []}
                        onSend={async body => {
                            await AngelsPortalVenueService.addNote('request', r.id, body);
                            load();
                        }}
                    />
                </div>
            )}
        </AngelsDashboardShell>
    );
}
