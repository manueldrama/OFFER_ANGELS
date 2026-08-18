import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Circle, Plus, CloudUpload } from 'lucide-react';
import { HrTaskService } from '../../../services/admin/hr/hrTaskService';
import { useToast } from '../../../contexts/ToastContext';
import { LabelPicker } from './LabelPicker';
import { TaskEntityLinkModal } from './TaskEntityLinkModal';
import { EmployeeSelect, type AssigneeOption } from './EmployeeSelect';
import { TASK_ENTITY_REGISTRY, type EntitySearchResult } from '../../../lib/tasks/entityRegistry';
import { COMPACT_SELECT, GHOST_BTN } from './_ui';
import {
    STATUS_DOT, TASK_FREQUENCY_LABEL, TASK_PRIORITY_META, TASK_STATUS_META, WEEKDAY_LABELS,
} from '../../../types/hrTasks';
import type {
    HrTask, HrTaskProject, TaskFrequency, TaskLinkEntityType, TaskPriority, TaskSourceType,
} from '../../../types/hrTasks';

export type { AssigneeOption } from './EmployeeSelect';

// GÖREV OLUŞTURMA/DÜZENLEME — detay modalıyla AYNI iki kolonlu düzen
// (kullanıcı isteği): solda başlık + açıklama + alt görevler, sağda slate
// özellik paneli (durum/öncelik pill'leri, atanan, son tarih, proje, etiket,
// ilişkili kayıtlar, tekrar) ve siyah birincil düğme.
//
// Props API'si öncekiyle BİREBİR — tüm çağıranlar (TasksPage, Leads,
// WhatsAppChat, ContextTaskButton, TaskDock) değişmeden çalışır. Davranış da
// aynı: rutin kipinde kural yazılır, bağlar görev yazıldıktan sonra eklenir,
// kaynak damgalanır, oluşturunca detay modalı açılır (ekler orada yüklenir).

export interface StagedLink {
    entity_type: TaskLinkEntityType;
    entity_id: string;
    label: string;
    meta?: Record<string, string | undefined>;
}

type InitialStatus = 'pending' | 'in_progress' | 'waiting';
const STATUS_CHOICES: InitialStatus[] = ['pending', 'in_progress', 'waiting'];
const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];
const FREQ_CHOICES: (TaskFrequency | null)[] = [null, 'daily', 'weekly', 'monthly'];

const SIDE_LABEL = 'text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5';

/** Detaydaki pill dili: aktif = renkli metin + current ring, pasif = gri çerçeve. */
const pillCls = (active: boolean, activeTone: string) =>
    `h-7 px-2.5 rounded-full text-[12px] font-semibold border bg-white transition-all cursor-pointer ${
        active ? `${activeTone} border-current ring-1 ring-current` : 'text-slate-500 border-slate-200 hover:border-slate-300'
    }`;

function toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function presetLocal(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(18, 0, 0, 0);
    return toLocalInput(d.toISOString());
}

