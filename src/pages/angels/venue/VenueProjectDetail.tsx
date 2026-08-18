// /angels/venue/projects/:id — proje detayı: timeline, ödeme durumu,
// içerik linkleri, ödeme sonrası açılan creator iletişim kartı, notlar.

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Mail, Camera, Phone, ExternalLink } from 'lucide-react';
import { A } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsCard, AngelsChip, PROJECT_STATUS_CHIP, PAYMENT_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { ProjectTimeline } from '../../../components/angels/dashboard/ProjectTimeline';
import { NotesThread } from '../../../components/angels/dashboard/NotesThread';
import { AngelsPortalVenueService } from '../../../services/angels/angelsPortalVenueService';
import {
    creatorDisplayName, formatMoney, CONTENT_FORMAT_LABELS, type ContentFormat,
} from '../../../types/angelsPlatform';

type Detail = Awaited<ReturnType<typeof AngelsPortalVenueService.getProject>>;
type Contacts = Awaited<ReturnType<typeof AngelsPortalVenueService.getProjectContacts>>['contacts'];

const CONTACT_UNLOCKED = ['payment_received', 'confirmed', 'scheduled', 'in_progress', 'content_submitted', 'under_review', 'completed'];

export default function VenueProjectDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [data, setData] = useState<Detail | null>(null);
    const [contacts, setContacts] = useState<Contacts | null>(null);
    const [loading, setLoading] = useState(true);
    const justAccepted = (location.state as any)?.justAccepted;

    const load = useCallback(() => {
        if (!id) return;
        AngelsPortalVenueService.getProject(id)
            .then(d => {
                setData(d);
                if (CONTACT_UNLOCKED.includes(d.project.status)) {
                    AngelsPortalVenueService.getProjectContacts(id)
                        .then(r => setContacts(r.contacts))
                        .catch(() => {});
                }
            })
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const p = data?.project;
    const payment = data?.payment;

    return (
        <AngelsDashboardShell area="venue">
            <button
                onClick={() => navigate('/venue/projects')}
                className="flex items-center gap-2 mb-6 cursor-pointer"
                style={{ color: A.textMuted, fontSize: 13.5, background: 'none', border: 'none', padding: 0 }}
            >
                <ArrowLeft size={15} /> All projects
            </button>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : !p ? (
                <AngelsCard><p style={{ color: A.textSecondary }}>Project not found.</p></AngelsCard>
            ) : (
                <>
                    {justAccepted && (
                        <div
                            className="rounded-xl px-4 py-3.5 mb-6"
                            style={{ background: 'rgba(52,199,123,0.08)', border: '1px solid rgba(52,199,123,0.25)' }}
                        >
                            <p style={{ color: '#5BC48F', fontSize: 14, fontWeight: 600 }}>
                                Proposal accepted — your project is confirmed.
                            </p>
                            <p style={{ color: A.textMuted, fontSize: 13, marginTop: 3 }}>
                                The CAFEPASTE Angels team will contact you shortly with payment details.
                            </p>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mb-6">
                        <h1 style={{ color: A.text, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em' }}>{p.title}</h1>
                        <AngelsChip tone={PROJECT_STATUS_CHIP[p.status]?.tone}>
                            {PROJECT_STATUS_CHIP[p.status]?.label ?? p.status}
                        </AngelsChip>
                    </div>

                    <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
                        <div className="flex flex-col gap-5">
                            {/* Ödeme banner'ı */}
                            {payment && (
                                <AngelsCard padding="p-5">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <p style={{ color: A.textGhost, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                                                Project Payment
                                            </p>
                                            <p style={{ color: A.text, fontSize: 24, fontWeight: 700 }}>
                                                {formatMoney(payment.amount, payment.currency)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <AngelsChip tone={PAYMENT_STATUS_CHIP[payment.payment_status as keyof typeof PAYMENT_STATUS_CHIP]?.tone}>
                                                {PAYMENT_STATUS_CHIP[payment.payment_status as keyof typeof PAYMENT_STATUS_CHIP]?.label ?? payment.payment_status}
                                            </AngelsChip>
                                            {payment.invoice_url && (
                                                <a
                                                    href={payment.invoice_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-1.5"
                                                    style={{ color: A.redText, fontSize: 13, fontWeight: 600 }}
                                                >
                                                    Invoice <ExternalLink size={13} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    {payment.payment_status === 'pending' && (
                                        <p style={{ color: A.textMuted, fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
                                            The CAFEPASTE Angels team will share payment instructions with you directly.
                                            Your project is confirmed once the payment is received.
                                        </p>
                                    )}
                                </AngelsCard>
                            )}

                            {/* Deliverables + içerik */}
                            <AngelsCard padding="p-5">
                                <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                                    Deliverables
                                </p>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {(Array.isArray(p.deliverables) ? p.deliverables : []).map((d: any, i: number) => (
                                        <AngelsChip key={i} tone="neutral">
                                            {d.quantity && d.quantity > 1 ? `${d.quantity}× ` : ''}
                                            {CONTENT_FORMAT_LABELS[d.type as ContentFormat] ?? d.type}
                                        </AngelsChip>
                                    ))}
                                </div>

                                {(p.content_links?.length ?? 0) > 0 && (
                                    <div className="mt-4">
                                        <p style={{ color: A.textGhost, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                            Submitted Content
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            {p.content_links.map((l, i) => (
                                                <a
                                                    key={i}
                                                    href={l.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2"
                                                    style={{ color: A.redText, fontSize: 13.5, fontWeight: 600 }}
                                                >
                                                    <ExternalLink size={13} /> {l.label || l.url}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </AngelsCard>

                            {/* Creator iletişim — ödeme sonrası */}
                            <AngelsCard padding="p-5">
                                <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                                    Creator Contact
                                </p>
                                {contacts ? (
                                    <div className="flex flex-col gap-2.5">
                                        <p style={{ color: A.text, fontSize: 15, fontWeight: 700 }}>
                                            {contacts.display_name || contacts.full_name}
                                        </p>
                                        <a href={`mailto:${contacts.email}`} className="flex items-center gap-2" style={{ color: A.textSecondary, fontSize: 13.5 }}>
                                            <Mail size={14} style={{ color: A.redText }} /> {contacts.email}
                                        </a>
                                        {contacts.whatsapp && (
                                            <p className="flex items-center gap-2" style={{ color: A.textSecondary, fontSize: 13.5 }}>
                                                <Phone size={14} style={{ color: A.redText }} /> {contacts.whatsapp}
                                            </p>
                                        )}
                                        <a
                                            href={`https://instagram.com/${contacts.instagram}`}
                                            target="_blank" rel="noreferrer"
                                            className="flex items-center gap-2"
                                            style={{ color: A.textSecondary, fontSize: 13.5 }}
                                        >
                                            <Camera size={14} style={{ color: A.redText }} /> @{contacts.instagram}
                                        </a>
                                    </div>
                                ) : (
                                    <p className="flex items-center gap-2" style={{ color: A.textGhost, fontSize: 13.5, lineHeight: 1.6 }}>
                                        <Lock size={14} />
                                        Contact details unlock after payment is received — until then, use the notes below.
                                    </p>
                                )}
                            </AngelsCard>

                            <NotesThread
                                notes={data?.notes ?? []}
                                onSend={async body => {
                                    await AngelsPortalVenueService.addNote('project', p.id, body);
                                    load();
                                }}
                            />
                        </div>

                        {/* Sağ — timeline */}
                        <AngelsCard padding="p-5">
                            <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                                Project Status
                            </p>
                            <ProjectTimeline status={p.status} />
                            <p style={{ color: A.textGhost, fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                                Creator: <span style={{ color: A.textSecondary }}>{creatorDisplayName(p.creator)}</span>
                            </p>
                        </AngelsCard>
                    </div>
                </>
            )}
        </AngelsDashboardShell>
    );
}
