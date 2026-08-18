// /venues/angels/request/:creatorId?t=<token> — collaboration request form a
// venue/brand partner submits for a specific approved creator.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { AngelsShell, AngelsButton, AngelsEyebrow, A } from '../../components/angels/AngelsShell';
import { Field, AngelsInput, AngelsTextarea } from '../../components/angels/AngelsForm';
import { useVenueToken, withToken } from '../../components/angels/useVenueToken';
import { AngelsService } from '../../services/angels/angelsService';
import { ANGEL_REQUEST_TYPES } from '../../types/angels';
import type { AngelCreator } from '../../types/angels';
import { useAngelsContent } from '../../hooks/useAngelsContent';
import { applyAngelsTemplate } from '../../utils/angelsTemplate';

export default function VenuesAngelsRequest() {
    const { creatorId = '' } = useParams();
    const navigate = useNavigate();
    const { state, venue, token } = useVenueToken();
    const { getSection } = useAngelsContent('venue_request');
    const intro = getSection('intro')?.config ?? {};
    const disclaimer = getSection('disclaimer')?.config ?? {};
    const successCopy = getSection('success_copy')?.config ?? {};
    const gateCopy = getSection('gate_copy')?.config ?? {};

    const [creator, setCreator] = useState<AngelCreator | null>(null);
    const [venueName, setVenueName] = useState('');
    const [requestType, setRequestType] = useState<string>(ANGEL_REQUEST_TYPES[0]);
    const [proposedDate, setProposedDate] = useState('');
    const [message, setMessage] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (state !== 'ok') return;
        if (venue?.name) setVenueName(venue.name);
        let active = true;
        (async () => {
            try {
                const c = await AngelsService.getPublishedCreatorById(creatorId);
                if (active) setCreator(c);
            } catch (e) {
                console.error('[angels] request creator load failed', e);
            }
        })();
        return () => {
            active = false;
        };
    }, [state, creatorId, venue]);

    async function handleSubmit() {
        if (!venueName.trim()) {
            setError(disclaimer.error_venue_name || 'Please enter your venue or brand name.');
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            await AngelsService.submitCollaborationRequest({
                creator_id: creatorId,
                venue_id: venue?.id ?? null,
                venue_name: venueName.trim(),
                request_type: requestType,
                proposed_date: proposedDate || undefined,
                message: message.trim() || undefined,
            });
            setDone(true);
        } catch (e: any) {
            console.error('[angels] request submit failed', e);
            setError(disclaimer.error_generic || 'Something went wrong. Please try again.');
            setSubmitting(false);
        }
    }

    if (state === 'loading') {
        return (
            <AngelsShell>
                <div className="flex items-center gap-2" style={{ color: A.textMuted }}>
                    <Loader2 size={18} className="animate-spin" /> Loading…
                </div>
            </AngelsShell>
        );
    }

    if (state === 'invalid') {
        return (
            <AngelsShell>
                <div className="text-center">
                    <h1 className="font-bold" style={{ fontSize: 22, marginBottom: 10 }}>
                        {gateCopy.title || 'Private access'}
                    </h1>
                    <p style={{ color: A.textSecondary, maxWidth: 420 }}>
                        {gateCopy.body || 'Please use the private link shared by the CAFEPASTE team.'}
                    </p>
                </div>
            </AngelsShell>
        );
    }

    if (done) {
        return (
            <AngelsShell maxWidth={540} wordmarkSize="md">
                <div className="text-center flex flex-col items-center">
                    <span
                        className="inline-flex items-center justify-center mb-6"
                        style={{ width: 60, height: 60, borderRadius: 9999, background: A.redSoft, color: A.red }}
                    >
                        <CheckCircle2 size={30} />
                    </span>
                    <h1 className="font-bold" style={{ fontSize: 24, letterSpacing: '-0.02em' }}>
                        {successCopy.title || 'Request sent'}
                    </h1>
                    <p style={{ color: A.textSecondary, marginTop: 12, lineHeight: 1.6, maxWidth: 420 }}>
                        {applyAngelsTemplate(
                            successCopy.body || 'Thank you. The CAFEPASTE team will review your request for {{creator}} and coordinate the introduction.',
                            { creator: creator?.full_name || 'the creator' },
                        )}
                    </p>
                    <div className="mt-7">
                        <AngelsButton onClick={() => navigate(withToken('/venues/angels', token))}>
                            {successCopy.back_label || 'Back to directory'}
                        </AngelsButton>
                    </div>
                </div>
            </AngelsShell>
        );
    }

    return (
        <AngelsShell maxWidth={560} wordmarkSize="sm">
            <button
                onClick={() => navigate(withToken(`/venues/angels/creators/${creatorId}`, token))}
                className="self-start inline-flex items-center gap-1.5 mb-6"
                style={{ color: A.textMuted, fontSize: 14, cursor: 'pointer' }}
            >
                <ArrowLeft size={15} /> {disclaimer.back_label || 'Back'}
            </button>

            <div className="text-center mb-8">
                <AngelsEyebrow>{intro.eyebrow || 'Collaboration request'}</AngelsEyebrow>
                <h1 className="font-bold" style={{ fontSize: 'clamp(1.4rem, 5vw, 1.9rem)', letterSpacing: '-0.02em' }}>
                    {creator
                        ? applyAngelsTemplate(intro.title_with_creator || 'Invite {{creator}}', { creator: creator.full_name })
                        : intro.title_fallback || 'Request a collaboration'}
                </h1>
                <p style={{ color: A.textSecondary, marginTop: 10, fontSize: 15 }}>
                    {intro.subtitle || 'Share a few details and our team will coordinate the introduction.'}
                </p>
            </div>

            {error && (
                <div
                    className="w-full mb-5"
                    style={{ background: A.redSoft, border: `1px solid ${A.red}`, borderRadius: 12, padding: '11px 15px', color: '#fff', fontSize: 14 }}
                >
                    {error}
                </div>
            )}

            <div className="w-full flex flex-col gap-5">
                <Field label="Venue / brand name">
                    <AngelsInput value={venueName} onChange={setVenueName} placeholder="Your venue or brand" />
                </Field>

                <Field label="Request type">
                    <select
                        value={requestType}
                        onChange={e => setRequestType(e.target.value)}
                        style={{
                            background: A.surface,
                            border: `1px solid ${A.border}`,
                            color: A.text,
                            borderRadius: 10,
                            padding: '13px 15px',
                            fontSize: 15,
                            width: '100%',
                            outline: 'none',
                        }}
                    >
                        {ANGEL_REQUEST_TYPES.map(t => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field label="Proposed date" optional>
                    <AngelsInput value={proposedDate} onChange={setProposedDate} type="date" />
                </Field>

                <Field label="Message" optional>
                    <AngelsTextarea
                        value={message}
                        onChange={setMessage}
                        placeholder="Tell the creator about the collaboration you have in mind…"
                        rows={4}
                    />
                </Field>

                <div className="flex flex-col items-center gap-3 pt-1">
                    <AngelsButton block loading={submitting} onClick={handleSubmit}>
                        {disclaimer.submit_label || 'Send Request'}
                    </AngelsButton>
                    <p style={{ color: A.textGhost, fontSize: 12.5, textAlign: 'center' }}>
                        {disclaimer.text || 'The CAFEPASTE team manages every collaboration personally.'}
                    </p>
                </div>
            </div>
        </AngelsShell>
    );
}