export function TaskFormModal({
    open, onClose, onSaved, canManage, currentUserId, assignees, editTask,
    projects = [], labelSuggestions = [],
    initialTitle, initialDescription, initialAssignee, initialLinks,
    sourceType, sourceId, initialRecurring,
}: {
    open: boolean;
    onClose: () => void;
    onSaved: (createdTask?: HrTask) => void;
    canManage: boolean;
    currentUserId: string | null;
    assignees: AssigneeOption[];
    editTask?: HrTask | null;
    projects?: HrTaskProject[];
    labelSuggestions?: string[];
    initialTitle?: string;
    initialDescription?: string;
    initialAssignee?: string;
    initialLinks?: StagedLink[];
    sourceType?: TaskSourceType;
    sourceId?: string | null;
    /** Rutinler sekmesindeki "Yeni Rutin" — panel Tekrar=haftalık açık başlar. */
    initialRecurring?: boolean;
}) {
    const toast = useToast();
    const titleRef = useRef<HTMLInputElement>(null);
    const [saving, setSaving] = useState(false);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<InitialStatus>('pending');
    const [priority, setPriority] = useState<TaskPriority>('normal');
    const [assignedTo, setAssignedTo] = useState('');
    const [dueAt, setDueAt] = useState('');            // datetime-local değeri
    const [projectId, setProjectId] = useState('');
    const [labels, setLabels] = useState<string[]>([]);
    const [checklistItems, setChecklistItems] = useState<string[]>([]);
    const [newItem, setNewItem] = useState('');
    const [stagedLinks, setStagedLinks] = useState<StagedLink[]>([]);
    const [linkPickerOpen, setLinkPickerOpen] = useState(false);

    // Tekrar: frequency null = tek seferlik.
    const [frequency, setFrequency] = useState<TaskFrequency | null>(null);
    const [weekday, setWeekday] = useState(1);
    const [dayOfMonth, setDayOfMonth] = useState(1);
    const [dueTime, setDueTime] = useState('18:00');

    useEffect(() => {
        if (!open) return;
        if (editTask) {
            setTitle(editTask.title);
            setDescription(editTask.description ?? '');
            setPriority(editTask.priority);
            setAssignedTo(editTask.assigned_to);
            setDueAt(editTask.due_at ? toLocalInput(editTask.due_at) : '');
            setProjectId(editTask.project_id ?? '');
            setLabels(editTask.labels ?? []);
            setChecklistItems([]);
            setStagedLinks([]);
            setFrequency(null);
        } else {
            setTitle(initialTitle ?? '');
            setDescription(initialDescription ?? '');
            setStatus('pending');
            setPriority('normal');
            setAssignedTo(initialAssignee ?? (canManage ? '' : (currentUserId ?? '')));
            setDueAt('');
            setProjectId('');
            setLabels([]);
            setChecklistItems([]);
            setStagedLinks(initialLinks ?? []);
            setFrequency(initialRecurring && canManage ? 'weekly' : null);
            setWeekday(1);
            setDayOfMonth(1);
            setDueTime('18:00');
        }
        setNewItem('');
        setTimeout(() => titleRef.current?.focus(), 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editTask, canManage, currentUserId, initialTitle, initialAssignee]);

    // Esc kapatır (bağ seçici açıkken o yer).
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !linkPickerOpen) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, linkPickerOpen, onClose]);

    if (!open) return null;

    const effectiveAssignee = canManage ? assignedTo : (currentUserId ?? '');
    const mode: 'edit' | 'recurring' | 'create' = editTask ? 'edit' : frequency ? 'recurring' : 'create';

    const addChecklistItem = () => {
        const label = newItem.trim();
        if (!label) return;
        setChecklistItems(prev => [...prev, label]);
        setNewItem('');
    };

    const handleSave = async () => {
        if (saving) return;
        if (!title.trim()) { toast.warning('Başlık gerekli'); titleRef.current?.focus(); return; }
        if (!effectiveAssignee) { toast.warning('Atanan kişi seçin'); return; }
        setSaving(true);
        try {
            if (editTask) {
                await HrTaskService.updateTask(editTask.id, {
                    title: title.trim(),
                    description: description.trim() || null,
                    priority,
                    due_at: dueAt ? new Date(dueAt).toISOString() : null,
                    project_id: projectId || null,
                    labels,
                    ...(canManage ? { assigned_to: effectiveAssignee } : {}),
                });
                toast.success('Görev güncellendi');
                onSaved();
                onClose();
            } else if (frequency) {
                await HrTaskService.createRecurrence({
                    title: title.trim(),
                    description: description.trim() || null,
                    priority,
                    assigned_to: effectiveAssignee,
                    frequency,
                    weekday: frequency === 'weekly' ? weekday : null,
                    day_of_month: frequency === 'monthly' ? dayOfMonth : null,
                    due_time: dueTime,
                    checklist: checklistItems,
                    project_id: projectId || null,
                    labels,
                });
                toast.success('Rutin kural oluşturuldu — ilk görevi zamanı gelince sistem açar');
                onSaved();
                onClose();
            } else {
                const created = await HrTaskService.createTask({
                    title: title.trim(),
                    description: description.trim() || null,
                    priority,
                    status,
                    assigned_to: effectiveAssignee,
                    due_at: dueAt ? new Date(dueAt).toISOString() : null,
                    project_id: projectId || null,
                    labels,
                    checklist: checklistItems,
                    source_type: sourceType ?? 'manual',
                    source_id: sourceId ?? null,
                });
                for (const l of stagedLinks) {
                    await HrTaskService.addLink(created.id, l).catch(e =>
                        console.error('[TaskFormModal] link error:', e));
                }
                toast.success('Görev oluşturuldu');
                onSaved(created);
                onClose();
            }
        } catch (e: any) {
            console.error('[TaskFormModal] save error:', e);
            toast.error(e?.message || 'Kaydedilemedi');
        } finally {
            setSaving(false);
        }
    };

    const datePresets: [string, string][] = [
        ['Bugün', presetLocal(0)],
        ['Yarın', presetLocal(1)],
        ['Bu hafta', presetLocal((() => { const diff = (5 - new Date().getDay() + 7) % 7; return diff === 0 ? 7 : diff; })())],
        ['Gel. hafta', presetLocal(7)],
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onMouseDown={onClose}>
            <div
                className="w-[92vw] max-w-[860px] max-h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                onMouseDown={e => e.stopPropagation()}
            >
                {/* ÜST BAR — breadcrumb + kapat (detay modalıyla aynı dil) */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
                    <p className="text-[12.5px] text-slate-400 min-w-0 truncate">
                        Görevler <span className="mx-1 text-slate-300">/</span>{' '}
                        <span className="font-semibold text-slate-600">
                            {mode === 'edit' ? 'Düzenle' : mode === 'recurring' ? 'Yeni Rutin' : 'Yeni Görev'}
                        </span>
                    </p>
                    <button onClick={onClose} className="ml-auto p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0" aria-label="Kapat">
                        <X size={16} />
                    </button>
                </div>

                {/* GÖVDE — iki kolon */}
                <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_290px]">
                    {/* SOL */}
                    <div className="overflow-y-auto p-6 min-w-0">
                        <input
                            ref={titleRef}
                            className="w-full text-[22px] font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-semibold outline-none"
                            placeholder={mode === 'recurring' ? 'Rutin görev başlığı' : 'Görev başlığı'}
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSave(); } }}
                            maxLength={200}
                        />

                        <div className="mt-5">
                            <p className={SIDE_LABEL}>Açıklama</p>
                            <div className="bg-slate-50 rounded-lg">
                                <textarea
                                    className="w-full bg-transparent p-4 text-[13.5px] text-slate-700 placeholder:text-slate-400 outline-none resize-none min-h-[96px]"
                                    placeholder="Görevin ayrıntılarını yazın…"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* ALT GÖREVLER — satır bazlı; kaydedince checklist olarak yazılır */}
                        {mode !== 'edit' && (
                            <div className="mt-5">
                                <div className="flex items-center gap-2">
                                    <p className={SIDE_LABEL + ' mb-0'}>Alt Görevler</p>
                                    {checklistItems.length > 0 && (
                                        <span className="text-[11px] font-bold text-slate-500 tabular-nums">{checklistItems.length}</span>
                                    )}
                                </div>
                                {checklistItems.length > 0 && (
                                    <ul className="mt-2 space-y-0.5">
                                        {checklistItems.map((label, i) => (
                                            <li key={`${label}-${i}`} className="flex items-center gap-2.5 px-1 py-1.5 rounded-md hover:bg-slate-50 group">
                                                <Circle size={16} className="text-slate-300 shrink-0" />
                                                <span className="text-[13px] text-slate-700 break-words min-w-0 flex-1">{label}</span>
                                                <button
                                                    onClick={() => setChecklistItems(prev => prev.filter((_, x) => x !== i))}
                                                    className="p-0.5 rounded text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 cursor-pointer"
                                                    aria-label={`${label} maddesini kaldır`}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="flex gap-2 mt-2">
                                    <input
                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[12.5px] outline-none focus:border-slate-400"
                                        placeholder="Alt görev ekle…"
                                        value={newItem}
                                        onChange={e => setNewItem(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
                                    />
                                    <button
                                        onClick={addChecklistItem}
                                        className="h-9 px-3 rounded-lg border border-slate-200 text-slate-600 text-[12.5px] font-semibold hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus size={13} /> Ekle
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* EKLER — dosyalar oluşturma SONRASI açılan detayda yüklenir */}
                        {mode === 'create' && (
                            <div className="mt-5">
                                <p className={SIDE_LABEL}>Ekler</p>
                                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center">
                                    <CloudUpload size={18} className="mx-auto text-slate-300 mb-1.5" />
                                    <p className="text-[12px] text-slate-400">
                                        Dosya ve görseller, görev oluşturulduktan sonra açılan detay penceresinde eklenir
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SAĞ PANEL */}
                    <div className="bg-slate-50/70 border-l border-slate-100 overflow-y-auto p-4 flex flex-col gap-5">
                        {/* DURUM — yalnız yeni tek seferlik görevde seçilir */}
                        {mode === 'create' && (
                            <div>
                                <p className={SIDE_LABEL}>Durum</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {STATUS_CHOICES.map(s => (
                                        <button key={s} onClick={() => setStatus(s)} className={pillCls(status === s, STATUS_DOT[s].text)}>
                                            {TASK_STATUS_META[s].label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <p className={SIDE_LABEL}>Öncelik</p>
                            <div className="flex flex-wrap gap-1.5">
                                {PRIORITY_ORDER.map(p => {
                                    const active = priority === p;
                                    const tone = p === 'urgent' ? 'text-rose-600' : p === 'high' ? 'text-amber-600' : p === 'normal' ? 'text-sky-600' : 'text-slate-500';
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setPriority(p)}
                                            className={active && p === 'urgent'
                                                ? 'h-7 px-2.5 rounded-full text-[12px] font-semibold border bg-rose-600 text-white border-rose-600 cursor-pointer'
                                                : pillCls(active, tone)}
                                        >
                                            {TASK_PRIORITY_META[p].label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className={SIDE_LABEL}>Atanan</p>
                            {canManage ? (
                                <EmployeeSelect
                                    variant="pill"
                                    value={effectiveAssignee}
                                    onChange={setAssignedTo}
                                    options={assignees}
                                    placeholder="Kişi seçin"
                                />
                            ) : (
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-6 h-6 rounded-full bg-slate-500 text-white text-[9.5px] font-bold inline-flex items-center justify-center">B</span>
                                    <span className="text-[12.5px] font-medium text-slate-700">Ben</span>
                                </span>
                            )}
                        </div>

                        {/* SON TARİH (tek seferlik) / ZAMANLAMA (rutin) */}
                        {mode !== 'recurring' ? (
                            <div>
                                <p className={SIDE_LABEL}>Son Tarih</p>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {datePresets.map(([label, value]) => (
                                        <button key={label} onClick={() => setDueAt(value)} className={pillCls(dueAt === value, 'text-sky-600')}>
                                            {label}
                                        </button>
                                    ))}
                                    {dueAt && (
                                        <button onClick={() => setDueAt('')} className={pillCls(false, '')} title="Tarihi kaldır">
                                            Yok
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="datetime-local"
                                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:border-slate-400 bg-white"
                                    value={dueAt}
                                    onChange={e => setDueAt(e.target.value)}
                                />
                            </div>
                        ) : (
                            <div>
                                <p className={SIDE_LABEL}>Zamanlama</p>
                                {frequency === 'weekly' && (
                                    <select className={`${COMPACT_SELECT} rounded-lg w-full mb-2`} value={weekday} onChange={e => setWeekday(parseInt(e.target.value, 10))}>
                                        {WEEKDAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                    </select>
                                )}
                                {frequency === 'monthly' && (
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <span className="text-[12px] text-slate-500">Ayın</span>
                                        <input
                                            type="number" min={1} max={31}
                                            className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] outline-none bg-white"
                                            value={dayOfMonth}
                                            onChange={e => setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                                            onWheel={e => e.currentTarget.blur()}
                                        />
                                        <span className="text-[12px] text-slate-500">. günü</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[12px] text-slate-500">Saat</span>
                                    <input
                                        type="time"
                                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] outline-none bg-white"
                                        value={dueTime}
                                        onChange={e => setDueTime(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {projects.length > 0 && (
                            <div>
                                <p className={SIDE_LABEL}>Proje</p>
                                <select className={`${COMPACT_SELECT} rounded-lg w-full`} value={projectId} onChange={e => setProjectId(e.target.value)}>
                                    <option value="">Projesiz</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div>
                            <p className={SIDE_LABEL}>Etiketler</p>
                            <LabelPicker value={labels} onChange={setLabels} suggestions={labelSuggestions} />
                        </div>

                        {/* İLİŞKİLİ KAYITLAR — yalnız yeni tek seferlik görevde */}
                        {mode === 'create' && (
                            <div>
                                <div className="flex items-center justify-between">
                                    <p className={SIDE_LABEL + ' mb-0'}>İlişkili Kayıtlar</p>
                                    <button onClick={() => setLinkPickerOpen(true)} className="text-[11.5px] font-semibold text-sky-600 hover:underline cursor-pointer">
                                        + Bağla
                                    </button>
                                </div>
                                <ul className="mt-2 space-y-1">
                                    {stagedLinks.map((l, i) => {
                                        const def = TASK_ENTITY_REGISTRY[l.entity_type];
                                        return (
                                            <li key={`${l.entity_type}-${l.entity_id}`} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-2.5 py-1.5 group">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                    l.entity_type === 'lead' ? 'bg-indigo-500' : l.entity_type === 'whatsapp' ? 'bg-emerald-500' : l.entity_type === 'offer' ? 'bg-amber-500' : 'bg-sky-500'
                                                }`} />
                                                <span className="min-w-0 flex-1 text-[12px] font-semibold text-slate-700 truncate" title={`${def.label}: ${l.label}`}>
                                                    {l.label}
                                                </span>
                                                <button
                                                    onClick={() => setStagedLinks(prev => prev.filter((_, x) => x !== i))}
                                                    className="p-0.5 rounded text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 cursor-pointer"
                                                    aria-label={`${l.label} bağlantısını kaldır`}
                                                >
                                                    <X size={11} />
                                                </button>
                                            </li>
                                        );
                                    })}
                                    {stagedLinks.length === 0 && (
                                        <li className="text-[11.5px] text-slate-400">Lead, teklif, WhatsApp veya servis kaydı bağlayın</li>
                                    )}
                                </ul>
                            </div>
                        )}

                        {/* TEKRAR — yalnız yönetici + yeni */}
                        {canManage && !editTask && (
                            <div>
                                <p className={SIDE_LABEL}>Tekrar</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {FREQ_CHOICES.map(f => (
                                        <button
                                            key={f ?? 'none'}
                                            onClick={() => setFrequency(f)}
                                            className={pillCls(frequency === f, 'text-emerald-600')}
                                        >
                                            {f ? TASK_FREQUENCY_LABEL[f] : 'Tek seferlik'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* KAYDET — mockup'taki siyah düğme dili */}
                        <div className="mt-auto pt-2 border-t border-slate-200/70 space-y-1.5">
                            <button
                                onClick={() => void handleSave()}
                                disabled={saving}
                                className="w-full h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
                            >
                                {saving && <Loader2 size={13} className="animate-spin" />}
                                {mode === 'edit' ? 'Kaydet' : mode === 'recurring' ? 'Kuralı Oluştur' : 'Görevi Oluştur'}
                            </button>
                            <button onClick={onClose} className={`${GHOST_BTN} w-full justify-center`}>Vazgeç</button>
                        </div>
                    </div>
                </div>
            </div>

            <TaskEntityLinkModal
                open={linkPickerOpen}
                onClose={() => setLinkPickerOpen(false)}
                onPick={(type: TaskLinkEntityType, r: EntitySearchResult) => {
                    setStagedLinks(prev =>
                        prev.some(l => l.entity_type === type && l.entity_id === r.entity_id)
                            ? prev
                            : [...prev, { entity_type: type, entity_id: r.entity_id, label: r.label, meta: r.meta }]);
                }}
            />
        </div>
    );
}
