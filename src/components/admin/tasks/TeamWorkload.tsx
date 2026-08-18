import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { Chip, DEPARTMENT_META } from '../../../pages/admin/hr/_shared';
import { avatarColor, isTaskOpen, isTaskOverdue } from '../../../types/hrTasks';
import type { AssigneeOption } from './EmployeeSelect';
import type { HrTask } from '../../../types/hrTasks';

// EKİP İŞ YÜKÜ (spec §37) — çalışan başına Açık / Devam / Bugün / Geciken.
// Amaç operasyon görünürlüğüdür, performans puanı DEĞİL (o iş KPI modülünün;
// buradaki sayılar yorumsuz verilir). Kart tıklaması o çalışana filtreler.
//
// Sayım istemcidedir (repo genel deseni); listTasks 500 kayıt sınırı geçerli —
// binlerce açık görevde sunucu tarafına taşınmalı (plan riskler bölümü).

function isToday(iso: string): boolean {
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function initials(name: string): string {
    return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toLocaleUpperCase('tr');
}

export function TeamWorkload({ tasks, employees, onSelectEmployee }: {
    tasks: HrTask[];
    employees: AssigneeOption[];
    onSelectEmployee: (employeeId: string) => void;
}) {
    const rows = useMemo(() => {
        const byAssignee = new Map<string, HrTask[]>();
        for (const t of tasks) {
            if (!byAssignee.has(t.assigned_to)) byAssignee.set(t.assigned_to, []);
            byAssignee.get(t.assigned_to)!.push(t);
        }
        // Personel listesi ∪ görevlerde geçen atananlar: hr_employees'te
        // olmayan kişi (ör. adminin kendisi) kaybolmasın.
        const known = new Set(employees.map(e => e.id));
        const extras: AssigneeOption[] = [];
        for (const [id, list] of byAssignee) {
            if (known.has(id)) continue;
            const a = list[0].assignee;
            extras.push({ id, label: a?.full_name || a?.email || id.slice(0, 8), department: null });
        }
        return [...employees, ...extras]
            .map(e => {
                const list = byAssignee.get(e.id) ?? [];
                const open = list.filter(isTaskOpen);
                return {
                    employee: e,
                    open: open.length,
                    inProgress: list.filter(t => t.status === 'in_progress').length,
                    dueToday: open.filter(t => t.due_at && isToday(t.due_at) && !isTaskOverdue(t)).length,
                    overdue: open.filter(isTaskOverdue).length,
                    review: list.filter(t => t.status === 'done').length,
                };
            })
            // En yüklü üstte — yöneticinin sorusu "kimin üzerinde fazla iş var"
            .sort((a, b) => (b.overdue - a.overdue) || (b.open - a.open));
    }, [tasks, employees]);

    if (employees.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <Users size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[13px] text-slate-400">Personel listesi yüklenemedi</p>
            </div>
        );
    }

    const stat = (value: number, label: string, activeCls: string) => (
        <div className={`rounded-lg px-2 py-1.5 text-center ${value > 0 ? activeCls : 'bg-slate-50'}`}>
            <p className={`text-[16px] font-bold tabular-nums ${value > 0 ? '' : 'text-slate-300'}`}>{value}</p>
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        </div>
    );

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map(r => (
                <button
                    key={r.employee.id}
                    onClick={() => onSelectEmployee(r.employee.id)}
                    className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-2.5 mb-3">
                        <span className={`w-9 h-9 rounded-full text-white text-[12px] font-bold inline-flex items-center justify-center shrink-0 ${avatarColor(r.employee.label)}`}>
                            {initials(r.employee.label)}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-semibold text-slate-900 truncate">{r.employee.label}</p>
                            {r.employee.department && <Chip meta={DEPARTMENT_META[r.employee.department]} />}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                        {stat(r.open, 'Açık', 'bg-sky-50 text-sky-700')}
                        {stat(r.dueToday, 'Bugün', 'bg-amber-50 text-amber-700')}
                        {stat(r.overdue, 'Geciken', 'bg-rose-50 text-rose-700')}
                        {stat(r.review, 'Kontrol', 'bg-violet-50 text-violet-700')}
                    </div>
                </button>
            ))}
        </div>
    );
}
