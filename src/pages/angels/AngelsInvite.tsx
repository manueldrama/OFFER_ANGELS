// /angels/invite/:token — the personalized private invitation, rebuilt to match
// the reference design (design-system/angels/CAFEPASTE® Angels Invitation.dc.html):
// sticky header, editorial hero, moments, why-invited, what-is, how-to-join,
// joining-the-network, confirm, footer.
//
// All copy/images/section order are admin-editable via /admin/angels/content
// (angels_page_sections, page_key='invite'). Sections render in sort_order via
// the renderers map; a hidden section (is_active=false) simply doesn't render.
// With no DB rows the defaults in angelsDefaultContent.ts reproduce the
// original page exactly. Personalized copy uses {{name}} placeholders.
//
// The section renderers themselves live in components/angels/AngelsInviteSections.tsx
// and are shared 1:1 with the public /angels landing page — only the CTA wiring
// (accept vs apply) and the {{name}}/expiry personalization differ.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

import {
    FONT_DISPLAY, FONT_BODY, useAngelsFonts, AngelsFooter, AngelsKeyframes, AngelsShell,
} from '../../components/angels/AngelsShell';
import {
    INVITE_A as A, buildAngelsSectionRenderers, AngelsFixedHeader, scrollToAngelsSection as scrollTo,
} from '../../components/angels/AngelsInviteSections';
import { AngelsService, isInvitationExpired } from '../../services/angels/angelsService';
import type { AngelInvitation } from '../../types/angels';
import { useAngelsContent } from '../../hooks/useAngelsContent';
import { applyAngelsTemplate } from '../../utils/angelsTemplate';

