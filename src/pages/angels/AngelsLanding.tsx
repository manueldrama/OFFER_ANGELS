// /angels — the public CAFEPASTE Angels landing. Renders the SAME sections as
// the private invite page (/angels/invite/:token) via the shared renderers in
// components/angels/AngelsInviteSections.tsx, reading the same admin-editable
// content (angels_page_sections, page_key='invite') so the two pages stay in
// sync automatically. Differences from the invite page, by design:
//   - no invitation token: {{name}} placeholders are stripped gracefully and
//     there is no "active until {{date}}" line or accept flow
//   - every primary CTA scrolls to the embedded creator application form
//     (#apply); the hero secondary link scrolls to the venue form (#venue)
//   - the confirm card renders in 'apply' mode (no agree-checkbox) and a few
//     invitation-specific strings are overridden via angels.landing.* i18n keys
// The application/venue forms below still read their own configs from
// page_key='landing' and submit through AngelsService unchanged.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { FONT_DISPLAY, FONT_BODY, useAngelsFonts, AngelsFooter, AngelsKeyframes, A, AngelsEyebrow, AngelsButton } from '../../components/angels/AngelsShell';
import { Field, AngelsInput, AngelsTextarea, ProfileImageUploader, GalleryUploader } from '../../components/angels/AngelsForm';
import {
    INVITE_A, buildAngelsSectionRenderers, AngelsFixedHeader, scrollToAngelsSection as scrollTo,
    type AngelsContentT,
} from '../../components/angels/AngelsInviteSections';
import { useAngelsContent } from '../../hooks/useAngelsContent';
import { stripAngelsNamePlaceholder } from '../../utils/angelsTemplate';
import { AngelsService } from '../../services/angels/angelsService';

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

