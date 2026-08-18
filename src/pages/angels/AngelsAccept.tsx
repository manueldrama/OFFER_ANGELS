import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ArrowRight, Image as ImageIcon, Camera, Clock, User, ChevronDown, Check } from 'lucide-react';
import { AngelsShell, AngelsButton, AngelsEyebrow, AngelsWordmark, A, FONT_DISPLAY } from '../../components/angels/AngelsShell';
import {
    Field,
    AngelsInput,
    AngelsTextarea,
    ProfileImageUploader,
    GalleryUploader,
} from '../../components/angels/AngelsForm';
import { AngelsService } from '../../services/angels/angelsService';
import type { AngelInvitation, AngelPhotoExample } from '../../types/angels';

export default function AngelsAccept() {
    const { token = '' } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [state, setState] = useState<'loading' | 'invalid' | 'photo_expired' | 'ok'>('loading');
    const [invitation, setInvitation] = useState<AngelInvitation | null>(null);
    const [photoExamples, setPhotoExamples] = useState<AngelPhotoExample[] | null>(null);
    const [view, setView] = useState<'menu' | 'upload' | 'examples' | 'later' | 'representative' | 'success_photos' | 'success_later' | 'success_rep'>('menu');

    // Option 1: Upload Photos
    const [fullName, setFullName] = useState('');
    const [instagram, setInstagram] = useState('');
    const [email, setEmail] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [gallery, setGallery] = useState<string[]>([]);
    const [bio, setBio] = useState('');

    // Option 3: Later
    const [reminderEmail, setReminderEmail] = useState('');

    // Manager
    const [repName, setRepName] = useState('');
    const [repContact, setRepContact] = useState('');
    const [repEmail, setRepEmail] = useState('');
    const [repWhatsapp, setRepWhatsapp] = useState('');
    const [repNotes, setRepNotes] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showNotIdeal, setShowNotIdeal] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const inv = await AngelsService.getInvitationByToken(token);
                if (!active) return;
                
                if (!inv) {
                    setState('invalid');
                    return;
                }

                // Initial populate
                if (inv.creator_name) setFullName(inv.creator_name);
                if (inv.instagram) setInstagram(inv.instagram.replace(/^@/, ''));
                if (inv.email) setEmail(inv.email);
                setReminderEmail(inv.email || '');

                if (inv.status === 'invited' || inv.status === 'opened') {
                    navigate(`/invite/${token}`, { replace: true });
                    return;
                }

                const path = location.pathname;
                const isPhotoExpired = inv.photo_status === 'photos_expired' || (inv.photo_deadline_at && new Date(inv.photo_deadline_at) < new Date());

                if (isPhotoExpired) {
                    if (!path.startsWith('/extension')) {
                        navigate(`/extension/${token}`, { replace: true });
                        return;
                    }
                    setState('photo_expired');
                    setInvitation(inv);
                    return;
                }

                if (inv.photo_status === 'photos_submitted') {
                    if (!path.startsWith('/status')) {
                        navigate(`/status/${token}`, { replace: true });
                        return;
                    }
                    setView('success_photos');
                } else {
                    if (!path.startsWith('/onboarding') && !path.startsWith('/upload') && !path.startsWith('/accept')) {
                        navigate(`/onboarding/${token}`, { replace: true });
                        return;
                    }
                }

                setInvitation(inv);
                setState('ok');

                // Load photo examples in background
                AngelsService.getActivePhotoExamples()
                    .then(res => { if (active) setPhotoExamples(res) })
                    .catch(() => { if (active) setPhotoExamples([]) });
            } catch (e) {
                console.error('[angels] onboarding load failed', e);
                if (active) setState('invalid');
            }
        })();
        return () => {
            active = false;
        };
    }, [token]);

    const handleUploadSubmit = async () => {
        if (!fullName.trim() || !instagram.trim() || !email.trim()) {
            setError('Please complete the required profile fields.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        if (gallery.length < 2) {
            setError('Please upload at least 2 photos.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            await AngelsService.submitPhotos(token, {
                full_name: fullName.trim(),
                instagram: instagram.trim().replace(/^@/, ''),
                email: email.trim(),
                whatsapp: whatsapp.trim() || undefined,
                gallery_images: gallery,
                bio: bio.trim() || undefined,
            });
            setView('success_photos');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e: any) {
            console.error(e);
            setError('Failed to submit your photos. Please try again.');
            setSubmitting(false);
        }
    };

    const handleLaterSubmit = async () => {
        setSubmitting(true);
        try {
            await AngelsService.saveLaterPreference(token, reminderEmail.trim() || undefined);
            setView('success_later');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e: any) {
            console.error(e);
            setSubmitting(false);
        }
    };

    const handleRepSubmit = async () => {
        if (!repName.trim() || !repEmail.trim()) {
            setError('Please provide the agency/manager name and email.');
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            await AngelsService.saveRepresentativeDetails(token, {
                name: repName.trim(),
                contact_person: repContact.trim(),
                email: repEmail.trim(),
                whatsapp: repWhatsapp.trim(),
                notes: repNotes.trim(),
            });
            setView('success_rep');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e: any) {
            console.error(e);
            setError('Failed to submit details. Please try again.');
            setSubmitting(false);
        }
    };

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
                    <h1 className="font-bold" style={{ fontSize: 24, marginBottom: 12 }}>Invitation not found</h1>
                    <p style={{ color: A.textSecondary }}>This private link is invalid. Please contact the CAFEPASTE team.</p>
                </div>
            </AngelsShell>
        );
    }

    if (state === 'photo_expired') {
        const deadline = invitation?.photo_deadline_at 
            ? new Date(invitation.photo_deadline_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) 
            : 'a previous date';
        return (
            <AngelsShell wordmarkSize="md">
                <div className="text-center w-full flex flex-col items-center max-w-[480px] mx-auto">
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] md:text-[11px] font-semibold tracking-[0.12em] uppercase mb-6" style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        PHOTO SUBMISSION WINDOW CLOSED
                    </span>
                    <h1 className="font-bold" style={{ fontFamily: FONT_DISPLAY, fontSize: 32, marginBottom: 16, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                        Your photo submission window has closed.
                    </h1>
                    <p style={{ color: A.text, fontSize: 16, marginBottom: 12, lineHeight: 1.5 }}>
                        Your CAFEPASTE Angels invitation was confirmed, but the first photo submission window ended on {deadline}.
                    </p>
                    <p style={{ color: A.textSecondary, fontSize: 15, lineHeight: 1.6, marginBottom: 40 }}>
                        If you would still like to continue, please request an extension.
                    </p>
                    <div className="flex flex-col gap-3 w-full sm:w-auto min-w-[240px]">
                        <button
                            onClick={() => window.location.href = 'mailto:angels@cafepaste.com?subject=Request Extension'}
                            className="inline-flex items-center justify-center font-semibold px-8 min-h-[52px] transition-all duration-300 w-full"
                            style={{ background: '#FFF', color: '#000', borderRadius: 10, fontSize: 15 }}
                        >
                            Request Extension
                        </button>
                        <button
                            onClick={() => window.location.href = 'mailto:angels@cafepaste.com'}
                            className="inline-flex items-center justify-center font-semibold px-8 min-h-[52px] transition-all duration-300 w-full"
                            style={{ background: 'transparent', color: A.textSecondary, border: `1px solid ${A.borderStrong}`, borderRadius: 10, fontSize: 15 }}
                        >
                            Contact CAFEPASTE Team
                        </button>
                    </div>
                </div>
            </AngelsShell>
        );
    }

    const BackButton = () => (
        <button
            onClick={() => { setView('menu'); setError(null); }}
            className="flex items-center gap-2 mb-6 text-sm transition-colors"
            style={{ color: A.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = A.textMuted}
        >
            <ArrowRight size={16} className="rotate-180" /> Back to options
        </button>
    );

    return (
        <AngelsShell maxWidth={1080} showWordmark={true} wordmarkSize="md" wordmarkGap="mb-7 sm:mb-8" className="px-5 pb-8 sm:pb-10 pt-5 sm:pt-6 w-full flex flex-col items-center">

            {view === 'menu' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-[1080px] mx-auto">
                    <div className="text-center mb-6 sm:mb-7">
                        <div className="flex justify-center mb-4">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${A.borderStrong}`, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                                <Check size={13} style={{ color: A.redText }} strokeWidth={2.5} />
                                <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.02em', color: A.textBright }}>
                                    Invitation Confirmed
                                </span>
                            </div>
                        </div>
                        <h1 className="font-bold" style={{ fontSize: 'clamp(1.5rem, 6vw, 2.05rem)', letterSpacing: '-0.02em', marginBottom: 10 }}>
                            Welcome, {invitation?.creator_name ? invitation.creator_name.split(' ')[0] : 'Creator'}.
                        </h1>

                        <p style={{ color: '#fff', fontSize: 15, marginBottom: 8, fontWeight: 500 }}>
                            Your private CAFEPASTE Angels invitation has already been confirmed.
                        </p>
                        
                        <p style={{ color: A.textSecondary, lineHeight: 1.6, fontSize: 14.5, maxWidth: 500, margin: '0 auto' }}>
                            To prepare your first Angels presentation, please share 2–5 lifestyle photos featuring coffee or cocktail moments.
                        </p>
                        
                        {invitation?.photo_deadline_at && (
                            <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full" style={{ background: 'rgba(196,30,42,0.08)', border: `1px solid rgba(196,30,42,0.15)` }}>
                                <Clock size={14} style={{ color: A.redText }} />
                                <span style={{ color: A.redText, fontSize: 13, fontWeight: 500, letterSpacing: '0.01em' }}>
                                    Please upload your first Angels photos by {new Date(invitation.photo_deadline_at).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-2">
                        <OptionCard 
                            num="01" 
                            title="Upload My Photos" 
                            desc="Upload 2–5 coffee or cocktail lifestyle photos for your first CAFEPASTE Angels presentation." 
                            btnLabel="Upload Photos" 
                            onClick={() => setView('upload')} 
                            variant="primary"
                        />
                        <OptionCard 
                            num="02" 
                            title="I’ll Send Them Later" 
                            desc="Keep your invitation active and receive a reminder before the photo deadline." 
                            btnLabel="Send Later" 
                            onClick={() => setView('later')} 
                            variant="ghost"
                        />
                        <OptionCard 
                            num="03" 
                            title="Handled by Manager / Agency" 
                            desc="Share your representative’s contact details so our team can continue with them." 
                            btnLabel="Add Representative" 
                            onClick={() => setView('representative')} 
                            variant="outline"
                        />
                    </div>
                </div>
            )}

            {view === 'upload' && (
                <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300 max-w-[800px] mx-auto">
                    <BackButton />
                    <div className="mb-6">
                        <h2 className="font-bold" style={{ fontSize: 24, letterSpacing: '-0.02em', marginBottom: 8 }}>Upload My Photos</h2>
                        <p style={{ color: A.textSecondary, fontSize: 15 }}>Upload 2–5 preferred lifestyle photos for your first CAFEPASTE Angels presentation.</p>
                    </div>

                    {error && (
                        <div className="w-full mb-6 p-3 rounded-lg" style={{ background: A.redSoft, border: `1px solid ${A.red}`, color: '#fff', fontSize: 14 }}>
                            {error}
                        </div>
                    )}

                    {/* Compact Style Guide at top of Upload Form */}
                    <div className="w-full flex flex-col gap-3 mb-8 p-5 rounded-[12px]" style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${A.border}` }}>
                        <div>
                            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Photo Style Guide</h3>
                            <p style={{ color: A.textSecondary, fontSize: 13, lineHeight: 1.4, marginBottom: 16 }}>
                                These are the types of images that work best for your first CAFEPASTE Angels presentation.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {['Coffee or Cocktail Moment', 'Elegant Venue', 'Natural Portrait With Drink', 'High Quality', 'Unpublished or Lightly Used'].map(item => (
                                    <span key={item} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${A.borderStrong}`, borderRadius: 999, padding: '4px 10px', fontSize: 12, color: A.s2 }}>
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={() => setShowNotIdeal(!showNotIdeal)}
                            className="flex items-center gap-2 mt-2 text-[12px] font-medium transition-colors w-fit"
                            style={{ color: A.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            Not ideal <ChevronDown size={14} className={`transition-transform ${showNotIdeal ? 'rotate-180' : ''}`} />
                        </button>

                        {showNotIdeal && (
                            <ul className="flex flex-col gap-2 mt-2 pt-3 animate-in fade-in slide-in-from-top-2" style={{ borderTop: `1px solid ${A.border}` }}>
                                {['dark or blurry images', 'low-quality selfies', 'mirror photos', 'heavily edited collages', 'images already overused on public feed'].map(item => (
                                    <li key={item} className="flex items-start gap-2" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                                        <div className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-white/20" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Compact Example Strip */}
                    <div className="w-full mb-10 relative">
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Photo Examples</h3>
                        <p style={{ color: A.textSecondary, fontSize: 13, lineHeight: 1.4, marginBottom: 12 }}>
                            A few quick references for the type of images that work best.
                        </p>
                        
                        <PremiumCarousel examples={photoExamples} />
                    </div>

                    <div className="flex flex-col gap-5 w-full">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Full Name">
                                <AngelsInput value={fullName} onChange={setFullName} placeholder="Your name" />
                            </Field>
                            <Field label="Instagram Username">
                                <AngelsInput value={instagram} onChange={setInstagram} placeholder="username" prefix="@" />
                            </Field>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Email">
                                <AngelsInput value={email} onChange={setEmail} placeholder="you@email.com" type="email" />
                            </Field>
                            <Field label="WhatsApp / Contact Number" optional>
                                <AngelsInput value={whatsapp} onChange={setWhatsapp} placeholder="+90 5xx xxx xx xx" />
                            </Field>
                        </div>
                        <div className="pt-2">
                            <h3 style={{ fontSize: 14, fontWeight: 600, color: A.textSecondary, marginBottom: 4 }}>Upload Photos (Required)</h3>
                            <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>Coffee, cocktail, venue or elegant lifestyle photos work best. (2-5 images)</p>
                            <GalleryUploader images={gallery} onChange={setGallery} max={8} />
                        </div>
                        <Field label="A few words about your style" optional>
                            <AngelsTextarea value={bio} onChange={setBio} placeholder="Your style, the venues you like, and the brands you enjoy working with..." rows={4} />
                        </Field>
                        
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <AngelsButton block loading={submitting} onClick={handleUploadSubmit}>Submit My Photos</AngelsButton>
                            <p style={{ color: A.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: 12 }}>
                                Our team will review your photos and contact you with the next steps.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {view === 'later' && (
                <div className="w-full max-w-[480px] mx-auto text-center animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-start mb-6"><BackButton /></div>
                    <AngelsEyebrow>SAVED FOR LATER</AngelsEyebrow>
                    <h2 className="font-bold" style={{ fontSize: 28, letterSpacing: '-0.02em', marginBottom: 12, lineHeight: 1.1 }}>
                        No problem — we’ll keep your invitation active.
                    </h2>
                    <p style={{ color: A.textSecondary, fontSize: 15, lineHeight: 1.5, marginBottom: 32 }}>
                        Your CAFEPASTE Angels invitation has been confirmed. You can upload your first Angels photos before {invitation?.photo_deadline_at ? new Date(invitation.photo_deadline_at).toLocaleDateString() : 'your deadline'}.
                    </p>
                    
                    <div className="text-left flex flex-col gap-4">
                        <Field label="Best email for reminder" optional>
                            <AngelsInput value={reminderEmail} onChange={setReminderEmail} placeholder="you@email.com" type="email" />
                        </Field>
                        <AngelsButton block loading={submitting} onClick={handleLaterSubmit}>Save for Later</AngelsButton>
                        <p style={{ color: A.textMuted, fontSize: 12.5, textAlign: 'center' }}>
                            We may remind you before your photo submission window closes.
                        </p>
                    </div>
                </div>
            )}

            {view === 'representative' && (
                <div className="w-full max-w-[540px] mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                    <BackButton />
                    <div className="mb-6">
                        <h2 className="font-bold" style={{ fontSize: 24, letterSpacing: '-0.02em', marginBottom: 8 }}>Representative Contact</h2>
                        <p style={{ color: A.textSecondary, fontSize: 15 }}>
                            If your collaborations are handled by a manager, agency or representative, share their contact details and our team will continue with them.
                        </p>
                    </div>

                    {error && <div className="w-full mb-4 p-3 rounded-lg" style={{ background: A.redSoft, border: `1px solid ${A.red}`, color: '#fff', fontSize: 14 }}>{error}</div>}

                    <div className="flex flex-col gap-4">
                        <Field label="Manager / Agency Name">
                            <AngelsInput value={repName} onChange={setRepName} placeholder="Agency or Manager name" />
                        </Field>
                        <Field label="Contact Person" optional>
                            <AngelsInput value={repContact} onChange={setRepContact} placeholder="Specific person's name" />
                        </Field>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Manager Email">
                                <AngelsInput value={repEmail} onChange={setRepEmail} placeholder="manager@agency.com" type="email" />
                            </Field>
                            <Field label="Manager WhatsApp / Contact Number" optional>
                                <AngelsInput value={repWhatsapp} onChange={setRepWhatsapp} placeholder="+90 5xx xxx xx xx" />
                            </Field>
                        </div>
                        <Field label="Notes" optional>
                            <AngelsTextarea value={repNotes} onChange={setRepNotes} placeholder="Any specific notes for our team..." rows={3} />
                        </Field>
                        <div className="mt-2 pt-4 border-t border-white/10">
                            <AngelsButton block loading={submitting} onClick={handleRepSubmit}>Send Representative Details</AngelsButton>
                            <p style={{ color: A.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: 12 }}>
                                Our team will contact your representative regarding your CAFEPASTE Angels profile and first photo submission.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Success States */}
            {view === 'success_photos' && (
                <div className="text-center w-full flex flex-col items-center max-w-[480px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <AngelsEyebrow>PHOTOS RECEIVED</AngelsEyebrow>
                    <h1 className="font-bold" style={{ fontFamily: FONT_DISPLAY, fontSize: 32, marginBottom: 16, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                        Thank you, {fullName.split(' ')[0] || 'Creator'}.
                    </h1>
                    <p style={{ color: A.text, fontSize: 16, marginBottom: 12 }}>Your first CAFEPASTE Angels photos have already been submitted.</p>
                    <p style={{ color: A.textSecondary, fontSize: 15, lineHeight: 1.6, marginBottom: 40 }}>
                        Our team will review your photos and contact you with the next steps.
                    </p>
                    <AngelsButton block onClick={() => window.location.href = '/'}>Return to CAFEPASTE Angels</AngelsButton>
                </div>
            )}

            {view === 'success_later' && (
                <div className="text-center w-full flex flex-col items-center max-w-[480px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <AngelsEyebrow>PREFERENCE SAVED</AngelsEyebrow>
                    <h1 className="font-bold" style={{ fontFamily: FONT_DISPLAY, fontSize: 32, marginBottom: 16, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                        We'll remind you soon.
                    </h1>
                    <p style={{ color: A.textSecondary, fontSize: 15, lineHeight: 1.6, marginBottom: 40 }}>
                        Your invitation remains active until the photo deadline. You can return to this exact link to upload your photos anytime before then.
                    </p>
                    <AngelsButton block onClick={() => window.location.href = '/'}>Return to CAFEPASTE Angels</AngelsButton>
                </div>
            )}

            {view === 'success_rep' && (
                <div className="text-center w-full flex flex-col items-center max-w-[480px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <AngelsEyebrow>DETAILS SENT</AngelsEyebrow>
                    <h1 className="font-bold" style={{ fontFamily: FONT_DISPLAY, fontSize: 32, marginBottom: 16, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                        Thank you.
                    </h1>
                    <p style={{ color: A.textSecondary, fontSize: 15, lineHeight: 1.6, marginBottom: 40 }}>
                        We have received your representative's details. Our team will be in touch with them regarding your Angels profile.
                    </p>
                    <AngelsButton block onClick={() => window.location.href = '/'}>Return to CAFEPASTE Angels</AngelsButton>
                </div>
            )}

        </AngelsShell>
    );
}

function OptionCard({ num, title, desc, btnLabel, onClick, children, variant = 'ghost' }: { num: string, title: string, desc: string, btnLabel: string, onClick: () => void, children?: React.ReactNode, variant?: 'primary' | 'ghost' | 'outline' }) {
    let btnStyle: React.CSSProperties = { padding: '0 20px', fontSize: 14, fontWeight: 600, borderRadius: 10, minHeight: 48 };
    let btnClass = "w-full flex items-center justify-center whitespace-nowrap transition-all duration-300 active:scale-[0.98] ";
    
    if (variant === 'primary') {
        btnClass += "shadow-lg hover:brightness-110";
        btnStyle = {
            ...btnStyle,
            background: 'linear-gradient(180deg, #D82B38 0%, #A31822 100%)',
            color: '#ffffff',
            border: `1px solid ${A.redBright}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 16px rgba(196,30,42,0.25)`,
            textShadow: '0 1px 2px rgba(0,0,0,0.2)'
        };
    } else if (variant === 'ghost') {
        btnClass += "hover:border-red-500/30 hover:text-white";
        btnStyle = {
            ...btnStyle,
            background: 'rgba(255,255,255,0.02)',
            color: A.textSecondary,
            border: '1px solid rgba(255,255,255,0.08)'
        };
    } else if (variant === 'outline') {
        btnClass += "hover:border-red-500/30 hover:text-white";
        btnStyle = {
            ...btnStyle,
            background: 'transparent',
            color: A.text,
            border: '1px solid rgba(255,255,255,0.12)'
        };
    }

    return (
        <div 
            className="group flex flex-col p-5 sm:p-6 md:p-5 rounded-[14px] transition-all duration-300 w-full"
            style={{ background: 'rgba(23,23,23,0.6)', border: `1px solid ${A.borderStrong}` }}
        >
            <div className="flex flex-col gap-2.5 flex-1 mb-5">
                <span style={{ fontSize: 12, fontWeight: 600, color: A.redText, letterSpacing: '0.1em' }}>{num}</span>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>{title}</h3>
                <p style={{ fontSize: 14, color: A.textSecondary, lineHeight: 1.5 }}>{desc}</p>
            </div>
            <button 
                onClick={onClick}
                className={btnClass}
                style={btnStyle}
            >
                {btnLabel}
            </button>
            {children}
        </div>
    );
}

function ExampleCard({ label, title, desc, img }: { label: string, title: string, desc: string, img?: string | null }) {
    return (
        <div className="flex-shrink-0 w-[150px] sm:w-[165px] flex flex-col overflow-hidden rounded-[10px] snap-center group transition-colors" style={{ border: `1px solid ${A.border}`, background: 'rgba(255,255,255,0.015)' }}>
            <div className="w-full h-[110px] sm:h-[120px] bg-neutral-900 flex items-center justify-center relative overflow-hidden">
                {img ? (
                    <img src={img} alt={title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#171717] to-[#0A0A0A] opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
                )}
                {!img && <ImageIcon size={20} style={{ color: 'rgba(255,255,255,0.2)', position: 'relative', zIndex: 1 }} />}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-[4px]" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', fontSize: 9, fontWeight: 600, color: '#fff', letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.1)', zIndex: 2 }}>
                    {label}
                </div>
            </div>
            <div className="p-3 flex flex-col gap-1 flex-1 border-t border-white/5">
                <h4 style={{ fontSize: 12, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{title}</h4>
                <p style={{ fontSize: 11, color: A.textSecondary, lineHeight: 1.3 }}>{desc}</p>
            </div>
        </div>
    );
}

function PremiumCarousel({ examples }: { examples: AngelPhotoExample[] | null }) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (offset: number) => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
        }
    };

    // Fallback default examples if none exist or still loading
    const displayItems = (examples && examples.length > 0) ? examples : [
        { id: '1', title: 'Coffee Moment', description: 'Portrait or lifestyle shot with coffee.', category: '', sort_order: 1, is_active: true, created_at: '', updated_at: '', image_url: null },
        { id: '2', title: 'Cocktail Moment', description: 'Stylish drink moment in a bar or lounge.', category: '', sort_order: 2, is_active: true, created_at: '', updated_at: '', image_url: null },
        { id: '3', title: 'Venue Atmosphere', description: 'Café, hotel, restaurant or beach club setting.', category: '', sort_order: 3, is_active: true, created_at: '', updated_at: '', image_url: null },
        { id: '4', title: 'Natural Portrait', description: 'Creator visible with a drink moment.', category: '', sort_order: 4, is_active: true, created_at: '', updated_at: '', image_url: null },
        { id: '5', title: 'Clean Detail', description: 'High-quality close-up with elegant mood.', category: '', sort_order: 5, is_active: true, created_at: '', updated_at: '', image_url: null },
        { id: '6', title: 'Unpublished Style', description: 'Fresh or lightly used lifestyle image.', category: '', sort_order: 6, is_active: true, created_at: '', updated_at: '', image_url: null },
    ];

    return (
        <div className="relative group w-full flex items-center">
            {/* Left Button */}
            <button 
                onClick={() => scroll(-200)} 
                className="absolute left-0 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hidden sm:flex items-center justify-center -ml-4 backdrop-blur-sm shadow-lg border border-white/10"
                style={{ width: 36, height: 36 }}
                aria-label="Previous examples"
            >
                <ArrowRight size={18} className="rotate-180" />
            </button>

            {/* Scroll Container */}
            <div 
                ref={scrollRef} 
                className="flex flex-row overflow-x-auto snap-x snap-mandatory pb-4 hide-scrollbar gap-3 w-full -mx-5 px-5 sm:mx-0 sm:px-0 scroll-smooth"
            >
                {displayItems.map((ex, i) => (
                    <ExampleCard 
                        key={ex.id} 
                        label={String(i + 1).padStart(2, '0')} 
                        title={ex.title} 
                        desc={ex.description} 
                        img={ex.image_url} 
                    />
                ))}
            </div>

            {/* Right Button */}
            <button 
                onClick={() => scroll(200)} 
                className="absolute right-0 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hidden sm:flex items-center justify-center -mr-4 backdrop-blur-sm shadow-lg border border-white/10"
                style={{ width: 36, height: 36 }}
                aria-label="Next examples"
            >
                <ArrowRight size={18} />
            </button>
        </div>
    );
}
