import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { P } from '../landing/primitives';
import { Upload, Check, AlertCircle, Loader2, X } from 'lucide-react';

interface Props {
    lang: string;
    onSuccess: () => void;
}

type FieldErrors = Record<string, string>;

const FOLLOWER_OPTIONS = ['1k-10k', '10k-50k', '50k-100k', '100k-500k', '500k+'] as const;
const ENGAGEMENT_OPTIONS = ['lt1', '1-3', '3-5', '5plus', 'unknown'] as const;
const NICHE_OPTIONS = [
    'food', 'lifestyle', 'fashion', 'travel', 'parenting', 'sports',
    'tech', 'beauty', 'education', 'business', 'art', 'other'
] as const;
const COLLAB_OPTIONS = ['gift', 'paid', 'ambassador', 'event'] as const;

const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 15,
    borderRadius: 10,
    border: `1px solid ${P.border}`,
    background: '#FFFFFF',
    color: P.fg,
    transition: 'border-color 0.15s, box-shadow 0.15s',
    outline: 'none',
};

const labelBase: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: P.fg,
    marginBottom: 6,
};

const sectionHeadingStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: P.primary,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: 18,
};

function FieldError({ msg }: { msg?: string }) {
    if (!msg) return null;
    return (
        <p className="mt-1 text-[12px] flex items-center gap-1" style={{ color: '#DC2626' }}>
            <AlertCircle size={12} /> {msg}
        </p>
    );
}

