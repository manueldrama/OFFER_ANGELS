import { useCallback, useEffect, useRef, useState } from 'react';
import {
    X, Check, Trash2, Pencil, Copy, History, Loader2, Plus, Send,
    Circle, CheckCircle2, Paperclip, CalendarDays, Undo2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { HrTaskService } from '../../../services/admin/hr/hrTaskService';
import { HrEmployeeService } from '../../../services/admin/hr/hrEmployeeService';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateTR } from '../../../pages/admin/hr/_shared';
import { LabelPicker, LabelChip } from './LabelPicker';
import { TaskAttachments } from './TaskAttachments';
import { TaskEntityLinkModal } from './TaskEntityLinkModal';
import { EmployeeSelect, type AssigneeOption } from './EmployeeSelect';
import { TASK_ENTITY_REGISTRY } from '../../../lib/tasks/entityRegistry';
import { withBase } from '../nav/navConfig';
import { usePanelBase } from '../../../contexts/PanelBaseContext';
import {
    STATUS_DOT, TASK_PRIORITY_META, TASK_STATUS_META,
    avatarColor, formatDuration, isSelfTask, taskCode,
} from '../../../types/hrTasks';
import type {
    HrTask, HrTaskAttachment, HrTaskComment, HrTaskItem, HrTaskLink,
    TaskPriority, TaskStatus,
} from '../../../types/hrTasks';

// GÖREV DETAYI — MOCKUP DÜZENİ: ortalanmış iki kolonlu modal.
// Üst bar: ✓ Tamamla + breadcrumb + görev kodu (CFP-101) + kopya/sil/kapat.
// Sol: başlık, açıklama kutusu, ilerleme çubuklu alt görevler, kartlı ekler,
// Yorumlar|Aktivite sekmeleri. Sağ: durum/öncelik pill'leri, atanan, son
// tarih, etiketler, ZAMAN TAKİBİ kronometresi, ilişkili kayıtlar.
//
// Dosya adı ve props API'si tarihsel (drawer dönemi) — TÜM çağıranlar
// (TasksPage, TaskDock, RelatedTasksPanel) değişmeden çalışır.

interface ActivityRow {
    id: string;
    action_type: string;
    new_value: any;
    created_at: string;
    sales_users?: { full_name: string | null; email: string | null } | null;
}

const ACTIVITY_LABEL: Record<string, string> = {
    'hr.task.create': 'Görev oluşturuldu',
    'hr.task.update': 'Görev düzenlendi',
    'hr.task.status': 'Durum değişti',
    'hr.task.assign': 'Atama değişti',
    'hr.task.approve': 'Onaylandı',
    'hr.task.reopen': 'Yeniden açıldı',
    'hr.task.delete': 'Silindi',
};

const STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'waiting', 'done', 'approved', 'cancelled'];
const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

/** Personelin izinli hedefleri (DB trigger'ıyla birebir) — UI ön kontrolü. */
function employeeTargets(from: TaskStatus): TaskStatus[] {
    if (['pending', 'in_progress', 'waiting'].includes(from)) return ['pending', 'in_progress', 'waiting', 'done'];
    if (from === 'done') return ['in_progress', 'done'];
    return [from];
}

function initials(name: string | null | undefined): string {
    if (!name) return '?';
    return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toLocaleUpperCase('tr');
}

const SIDE_LABEL = 'text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5';

