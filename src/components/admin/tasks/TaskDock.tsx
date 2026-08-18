import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    SquareKanban, X, ExternalLink, Volume2, VolumeX, Loader2,
    Circle, CheckCircle2, CheckCheck, Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { HrTaskService } from '../../../services/admin/hr/hrTaskService';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRealtime } from '../../../hooks/useAdminRealtime';
import { isTaskSoundOn, setTaskSound, type TaskNotificationsState } from '../../../hooks/useTaskNotifications';
import { playPing } from '../../../lib/notificationSound';
import { TaskDueLabel } from './TaskStatusChip';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import { TYPE_META, timeAgo } from './TaskBell';
import { toCanonicalPath, withBase } from '../nav/navConfig';
import { usePanelBase } from '../../../contexts/PanelBaseContext';
import { avatarColor, isTaskOpen, isTaskOverdue } from '../../../types/hrTasks';
import type { HrTask } from '../../../types/hrTasks';

// GÖREV BALONU — WhatsApp/destek balonlarının 4. üyesi: HER sayfadan tek
// tıkla görev takibi. Panelde Görevlerim (checkbox'la tamamla + hızlı ekle)
// ve Bildirimler sekmeleri; görev tıklanınca detay çekmecesi BULUNDUĞUN
// sayfanın üstünde açılır — sayfa değişmez.
//
// Veri: tek useTaskNotifications örneği PROP'la gelir (provider yalnız
// Outlet'i sarıyor; kabuk kromundan context görünmez — TaskBell deseni).
// Görev listesi panelin kendi fetch'idir ve yalnız panel açıkken canlıdır.
// Rota gizleme toCanonicalPath ile — /team tabanında da doğru çalışır
// (eski balonlardaki bilinen pathname kusuru tekrarlanmadı).

const BUBBLE_POS = 'bottom-6 right-[15rem] max-[640px]:bottom-[15rem] max-[640px]:right-4';