export default function AngelsInvite() {
    useAngelsFonts();
    const { token = '' } = useParams();
    const navigate = useNavigate();
    const { getSection, orderedSections } = useAngelsContent('invite');
    const [invitation, setInvitation] = useState<AngelInvitation | null>(null);
    const [state, setState] = useState<'loading' | 'ok' | 'invalid' | 'expired' | 'accepted'>('loading');
    const [agreed, setAgreed] = useState(false);
    const [agreeError, setAgreeError] = useState('');
    const [renewState, setRenewState] = useState<'idle' | 'sending' | 'sent'>('idle');

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const inv = await AngelsService.getInvitationByToken(token);
                if (!active) return;
                if (!inv) return setState('invalid');
                setInvitation(inv);
                if (inv.renewal_requested_at) setRenewState('sent');
                // Accepted first: an accepted invitation is never treated as
                // expired — expiry only gates acceptance (isInvitationExpired).
                if (inv.status !== 'accepted' && isInvitationExpired(inv)) return setState('expired');
                if (inv.status === 'accepted') {
                    const photoStatus = inv.photo_status;
                    if (photoStatus === 'photos_submitted') {
                        navigate(`/status/${token}`, { replace: true });
                    } else if (photoStatus === 'photos_expired') {
                        navigate(`/extension/${token}`, { replace: true });
                    } else {
                        navigate(`/onboarding/${token}`, { replace: true });
                    }
                    return;
                }
                setState('ok');
                if (inv.status === 'invited') AngelsService.markInvitationOpened(token);
            } catch (e) {
                console.error('[angels] invite load failed', e);
                if (active) setState('invalid');
            }
        })();
        return () => {
            active = false;
        };
    }, [token]);

    // ── Simple states reuse the centered shell ──────────────────────────────
    if (state === 'expired') {
        const sc = getSection('status_copy')?.config ?? {};
        const expiryDate = invitation?.expires_at
            ? new Date(invitation.expires_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
            : 'a previous date';
        const untilLine = applyAngelsTemplate(
            sc.expired_until_line || 'Your private CAFEPASTE Angels invitation was reserved until {{date}}.',
            { date: expiryDate },
        );

        async function requestRenewal() {
            if (renewState !== 'idle') return;
            try {
                setRenewState('sending');
                await AngelsService.requestInvitationRenewal(token);
                setRenewState('sent');
            } catch (e) {
                console.error('[angels] renewal request failed', e);
                setRenewState('idle');
            }
        }

        return (
            <AngelsShell wordmarkSize="md">
                <div className="text-center w-full flex flex-col items-center max-w-[480px] mx-auto">
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] md:text-[11px] font-semibold tracking-[0.12em] uppercase mb-6" style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {sc.expired_badge || 'INVITATION EXPIRED'}
                    </span>
                    <h1 className="font-bold" style={{ fontFamily: FONT_DISPLAY, fontSize: 32, marginBottom: 16, letterSpacing: '-0.02em' }}>
                        {sc.expired_title || 'This invitation has expired.'}
                    </h1>
                    <p style={{ color: A.textSecondary, fontSize: 16, marginBottom: 40 }}>
                        {untilLine}
                    </p>
                    <div className="flex flex-col gap-3 w-full sm:w-auto min-w-[240px]">
                        {renewState === 'sent' ? (
                            <div
                                className="w-full text-left px-5 py-4"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10 }}
                            >
                                <p className="inline-flex items-center gap-2 font-semibold" style={{ color: '#fff', fontSize: 15, marginBottom: 6 }}>
                                    <Check size={16} style={{ color: '#4ade80' }} />
                                    {sc.expired_requested_title || 'Request received'}
                                </p>
                                <p style={{ color: A.textSecondary, fontSize: 13.5, lineHeight: 1.55 }}>
                                    {sc.expired_requested_body || 'Thank you — the CAFEPASTE team has been notified. If your invitation is renewed, this same private link will become active again.'}
                                </p>
                            </div>
                        ) : (
                            <button
                                onClick={requestRenewal}
                                disabled={renewState === 'sending'}
                                className="inline-flex items-center justify-center font-semibold px-8 min-h-[52px] transition-all duration-300 w-full cursor-pointer disabled:opacity-60"
                                style={{
                                    background: '#FFF',
                                    color: '#000',
                                    borderRadius: 10,
                                    fontSize: 15,
                                }}
                            >
                                {renewState === 'sending' ? '…' : (sc.expired_request_button || 'Request New Invitation')}
                            </button>
                        )}
                        <button
                            onClick={() => window.location.href = 'mailto:angels@cafepaste.com'}
                            className="inline-flex items-center justify-center font-semibold px-8 min-h-[52px] transition-all duration-300 w-full cursor-pointer"
                            style={{
                                background: 'transparent',
                                color: A.textSecondary,
                                border: `1px solid ${A.borderStrong}`,
                                borderRadius: 10,
                                fontSize: 15,
                            }}
                        >
                            {sc.expired_contact_button || 'Contact CAFEPASTE Team'}
                        </button>
                    </div>
                </div>
            </AngelsShell>
        );
    }

    if (state === 'loading' || state === 'invalid' || state === 'accepted') {
        const statusCfg = getSection('status_copy')?.config ?? {};
        const titles: Record<string, string> = {
            loading: statusCfg.loading_title || 'Loading your invitation…',
            invalid: statusCfg.invalid_title || 'Invitation not found',
            accepted: statusCfg.accepted_title || 'You’ve already accepted',
        };
        const bodies: Record<string, string> = {
            loading: '',
            invalid: statusCfg.invalid_body || '',
            accepted: statusCfg.accepted_body || '',
        };
        return (
            <AngelsShell wordmarkSize="md">
                <div className="text-center">
                    <h1 className="font-bold" style={{ fontFamily: FONT_DISPLAY, fontSize: 24, marginBottom: 12 }}>
                        {titles[state]}
                    </h1>
                    {bodies[state] && (
                        <p style={{ color: A.textSecondary, lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
                            {bodies[state]}
                        </p>
                    )}
                </div>
            </AngelsShell>
        );
    }

    const name = (invitation?.creator_name || '').trim().split(' ')[0] || 'You';
    const t = (text: string | null | undefined, options?: { noTradeMark?: boolean }) => {
        const result = applyAngelsTemplate(text, { name });
        if (!result) return result;
        if (options?.noTradeMark) {
            return result.replace(/CAFEPASTE®/g, 'CAFEPASTE');
        }
        return result.replace(/CAFEPASTE(?!®)/g, 'CAFEPASTE®');
    };

    // Hero CTA target: scroll to the confirm section if it's on the page,
    // otherwise (admin hid it) go straight to the acceptance form.
    async function goToConfirm() {
        if (document.getElementById('confirm')) {
            scrollTo('confirm');
        } else {
            try {
                setState('loading');
                await AngelsService.confirmInvitation(token);
                navigate(`/accept/${token}`);
            } catch (e) {
                console.error(e);
                setState('invalid');
            }
        }
    }

    async function onAccept() {
        if (!agreed) {
            const cfg = getSection('confirm')?.config ?? {};
            setAgreeError(cfg.agree_error || 'Please confirm the statement above to accept your invitation.');
            return;
        }
        try {
            setState('loading');
            await AngelsService.confirmInvitation(token);
            navigate(`/accept/${token}`);
        } catch (e) {
            console.error(e);
            setState('invalid');
        }
    }

    const renderers = buildAngelsSectionRenderers({
        t,
        onHeroPrimary: goToConfirm,
        renderHeroExtra: cfg => invitation?.expires_at ? (
            <p style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                {applyAngelsTemplate(
                    cfg.active_until_line || 'Your private invitation is active until {{date}}.',
                    { date: new Date(invitation.expires_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) },
                )}
            </p>
        ) : null,
        confirm: {
            kind: 'accept',
            agreed,
            onToggleAgreed: () => {
                setAgreed(a => !a);
                setAgreeError('');
            },
            agreeError,
            onAccept,
        },
    });

    const headerCfg = getSection('header')?.config ?? null;

    return (
        <div
            className="angels-shell"
            style={{
                background: A.bgMain,
                color: 'rgba(255, 255, 255, 0.95)',
                fontFamily: FONT_BODY,
                minHeight: '100dvh',
                scrollBehavior: 'smooth',
                overflowX: 'hidden',
            }}
        >
            <AngelsKeyframes />

            <AngelsFixedHeader pillText={headerCfg?.pill_text} t={t} />

            {/* ── SECTIONS in admin-defined order ── */}
            {orderedSections.map(s => renderers[s.section_type]?.(s) ?? null)}

            <AngelsFooter />
        </div>
    );
}
