import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { P } from '../landing/primitives';
import { Phone, MessageSquare, Mail, AlertCircle, Loader2, ArrowRight, Tag, Building2 } from 'lucide-react';
import { businessTypesService, businessTypeI18nKey, type BusinessType } from '../../services/admin/businessTypesService';

interface Props {
    lang: string;
    onSuccess: () => void;
}

type FieldErrors = Record<string, string>;

const TOPICS = ['sales', 'corporate'] as const;
const CHANNELS = ['phone', 'whatsapp', 'email'] as const;

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

function FieldError({ msg }: { msg?: string }) {
    if (!msg) return null;
    return (
        <p className="mt-1 text-[12px] flex items-center gap-1" style={{ color: '#DC2626' }}>
            <AlertCircle size={12} /> {msg}
        </p>
    );
}

const CHANNEL_ICON: Record<(typeof CHANNELS)[number], React.ReactNode> = {
    phone: <Phone size={18} />,
    whatsapp: <MessageSquare size={18} />,
    email: <Mail size={18} />,
};

export default function CorporateContactForm({ lang, onSuccess }: Props) {
    const { t } = useTranslation('contact');

    // ── State ─────────────────────────────────────────────────────────────
    const [topic, setTopic] = useState<(typeof TOPICS)[number]>('sales');
    const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('phone');
    const [fullName, setFullName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [businessType, setBusinessType] = useState('');
    // Admin-yönetilen işletme tipleri (merkezi liste, anon public-read RLS).
    const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);
    useEffect(() => {
        let cancelled = false;
        businessTypesService.listActive()
            .then(types => { if (!cancelled) setBusinessTypes(types); })
            .catch(() => { /* liste boş kalır */ });
        return () => { cancelled = true; };
    }, []);
    const [countryCity, setCountryCity] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [kvkk, setKvkk] = useState(false);
    const [honeypot, setHoneypot] = useState(''); // company_site — gizli

    const [errors, setErrors] = useState<FieldErrors>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // ── Validation ────────────────────────────────────────────────────────
    function validate(): FieldErrors {
        const e: FieldErrors = {};
        if (fullName.trim().split(/\s+/).filter(Boolean).length < 2) e.fullName = t('form.errors.fullName');
        if (!companyName.trim()) e.companyName = t('form.errors.company');
        if (!phone.trim() && !email.trim()) e.phoneOrEmail = t('form.errors.phoneOrEmail');
        if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = t('form.errors.email');
        if (!kvkk) e.kvkk = t('form.errors.kvkk');
        return e;
    }

    async function handleSubmit(ev: React.FormEvent) {
        ev.preventDefault();
        setSubmitError(null);
        const e = validate();
        setErrors(e);
        if (Object.keys(e).length) return;

        setSubmitting(true);
        try {
            const res = await fetch('/api/contact/corporate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: fullName.trim(),
                    companyName: companyName.trim(),
                    businessType: businessType || undefined,
                    countryCity: countryCity.trim() || undefined,
                    city: countryCity.trim() || undefined,
                    phone: phone.trim() || undefined,
                    email: email.trim() || undefined,
                    topic,
                    channel,
                    message: message.trim() || undefined,
                    languageCode: lang,
                    company_site: honeypot, // honeypot
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) throw new Error(data?.error || 'submit_failed');
            onSuccess();
        } catch {
            setSubmitError(t('form.errors.submit'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Sol kolon: konu seçimi */}
            <div className="lg:col-span-2 space-y-6">
                {/* Konu seçimi */}
                <div
                    style={{ background: '#FFFFFF', border: `1px solid ${P.border}`, borderRadius: 14 }}
                    className="p-5"
                >
                    <p className="flex items-center gap-2 mb-4" style={{ ...labelBase, marginBottom: 14 }}>
                        <Tag size={15} style={{ color: P.primary }} /> {t('topic.label')}
                    </p>
                    <div className="space-y-3">
                        {TOPICS.map(key => {
                            const active = topic === key;
                            return (
                                <button
                                    type="button"
                                    key={key}
                                    onClick={() => setTopic(key)}
                                    className="w-full text-left rounded-[12px] p-4 transition-all"
                                    style={{
                                        border: `2px solid ${active ? P.fg : P.border}`,
                                        background: active ? P.secondary : '#FFFFFF',
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="font-semibold text-[14px]" style={{ color: P.fg }}>
                                            {t(`topic.${key}.title`)}
                                        </span>
                                        <span
                                            className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0"
                                            style={{
                                                border: `1.5px solid ${active ? P.fg : P.border}`,
                                                background: active ? P.fg : 'transparent',
                                            }}
                                        >
                                            {active && <span className="w-2 h-2 rounded-full" style={{ background: '#FFF' }} />}
                                        </span>
                                    </div>
                                    <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: P.muted }}>
                                        {t(`topic.${key}.desc`)}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Sağ kolon: iletişim yöntemi + form alanları */}
            <div className="lg:col-span-3">
                <div
                    style={{ background: '#FFFFFF', border: `1px solid ${P.border}`, borderRadius: 14 }}
                    className="p-5 sm:p-6 space-y-5"
                >
                    <div>
                        <p className="flex items-center gap-2" style={{ ...labelBase, marginBottom: 4 }}>
                            <Building2 size={15} style={{ color: P.primary }} /> {t('form.sectionTitle')}
                        </p>
                        <p className="text-[12.5px]" style={{ color: P.muted }}>{t('form.sectionSubtitle')}</p>
                    </div>

                    {/* Kanal seçimi */}
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: P.muted }}>{t('channel.label')}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {CHANNELS.map(key => {
                                const active = channel === key;
                                return (
                                    <button
                                        type="button"
                                        key={key}
                                        onClick={() => setChannel(key)}
                                        className="flex items-center gap-2.5 rounded-[10px] p-3 text-left transition-all"
                                        style={{
                                            border: `2px solid ${active ? P.fg : P.border}`,
                                            background: active ? P.secondary : '#FFFFFF',
                                        }}
                                    >
                                        <span style={{ color: active ? P.fg : P.muted }}>{CHANNEL_ICON[key]}</span>
                                        <span className="min-w-0">
                                            <span className="block text-[13px] font-semibold truncate" style={{ color: P.fg }}>{t(`channel.${key}.title`)}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Ad Soyad + Firma */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label style={labelBase}>{t('form.fullName')} <span style={{ color: P.primary }}>*</span></label>
                            <input
                                style={inputBase}
                                value={fullName}
                                onChange={e => { setFullName(e.target.value); if (errors.fullName) setErrors(p => ({ ...p, fullName: '' })); }}
                                placeholder={t('form.fullNamePlaceholder')}
                            />
                            <FieldError msg={errors.fullName} />
                        </div>
                        <div>
                            <label style={labelBase}>{t('form.companyName')} <span style={{ color: P.primary }}>*</span></label>
                            <input
                                style={inputBase}
                                value={companyName}
                                onChange={e => { setCompanyName(e.target.value); if (errors.companyName) setErrors(p => ({ ...p, companyName: '' })); }}
                                placeholder={t('form.companyNamePlaceholder')}
                            />
                            <FieldError msg={errors.companyName} />
                        </div>
                    </div>

                    {/* İşletme türü + Ülke/Şehir */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label style={labelBase}>{t('form.businessType')}</label>
                            <select
                                style={{ ...inputBase, appearance: 'auto' }}
                                value={businessType}
                                onChange={e => setBusinessType(e.target.value)}
                            >
                                <option value="">{t('form.businessTypePlaceholder')}</option>
                                {businessTypes.map(bt => (
                                    <option key={bt.id} value={bt.slug}>{t(businessTypeI18nKey(bt.slug))}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={labelBase}>{t('form.countryCity')}</label>
                            <input
                                style={inputBase}
                                value={countryCity}
                                onChange={e => setCountryCity(e.target.value)}
                                placeholder={t('form.countryCityPlaceholder')}
                            />
                        </div>
                    </div>

                    {/* Telefon + E-posta */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label style={labelBase}>{t('form.phone')}</label>
                            <input
                                type="tel"
                                style={inputBase}
                                value={phone}
                                onChange={e => { setPhone(e.target.value); if (errors.phoneOrEmail) setErrors(p => ({ ...p, phoneOrEmail: '' })); }}
                                placeholder={t('form.phonePlaceholder')}
                            />
                        </div>
                        <div>
                            <label style={labelBase}>{t('form.email')}</label>
                            <input
                                type="email"
                                style={inputBase}
                                value={email}
                                onChange={e => { setEmail(e.target.value); if (errors.email || errors.phoneOrEmail) setErrors(p => ({ ...p, email: '', phoneOrEmail: '' })); }}
                                placeholder={t('form.emailPlaceholder')}
                            />
                            <FieldError msg={errors.email} />
                        </div>
                    </div>
                    <FieldError msg={errors.phoneOrEmail} />

                    {/* Mesaj */}
                    <div>
                        <label style={labelBase}>{t('form.message')}</label>
                        <textarea
                            rows={4}
                            style={{ ...inputBase, resize: 'vertical' }}
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder={t('form.messagePlaceholder')}
                        />
                    </div>

                    {/* Honeypot — ekranda gizli, botlar doldurur */}
                    <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={e => setHoneypot(e.target.value)}
                        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                        aria-hidden="true"
                    />

                    {/* KVKK */}
                    <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={kvkk}
                            onChange={e => { setKvkk(e.target.checked); if (errors.kvkk) setErrors(p => ({ ...p, kvkk: '' })); }}
                            className="mt-0.5"
                            style={{ accentColor: P.primary, width: 16, height: 16 }}
                        />
                        <span className="text-[12.5px] leading-relaxed" style={{ color: P.body }}>{t('form.kvkk')}</span>
                    </label>
                    <FieldError msg={errors.kvkk} />

                    {submitError && (
                        <p className="text-[13px] flex items-center gap-1.5" style={{ color: '#DC2626' }}>
                            <AlertCircle size={14} /> {submitError}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] py-4 px-7 text-[15px] transition-all duration-200 active:scale-[0.99] disabled:opacity-60"
                        style={{ background: P.fg, color: '#FFFFFF' }}
                    >
                        {submitting ? (
                            <><Loader2 size={16} className="animate-spin" /> {t('form.submitting')}</>
                        ) : (
                            <>{t('form.submit')} <ArrowRight size={16} /></>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}