function isToday(iso: string): boolean {
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function TaskDock({ state, currentUserId, canManage }: {
    state: TaskNotificationsState;
    currentUserId: string | null;
    canManage: boolean;
}) {
    const location = useLocation();
    const base = usePanelBase();
    const toast = useToast();
    const canonical = toCanonicalPath(location.pathname);

    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'tasks' | 'notifications'>('tasks');
    const [tasks, setTasks] = useState<HrTask[]>([]);
    const [tasksLoaded, setTasksLoaded] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [detailId, setDetailId] = useState<string | null>(null);
    const [quickTitle, setQuickTitle] = useState('');
    const [quickSaving, setQuickSaving] = useState(false);
    const [soundOn, setSoundOn] = useState<boolean>(isTaskSoundOn);

    const loadTasks = useCallback(() => {
        if (!currentUserId) return;
        HrTaskService.myTasks(currentUserId)
            .then(setTasks)
            .catch(e => console.error('[TaskDock] load error:', e))
            .finally(() => setTasksLoaded(true));
    }, [currentUserId]);

    // Görev listesi yalnız panel AÇIKKEN canlı — kapalıyken rozet işini
    // zaten paylaşılan hook (openTaskCount) taşıyor; boşa sorgu atılmaz.
    useEffect(() => {
        if (open) loadTasks();
    }, [open, loadTasks]);
    useAdminRealtime(open ? ['hr_tasks'] : [], loadTasks);

    useEffect(() => {
        if (open && tab === 'notifications') void state.loadList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, tab]);

    const openTasks = useMemo(() => tasks.filter(isTaskOpen), [tasks]);
    const overdue = useMemo(() => openTasks.filter(isTaskOverdue), [openTasks]);
    const dueToday = useMemo(
        () => openTasks.filter(t => t.due_at && isToday(t.due_at) && !isTaskOverdue(t)),
        [openTasks],
    );
    const rest = useMemo(
        () => openTasks.filter(t => !overdue.includes(t) && !dueToday.includes(t)),
        [openTasks, overdue, dueToday],
    );

    // Detay: önce listeden; bildirimden gelen görev "Görevlerim"de olmayabilir
    // (yöneticiye ekip bildirimi) — o durumda tekil çekilir.
    const [fetchedDetail, setFetchedDetail] = useState<HrTask | null>(null);
    const detailTask = useMemo(
        () => (detailId ? tasks.find(t => t.id === detailId) ?? fetchedDetail : null),
        [tasks, detailId, fetchedDetail],
    );
    useEffect(() => {
        if (!detailId || tasks.some(t => t.id === detailId)) { setFetchedDetail(null); return; }
        HrTaskService.getTask(detailId)
            .then(t => setFetchedDetail(t))
            .catch(() => setFetchedDetail(null));
    }, [detailId, tasks]);

    // Görevler sayfasındayken balon gereksiz gürültü — gizle.
    if (canonical === '/admin/tasks') return null;

    const badge = state.unreadCount > 0
        ? { count: state.unreadCount, cls: 'bg-red-500' }
        : state.openTaskCount > 0
            ? { count: state.openTaskCount, cls: 'bg-sky-800' }
            : null;

    const complete = async (t: HrTask) => {
        setBusyId(t.id);
        try {
            await HrTaskService.setStatus(t.id, 'done');
            loadTasks();
            state.refresh();
        } catch (e: any) {
            toast.error(e?.message || 'Tamamlanamadı');
        } finally {
            setBusyId(null);
        }
    };

    const quickCreate = async () => {
        const title = quickTitle.trim();
        if (!title || !currentUserId) return;
        setQuickSaving(true);
        try {
            await HrTaskService.createTask({ title, assigned_to: currentUserId, source_type: 'manual' });
            setQuickTitle('');
            loadTasks();
            state.refresh();
        } catch (e: any) {
            toast.error(e?.message || 'Oluşturulamadı');
        } finally {
            setQuickSaving(false);
        }
    };

    const toggleSound = () => {
        setSoundOn(prev => {
            const next = !prev;
            setTaskSound(next);
            if (next) playPing();   // test bip'i — kullanıcı jesti autoplay kilidini açar
            return next;
        });
    };

    const taskRow = (t: HrTask) => {
        const assigneeName = t.assignee?.full_name || t.assignee?.email;
        return (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 group">
                <button
                    onClick={() => void complete(t)}
                    disabled={busyId === t.id}
                    title="Tamamla"
                    className="shrink-0 text-slate-300 hover:text-emerald-600 cursor-pointer"
                    aria-label={`${t.title} görevini tamamla`}
                >
                    {busyId === t.id ? <Loader2 size={15} className="animate-spin" /> : <Circle size={15} />}
                </button>
                <button onClick={() => setDetailId(t.id)} className="min-w-0 flex-1 text-left cursor-pointer">
                    <span className="block text-[12.5px] font-medium text-slate-800 truncate group-hover:text-slate-900">
                        {t.title}
                    </span>
                </button>
                <TaskDueLabel task={t} />
            </li>
        );
    };

    const section = (label: string, rows: HrTask[], tone?: string) => rows.length > 0 && (
        <div>
            <p className={`px-3 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider ${tone ?? 'text-slate-400'}`}>
                {label} · {rows.length}
            </p>
            <ul className="divide-y divide-slate-50">{rows.map(taskRow)}</ul>
        </div>
    );

    return (
        <>
            {/* Balon */}
            <button
                onClick={() => setOpen(v => !v)}
                title="Görevler"
                aria-label="Görev paneli"
                className={`fixed ${BUBBLE_POS} z-40 w-14 h-14 rounded-full bg-sky-600 hover:bg-sky-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer`}
            >
                <SquareKanban size={24} />
                {badge && (
                    <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1 inline-flex items-center justify-center rounded-full text-[11px] font-bold text-white border-2 border-white ${badge.cls}`}>
                        {badge.count > 99 ? '99+' : badge.count}
                    </span>
                )}
            </button>

            {/* Mini panel */}
            {open && (
                <div className="fixed bottom-24 right-6 z-40 w-[380px] h-[540px] max-h-[calc(100vh-8rem)] max-[640px]:bottom-20 max-[640px]:left-3 max-[640px]:right-3 max-[640px]:w-auto max-[640px]:h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
                    {/* Başlık */}
                    <div className="px-4 py-3 bg-sky-700 text-white flex items-center gap-2 shrink-0">
                        <SquareKanban size={16} />
                        <p className="text-[13.5px] font-semibold flex-1">Görevler</p>
                        <button
                            onClick={toggleSound}
                            title={soundOn ? 'Bildirim sesi açık' : 'Bildirim sesi kapalı'}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${soundOn ? 'text-white hover:bg-white/15' : 'text-white/50 hover:bg-white/15'}`}
                        >
                            {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        </button>
                        <Link
                            to={withBase('/admin/tasks', base)}
                            onClick={() => setOpen(false)}
                            title="Tam sayfayı aç"
                            className="p-1.5 rounded-md text-white hover:bg-white/15"
                        >
                            <ExternalLink size={14} />
                        </Link>
                        <button onClick={() => setOpen(false)} className="p-1.5 rounded-md text-white hover:bg-white/15 cursor-pointer" aria-label="Kapat">
                            <X size={15} />
                        </button>
                    </div>

                    {/* Sekmeler */}
                    <div className="flex border-b border-slate-100 shrink-0">
                        {([
                            ['tasks', `Görevlerim${state.openTaskCount > 0 ? ` (${state.openTaskCount})` : ''}`],
                            ['notifications', `Bildirimler${state.unreadCount > 0 ? ` (${state.unreadCount})` : ''}`],
                        ] as ['tasks' | 'notifications', string][]).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className={`flex-1 py-2 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                                    tab === key ? 'text-sky-700 border-b-2 border-sky-600 bg-sky-50/50' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >{label}</button>
                        ))}
                    </div>

                    {/* İçerik */}
                    <div className="flex-1 overflow-y-auto">
                        {tab === 'tasks' ? (
                            !tasksLoaded ? (
                                <div className="py-10 flex justify-center"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
                            ) : openTasks.length === 0 ? (
                                <div className="py-10 text-center">
                                    <CheckCircle2 size={26} className="mx-auto text-emerald-400 mb-2" />
                                    <p className="text-[12.5px] text-slate-400">Açık göreviniz yok</p>
                                </div>
                            ) : (
                                <>
                                    {section('Geciken', overdue, 'text-rose-500')}
                                    {section('Bugün', dueToday, 'text-amber-600')}
                                    {section('Diğer', rest)}
                                </>
                            )
                        ) : (
                            state.listLoading && state.items.length === 0 ? (
                                <div className="py-10 flex justify-center"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
                            ) : state.items.length === 0 ? (
                                <p className="py-10 text-center text-[12.5px] text-slate-400">Bildirim yok</p>
                            ) : (
                                <>
                                    {state.unreadCount > 0 && (
                                        <div className="px-3 pt-2 flex justify-end">
                                            <button onClick={() => void state.markAllRead()} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-emerald-600 cursor-pointer">
                                                <CheckCheck size={12} /> Tümünü okundu işaretle
                                            </button>
                                        </div>
                                    )}
                                    <ul className="divide-y divide-slate-50">
                                        {state.items.map(n => {
                                            const meta = TYPE_META[n.type] ?? TYPE_META.task_status;
                                            const Icon = meta.icon;
                                            return (
                                                <li key={n.id}>
                                                    <button
                                                        onClick={() => { if (!n.is_read) void state.markAsRead(n.id); if (n.task_id) setDetailId(n.task_id); setTab('tasks'); }}
                                                        className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-slate-50 ${n.is_read ? 'opacity-60' : ''}`}
                                                    >
                                                        <span className={`mt-0.5 p-1.5 rounded-md shrink-0 ${meta.cls}`}><Icon size={12} /></span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-[12.5px] font-medium text-slate-800 truncate">{n.title}</span>
                                                            {n.message && <span className="block text-[11px] text-slate-500 truncate">{n.message}</span>}
                                                            <span className="block text-[10px] text-slate-400 mt-0.5">{timeAgo(n.created_at)}</span>
                                                        </span>
                                                        {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-sky-500 shrink-0" />}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </>
                            )
                        )}
                    </div>

                    {/* Hızlı ekle */}
                    {tab === 'tasks' && (
                        <div className="border-t border-slate-100 px-3 py-2 flex items-center gap-2 shrink-0">
                            <Plus size={14} className="text-slate-300 shrink-0" />
                            <input
                                className="flex-1 text-[12.5px] outline-none placeholder:text-slate-400"
                                placeholder="Hızlı görev — başlık + Enter"
                                value={quickTitle}
                                onChange={e => setQuickTitle(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') void quickCreate(); }}
                                disabled={quickSaving}
                            />
                            {quickSaving && <Loader2 size={13} className="animate-spin text-slate-400" />}
                        </div>
                    )}
                </div>
            )}

            {/* Görev detayı — bulunduğun sayfanın üstünde, sayfa değişmez */}
            {detailTask && (
                <TaskDetailDrawer
                    task={detailTask}
                    canManage={canManage}
                    currentUserId={currentUserId}
                    onClose={() => setDetailId(null)}
                    onChanged={() => { loadTasks(); state.refresh(); }}
                    onDeleted={() => { loadTasks(); state.refresh(); }}
                />
            )}
        </>
    );
}
