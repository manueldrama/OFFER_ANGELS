// /angels/creator/projects/:id — proje detayı: timeline, içerik gönderimi,
// payout durumu, ödeme sonrası açılan venue iletişim kartı, notlar.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Mail, Phone, Plus, Trash2, ExternalLink } from 'lucide-react';
import { A, AngelsButton } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsCard, AngelsChip, PROJECT_STATUS_CHIP, PAYOUT_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { ProjectTimeline } from '../../../components/angels/dashboard/ProjectTimeline';
import { NotesThread } from '../../../components/angels/dashboard/NotesThread';
import { useAngelsAuth } from '../../../components/angels/AngelsAuthProvider';
import { AngelsPortalCreatorService } from '../../../services/angels/angelsPortalCreatorService';
import { formatMoney } from '../../../types/angelsPlatform';

type Detail = Awaited<ReturnType<typeof AngelsPortalCreatorService.getProject>>;

const CONTACT_UNLOCKED = ['payment_received', 'confirmed', 'scheduled', 'in_progress', 'content_submitted', 'under_review', 'completed'];
const CONTENT_OPEN = ['payment_received', 'confirmed', 'scheduled', 'in_progress'];

export default function CreatorProjectDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { activeCreatorId } = useAngelsAuth();
    const [data, setData] = useState<Detail | null>(null);
    const [contacts, setContacts] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [links, setLinks] = useState<{ url: string; label: string }[]>([{ url: '', label: '' }]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        if (!id || !activeCreatorId) return;
        AngelsPortalCreatorService.getProject(activeCreatorId, id)
            .then(d => {
                setData(d);
                if (CONTACT_UNLOCKED.includes(d.project.status)) {
                    AngelsPortalCreatorService.getProjectContacts(activeCreatorId, id)
                        .then(r => setContacts(r.contacts))
                        .catch(() => {});
                }
            })
            .finally(() => setLoading(false));
    }, [id, activeCreatorId]);

    useEffect(() => { load(); }, [load]);

    async function submitContent() {
        if (!id || !activeCreatorId || busy) return;
        const clean = links.filter(l => l.url.trim());
        if (!clean.length) { setError('Add at least one content link.'); return; }
        setBusy(true);
        setError(null);
        try {
            await AngelsPortalCreatorService.submitContent(activeCreatorId, id, clean);
            setLinks([{ url: '', label: '' }]);
            load();
        } catch (e: any) {
            setError(e?.message || 'Failed to submit content.');
        } finally {
            setBusy(false);
        }
    }

    const p = data?.project;
    const payout = data?.payout;

    return (
        <AngelsDashboardShell area="creator">
            <button
                onClick={() => navigate('/creator/projects')}
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
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                        <h1 style={{ color: A.text, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em' }}>{p.title}</h1>
                        <AngelsChip tone={PROJECT_STATUS_CHIP[p.status]?.tone}>
                            {PROJECT_STATUS_CHIP[p.status]?.label ?? p.status}
                        </AngelsChip>
                    </div>

                    <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
                        <div className="flex flex-col gap-5">
                            {/* Payout kartı */}
                            {payout && (
                                <AngelsCard padding="p-5">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <p style={{ color: A.textGhost, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                                                Your Payout
                                            </p>
                                            <p style={{ color: '#5BC48F', fontSize: 24, fontWeight: 700 }}>
                                                {formatMoney(payout.amount, payout.currency)}
                                            </p>
                                        </div>
                                        <AngelsChip tone={PAYOUT_STATUS_CHIP[payout.payout_status as keyof typeof PAYOUT_STATUS_CHIP]?.tone}>
                                            {PAYOUT_STATUS_CHIP[payout.payout_status as keyof typeof PAYOUT_STATUS_CHIP]?.label ?? payout.payout_status}
                                        </AngelsChip>
                                    </div>
                                    <p style={{ color: A.textGhost, fontSize: 12.5, marginTop: 10, lineHeight: 1.6 }}>
                                        Payouts are released by the CAFEPASTE Angels team after the project is completed.
                                    </p>
                                </AngelsCard>
                            )}

                            {/* İçerik gönderimi */}
                            <AngelsCard>
                                <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
                                    Content Delivery
                                </p>

                                {(p.content_links?.length ?? 0) > 0 && (
                                    <div className="flex flex-col gap-2 mb-4">
                                        {p.content_links.map((l, i) => (
                                            <a key={i} href={l.url} target="_blank" rel="noreferrer"
                                                className="flex items-center gap-2"
                                                style={{ color: A.redText, fontSize: 13.5, fontWeight: 600 }}>
                                                <ExternalLink size={13} /> {l.label || l.url}
                                            </a>
                                        ))}
                                    </div>
                                )}

                                {CONTENT_OPEN.includes(p.status) || p.status === 'content_submitted' ? (
                                    <>
                                        <div className="flex flex-col gap-2.5 mb-4">
                                            {links.map((l, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <input
                                                        value={l.url}
                                                        onChange={e => setLinks(ls => ls.map((x, xi) => xi === i ? { ...x, url: e.target.value } : x))}
                                                        placeholder="https://instagram.com/p/…"
                                                        className="flex-1 rounded-lg px-3.5"
                                                        style={{ background: A.bg, border: `1px solid ${A.border}`, color: A.text, fontSize: 13.5, height: 42, outline: 'none' }}
                                                    />
                                                    <input
                                                        value={l.label}
                                                        onChange={e => setLinks(ls => ls.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x))}
                                                        placeholder="Label (Reel, Story…)"
                                                        className="w-[140px] rounded-lg px-3"
                                                        style={{ background: A.bg, border: `1px solid ${A.border}`, color: A.text, fontSize: 13.5, height: 42, outline: 'none' }}
                                                    />
                                                    {links.length > 1 && (
                                                        <button
                                                            onClick={() => setLinks(ls => ls.filter((_, xi) => xi !== i))}
                                                            className="px-2.5 rounded-lg cursor-pointer"
                                                            style={{ color: A.textMuted, background: 'none', border: `1px solid ${A.border}` }}
                                                        ><Trash2 size={14} /></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                onClick={() => setLinks(ls => [...ls, { url: '', label: '' }])}
                                                className="flex items-center gap-1.5 cursor-pointer"
                                                style={{ color: A.textMuted, fontSize: 13, background: 'none', border: 'none', padding: 0 }}
                                            ><Plus size={14} /> Add another link</button>
                                        </div>
                                        <div className="mt-4">
                                            <AngelsButton loading={busy} onClick={() => void submitContent()}>
                                                Submit Content
                                            </AngelsButton>
                                        </div>
                                    </>
                                ) : (
                                    <p style={{ color: A.textGhost, fontSize: 13, lineHeight: 1.6 }}>
                                        {p.status === 'payment_pending'
                                            ? 'Content delivery opens once the venue payment is received.'
                                            : 'Content delivery is closed for this project.'}
                                    </p>
                                )}
                                {error && <p style={{ color: A.redText, fontSize: 13.5, marginTop: 10 }}>{error}</p>}
                            </AngelsCard>

                            {/* Venue iletişim */}
                            <AngelsCard padding="p-5">
                                <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                                    Venue Contact
                                </p>
                                {contacts ? (
                                    <div className="flex flex-col gap-2.5">
                                        <p style={{ color: A.text, fontSize: 15, fontWeight: 700 }}>{contacts.name}</p>
                                        {contacts.contact_person && (
                                            <p style={{ color: A.textSecondary, fontSize: 13.5 }}>{contacts.contact_person}</p>
                                        )}
                                        {contacts.email && (
                                            <a href={`mailto:${contacts.email}`} className="flex items-center gap-2" style={{ color: A.textSecondary, fontSize: 13.5 }}>
                                                <Mail size={14} style={{ color: A.redText }} /> {contacts.email}
                                            </a>
                                        )}
                                        {contacts.phone && (
                                            <p className="flex items-center gap-2" style={{ color: A.textSecondary, fontSize: 13.5 }}>
                                                <Phone size={14} style={{ color: A.redText }} /> {contacts.phone}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="flex items-center gap-2" style={{ color: A.textGhost, fontSize: 13.5, lineHeight: 1.6 }}>
                                        <Lock size={14} />
                                        Venue contact unlocks once the project is confirmed — until then, use the notes below.
                                    </p>
                                )}
                            </AngelsCard>

                            <NotesThread
                                notes={data?.notes ?? []}
                                onSend={async body => {
                                    if (!activeCreatorId) return;
                                    await AngelsPortalCreatorService.addNote(activeCreatorId, 'project', p.id, body);
                                    load();
                                }}
                            />
                        </div>

                        <AngelsCard padding="p-5">
                            <p style={{ color: A.textMuted, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                                Project Status
                            </p>
                            <ProjectTimeline status={p.status} />
                        </AngelsCard>
                    </div>
                </>
            )}
        </AngelsDashboardShell>
    );
}
