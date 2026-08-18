import { useState } from 'react';
import { X, Plus, Archive, Loader2 } from 'lucide-react';
import { HrTaskService } from '../../../services/admin/hr/hrTaskService';
import { useToast } from '../../../contexts/ToastContext';
import { BTN_ACCENT } from '../../../pages/admin/hr/_shared';
import { PROJECT_COLORS } from '../../../types/hrTasks';
import type { HrTaskProject } from '../../../types/hrTasks';

// Proje yönetimi (yalnız yönetici — RLS de öyle). Silme YOK, arşivleme var:
// geçmiş görevlerin proje bağlamı kaybolmasın (migration INVARIANT B).

export function ProjectManagerModal({ open, onClose, projects, onChanged }: {
    open: boolean;
    onClose: () => void;
    projects: HrTaskProject[];
    onChanged: () => void;
}) {
    const toast = useToast();
    const [name, setName] = useState('');
    const [color, setColor] = useState(PROJECT_COLORS[0]);
    const [saving, setSaving] = useState(false);

    if (!open) return null;

    const create = async () => {
        const clean = name.trim();
        if (!clean) { toast.warning('Proje adı gerekli'); return; }
        setSaving(true);
        try {
            await HrTaskService.createProject(clean, color);
            setName('');
            toast.success('Proje oluşturuldu');
            onChanged();
        } catch (e: any) {
            toast.error(e?.message || 'Oluşturulamadı');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onMouseDown={onClose}>
            <div
                className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl max-h-[85vh] overflow-y-auto"
                onMouseDown={e => e.stopPropagation()}
            >
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                    <h3 className="text-[15px] font-semibold text-slate-900">Projeler</h3>
                    <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Kapat">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <input
                            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13.5px] outline-none focus:border-slate-400"
                            placeholder="Yeni proje adı…"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') void create(); }}
                            maxLength={100}
                        />
                        <button onClick={() => void create()} disabled={saving} className={BTN_ACCENT}>
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 mb-4">
                        {PROJECT_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`}
                                style={{ backgroundColor: c }}
                                aria-label={`Renk ${c}`}
                            />
                        ))}
                    </div>

                    <ul className="divide-y divide-slate-100">
                        {projects.map(p => (
                            <li key={p.id} className="py-2.5 flex items-center gap-3">
                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                <span className="text-[13.5px] font-medium text-slate-800 flex-1 min-w-0 truncate">{p.name}</span>
                                <button
                                    onClick={() => {
                                        if (!window.confirm(`"${p.name}" arşivlensin mi? Görevleri kalır, proje seçiminden kalkar.`)) return;
                                        void HrTaskService.archiveProject(p.id)
                                            .then(() => { toast.success('Proje arşivlendi'); onChanged(); })
                                            .catch((e: any) => toast.error(e?.message || 'Arşivlenemedi'));
                                    }}
                                    title="Arşivle"
                                    className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                >
                                    <Archive size={14} />
                                </button>
                            </li>
                        ))}
                        {projects.length === 0 && (
                            <li className="py-6 text-center text-[12.5px] text-slate-400">Henüz proje yok</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}
