// /angels/venue/requests/new/:creatorId — işbirliği talep formu (tek sayfa,
// bölümlü). Gönderim: admin_review (ayar açıksa) veya doğrudan creator'a.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { A, AngelsButton } from '../../../components/angels/AngelsShell';
import { AngelsLabel, AngelsInput, AngelsTextarea } from '../../../components/angels/AngelsForm';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsCard,
} from '../../../components/angels/dashboard/AngelsDashboard';
import {
    AngelsPortalVenueService, type DirectoryCreator,
} from '../../../services/angels/angelsPortalVenueService';
import {
    CAMPAIGN_TYPES, CONTENT_FORMATS, CONTENT_FORMAT_LABELS,
} from '../../../types/angelsPlatform';

const selectStyle: React.CSSProperties = {
    background: A.surface, border: `1px solid ${A.border}`, color: A.text,
    borderRadius: 10, padding: '13px 15px', fontSize: 15, width: '100%', outline: 'none',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <p style={{
            color: A.textMuted, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14,
        }}>
            {children}
        </p>
    );
}

export default function VenueRequestNew() {
    const { creatorId } = useParams<{ creatorId: string }>();
    const navigate = useNavigate();
    const [creator, setCreator] = useState<DirectoryCreator | null>(null);

    const [title, setTitle] = useState('');
    const [campaignType, setCampaignType] = useState('venue_visit');
    const [deliverables, setDeliverables] = useState<string[]>([]);
    const [brief, setBrief] = useState('');
    const [usageRights, setUsageRights] = useState('');
    const [budgetMin, setBudgetMin] = useState('');
    const [budgetMax, setBudgetMax] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [travelCovered, setTravelCovered] = useState(false);
    const [accommodationCovered, setAccommodationCovered] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (creatorId) {
            AngelsPortalVenueService.getDirectoryCreator(creatorId).then(setCreator);
        }
    }, [creatorId]);

    function toggleDeliverable(d: string) {
        setDeliverables(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
    }

    async function submit() {
        if (busy) return;
        setError(null);
        if (!title.trim()) { setError('Please give your project a title.'); return; }
        if (!deliverables.length) { setError('Select at least one deliverable.'); return; }
        setBusy(true);
        try {
            await AngelsPortalVenueService.submitRequest({
                creator_id: creatorId,
                project_title: title.trim(),
                campaign_type: campaignType,
                deliverables,
                brief: brief.trim() || null,
                usage_rights: usageRights.trim() || null,
                budget_min: budgetMin ? Number(budgetMin) : null,
                budget_max: budgetMax ? Number(budgetMax) : null,
                currency,
                travel_covered: travelCovered,
                accommodation_covered: accommodationCovered,
                proposed_start_date: startDate || null,
                proposed_end_date: endDate || null,
            });
            navigate('/venue/requests', { state: { justSent: true } });
        } catch (e: any) {
            setError(e?.message || 'Failed to send the request. Please try again.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <AngelsDashboardShell area="venue">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 mb-6 cursor-pointer"
                style={{ color: A.textMuted, fontSize: 13.5, background: 'none', border: 'none', padding: 0 }}
            >
                <ArrowLeft size={15} /> Back
            </button>

            <AngelsPageHeader
                eyebrow="New Collaboration"
                title={creator ? `Request ${creator.display_name}` : 'Request Collaboration'}
                description="Share your project details. The CAFEPASTE Angels team reviews every request before it reaches the creator."
            />

            <div className="max-w-[720px] flex flex-col gap-5">
                <AngelsCard>
                    <SectionTitle>Project</SectionTitle>
                    <div className="flex flex-col gap-4">
                        <div>
                            <AngelsLabel>Project title</AngelsLabel>
                            <AngelsInput value={title} onChange={setTitle} placeholder="e.g. Summer terrace opening with signature drinks" />
                        </div>
                        <div>
                            <AngelsLabel>Campaign type</AngelsLabel>
                            <select value={campaignType} onChange={e => setCampaignType(e.target.value)} style={selectStyle}>
                                {CAMPAIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <AngelsLabel optional>Project brief</AngelsLabel>
                            <AngelsTextarea
                                value={brief}
                                onChange={setBrief}
                                rows={4}
                                placeholder="Describe your venue, the drink concept, the atmosphere and what you'd love the creator to capture…"
                            />
                        </div>
                    </div>
                </AngelsCard>

                <AngelsCard>
                    <SectionTitle>Deliverables</SectionTitle>
                    <div className="flex flex-wrap gap-2.5">
                        {CONTENT_FORMATS.map(f => {
                            const on = deliverables.includes(f);
                            return (
                                <button
                                    key={f}
                                    onClick={() => toggleDeliverable(f)}
                                    className="flex items-center gap-1.5 rounded-full px-3.5 py-2 cursor-pointer transition-colors"
                                    style={{
                                        background: on ? A.redSoft : A.bg,
                                        border: `1px solid ${on ? A.redLine : A.border}`,
                                        color: on ? A.redText : A.textSecondary,
                                        fontSize: 13, fontWeight: 600,
                                    }}
                                >
                                    {on && <Check size={13} />}
                                    {CONTENT_FORMAT_LABELS[f]}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-5">
                        <AngelsLabel optional>Usage rights</AngelsLabel>
                        <AngelsInput
                            value={usageRights}
                            onChange={setUsageRights}
                            placeholder="e.g. Organic social use for 6 months"
                        />
                    </div>
                </AngelsCard>

                <AngelsCard>
                    <SectionTitle>Budget & Logistics</SectionTitle>
                    <div className="grid sm:grid-cols-3 gap-4 mb-4">
                        <div>
                            <AngelsLabel optional>Budget from</AngelsLabel>
                            <AngelsInput value={budgetMin} onChange={setBudgetMin} type="number" placeholder="500" />
                        </div>
                        <div>
                            <AngelsLabel optional>Budget up to</AngelsLabel>
                            <AngelsInput value={budgetMax} onChange={setBudgetMax} type="number" placeholder="1500" />
                        </div>
                        <div>
                            <AngelsLabel>Currency</AngelsLabel>
                            <select value={currency} onChange={e => setCurrency(e.target.value)} style={selectStyle}>
                                {['USD', 'EUR', 'GBP', 'TRY', 'AED'].map(cur => <option key={cur} value={cur}>{cur}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <AngelsLabel optional>Preferred start</AngelsLabel>
                            <AngelsInput value={startDate} onChange={setStartDate} type="date" />
                        </div>
                        <div>
                            <AngelsLabel optional>Preferred end</AngelsLabel>
                            <AngelsInput value={endDate} onChange={setEndDate} type="date" />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {[
                            { label: 'Travel covered by venue', value: travelCovered, set: setTravelCovered },
                            { label: 'Accommodation covered', value: accommodationCovered, set: setAccommodationCovered },
                        ].map(opt => (
                            <button
                                key={opt.label}
                                onClick={() => opt.set(!opt.value)}
                                className="flex items-center gap-2 cursor-pointer"
                                style={{ background: 'none', border: 'none', padding: 0, color: A.textSecondary, fontSize: 13.5 }}
                            >
                                <span
                                    className="inline-flex items-center justify-center rounded"
                                    style={{
                                        width: 18, height: 18,
                                        background: opt.value ? A.red : A.bg,
                                        border: `1px solid ${opt.value ? A.red : A.borderStrong}`,
                                    }}
                                >
                                    {opt.value && <Check size={12} color="#fff" />}
                                </span>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </AngelsCard>

                {error && <p style={{ color: A.redText, fontSize: 14 }}>{error}</p>}

                <div className="flex flex-col gap-3">
                    <AngelsButton block loading={busy} onClick={() => void submit()}>
                        Send Collaboration Request
                    </AngelsButton>
                    <p style={{ color: A.textGhost, fontSize: 12, lineHeight: 1.7, textAlign: 'center' }}>
                        Please don't share direct contact details in the brief — all communication and payments
                        are handled through CAFEPASTE Angels to protect both sides.
                    </p>
                </div>
            </div>
        </AngelsDashboardShell>
    );
}
