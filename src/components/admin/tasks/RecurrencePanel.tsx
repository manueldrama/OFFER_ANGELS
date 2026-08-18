import { Plus, Repeat, Trash2 } from 'lucide-react';
import { HrTaskService } from '../../../services/admin/hr/hrTaskService';
import { useToast } from '../../../contexts/ToastContext';
import { TASK_FREQUENCY_LABEL, WEEKDAY_LABELS, avatarColor } from '../../../types/hrTasks';
import type { HrTaskRecurrence } from '../../../types/hrTasks';

// Rutinler — MOCKUP TABLOSU: RUTİN (başlık+açıklama) | SIKLIK (çip) |
// SONRAKİ ÇALIŞMA | ATANAN | DURUM (toggle switch). Üstte açıklama satırı
// + siyah "+ Yeni Rutin" (composer'ı Tekrar açık başlatır).

function freqChip(r: HrTaskRecurrence): string {
    if (r.frequency === 'weekly' && r.weekday != null) return `Haftalık · ${WEEKDAY_LABELS[r.weekday].slice(0, 3)}`;
    if (r.frequency === 'monthly' && r.day_of_month != null) return `Aylık · ${r.day_of_month}'i`;
    return TASK_FREQUENCY_LABEL[r.frequency];
}

function nextRun(r: HrTaskRecurrence): string {
    const d = new Date(r.next_run_at);
    return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

function initials(name: string): string {
    return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toLocaleUpperCase('tr');
}

export function RecurrencePanel({ recurrences, canManage, onChanged, onNewRoutine }: {
    recurrences: HrTaskRecurrence[];
    canManage: boolean;
    onChanged: () => void;
    onNewRoutine: () => void;
}) {
    const toast = useToast();

    if (!canManage) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <Repeat size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[13px] text-slate-400">
                    Rutin görev kurallarını yöneticiler tanımlar; size düşen görevler panonuzda görünür.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-[12.5px] text-slate-400">Belirlenen sıklıkta otomatik görev oluşturan rutinler</p>
                <button
                    onClick={onNewRoutine}
                    className="h-8 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                    <Plus size={13} /> Yeni Rutin
                </button>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full min-w-[720px]">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="text-left px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Rutin</th>
                            <th className="text-left px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 w-[140px]">Sıklık</th>
                            <th className="text-left px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 w-[150px]">Sonraki Çalışma</th>
                            <th className="text-left px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 w-[170px]">Atanan</th>
                            <th className="text-left px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 w-[90px]">Durum</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {recurrences.map(r => {
                            const assigneeName = r.assignee?.full_name || r.assignee?.email || '—';
                            return (
                                <tr key={r.id} className="group hover:bg-slate-50/60 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="text-[13px] font-semibold text-slate-900">{r.title}</p>
                                        {r.description && (
                                            <p className="text-[11.5px] text-slate-400 mt-0.5 truncate max-w-[360px]">{r.description}</p>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11.5px] font-semibold whitespace-nowrap">
                                            {freqChip(r)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-[12.5px] font-medium text-slate-600 tabular-nums whitespace-nowrap">
                                        {nextRun(r)}
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className="inline-flex items-center gap-1.5 min-w-0">
                                            <span className={`w-6 h-6 rounded-full text-white text-[9.5px] font-bold inline-flex items-center justify-center shrink-0 ${avatarColor(assigneeName)}`}>
                                                {initials(assigneeName)}
                                            </span>
                                            <span className="text-[12.5px] text-slate-600 truncate">{assigneeName}</span>
                                        </span>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            {/* Toggle switch (mockup) */}
                                            <button
                                                role="switch"
                                                aria-checked={r.is_active}
                                                title={r.is_active ? 'Durdur' : 'Devam ettir'}
                                                onClick={() => {
                                                    void HrTaskService.toggleRecurrence(r.id, !r.is_active)
                                                        .then(onChanged)
                                                        .catch((e: any) => toast.error(e?.message || 'Güncellenemedi'));
                                                }}
                                                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${r.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                            >
                                                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${r.is_active ? 'left-[18px]' : 'left-0.5'}`} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (!window.confirm('Rutin kural silinsin mi? Açılmış görevler kalır.')) return;
                                                    void HrTaskService.deleteRecurrence(r.id)
                                                        .then(onChanged)
                                                        .catch((e: any) => toast.error(e?.message || 'Silinemedi'));
                                                }}
                                                title="Sil"
                                                className="p-1 rounded text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {recurrences.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-[12.5px] text-slate-400">
                                    Rutin kural yok — "Yeni Rutin" ile oluşturun
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
