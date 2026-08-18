// /angels/login — venue + creator ortak giriş (custom Angels auth).
// Üyeliğe göre yönlendirir: venue → /angels/venue, creator → /angels/creator,
// ikisi birden → seçim ekranı.

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Sparkles } from 'lucide-react';
import { A, AngelsShell, AngelsButton } from '../../../components/angels/AngelsShell';
import { AngelsLabel, AngelsInput } from '../../../components/angels/AngelsForm';
import { useAngelsAuth } from '../../../components/angels/AngelsAuthProvider';
import { AngelsAuthService } from '../../../services/angels/angelsAuthService';
import type { AngelsSessionData } from '../../../types/angelsPlatform';

type Mode = 'login' | 'forgot' | 'forgot_done' | 'choose';

export default function AngelsLogin() {
    const navigate = useNavigate();
    const location = useLocation();
    const { signIn } = useAngelsAuth();

    const [mode, setMode] = useState<Mode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const from: string | undefined = (location.state as any)?.from?.pathname;

    function routeAfterLogin(data: AngelsSessionData) {
        const hasVenue = data.venueMemberships.length > 0;
        const hasCreator = data.creatorMemberships.length > 0;
        if (hasVenue && hasCreator) { setMode('choose'); return; }
        if (hasVenue) { navigate(from?.startsWith('/venue') ? from : '/venue', { replace: true }); return; }
        if (hasCreator) { navigate(from?.startsWith('/creator') ? from : '/creator', { replace: true }); return; }
        setError('This account has no dashboard access yet. Please contact the CAFEPASTE Angels team.');
    }

    async function handleLogin() {
        if (busy) return;
        setError(null);
        setBusy(true);
        try {
            const data = await signIn(email, password);
            routeAfterLogin(data);
        } catch (e: any) {
            setError(e?.message || 'Sign in failed. Please try again.');
        } finally {
            setBusy(false);
        }
    }

    async function handleForgot() {
        if (busy) return;
        setError(null);
        setBusy(true);
        try {
            await AngelsAuthService.requestReset(email);
            setMode('forgot_done');
        } catch (e: any) {
            setError(e?.message || 'Something went wrong. Please try again.');
        } finally {
            setBusy(false);
        }
    }

    const card: React.CSSProperties = {
        background: A.surface,
        border: `1px solid ${A.border}`,
    };

    return (
        <AngelsShell maxWidth={440}>
            <div className="w-full rounded-2xl p-7 sm:p-9" style={card}>
                {mode === 'choose' ? (
                    <>
                        <h1 style={{ color: A.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                            Choose your workspace
                        </h1>
                        <p style={{ color: A.textSecondary, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                            Your account has access to both areas.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => navigate('/venue', { replace: true })}
                                className="flex items-center gap-3 rounded-xl p-4 text-left transition-colors cursor-pointer"
                                style={{ border: `1px solid ${A.border}`, background: A.bg }}
                            >
                                <Building2 size={20} style={{ color: A.redText }} />
                                <div>
                                    <p style={{ color: A.text, fontSize: 15, fontWeight: 600 }}>Venue Desk</p>
                                    <p style={{ color: A.textMuted, fontSize: 12.5 }}>Discover creators & manage collaborations</p>
                                </div>
                            </button>
                            <button
                                onClick={() => navigate('/creator', { replace: true })}
                                className="flex items-center gap-3 rounded-xl p-4 text-left transition-colors cursor-pointer"
                                style={{ border: `1px solid ${A.border}`, background: A.bg }}
                            >
                                <Sparkles size={20} style={{ color: A.redText }} />
                                <div>
                                    <p style={{ color: A.text, fontSize: 15, fontWeight: 600 }}>Creator Dashboard</p>
                                    <p style={{ color: A.textMuted, fontSize: 12.5 }}>Requests, proposals, projects & payouts</p>
                                </div>
                            </button>
                        </div>
                    </>
                ) : mode === 'forgot_done' ? (
                    <>
                        <h1 style={{ color: A.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                            Check your inbox
                        </h1>
                        <p style={{ color: A.textSecondary, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                            If an account exists for <span style={{ color: A.text }}>{email}</span>, we've sent a link
                            to reset your password. The link is valid for 7 days.
                        </p>
                        <button
                            onClick={() => setMode('login')}
                            className="cursor-pointer"
                            style={{ color: A.redText, fontSize: 14, fontWeight: 600, background: 'none', border: 'none', padding: 0 }}
                        >
                            Back to sign in
                        </button>
                    </>
                ) : (
                    <>
                        <h1 style={{ color: A.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                            {mode === 'forgot' ? 'Reset your password' : 'Sign in'}
                        </h1>
                        <p style={{ color: A.textSecondary, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                            {mode === 'forgot'
                                ? 'Enter the email connected to your Angels account.'
                                : 'Private access for approved venues and creators.'}
                        </p>

                        <form
                            onSubmit={e => { e.preventDefault(); void (mode === 'forgot' ? handleForgot() : handleLogin()); }}
                            className="flex flex-col gap-4"
                        >
                            <div>
                                <AngelsLabel>Email</AngelsLabel>
                                <AngelsInput value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
                            </div>
                            {mode === 'login' && (
                                <div>
                                    <AngelsLabel>Password</AngelsLabel>
                                    <AngelsInput value={password} onChange={setPassword} type="password" placeholder="••••••••" />
                                </div>
                            )}

                            {error && (
                                <p style={{ color: A.redText, fontSize: 13.5, lineHeight: 1.6 }}>{error}</p>
                            )}

                            <AngelsButton type="submit" block loading={busy}>
                                {mode === 'forgot' ? 'Send Reset Link' : 'Sign In'}
                            </AngelsButton>
                        </form>

                        <div className="mt-5 text-center">
                            <button
                                onClick={() => { setError(null); setMode(mode === 'forgot' ? 'login' : 'forgot'); }}
                                className="cursor-pointer"
                                style={{ color: A.textMuted, fontSize: 13, background: 'none', border: 'none', padding: 0 }}
                            >
                                {mode === 'forgot' ? 'Back to sign in' : 'Forgot your password?'}
                            </button>
                        </div>
                    </>
                )}
            </div>
            <p className="mt-6 text-center" style={{ color: A.textGhost, fontSize: 12, lineHeight: 1.7, maxWidth: 360 }}>
                Access is provided by the CAFEPASTE Angels team after approval.
                Collaborations are managed through CAFEPASTE Angels.
            </p>
        </AngelsShell>
    );
}
