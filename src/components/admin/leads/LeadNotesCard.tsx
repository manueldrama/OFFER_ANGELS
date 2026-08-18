import React, { useEffect, useState } from 'react';
import { StickyNote, Send, Loader2 } from 'lucide-react';
import { AdminLeadsService, LeadNote } from '../../../services/admin/leadsService';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateTime } from '../../../hooks/useAppSettings';

interface LeadNotesCardProps {
    /** Notların bağlı olduğu lead. Teklif satırında her zaman dolu (offer.lead_id). */
    leadId: string;
}

/**
 * Açılan teklif/lead panelinde müşteri notlarını gösteren + yeni not ekleyen kart.
 * Kendi verisini yönetir (mount olunca listNotes ile çeker). Yalnızca satır açıkken
 * render edildiğinden fetch otomatik olarak sadece açılınca tetiklenir.
 */
export const LeadNotesCard: React.FC<LeadNotesCardProps> = ({ leadId }) => {
    const { success, error: toastError } = useToast();
    const [notes, setNotes] = useState<LeadNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            try {
                const data = await AdminLeadsService.listNotes(leadId);
                if (alive) setNotes(data);
            } catch {
                if (alive) toastError('Hata', 'Notlar yüklenemedi.');
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadId]);

    const handleAdd = async () => {
        const content = input.trim();
        if (!content || saving) return;
        setSaving(true);
        try {
            const note = await AdminLeadsService.addNote(leadId, content);
            setNotes(prev => [note, ...prev]);
            setInput('');
            success('Eklendi', 'Not kaydedildi.');
        } catch {
            toastError('Hata', 'Not eklenemedi.');
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Ctrl/Cmd + Enter ile hızlı kaydet.
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <>
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <StickyNote size={12} />Müşteri Notları
            </div>
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
                {/* Not ekleme alanı */}
                <div className="mb-3">
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={2}
                        placeholder="Bu müşteriyle ilgili bir not yazın…"
                        className="w-full resize-y rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <div className="mt-2 flex justify-end">
                        <button
                            onClick={handleAdd}
                            disabled={saving || !input.trim()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                            {saving ? 'Ekleniyor…' : 'Not Ekle'}
                        </button>
                    </div>
                </div>

                {/* Not listesi */}
                {loading ? (
                    <div className="flex items-center justify-center py-3">
                        <Loader2 size={16} className="animate-spin text-slate-300" />
                    </div>
                ) : notes.length === 0 ? (
                    <p className="text-[11.5px] italic text-slate-400">Henüz not eklenmedi.</p>
                ) : (
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                        {notes.map(note => (
                            <div key={note.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                                <p className="whitespace-pre-wrap text-[12.5px] text-slate-800">{note.note_content}</p>
                                <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                                    {note.is_system_generated && (
                                        <span className="rounded bg-slate-200 px-1.5 py-0.5 font-semibold text-slate-600">Sistem</span>
                                    )}
                                    <span>{formatDateTime(note.created_at)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};