export default function InfluencerApplicationForm({ lang, onSuccess }: Props) {
    const { t } = useTranslation('influencer');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── State ─────────────────────────────────────────────────────────────
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [city, setCity] = useState('');
    const [instagram, setInstagram] = useState('');
    const [tiktok, setTiktok] = useState('');
    const [youtube, setYoutube] = useState('');
    const [followerRange, setFollowerRange] = useState<string>('');
    const [engagementRate, setEngagementRate] = useState<string>('');
    const [niches, setNiches] = useState<string[]>([]);
    const [priorCollab, setPriorCollab] = useState<boolean | null>(null);
    const [collabTypes, setCollabTypes] = useState<string[]>([]);
    const [pitchMessage, setPitchMessage] = useState('');
    const [mediaKit, setMediaKit] = useState<{ path: string; name: string; size: number; mime: string } | null>(null);
    const [kvkk, setKvkk] = useState(false);
    const [honeypot, setHoneypot] = useState(''); // never expose to user

    const [errors, setErrors] = useState<FieldErrors>({});
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // ── Validation ────────────────────────────────────────────────────────
    function validate(): FieldErrors {
        const e: FieldErrors = {};
        if (!fullName.trim()) e.full_name = t('form.errors.required');
        if (!email.trim()) e.email = t('form.errors.required');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t('form.errors.email');
        if (!phone.trim()) e.phone = t('form.errors.required');
        if (!instagram.trim()) e.instagram_handle = t('form.errors.required');
        if (!followerRange) e.follower_range = t('form.errors.required');
        if (niches.length === 0) e.niches = t('form.errors.required');
        if (priorCollab === null) e.prior_collab = t('form.errors.required');
        if (collabTypes.length === 0) e.collab_types = t('form.errors.required');
        if (!pitchMessage.trim()) e.pitch_message = t('form.errors.required');
        else if (pitchMessage.trim().length < 50) e.pitch_message = t('form.errors.pitchTooShort');
        else if (pitchMessage.length > 2000) e.pitch_message = t('form.errors.pitchTooLong');
        if (!kvkk) e.kvkk_accepted = t('form.errors.kvkk');
        return e;
    }

    // ── File upload ───────────────────────────────────────────────────────
    async function handleFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
        const file = ev.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, media_kit_path: t('form.errors.fileTooLarge') }));
            return;
        }
        const allowedMime = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedMime.includes(file.type)) {
            setErrors(prev => ({ ...prev, media_kit_path: t('form.errors.fileType') }));
            return;
        }

        setUploading(true);
        setErrors(prev => { const c = { ...prev }; delete c.media_kit_path; return c; });

        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/influencer-applications/upload', {
                method: 'POST',
                body: fd,
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || 'upload failed');
            }
            setMediaKit({ path: json.path, name: json.name, size: json.size, mime: json.mime });
        } catch (err) {
            console.error(err);
            setErrors(prev => ({ ...prev, media_kit_path: t('form.errors.uploadFailed') }));
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    function removeMediaKit() {
        setMediaKit(null);
    }

    // ── Submit ────────────────────────────────────────────────────────────
    async function handleSubmit(ev: React.FormEvent) {
        ev.preventDefault();
        setSubmitError(null);

        const validation = validate();
        if (Object.keys(validation).length > 0) {
            setErrors(validation);
            // scroll to first error
            const firstKey = Object.keys(validation)[0];
            const el = document.querySelector(`[data-field="${firstKey}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        setErrors({});
        setSubmitting(true);

        const payload: Record<string, any> = {
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            city: city.trim() || null,
            language: lang,
            instagram_handle: instagram.trim().replace(/^@+/, ''),
            tiktok_handle: tiktok.trim().replace(/^@+/, '') || null,
            youtube_handle: youtube.trim() || null,
            follower_range: followerRange,
            engagement_rate: engagementRate || null,
            niches,
            prior_collab: priorCollab === true,
            collab_types: collabTypes,
            pitch_message: pitchMessage.trim(),
            kvkk_accepted: kvkk,
            website: honeypot, // honeypot
        };
        if (mediaKit) {
            payload.media_kit_path = mediaKit.path;
            payload.media_kit_name = mediaKit.name;
            payload.media_kit_size = mediaKit.size;
            payload.media_kit_mime = mediaKit.mime;
        }

        try {
            const res = await fetch('/api/influencer-applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) {
                if (json.fields) setErrors(json.fields);
                throw new Error(json.error || 'submit failed');
            }
            onSuccess();
        } catch (err: any) {
            setSubmitError(t('form.errors.submitFailed'));
            console.error('[InfluencerForm] Submit error:', err);
        } finally {
            setSubmitting(false);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    function toggleArray(setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) {
        setter(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]);
    }

    const chipBase = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium cursor-pointer transition-all duration-150 select-none';
    const chipUnchecked: React.CSSProperties = {
        background: '#FFFFFF',
        color: P.body,
        border: `1px solid ${P.border}`,
    };
    const chipChecked: React.CSSProperties = {
        background: P.primary,
        color: '#FFFFFF',
        border: `1px solid ${P.primary}`,
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <form
            onSubmit={handleSubmit}
            className="w-full max-w-[760px] mx-auto"
            style={{
                background: '#FFFFFF',
                borderRadius: 18,
                padding: 'clamp(24px, 4vw, 40px)',
                border: `1px solid ${P.border}`,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
            }}
            noValidate
        >
            {/* Honeypot — hidden from real users, visible to bots */}
            <div style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true">
                <label>
                    Website
                    <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={e => setHoneypot(e.target.value)}
                    />
                </label>
            </div>

            <h2 className="text-[clamp(20px,3vw,26px)] font-bold mb-1.5" style={{ color: P.fg }}>
                {t('form.title')}
            </h2>
            <p className="text-[14px] mb-8" style={{ color: P.muted }}>
                {t('form.subtitle')}
            </p>

            {/* ── Personal ─────────────────────────────────────────────── */}
            <div className="mb-8">
                <h3 style={sectionHeadingStyle}>{t('form.sections.personal')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div data-field="full_name">
                        <label style={labelBase}>{t('form.fields.fullName')} *</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            style={inputBase}
                            onFocus={e => { e.currentTarget.style.borderColor = P.primary; }}
                            onBlur={e => { e.currentTarget.style.borderColor = P.border; }}
                        />
                        <FieldError msg={errors.full_name} />
                    </div>
                    <div data-field="email">
                        <label style={labelBase}>{t('form.fields.email')} *</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            style={inputBase}
                            onFocus={e => { e.currentTarget.style.borderColor = P.primary; }}
                            onBlur={e => { e.currentTarget.style.borderColor = P.border; }}
                        />
                        <FieldError msg={errors.email} />
                    </div>
                    <div data-field="phone">
                        <label style={labelBase}>{t('form.fields.phone')} *</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            style={inputBase}
                            onFocus={e => { e.currentTarget.style.borderColor = P.primary; }}
                            onBlur={e => { e.currentTarget.style.borderColor = P.border; }}
                        />
                        <FieldError msg={errors.phone} />
                    </div>
                    <div>
                        <label style={labelBase}>{t('form.fields.city')}</label>
                        <input
                            type="text"
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            style={inputBase}
                            onFocus={e => { e.currentTarget.style.borderColor = P.primary; }}
                            onBlur={e => { e.currentTarget.style.borderColor = P.border; }}
                        />
                    </div>
                </div>
            </div>

            {/* ── Social ──────────────────────────────────────────────── */}
            <div className="mb-8">
                <h3 style={sectionHeadingStyle}>{t('form.sections.social')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div data-field="instagram_handle">
                        <label style={labelBase}>{t('form.fields.instagram')} *</label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: P.muted }}>@</span>
                            <input
                                type="text"
                                value={instagram}
                                onChange={e => setInstagram(e.target.value.replace(/^@+/, ''))}
                                style={{ ...inputBase, paddingLeft: 32 }}
                                placeholder="kullaniciadi"
                                onFocus={e => { e.currentTarget.style.borderColor = P.primary; }}
                                onBlur={e => { e.currentTarget.style.borderColor = P.border; }}
                            />
                        </div>
                        <FieldError msg={errors.instagram_handle} />
                    </div>
                    <div>
                        <label style={labelBase}>{t('form.fields.tiktok')}</label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: P.muted }}>@</span>
                            <input
                                type="text"
                                value={tiktok}
                                onChange={e => setTiktok(e.target.value.replace(/^@+/, ''))}
                                style={{ ...inputBase, paddingLeft: 32 }}
                                placeholder="kullaniciadi"
                                onFocus={e => { e.currentTarget.style.borderColor = P.primary; }}
                                onBlur={e => { e.currentTarget.style.borderColor = P.border; }}
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label style={labelBase}>{t('form.fields.youtube')}</label>
                        <input
                            type="text"
                            value={youtube}
                            onChange={e => setYoutube(e.target.value)}
                            style={inputBase}
                            placeholder="youtube.com/@kanalim"
                            onFocus={e => { e.currentTarget.style.borderColor = P.primary; }}
                            onBlur={e => { e.currentTarget.style.borderColor = P.border; }}
                        />
                    </div>
                </div>
            </div>

            {/* ── Profile ─────────────────────────────────────────────── */}
            <div className="mb-8">
                <h3 style={sectionHeadingStyle}>{t('form.sections.profile')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    <div data-field="follower_range">
                        <label style={labelBase}>{t('form.fields.followers')} *</label>
                        <select
                            value={followerRange}
                            onChange={e => setFollowerRange(e.target.value)}
                            style={inputBase}
                            onFocus={e => { e.currentTarget.style.borderColor = P.primary; }}
                            onBlur={e => { e.currentTarget.style.borderColor = P.border; }}
                        >
                            <option value="">—</option>
                            {FOLLOWER_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{t(`form.options.follower.${opt}`)}</option>
                            ))}
                        </select>
                        <FieldError msg={errors.follower_range} />
                    </div>
                    <div>
                        <label style={labelBase}>{t('form.fields.engagement')}</label>
                        <select
                            value={engagementRate}
                            onChange={e => setEngagementRate(e.target.value)}
                            style={inputBase}
                            onFocus={e => { e.currentTarget.style.borderColor = P.primary; }}
                            onBlur={e => { e.currentTarget.style.borderColor = P.border; }}
                        >
                            <option value="">—</option>
                            {ENGAGEMENT_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{t(`form.options.engagement.${opt}`)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div data-field="niches">
                    <label style={labelBase}>{t('form.fields.niches')} *</label>
                    <div className="flex flex-wrap gap-2">
                        {NICHE_OPTIONS.map(opt => {
                            const active = niches.includes(opt);
                            return (
                                <button
                                    type="button"
                                    key={opt}
                                    className={chipBase}
                                    style={active ? chipChecked : chipUnchecked}
                                    onClick={() => toggleArray(setNiches, opt)}
                                >
                                    {active && <Check size={13} />}
                                    {t(`form.options.niches.${opt}`)}
                                </button>
                            );
                        })}
                    </div>
                    <FieldError msg={errors.niches} />
                </div>
            </div>

            {/* ── Collab preferences ──────────────────────────────────── */}
            <div className="mb-8">
                <h3 style={sectionHeadingStyle}>{t('form.sections.collab')}</h3>

                <div data-field="prior_collab" className="mb-5">
                    <label style={labelBase}>{t('form.fields.priorCollab')} *</label>
                    <div className="flex gap-2">
                        {[true, false].map(val => {
                            const active = priorCollab === val;
                            return (
                                <button
                                    type="button"
                                    key={String(val)}
                                    className={chipBase}
                                    style={active ? chipChecked : chipUnchecked}
                                    onClick={() => setPriorCollab(val)}
                                >
                                    {active && <Check size={13} />}
                                    {val ? t('form.options.yes') : t('form.options.no')}
                                </button>
                            );
                        })}
                    </div>
                    <FieldError msg={errors.prior_collab} />
                </div>

                <div data-field="collab_types">
                    <label style={labelBase}>{t('form.fields.collabTypes')} *</label>
                    <div className="flex flex-wrap gap-2">
                        {COLLAB_OPTIONS.map(opt => {
                            const active = collabTypes.includes(opt);
                            return (
                                <button
                                    type="button"
                                    key={opt}
                                    className={chipBase}
                                    style={active ? chipChecked : chipUnchecked}
                                    onClick={() => toggleArray(setCollabTypes, opt)}
                                >
                                    {active && <Check size={13} />}
                                    {t(`form.options.collab.${opt}`)}
                                </button>
                            );
                        })}
                    </div>
                    <FieldError msg={errors.collab_types} />
                </div>
            </div>

            {/* ── Pitch + media ───────────────────────────────────────── */}
            <div className="mb-8">
                <h3 style={sectionHeadingStyle}>{t('form.sections.pitch')}</h3>

                <div data-field="pitch_message" className="mb-5">
                    <label style={labelBase}>{t('form.fields.pitch')} *</label>
                    <textarea
                        value={pitchMessage}
                        onChange={e => setPitchMessage(e.target.value)}
                        rows={5}
                        placeholder={t('form.fields.pitchPlaceholder')}
                        style={{ ...inputBase, resize: 'vertical', minHeight: 130 }}
                        onFocus={e => { e.currentTarget.style.borderColor = P.primary; }}
                        onBlur={e => { e.currentTarget.style.borderColor = P.border; }}
                    />
                    <div className="flex justify-between items-center mt-1">
                        <FieldError msg={errors.pitch_message} />
                        <span className="text-[11px] ml-auto" style={{ color: P.muted }}>
                            {pitchMessage.length} / 2000
                        </span>
                    </div>
                </div>

                <div data-field="media_kit_path">
                    <label style={labelBase}>{t('form.fields.mediaKit')}</label>
                    {!mediaKit && (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-[10px] transition-colors cursor-pointer"
                            style={{
                                border: `1.5px dashed ${P.border}`,
                                background: P.secondary,
                                color: P.body,
                                fontSize: 14,
                                fontWeight: 500,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = P.primary; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = P.border; }}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> {t('form.uploading')}
                                </>
                            ) : (
                                <>
                                    <Upload size={16} /> {t('form.fields.mediaKitHint')}
                                </>
                            )}
                        </button>
                    )}
                    {mediaKit && (
                        <div
                            className="flex items-center gap-3 px-4 py-3 rounded-[10px]"
                            style={{ background: P.primaryBg, border: `1px solid ${P.primary}40` }}
                        >
                            <Check size={16} style={{ color: P.primary }} />
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold truncate" style={{ color: P.fg }}>{mediaKit.name}</p>
                                <p className="text-[11px]" style={{ color: P.muted }}>{(mediaKit.size / 1024).toFixed(0)} KB</p>
                            </div>
                            <button
                                type="button"
                                onClick={removeMediaKit}
                                className="p-1.5 rounded-md hover:bg-white/60 transition-colors cursor-pointer"
                                aria-label="Kaldır"
                            >
                                <X size={14} style={{ color: P.muted }} />
                            </button>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <FieldError msg={errors.media_kit_path} />
                </div>
            </div>

            {/* ── KVKK + submit ───────────────────────────────────────── */}
            <div data-field="kvkk_accepted" className="mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={kvkk}
                        onChange={e => setKvkk(e.target.checked)}
                        className="mt-0.5 w-4 h-4 cursor-pointer"
                        style={{ accentColor: P.primary }}
                    />
                    <span className="text-[13px] leading-relaxed" style={{ color: P.body }}>
                        {t('form.fields.kvkk')}
                    </span>
                </label>
                <FieldError msg={errors.kvkk_accepted} />
            </div>

            {submitError && (
                <div
                    className="mb-5 p-3 rounded-[10px] flex items-center gap-2"
                    style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13 }}
                >
                    <AlertCircle size={16} /> {submitError}
                </div>
            )}

            <button
                type="submit"
                disabled={submitting || uploading}
                className="w-full inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] py-4 text-[15px] transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                    background: 'linear-gradient(135deg, #DC2626, #991B1B)',
                    color: '#FAFAFA',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1), 0 4px 12px rgba(196,30,42,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    textShadow: '0 1px 1px rgba(0,0,0,0.15)',
                    letterSpacing: '0.02em',
                }}
            >
                {submitting ? (
                    <>
                        <Loader2 size={16} className="animate-spin" /> {t('form.submitting')}
                    </>
                ) : (
                    t('form.submit')
                )}
            </button>
        </form>
    );
}
