import { Layers, Search } from 'lucide-react';
import { COMPACT_SELECT } from './_ui';
import { TASK_PRIORITY_META } from '../../../types/hrTasks';
import type { AssigneeOption } from './EmployeeSelect';
import type { HrTaskProject, TaskGroupBy, TaskPriority, TaskView } from '../../../types/hrTasks';

// MOCKUP sekme satırı: solda ALTI ÇİZGİLİ görünüm sekmeleri (Liste Pano
// Takvim İş Yükü Rutinler), sağda HEP GÖRÜNÜR filtreler — arama + Tüm
// projeler + Tüm öncelikler + Tüm personel (+ liste için Grupla).

const VIEWS: { key: TaskView; label: string; managerOnly?: boolean }[] = [
    { key: 'list', label: 'Liste' },
    { key: 'board', label: 'Pano' },
    { key: 'calendar', label: 'Takvim' },
    { key: 'workload', label: 'İş Yükü', managerOnly: true },
    { key: 'routines', label: 'Rutinler' },
];

export interface TaskPageFilters {
    projectId: string;
    label: string;
    priority: TaskPriority | '';
    assignedTo: string;
    search: string;
}

export function TasksFilterBar({
    view, onViewChange, canManage,
    filters, onFiltersChange, projects, assignees,
    groupBy, onGroupByChange,
}: {
    view: TaskView;
    onViewChange: (v: TaskView) => void;
    canManage: boolean;
    filters: TaskPageFilters;
    onFiltersChange: (f: TaskPageFilters) => void;
    projects: HrTaskProject[];
    assignees: AssigneeOption[];
    groupBy: TaskGroupBy;
    onGroupByChange: (g: TaskGroupBy) => void;
}) {
    const set = (patch: Partial<TaskPageFilters>) => onFiltersChange({ ...filters, ...patch });
    const showFilters = view !== 'routines' && view !== 'workload';

    return (
        <div className="flex items-end justify-between gap-3 flex-wrap border-b border-slate-200 mb-4">
            {/* Altı çizgili sekmeler */}
            <div className="flex items-center gap-5">
                {VIEWS.filter(v => !v.managerOnly || canManage).map(v => (
                    <button
                        key={v.key}
                        onClick={() => onViewChange(v.key)}
                        className={`pb-2.5 -mb-px text-[13.5px] font-semibold transition-colors cursor-pointer border-b-2 ${
                            view === v.key
                                ? 'text-slate-900 border-slate-900'
                                : 'text-slate-400 border-transparent hover:text-slate-600'
                        }`}
                    >
                        {v.label}
                    </button>
                ))}
            </div>

            {/* Kalıcı filtreler */}
            {showFilters && (
                <div className="flex items-center gap-2 flex-wrap pb-2">
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            className="h-8 w-40 border border-slate-200 rounded-lg pl-7 pr-2.5 text-[12.5px] outline-none focus:border-slate-400 bg-white"
                            placeholder="Görev ara…"
                            value={filters.search}
                            onChange={e => set({ search: e.target.value })}
                        />
                    </div>
                    {view === 'list' && (
                        <div className="relative inline-flex items-center">
                            <Layers size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                            <select className={`${COMPACT_SELECT} pl-7 rounded-lg`} value={groupBy} onChange={e => onGroupByChange(e.target.value as TaskGroupBy)}>
                                <option value="status">Duruma göre</option>
                                <option value="date">Tarihe göre</option>
                                <option value="priority">Önceliğe göre</option>
                                <option value="project">Projeye göre</option>
                                <option value="assignee">Atanana göre</option>
                            </select>
                        </div>
                    )}
                    <select className={`${COMPACT_SELECT} rounded-lg`} value={filters.projectId} onChange={e => set({ projectId: e.target.value })}>
                        <option value="">Tüm projeler</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select className={`${COMPACT_SELECT} rounded-lg`} value={filters.priority} onChange={e => set({ priority: e.target.value as TaskPriority | '' })}>
                        <option value="">Tüm öncelikler</option>
                        {(Object.keys(TASK_PRIORITY_META) as TaskPriority[]).map(p => (
                            <option key={p} value={p}>{TASK_PRIORITY_META[p].label}</option>
                        ))}
                    </select>
                    {canManage && (
                        <select className={`${COMPACT_SELECT} rounded-lg`} value={filters.assignedTo} onChange={e => set({ assignedTo: e.target.value })}>
                            <option value="">Tüm personel</option>
                            {assignees.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                        </select>
                    )}
                </div>
            )}
        </div>
    );
}
