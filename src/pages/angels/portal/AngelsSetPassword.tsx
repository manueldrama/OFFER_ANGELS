// /angels/set-password?t=<token> — kurulum/sıfırlama linki tüketir,
// şifreyi belirler ve otomatik giriş yapıp doğru panele yönlendirir.

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { A, AngelsShell, AngelsButton } from '../../../components/angels/AngelsShell';
import { AngelsLabel, AngelsInput } from '../../../components/angels/AngelsForm';
import { useAngelsAuth } from '../../../components/angels/AngelsAuthProvider';
import { AngelsAuthService } from '../../../services/angels/angelsAuthService';

export default function AngelsSetPassword() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { adoptSession } = useAngelsAuth();

    const linkToken = useMemo(() => (params.get('t') || '').trim(), [params]);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function handleSubmit() {
        if (busy) return;
        setError(null);
        if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
        if (password !== confirm) { setError('Passwords do not match.'); return; }
        setBusy(true);
        try {
            const data = await AngelsAuthService.setPassword(linkToken, password);
            adoptSession(data);
            if (data.venueMemberships.length > 0 && data.creatorMemberships.length === 0) {
                navigate('/venue', { replace: true });
            } else if (data.creatorMemberships.length > 0 && data.venueMemberships.length === 0) {
                navigate('/creator', { replace: true });
            } else {
                navigate('/login', { replace: true });
            }
        } catch (e: any) {
            setError(e?.message || 'This link is invalid or has expired.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <AngelsShell maxWidth={440}>
            <div
                className="w-full rounded-2xl p-7 sm:p-9"
                style={{ background: A.surface, border: `1px solid ${A.border}` }}
            >
                <h1 style={{ color: A.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                    Set your password
                </h1>
                <p style={{ color: A.textSecondary, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                    Choose a password for your CAFEPASTE Angels account.
                </p>

                {!linkToken ? (
                    <p style={{ color: A.redText, fontSize: 14, lineHeight: 1.7 }}>
                        This link is missing its access token. Please use the link from your email,
                        or contact the CAFEPASTE Angels team for a new one.
                    </p>
                ) : (
                    <form
                        onSubmit={e => { e.preventDefault(); void handleSubmit(); }}
                        className="flex flex-col gap-4"
                    >
                        <div>
                            <AngelsLabel>New password</AngelsLabel>
                            <AngelsInput value={password} onChange={setPassword} type="password" placeholder="At least 8 characters" />
                        </div>
                        <div>
                            <AngelsLabel>Confirm password</AngelsLabel>
                            <AngelsInput value={confirm} onChange={setConfirm} type="password" placeholder="Repeat your password" />
                        </div>

                        {error && <p style={{ color: A.redText, fontSize: 13.5, lineHeight: 1.6 }}>{error}</p>}

                        <AngelsButton type="submit" block loading={busy}>
                            Save & Continue
                        </AngelsButton>
                    </form>
                )}
            </div>
        </AngelsShell>
    );
}
