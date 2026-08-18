import { useContext, useEffect, useState } from 'react';
import { X, Loader2, CheckSquare } from 'lucide-react';
import { AuthContext } from '../../auth/AuthProvider';
import { HrTaskService } from '../../../services/admin/hr/hrTaskService';
import { HrEmployeeService } from '../../../services/admin/hr/hrEmployeeService';
import { useToast } from '../../../contexts/ToastContext';
import { BTN_ACCENT } from '../../../pages/admin/hr/_shared';
import { EmployeeSelect, type AssigneeOption } from './EmployeeSelect';
import { TASK_PRIORITY_META } from '../../../types/hrTasks';
import type { TaskPriority } from '../../../types/hrTasks';

// TOPLU GÖREV ÜRETİMİ (spec §34): seçilen her lead için AYRI görev açılır
// (20 lead'i tek görevin içine tıkmak yasak). Başlıkta {lead} yer tutucusu
// müşteri adıyla değişir. Atanan boşsa her görev KENDİ lead'inin sahibine
// gider (sahipsizse oluşturana). Kısmi hata işi durdurmaz — sonunda
// "18/20 oluşturuldu" raporlanır.

export interface BulkTaskLead {
    id: string;
    label: string;
    assignedTo: string | null;
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-[13.5px] outline-none focus:border-slate-400 bg-white';
const labelCls = 'text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block';

export function BulkTaskModal({ open, leads, onClose, onDone }: {
    open: boolean;
    leads: BulkTaskLead[];
    onClose: () => void;
    onDone: () => void;
}) {
    const { session } = useContext(AuthContext);
    const toast = useToast();
    const currentUserId = session?.user?.id ?? null;

    const [title, setTitle] = useState('Takip: {lead}');
    const [assignee, setAssignee] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('normal');
    const [dueAt, setDueAt] = useState('');
    const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!open) return;
        setTitle('Takip: {lead}');
        setAssignee('');
        setPriority('normal');
        setDueAt('');
        setProgress(0);
        if (assignees.length === 0) {
            HrEmployeeService.listEmployees()
                .then(rows => setAssignees(rows.map(e => ({
                    id: e.employee_id,
                    label: e.user?.full_name || e.user?.email || e.employee_id.slice(0, 8),
                    department: e.department ?? null,
                }))))
                .catch(() => setAssignees([]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    const run = async () => {
        const template = title.trim();
        if (!template) { toast.warning('Başlık şablonu gerekli'); return; }
        setRunning(true);
        let ok = 0;
        for (const lead of leads) {
            try {
                const created = await HrTaskService.createTask({
                    title: template.replace('{lead}', lead.label).slice(0, 200),
                    assigned_to: assignee || lead.assignedTo || currentUserId || '',
                    priority,
                    due_at: dueAt ? new Date(dueAt).toISOString() : null,
                    source_type: 'bulk',
                });
                await HrTaskService.addLink(created.id, {
                    entity_type: 'lead', entity_id: lead.id, label: lead.label,
                }).catch(() => undefined);
                ok++;
            } catch (e) {
                console.error('[BulkTaskModal] lead görev hatası:', lead.id, e);
            }
            setProgress(p => p + 1);
        }
        setRunning(false);
        if (ok === leads.length) toast.success(`${ok} görev oluşturuldu`);
        else toast.warning(`${ok}/${leads.length} görev oluşturuldu — kalanlar hata verdi`);
        onDone();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40" onMouseDown={running ? undefined : onClose}>
            <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl" onMouseDown={e => e.stopPropagation()}>
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                        <CheckSquare size={15} className="text-sky-600" /> {leads.length} Lead İçin Görev
                    </h3>
                    <button onClick={onClose} disabled={running} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40" aria-label="Kapat">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className={labelCls}>Başlık Şablonu</label>
                        <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} maxLength={180} />
                        <p className="text-[10.5px] text-slate-400 mt-1">{'{lead}'} müşteri adıyla değişir — her lead için AYRI görev açılır.</p>
                    </div>
                    <div>
                        <label className={labelCls}>Atanan</label>
                        <EmployeeSelect
                            value={assignee}
                            onChange={setAssignee}
                            options={assignees}
                            allowEmpty
                            emptyLabel="Her lead'in sahibi"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Öncelik</label>
                            <select className={inputCls} value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
                                {(Object.keys(TASK_PRIORITY_META) as TaskPriority[]).map(p => (
                                    <option key={p} value={p}>{TASK_PRIORITY_META[p].label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Son Tarih</label>
                            <input type="datetime-local" className={inputCls} value={dueAt} onChange={e => setDueAt(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
                    {running ? (
                        <span className="text-[12px] text-slate-500 tabular-nums inline-flex items-center gap-1.5">
                            <Loader2 size={13} className="animate-spin" /> {progress}/{leads.length}
                        </span>
                    ) : <span />}
                    <div className="flex gap-2">
                        <button onClick={onClose} disabled={running} className="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40 cursor-pointer">
                            Vazgeç
                        </button>
                        <button onClick={() => void run()} disabled={running} className={BTN_ACCENT}>
                            {running && <Loader2 size={13} className="animate-spin" />}
                            Görevleri Oluştur
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
