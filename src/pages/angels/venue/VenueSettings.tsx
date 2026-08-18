// /angels/venue/settings — venue profil + fatura bilgileri.
// Küratörlük alanları (onay/doğrulama durumu) yalnız görüntülenir.

import { useEffect, useState } from 'react';
import { A, AngelsButton } from '../../../components/angels/AngelsShell';
import { AngelsLabel, AngelsInput } from '../../../components/angels/AngelsForm';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsCard, AngelsChip,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { AngelsPortalVenueService } from '../../../services/angels/angelsPortalVenueService';
import { VENUE_TYPES } from '../../../types/angelsPlatform';

const EDITABLE = [
    'contact_person', 'email', 'phone', 'website', 'instagram',
    'billing_name', 'billing_address', 'billing_email', 'tax_id',
] as const;
type EditableKey = typeof EDITABLE[number];

const FIELD_LABELS: Record<EditableKey, string> = {
    contact_person: 'Contact person',
    email: 'Contact email',
    phone: 'Phone',
    website: 'Website',
    instagram: 'Instagram',
    billing_name: 'Billing name',
    billing_address: 'Billing address',
    billing_email: 'Billing email',
    tax_id: 'Tax number',
};

export default function VenueSettings() {
    const [venue, setVenue] = useState<any | null>(null);
    const [form, setForm] = useState<Record<EditableKey, string>>({} as any);
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        AngelsPortalVenueService.getProfile().then(r => {
            setVenue(r.venue);
            const next = {} as Record<EditableKey, string>;
            for (const k of EDITABLE) next[k] = r.venue?.[k] ?? '';
            setForm(next);
        });
    }, []);

    async function save() {
        if (busy) return;
        setBusy(true);
        setSaved(false);
        setError(null);
        try {
            await AngelsPortalVenueService.updateProfile(form);
            setSaved(true);
        } catch (e: any) {
            setError(e?.message || 'Failed to save.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <AngelsDashboardShell area="venue">
            <AngelsPageHeader
                eyebrow="Collaboration Desk"
                title="Settings"
                description="Your venue profile and billing details."
            />

            {!venue ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : (
                <div className="max-w-[680px] flex flex-col gap-5">
                    <AngelsCard>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <div>
                                <p style={{ color: A.text, fontSize: 18, fontWeight: 700 }}>{venue.name}</p>
                                <p style={{ color: A.textMuted, fontSize: 13, marginTop: 3 }}>
                                    {[VENUE_TYPES.find(t => t.value === venue.venue_type)?.label, venue.city, venue.country]
                                        .filter(Boolean).join(' · ') || '—'}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <AngelsChip tone={venue.account_status === 'active' || venue.account_status === 'approved' ? 'success' : 'warning'}>
                                    {venue.account_status === 'pending_review' ? 'Pending Review' : venue.account_status}
                                </AngelsChip>
                                {venue.verification_status === 'verified' && <AngelsChip tone="gold">Verified</AngelsChip>}
                            </div>
                        </div>
                        <p style={{ color: A.textGhost, fontSize: 12.5, lineHeight: 1.6 }}>
                            Venue name, type and approval status are managed by the CAFEPASTE Angels team.
                        </p>
                    </AngelsCard>

                    <AngelsCard>
                        <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                            Contact
                        </p>
                        <div className="grid sm:grid-cols-2 gap-4">
                            {(['contact_person', 'email', 'phone', 'website', 'instagram'] as EditableKey[]).map(k => (
                                <div key={k} className={k === 'website' ? 'sm:col-span-2' : ''}>
                                    <AngelsLabel>{FIELD_LABELS[k]}</AngelsLabel>
                                    <AngelsInput value={form[k] ?? ''} onChange={v => setForm(f => ({ ...f, [k]: v }))} />
                                </div>
                            ))}
                        </div>
                    </AngelsCard>

                    <AngelsCard>
                        <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                            Billing
                        </p>
                        <div className="grid sm:grid-cols-2 gap-4">
                            {(['billing_name', 'billing_email', 'billing_address', 'tax_id'] as EditableKey[]).map(k => (
                                <div key={k} className={k === 'billing_address' ? 'sm:col-span-2' : ''}>
                                    <AngelsLabel>{FIELD_LABELS[k]}</AngelsLabel>
                                    <AngelsInput value={form[k] ?? ''} onChange={v => setForm(f => ({ ...f, [k]: v }))} />
                                </div>
                            ))}
                        </div>
                    </AngelsCard>

                    {error && <p style={{ color: A.redText, fontSize: 14 }}>{error}</p>}
                    {saved && <p style={{ color: '#5BC48F', fontSize: 14 }}>Saved.</p>}

                    <div>
                        <AngelsButton loading={busy} onClick={() => void save()}>Save Changes</AngelsButton>
                    </div>
                </div>
            )}
        </AngelsDashboardShell>
    );
}