export default function AngelsLanding() {
    useAngelsFonts();
    const { t, i18n } = useTranslation('offer');
    const lang = (i18n.language || 'en').split('-')[0];
    // Main sections are shared with the invite page; the two forms below keep
    // their own admin configs under page_key='landing'.
    const { orderedSections, getSection: getInviteSection } = useAngelsContent('invite');
    const { getSection } = useAngelsContent('landing');

    const appFormSection = getSection('application_form');
    const venueFormSection = getSection('venue_partnership');
    // Localized via config_i18n like every other Angels section; if the admin
    // hides the section, the invite copy shows unchanged (no override).
    const ov = getSection('landing_overrides')?.config ?? {};

    // Forms state
    const [appState, setAppState] = useState<'idle'|'submitting'|'success'|'error'>('idle');
    const [fullName, setFullName] = useState('');
    const [instagram, setInstagram] = useState('');
    const [tiktok, setTiktok] = useState('');
    const [email, setEmail] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [country, setCountry] = useState('');
    const [city, setCity] = useState('');
    const [intro, setIntro] = useState('');
    const [profileImage, setProfileImage] = useState<string|null>(null);
    const [gallery, setGallery] = useState<string[]>([]);
    const [consent, setConsent] = useState(false);
    const [appErrorMsg, setAppErrorMsg] = useState('');

    const [venueState, setVenueState] = useState<'idle'|'submitting'|'success'|'error'>('idle');
    const [venueName, setVenueName] = useState('');
    const [vContact, setVContact] = useState('');
    const [vEmail, setVEmail] = useState('');
    const [vPhone, setVPhone] = useState('');
    const [vCountry, setVCountry] = useState('');
    const [vCity, setVCity] = useState('');
    const [vMessage, setVMessage] = useState('');
    const [vErrorMsg, setVErrorMsg] = useState('');

    const handleAppSubmit = async () => {
        if (!fullName.trim() || !instagram.trim() || !email.trim() || !country.trim() || !city.trim()) {
            setAppState('error');
            setAppErrorMsg(t('angels.apply.errorRequired'));
            return;
        }
        if (!consent) {
            setAppState('error');
            setAppErrorMsg(t('angels.apply.errorConsent'));
            return;
        }

        setAppState('submitting');
        setAppErrorMsg('');

        try {
            await AngelsService.submitApplication({
                full_name: fullName.trim(),
                instagram: instagram.trim(),
                tiktok: tiktok.trim() || undefined,
                email: email.trim(),
                whatsapp: whatsapp.trim() || undefined,
                country: country.trim(),
                city: city.trim(),
                category: [],
                language: undefined,
                introduction: intro.trim() || undefined,
                profile_image_url: profileImage || undefined,
                gallery_urls: gallery.length > 0 ? gallery : undefined
            });
            setAppState('success');
        } catch (e: any) {
            console.error(e);
            setAppState('error');
            setAppErrorMsg(t('angels.apply.errorGeneric'));
        }
    };

    const handleVenueSubmit = async () => {
        if (!venueName.trim() || !vContact.trim() || !vEmail.trim() || !vCountry.trim() || !vCity.trim() || !vMessage.trim()) {
            setVenueState('error');
            setVErrorMsg(t('angels.venue.errorRequired'));
            return;
        }

        setVenueState('submitting');
        setVErrorMsg('');

        try {
            await AngelsService.submitVenuePartnership({
                venue_name: venueName.trim(),
                contact_person: vContact.trim(),
                email: vEmail.trim(),
                phone: vPhone.trim() || undefined,
                country: vCountry.trim(),
                city: vCity.trim(),
                message: vMessage.trim()
            });
            setVenueState('success');
        } catch (e: any) {
            console.error(e);
            setVenueState('error');
            setVErrorMsg(t('angels.venue.errorGeneric'));
        }
    };

    const replaceTM = (text?: string) => {
        if (!text) return text;
        return text.replace(/CAFEPASTE(?!®)/g, 'CAFEPASTE®');
    };

    // Content translator for the shared sections: same TM normalization as the
    // invite page, but {{name}} degrades to the impersonal reading.
    const tc: AngelsContentT = (text, options) => {
        const result = stripAngelsNamePlaceholder(text, lang);
        if (!result) return result;
        if (options?.noTradeMark) {
            return result.replace(/CAFEPASTE®/g, 'CAFEPASTE');
        }
        return result.replace(/CAFEPASTE(?!®)/g, 'CAFEPASTE®');
    };

    // Invitation-specific copy that must read as an application on the public
    // page. Everything else stays byte-identical with the invite content.
    const prune = (o: Record<string, any>) =>
        Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ''));
    const OVERRIDES: Record<string, Record<string, any>> = {
        hero: prune({
            badge_text: ov.badge_text,
            cta_primary_label: ov.hero_cta_label,
            cta_secondary_label: ov.hero_secondary_cta_label,
        }),
        confirm: prune({
            eyebrow: ov.confirm_eyebrow,
            title: ov.confirm_title,
            subtitle: ov.confirm_subtitle,
            statement: ov.confirm_statement,
            cta_label: ov.confirm_cta_label,
            footnote: ov.confirm_footnote,
        }),
    };
    const sections = orderedSections.map(s =>
        OVERRIDES[s.section_type] ? { ...s, config: { ...s.config, ...OVERRIDES[s.section_type] } } : s);

    const renderers = buildAngelsSectionRenderers({
        t: tc,
        onHeroPrimary: () => scrollTo('apply'),
        onHeroSecondary: () => scrollTo('venue'),
        confirm: { kind: 'apply', onApply: () => scrollTo('apply') },
    });

    const renderApplicationForm = () => {
        if (!appFormSection) return null;
        const cfg = appFormSection.config;
        return (
            <section id="apply" style={{ padding: 'clamp(64px, 10vw, 96px) 24px', background: A.bgDeep, position: 'relative' }}>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: NOISE }} />
                <div className="mx-auto relative z-10" style={{ maxWidth: 800 }}>
                    <div className="text-center mb-10">
                        <AngelsEyebrow>{cfg.eyebrow || t('angels.apply.eyebrow')}</AngelsEyebrow>
                        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(28px,3.6vw,42px)', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 16px', color: '#fff' }}>
                            {replaceTM(cfg.title) || t('angels.apply.title')}
                        </h2>
                        <p style={{ fontSize: 'clamp(15px,1.6vw,17px)', lineHeight: 1.5, color: A.textSecondary, maxWidth: 680, margin: '0 auto' }}>
                            {t('angels.apply.subtitle')}
                        </p>
                    </div>

                    {appState === 'success' ? (
                        <div className="text-center py-12" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: `1px solid ${A.borderStrong}` }}>
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-6" style={{ background: 'rgba(209,28,42,0.1)', border: `1px solid rgba(209,28,42,0.2)` }}>
                                <Check size={24} style={{ color: A.redText }} strokeWidth={2.5} />
                            </div>
                            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 12 }}>{t('angels.apply.successTitle')}</h3>
                            <p style={{ color: A.textSecondary, maxWidth: 400, margin: '0 auto' }}>{t('angels.apply.successBody')}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6" style={{ background: 'rgba(20,20,24,0.4)', padding: '32px', borderRadius: 16, border: `1px solid ${A.borderStrong}`, boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
                            {appState === 'error' && appErrorMsg && (
                                <div className="w-full p-3 rounded-lg" style={{ background: A.redSoft, border: `1px solid ${A.red}`, color: '#fff', fontSize: 14 }}>
                                    {appErrorMsg}
                                </div>
                            )}

                            <div className="grid sm:grid-cols-2 gap-5">
                                <Field label={t('angels.apply.nameLabel')}>
                                    <AngelsInput value={fullName} onChange={setFullName} placeholder={t('angels.apply.namePlaceholder')} />
                                </Field>
                                <Field label={t('angels.apply.emailLabel')}>
                                    <AngelsInput value={email} onChange={setEmail} placeholder={t('angels.apply.emailPlaceholder')} type="email" />
                                </Field>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-5">
                                <Field label={t('angels.apply.instagramLabel')}>
                                    <AngelsInput value={instagram} onChange={setInstagram} placeholder={t('angels.apply.instagramPlaceholder')} prefix="@" />
                                </Field>
                                <Field label={t('angels.apply.tiktokLabel')} optional>
                                    <AngelsInput value={tiktok} onChange={setTiktok} placeholder={t('angels.apply.tiktokPlaceholder')} prefix="@" />
                                </Field>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-5">
                                <Field label={t('angels.apply.countryLabel')}>
                                    <AngelsInput value={country} onChange={setCountry} placeholder={t('angels.apply.countryPlaceholder')} />
                                </Field>
                                <Field label={t('angels.apply.cityLabel')}>
                                    <AngelsInput value={city} onChange={setCity} placeholder={t('angels.apply.cityPlaceholder')} />
                                </Field>
                            </div>

                            <Field label={t('angels.apply.whatsappLabel')} optional>
                                <AngelsInput value={whatsapp} onChange={setWhatsapp} placeholder={t('angels.apply.whatsappPlaceholder')} />
                            </Field>

                            <Field label={t('angels.apply.introLabel')} optional>
                                <AngelsTextarea value={intro} onChange={setIntro} placeholder={t('angels.apply.introPlaceholder')} rows={4} />
                            </Field>

                            <div className="pt-2">
                                <h3 style={{ fontSize: 14, fontWeight: 600, color: A.textSecondary, marginBottom: 4 }}>{t('angels.apply.profilePhotoLabel')} (Optional)</h3>
                                <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>{t('angels.apply.profilePhotoHint')}</p>
                                <ProfileImageUploader value={profileImage} onChange={setProfileImage} />
                            </div>

                            <div className="pt-2">
                                <h3 style={{ fontSize: 14, fontWeight: 600, color: A.textSecondary, marginBottom: 4 }}>{t('angels.apply.galleryLabel')} (Optional)</h3>
                                <p style={{ fontSize: 13, color: A.textMuted, marginBottom: 12 }}>{t('angels.apply.galleryHint')}</p>
                                <GalleryUploader images={gallery} onChange={setGallery} max={3} />
                            </div>

                            <div className="mt-4 pt-6 border-t border-white/10">
                                <button type="button" onClick={() => setConsent(!consent)} className="group flex items-start gap-4 mb-6 text-left" style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                                    <span style={{ width: 22, height: 22, borderRadius: 6, background: consent ? A.red : 'transparent', border: `1px solid ${consent ? A.red : 'rgba(255,255,255,0.2)'}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', marginTop: 2 }}>
                                        {consent && <Check size={14} color="#fff" strokeWidth={3} />}
                                    </span>
                                    <span style={{ fontSize: 13, color: consent ? '#fff' : 'rgba(255,255,255,0.6)', lineHeight: 1.5, transition: 'color 0.2s' }}>
                                        {t('angels.apply.consentLabel')}
                                    </span>
                                </button>
                                <AngelsButton block loading={appState === 'submitting'} onClick={handleAppSubmit}>{t('angels.apply.submitButton')}</AngelsButton>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        );
    };

    const renderVenueForm = () => {
        if (!venueFormSection) return null;
        const cfg = venueFormSection.config;
        return (
            <section id="venue" style={{ padding: 'clamp(64px, 10vw, 96px) 24px', background: '#080809', position: 'relative' }}>
                <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: NOISE }} />
                <div className="mx-auto relative z-10" style={{ maxWidth: 640 }}>
                    <div className="text-center mb-10">
                        <AngelsEyebrow>{cfg.eyebrow || t('angels.venue.eyebrow')}</AngelsEyebrow>
                        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(28px,3.6vw,42px)', lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 16px', color: '#fff' }}>
                            {replaceTM(cfg.title) || t('angels.venue.title')}
                        </h2>
                        <p style={{ fontSize: 'clamp(15px,1.6vw,17px)', lineHeight: 1.5, color: A.textSecondary, maxWidth: 540, margin: '0 auto' }}>
                            {t('angels.venue.subtitle')}
                        </p>
                    </div>

                    {venueState === 'success' ? (
                        <div className="text-center py-12" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: `1px solid ${A.borderStrong}` }}>
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-6" style={{ background: 'rgba(209,28,42,0.1)', border: `1px solid rgba(209,28,42,0.2)` }}>
                                <Check size={24} style={{ color: A.redText }} strokeWidth={2.5} />
                            </div>
                            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 12 }}>{t('angels.venue.successTitle')}</h3>
                            <p style={{ color: A.textSecondary, maxWidth: 400, margin: '0 auto' }}>{t('angels.venue.successBody')}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6" style={{ background: 'rgba(20,20,24,0.3)', padding: '32px', borderRadius: 16, border: `1px solid ${A.borderStrong}`, boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
                            {venueState === 'error' && vErrorMsg && (
                                <div className="w-full p-3 rounded-lg" style={{ background: A.redSoft, border: `1px solid ${A.red}`, color: '#fff', fontSize: 14 }}>
                                    {vErrorMsg}
                                </div>
                            )}

                            <Field label={t('angels.venue.venueNameLabel')}>
                                <AngelsInput value={venueName} onChange={setVenueName} placeholder={t('angels.venue.venueNamePlaceholder')} />
                            </Field>
                            <div className="grid sm:grid-cols-2 gap-5">
                                <Field label={t('angels.venue.contactPersonLabel')}>
                                    <AngelsInput value={vContact} onChange={setVContact} placeholder={t('angels.venue.contactPersonPlaceholder')} />
                                </Field>
                                <Field label={t('angels.venue.emailLabel')}>
                                    <AngelsInput value={vEmail} onChange={setVEmail} placeholder={t('angels.venue.emailPlaceholder')} type="email" />
                                </Field>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-5">
                                <Field label={t('angels.venue.countryLabel')}>
                                    <AngelsInput value={vCountry} onChange={setVCountry} placeholder={t('angels.venue.countryPlaceholder')} />
                                </Field>
                                <Field label={t('angels.venue.cityLabel')}>
                                    <AngelsInput value={vCity} onChange={setVCity} placeholder={t('angels.venue.cityPlaceholder')} />
                                </Field>
                            </div>

                            <Field label={t('angels.venue.phoneLabel')} optional>
                                <AngelsInput value={vPhone} onChange={setVPhone} placeholder={t('angels.venue.phonePlaceholder')} />
                            </Field>

                            <Field label={t('angels.venue.messageLabel')}>
                                <AngelsTextarea value={vMessage} onChange={setVMessage} placeholder={t('angels.venue.messagePlaceholder')} rows={4} />
                            </Field>

                            <div className="mt-2 pt-6 border-t border-white/10">
                                <AngelsButton block loading={venueState === 'submitting'} onClick={handleVenueSubmit}>{t('angels.venue.submitButton')}</AngelsButton>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        );
    };

    const headerCfg = getInviteSection('header')?.config ?? null;

    return (
        <div
            className="angels-shell"
            style={{
                background: INVITE_A.bgMain,
                color: 'rgba(255, 255, 255, 0.95)',
                fontFamily: FONT_BODY,
                minHeight: '100dvh',
                scrollBehavior: 'smooth',
                overflowX: 'hidden',
            }}
        >
            <AngelsKeyframes />

            <AngelsFixedHeader pillText={headerCfg?.pill_text ? (ov.badge_text || headerCfg.pill_text) : null} t={tc} />

            {/* ── Shared invite sections in admin-defined order ── */}
            {sections.map(s => renderers[s.section_type]?.(s) ?? null)}

            {renderApplicationForm()}
            {renderVenueForm()}
            <AngelsFooter />
        </div>
    );
}
