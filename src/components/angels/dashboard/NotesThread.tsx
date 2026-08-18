// Yapılandırılmış not thread'i — açık chat DEĞİL; talep/teklif/proje bağlamında
// kısa, kayıtlı mesajlar. Admin her şeyi görür; venue↔creator yalnız 'all'
// görünürlüğündeki notları görür (sunucu tarafında filtrelenir).

import { useState } from 'react';
import { Send } from 'lucide-react';
import { A } from '../AngelsShell';
import { AngelsCard } from './AngelsDashboard';
import type { AngelsNote } from '../../../types/angelsPlatform';

const AUTHOR_LABEL: Record<AngelsNote['author_kind'], string> = {
    venue: 'Venue',
    creator: 'Creator',
    admin: 'CAFEPASTE Angels',
};

export function NotesThread({
    notes,
    onSend,
    placeholder = 'Add a note for the other side and the Angels team…',
}: {
    notes: AngelsNote[];
    onSend: (body: string) => Promise<void>;
    placeholder?: string;
}) {
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit() {
        const body = draft.trim();
        if (!body || busy) return;
        setBusy(true);
        try {
            await onSend(body);
            setDraft('');
        } finally {
            setBusy(false);
        }
    }

    return (
        <AngelsCard padding="p-5">
            <p style={{
                color: A.textMuted, fontSize: 11.5, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
            }}>
                Notes
            </p>

            {notes.length === 0 ? (
                <p style={{ color: A.textGhost, fontSize: 13, marginBottom: 16 }}>
                    No notes yet. Communication is managed through CAFEPASTE Angels.
                </p>
            ) : (
                <div className="flex flex-col gap-3 mb-4">
                    {notes.map(n => (
                        <div
                            key={n.id}
                            className="rounded-lg px-3.5 py-3"
                            style={{
                                background: n.author_kind === 'admin' ? A.redSoft : A.bg,
                                border: `1px solid ${n.author_kind === 'admin' ? A.redLine : A.border}`,
                            }}
                        >
                            <div className="flex items-center justify-between gap-3 mb-1">
                                <span style={{
                                    color: n.author_kind === 'admin' ? A.redText : A.textSecondary,
                                    fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em',
                                }}>
                                    {AUTHOR_LABEL[n.author_kind]}
                                </span>
                                <span style={{ color: A.textGhost, fontSize: 11 }}>
                                    {new Date(n.created_at).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                    })}
                                </span>
                            </div>
                            <p style={{ color: A.s2, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {n.body}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }}
                    placeholder={placeholder}
                    className="flex-1 rounded-lg px-3.5"
                    style={{
                        background: A.bg, border: `1px solid ${A.border}`, color: A.text,
                        fontSize: 13.5, height: 42, outline: 'none',
                    }}
                />
                <button
                    onClick={() => void submit()}
                    disabled={busy || !draft.trim()}
                    className="rounded-lg px-4 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: A.red, color: '#fff', border: 'none', height: 42 }}
                >
                    <Send size={15} />
                </button>
            </div>
        </AngelsCard>
    );
}