export function TaskDetailDrawer({
    task, canManage, currentUserId, onClose, onChanged, onDeleted, onEdit,
}: {
    task: HrTask;
    canManage: boolean;
    currentUserId: string | null;
    onClose: () => void;
    onChanged: () => void;
    onDeleted?: () => void;
    onEdit?: () => void;
}) {
    const toast = useToast();
    const base = usePanelBase();
    const [items, setItems] = useState<HrTaskItem[]>([]);
    const [comments, setComments] = useState<HrTaskComment[]>([]);
    const [attachments, setAttachments] = useState<HrTaskAttachment[]>([]);
    const [links, setLinks] = useState<HrTaskLink[]>([]);
    const [activity, setActivity] = useState<ActivityRow[]>([]);
    const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [tab, setTab] = useState<'comments' | 'activity'>('comments');
    const [newComment, setNewComment] = useState('');
    const [newItem, setNewItem] = useState('');
    const [commentFile, setCommentFile] = useState<File | null>(null);
    const [sendingComment, setSendingComment] = useState(false);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [labelsOpen, setLabelsOpen] = useState(false);
    const [dueOpen, setDueOpen] = useState(false);
    const [tick, setTick] = useState(0);
    const commentFileRef = useRef<HTMLInputElement>(null);
    const labelsRef = useRef<HTMLDivElement>(null);
    const dueRef = useRef<HTMLDivElement>(null);

    const isAssignee = currentUserId === task.assigned_to;
    const self = isSelfTask(task);
    const canEditMeta = canManage || self;
    const canTouch = canManage || isAssignee;
    const locked = task.status === 'approved' || task.status === 'cancelled';

    const load = useCallback(async () => {
        try {
            const [i, c, a, l] = await Promise.all([
                HrTaskService.listItems(task.id),
                HrTaskService.listComments(task.id),
                HrTaskService.listAttachments(task.id).catch(() => [] as HrTaskAttachment[]),
                HrTaskService.listLinks(task.id).catch(() => [] as HrTaskLink[]),
            ]);
            setItems(i); setComments(c); setAttachments(a); setLinks(l);
        } catch (e) {
            console.error('[TaskDetail] load error:', e);
        } finally {
            setLoading(false);
        }
    }, [task.id]);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        if (!canManage) return;
        supabase
            .from('audit_logs')
            .select('id, action_type, new_value, created_at, sales_users(full_name, email)')
            .eq('entity_type', 'hr_tasks')
            .eq('entity_id', task.id)
            .order('created_at', { ascending: false })
            .limit(25)
            .then(({ data, error }) => { if (!error && data) setActivity(data as unknown as ActivityRow[]); });
    }, [canManage, task.id]);

    useEffect(() => {
        if (!canManage || assignees.length > 0) return;
        HrEmployeeService.listEmployees()
            .then(rows => setAssignees(rows.map(e => ({
                id: e.employee_id,
                label: e.user?.full_name || e.user?.email || e.employee_id.slice(0, 8),
                department: e.department ?? null,
            }))))
            .catch(() => setAssignees([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canManage]);

    // Sayaç çalışıyorsa saniyelik canlı akış.
    useEffect(() => {
        if (!task.timer_started_at) return;
        const id = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(id);
    }, [task.timer_started_at]);

    // Esc kapatır; popover'lar önce kendini kapatır.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || linkModalOpen) return;
            if (labelsOpen) { setLabelsOpen(false); return; }
            if (dueOpen) { setDueOpen(false); return; }
            onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, linkModalOpen, labelsOpen, dueOpen]);

    // Popover dış-tık kapanışları.
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (labelsOpen && labelsRef.current && !labelsRef.current.contains(e.target as Node)) setLabelsOpen(false);
            if (dueOpen && dueRef.current && !dueRef.current.contains(e.target as Node)) setDueOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [labelsOpen, dueOpen]);

    const act = async (fn: () => Promise<unknown>, okMsg?: string) => {
        setBusy(true);
        try {
            await fn();
            if (okMsg) toast.success(okMsg);
            onChanged();
        } catch (e: any) {
            toast.error(e?.message || 'İşlem başarısız');
        } finally {
            setBusy(false);
        }
    };

    const setStatus = (s: TaskStatus) => void act(
        () => (s === 'approved' ? HrTaskService.approveTask(task.id) : HrTaskService.setStatus(task.id, s)),
        `Durum: ${TASK_STATUS_META[s].label}`,
    );

    const toggleItem = async (item: HrTaskItem) => {
        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, is_done: !i.is_done } : i)));
        try { await HrTaskService.toggleItem(item.id, !item.is_done); } catch { void load(); }
    };

    const addItem = async () => {
        const label = newItem.trim();
        if (!label) return;
        setNewItem('');
        try {
            const created = await HrTaskService.addItem(task.id, label, items.length);
            setItems(prev => [...prev, created]);
        } catch (e: any) { toast.error(e?.message || 'Madde eklenemedi'); }
    };

    const sendComment = async () => {
        const body = newComment.trim();
        if (!body && !commentFile) return;
        setSendingComment(true);
        try {
            const created = await HrTaskService.addComment(task.id, body || 'Dosya ekledi');
            if (commentFile) await HrTaskService.uploadAttachment(task.id, commentFile, created.id);
            setNewComment(''); setCommentFile(null);
            void load(); onChanged();
        } catch (e: any) {
            toast.error(e?.message || 'Yorum gönderilemedi');
        } finally {
            setSendingComment(false);
        }
    };

    const copyLink = () => {
        const url = `${window.location.origin}${withBase('/admin/tasks', base)}?task=${task.id}`;
        navigator.clipboard?.writeText(url)
            .then(() => toast.success('Görev bağlantısı kopyalandı'))
            .catch(() => toast.error('Kopyalanamadı'));
    };

    const timerRunning = !!task.timer_started_at;
    const totalSeconds = (task.time_spent_seconds ?? 0) + (timerRunning
        ? Math.floor((Date.now() - new Date(task.timer_started_at!).getTime()) / 1000)
        : 0);
    void tick; // canlı akış re-render tetikleyicisi

    const doneItems = items.filter(i => i.is_done).length;
    const taskAttachments = attachments.filter(a => !a.comment_id);
    const commentAttachments = (commentId: string) => attachments.filter(a => a.comment_id === commentId);
    const allowedTargets = canManage ? STATUS_ORDER : employeeTargets(task.status);

    const statusPill = (s: TaskStatus) => {
        const active = task.status === s;
        const dot = STATUS_DOT[s];
        const allowed = allowedTargets.includes(s);
        return (
            <button
                key={s}
                disabled={busy || active || !allowed || !canTouch}
                onClick={() => setStatus(s)}
                className={`h-7 px-2.5 rounded-full text-[12px] font-semibold border transition-all cursor-pointer disabled:cursor-default ${
                    active
                        ? `${dot.text} border-current bg-white ring-1 ring-current`
                        : allowed && canTouch
                            ? 'text-slate-500 border-slate-200 bg-white hover:border-slate-300'
                            : 'text-slate-300 border-slate-100 bg-white'
                }`}
            >
                {TASK_STATUS_META[s].label}
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onMouseDown={onClose}>
            <div
                className="w-[92vw] max-w-[1000px] max-h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                onMouseDown={e => e.stopPropagation()}
            >
                {/* ÜST BAR — Tamamla + breadcrumb | kod + kopya + düzenle + sil + X */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
                    {canTouch && !locked && (
                        task.status === 'done' && canManage ? (
                            <button
                                disabled={busy}
                                onClick={() => setStatus('approved')}
                                className="h-8 px-3 rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-[12.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                                <Check size={14} /> Onayla
                            </button>
                        ) : (
                            <button
                                disabled={busy || task.status === 'done'}
                                onClick={() => setStatus('done')}
                                className="h-8 px-3 rounded-lg border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 text-[12.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                            >
                                <Check size={14} /> {task.status === 'done' ? 'Tamamlandı' : 'Tamamla'}
                            </button>
                        )
                    )}
                    {locked && canManage && (
                        <button
                            disabled={busy}
                            onClick={() => setStatus('in_progress')}
                            className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 text-[12.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                            <Undo2 size={13} /> Yeniden Aç
                        </button>
                    )}
                    <p className="text-[12.5px] text-slate-400 min-w-0 truncate">
                        Görevler <span className="mx-1 text-slate-300">/</span> {TASK_STATUS_META[task.status].label}
                    </p>
                    <div className="ml-auto flex items-center gap-1 shrink-0">
                        <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-[11.5px] font-bold font-mono tracking-wide">
                            {taskCode(task)}
                        </span>
                        <button onClick={copyLink} title="Bağlantıyı kopyala" className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
                            <Copy size={14} />
                        </button>
                        {canEditMeta && onEdit && (
                            <button onClick={onEdit} title="Düzenle" className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
                                <Pencil size={14} />
                            </button>
                        )}
                        {(canManage || (self && !locked)) && (
                            <button
                                disabled={busy}
                                onClick={() => {
                                    if (!window.confirm('Görev silinsin mi? Bu geri alınamaz.')) return;
                                    void act(async () => {
                                        await HrTaskService.deleteTask(task.id);
                                        onDeleted?.();
                                        onClose();
                                    }, 'Görev silindi');
                                }}
                                title="Sil"
                                className="p-1.5 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Kapat">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* GÖVDE — iki kolon */}
                <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_300px]">
                    {/* SOL */}
                    <div className="overflow-y-auto p-6 min-w-0">
                        <h2 className="text-[22px] font-bold text-slate-900 break-words">{task.title}</h2>
                        <p className="text-[12px] text-slate-400 mt-1">
                            Oluşturma: {formatDateTR(task.created_at)} · Atayan: {self ? 'Kendisi' : task.creator?.full_name || task.creator?.email || '—'}
                        </p>

                        {task.description && (
                            <div className="mt-5">
                                <p className={SIDE_LABEL}>Açıklama</p>
                                <div className="bg-slate-50 rounded-lg p-4 text-[13.5px] text-slate-700 whitespace-pre-wrap break-words">
                                    {task.description}
                                </div>
                            </div>
                        )}

                        {/* ALT GÖREVLER */}
                        <div className="mt-5">
                            <div className="flex items-center gap-2">
                                <p className={SIDE_LABEL + ' mb-0'}>Alt Görevler</p>
                                {items.length > 0 && <span className="text-[11px] font-bold text-slate-500 tabular-nums">{doneItems}/{items.length}</span>}
                                {items.length > 0 && (
                                    <div className="h-1.5 w-40 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneItems / items.length) * 100}%` }} />
                                    </div>
                                )}
                            </div>
                            {loading ? (
                                <div className="py-4"><Loader2 size={14} className="animate-spin text-slate-400" /></div>
                            ) : (
                                <ul className="mt-2 space-y-0.5">
                                    {items.map(item => (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => void toggleItem(item)}
                                                disabled={locked}
                                                className="w-full flex items-center gap-2.5 px-1 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors disabled:cursor-default"
                                            >
                                                {item.is_done
                                                    ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                                    : <Circle size={16} className="text-slate-300 shrink-0" />}
                                                <span className={`text-[13px] break-words ${item.is_done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                                    {item.label}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {!locked && (
                                <div className="flex gap-2 mt-2">
                                    <input
                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[12.5px] outline-none focus:border-slate-400"
                                        placeholder="Alt görev ekle…"
                                        value={newItem}
                                        onChange={e => setNewItem(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') void addItem(); }}
                                    />
                                    <button
                                        onClick={() => void addItem()}
                                        className="h-9 px-3 rounded-lg border border-slate-200 text-slate-600 text-[12.5px] font-semibold hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus size={13} /> Ekle
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* EKLER */}
                        <div className="mt-5">
                            <p className={SIDE_LABEL}>Ekler{taskAttachments.length > 0 && ` · ${taskAttachments.length}`}</p>
                            <TaskAttachments
                                taskId={task.id}
                                attachments={taskAttachments}
                                onChanged={() => { void load(); onChanged(); }}
                                readOnly={locked}
                            />
                        </div>

                        {/* YORUMLAR | AKTİVİTE */}
                        <div className="mt-6 border-t border-slate-100 pt-1">
                            <div className="flex items-center gap-5 border-b border-slate-100">
                                <button
                                    onClick={() => setTab('comments')}
                                    className={`pb-2 pt-2 text-[12.5px] font-semibold border-b-2 -mb-px cursor-pointer ${tab === 'comments' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                                >
                                    Yorumlar{comments.length > 0 && ` · ${comments.length}`}
                                </button>
                                {canManage && (
                                    <button
                                        onClick={() => setTab('activity')}
                                        className={`pb-2 pt-2 text-[12.5px] font-semibold border-b-2 -mb-px inline-flex items-center gap-1 cursor-pointer ${tab === 'activity' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                                    >
                                        <History size={12} /> Aktivite
                                    </button>
                                )}
                            </div>

                            {tab === 'comments' ? (
                                <>
                                    <ul className="mt-3 space-y-3">
                                        {comments.map(c => {
                                            const cAtts = commentAttachments(c.id);
                                            const authorName = c.author?.full_name || c.author?.email || '—';
                                            return (
                                                <li key={c.id} className="flex items-start gap-2.5">
                                                    <span className={`w-7 h-7 rounded-full text-white text-[10px] font-bold inline-flex items-center justify-center shrink-0 mt-0.5 ${avatarColor(authorName)}`}>
                                                        {initials(authorName)}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[12px]">
                                                            <span className="font-bold text-slate-800">{authorName}</span>
                                                            <span className="text-slate-400"> · {formatDateTR(c.created_at)}</span>
                                                        </p>
                                                        <p className="text-[13px] text-slate-700 mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
                                                        {cAtts.length > 0 && (
                                                            <div className="mt-1 flex flex-wrap gap-1.5">
                                                                {cAtts.map(a => (
                                                                    <button
                                                                        key={a.id}
                                                                        onClick={() => void HrTaskService.getAttachmentUrl(a.storage_path).then(u => window.open(u, '_blank', 'noopener')).catch(() => toast.error('Dosya açılamadı'))}
                                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-medium text-sky-700 hover:border-sky-300 cursor-pointer"
                                                                    >
                                                                        <Paperclip size={10} /> {a.file_name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                        {!loading && comments.length === 0 && (
                                            <li className="text-[12px] text-slate-400">Henüz yorum yok</li>
                                        )}
                                    </ul>

                                    {commentFile && (
                                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-sky-50 text-sky-700 text-[11.5px] font-medium">
                                            <Paperclip size={11} /> {commentFile.name}
                                            <button onClick={() => setCommentFile(null)} className="hover:opacity-70 cursor-pointer" aria-label="Eki kaldır"><X size={11} /></button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-3">
                                        <span className={`w-7 h-7 rounded-full text-white text-[10px] font-bold inline-flex items-center justify-center shrink-0 ${avatarColor('Ben')}`}>
                                            {initials('Ben')}
                                        </span>
                                        <input
                                            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-slate-400"
                                            placeholder="Yorum yaz… @ ile bahset"
                                            value={newComment}
                                            onChange={e => setNewComment(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') void sendComment(); }}
                                        />
                                        <button
                                            onClick={() => commentFileRef.current?.click()}
                                            title="Dosya ekle"
                                            className={`p-2 rounded-lg cursor-pointer ${commentFile ? 'text-sky-600 bg-sky-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                                        >
                                            <Paperclip size={15} />
                                        </button>
                                        <button
                                            onClick={() => void sendComment()}
                                            disabled={sendingComment}
                                            className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                            aria-label="Gönder"
                                        >
                                            {sendingComment ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                        </button>
                                        <input ref={commentFileRef} type="file" className="hidden" onChange={e => { setCommentFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                                    </div>
                                </>
                            ) : (
                                <ul className="mt-3 space-y-2">
                                    {activity.map(a => (
                                        <li key={a.id} className="flex items-start gap-2 text-[12.5px]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                                            <span className="min-w-0 flex-1 text-slate-600">
                                                <span className="font-semibold">{ACTIVITY_LABEL[a.action_type] ?? a.action_type}</span>
                                                {a.new_value?.status && ` → ${TASK_STATUS_META[a.new_value.status as TaskStatus]?.label ?? a.new_value.status}`}
                                                <span className="text-slate-400">
                                                    {' · '}{a.sales_users?.full_name || a.sales_users?.email || '—'}
                                                    {' · '}{formatDateTR(a.created_at)}
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                    {activity.length === 0 && <li className="text-[12px] text-slate-400">Kayıt yok</li>}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* SAĞ PANEL */}
                    <div className="bg-slate-50/70 border-l border-slate-100 overflow-y-auto p-4 space-y-5">
                        <div>
                            <p className={SIDE_LABEL}>Durum</p>
                            <div className="flex flex-wrap gap-1.5">{STATUS_ORDER.map(statusPill)}</div>
                        </div>

                        <div>
                            <p className={SIDE_LABEL}>Öncelik</p>
                            <div className="flex flex-wrap gap-1.5">
                                {PRIORITY_ORDER.map(p => {
                                    const active = task.priority === p;
                                    const cls = p === 'urgent' ? 'text-rose-600 border-rose-300' : p === 'high' ? 'text-amber-600 border-amber-300' : p === 'normal' ? 'text-sky-600 border-sky-300' : 'text-slate-500 border-slate-300';
                                    return (
                                        <button
                                            key={p}
                                            disabled={busy || active || !canEditMeta}
                                            onClick={() => void act(() => HrTaskService.updateTask(task.id, { priority: p }))}
                                            className={`h-7 px-2.5 rounded-full text-[12px] font-semibold border bg-white transition-all cursor-pointer disabled:cursor-default ${
                                                active
                                                    ? p === 'urgent' ? 'bg-rose-600 text-white border-rose-600' : `${cls} ring-1 ring-current`
                                                    : canEditMeta ? 'text-slate-400 border-slate-200 hover:border-slate-300' : 'text-slate-300 border-slate-100'
                                            }`}
                                        >
                                            {TASK_PRIORITY_META[p].label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className={SIDE_LABEL}>Atanan</p>
                                {canManage ? (
                                    <EmployeeSelect
                                        variant="pill"
                                        value={task.assigned_to}
                                        onChange={id => void act(() => HrTaskService.updateTask(task.id, { assigned_to: id }))}
                                        options={assignees}
                                    />
                                ) : (
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className={`w-6 h-6 rounded-full text-white text-[9.5px] font-bold inline-flex items-center justify-center ${avatarColor(task.assignee?.full_name || '?')}`}>
                                            {initials(task.assignee?.full_name || task.assignee?.email)}
                                        </span>
                                        <span className="text-[12.5px] font-medium text-slate-700 truncate">
                                            {task.assignee?.full_name || task.assignee?.email || '—'}
                                        </span>
                                    </span>
                                )}
                            </div>
                            <div ref={dueRef} className="relative">
                                <p className={SIDE_LABEL}>Son Tarih</p>
                                <button
                                    disabled={!canEditMeta}
                                    onClick={() => setDueOpen(v => !v)}
                                    className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${canEditMeta ? 'cursor-pointer hover:opacity-70' : ''} ${
                                        task.due_at && new Date(task.due_at) < new Date() && !locked ? 'text-rose-600' : 'text-slate-700'
                                    }`}
                                >
                                    <CalendarDays size={13} className="text-slate-400" />
                                    {task.due_at
                                        ? `${formatDateTR(task.due_at)} ${new Date(task.due_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
                                        : '—'}
                                </button>
                                {dueOpen && (
                                    <div className="absolute right-0 top-full mt-1 z-[70] bg-white rounded-lg border border-slate-200 shadow-xl p-3">
                                        <input
                                            type="datetime-local"
                                            className="border border-slate-200 rounded-md px-2 py-1.5 text-[12px] outline-none focus:border-slate-400"
                                            defaultValue={task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : ''}
                                            onChange={e => {
                                                const v = e.target.value;
                                                void act(() => HrTaskService.updateTask(task.id, { due_at: v ? new Date(v).toISOString() : null }));
                                            }}
                                        />
                                        <button
                                            onClick={() => { setDueOpen(false); void act(() => HrTaskService.updateTask(task.id, { due_at: null })); }}
                                            className="block mt-2 text-[11.5px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >Tarihi kaldır</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div ref={labelsRef} className="relative">
                            <p className={SIDE_LABEL}>Etiketler</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {task.labels.map(l => <LabelChip key={l} label={l} />)}
                                {canEditMeta && (
                                    <button
                                        onClick={() => setLabelsOpen(v => !v)}
                                        className="h-6 px-2 rounded-full border border-dashed border-slate-300 text-[11px] font-semibold text-slate-400 hover:border-slate-400 hover:text-slate-600 cursor-pointer"
                                    >+ Etiket</button>
                                )}
                            </div>
                            {labelsOpen && (
                                <div className="absolute left-0 top-full mt-1 z-[70] w-[260px] bg-white rounded-lg border border-slate-200 shadow-xl p-3">
                                    <LabelPicker
                                        value={task.labels}
                                        onChange={labels => void act(() => HrTaskService.updateTask(task.id, { labels }))}
                                    />
                                </div>
                            )}
                        </div>

                        {/* ZAMAN TAKİBİ */}
                        <div>
                            <p className={SIDE_LABEL}>Zaman Takibi</p>
                            <div className="bg-white rounded-xl border border-slate-200 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className={`text-[20px] font-bold font-mono tabular-nums ${timerRunning ? 'text-emerald-600' : 'text-slate-900'}`}>
                                        {formatDuration(totalSeconds)}
                                    </span>
                                    {canTouch && !locked && (
                                        <button
                                            disabled={busy}
                                            onClick={() => void act(() => timerRunning
                                                ? HrTaskService.stopTimer(task)
                                                : HrTaskService.startTimer(task.id))}
                                            className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                                        >
                                            {timerRunning ? '⏸ Durdur' : '▶ Başlat'}
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10.5px] text-slate-400 mt-1.5">Bu görevde toplam çalışma süresi</p>
                            </div>
                        </div>

                        {/* İLİŞKİLİ KAYITLAR */}
                        <div>
                            <div className="flex items-center justify-between">
                                <p className={SIDE_LABEL + ' mb-0'}>İlişkili Kayıtlar</p>
                                {!locked && (
                                    <button onClick={() => setLinkModalOpen(true)} className="text-[11.5px] font-semibold text-sky-600 hover:underline cursor-pointer">
                                        + Bağla
                                    </button>
                                )}
                            </div>
                            <ul className="mt-2 space-y-1">
                                {links.map(l => {
                                    const def = TASK_ENTITY_REGISTRY[l.entity_type];
                                    return (
                                        <li key={l.id} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-2.5 py-1.5 group">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                l.entity_type === 'lead' ? 'bg-indigo-500' : l.entity_type === 'whatsapp' ? 'bg-emerald-500' : l.entity_type === 'offer' ? 'bg-amber-500' : 'bg-sky-500'
                                            }`} />
                                            <button
                                                onClick={() => { window.location.href = def.route(l, base); }}
                                                className="min-w-0 flex-1 text-left text-[12px] font-semibold text-slate-700 truncate hover:text-slate-900 cursor-pointer"
                                                title={`${def.label}: ${l.label}`}
                                            >
                                                {l.label}
                                            </button>
                                            <span className="text-[10px] font-bold font-mono text-slate-300 shrink-0">
                                                {l.entity_id.slice(0, 8).toUpperCase()}
                                            </span>
                                            {!locked && (
                                                <button
                                                    onClick={() => void act(async () => { await HrTaskService.removeLink(l.id); void load(); })}
                                                    className="p-0.5 rounded text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 cursor-pointer"
                                                    aria-label="Bağı kaldır"
                                                >
                                                    <X size={11} />
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                                {links.length === 0 && <li className="text-[11.5px] text-slate-400">Bağlı kayıt yok</li>}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <TaskEntityLinkModal
                open={linkModalOpen}
                taskId={task.id}
                onClose={() => setLinkModalOpen(false)}
                onLinked={() => void load()}
            />
        </div>
    );
}
