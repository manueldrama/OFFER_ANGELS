// Görev yönetimi tipleri (hr_tasks ailesi).
//
// hr.ts'e EKLENMEDİ: o dosya zaten büyük ve bordro/puantaj odaklı.
// "tasks.ts" adı da seçilmedi: /admin/automation/tasks (follow_up_tasks,
// bot otomasyonu) ile karışırdı. Bu dosya İNSAN görevlerinin tipleridir.

import type { ChipMeta } from '../pages/admin/hr/_shared';

export type TaskStatus = 'pending' | 'in_progress' | 'waiting' | 'done' | 'approved' | 'cancelled';

/** Görevin hangi aksiyondan doğduğu (bağ ile ayrı kavram — spec §6). */
export type TaskSourceType =
    | 'manual' | 'lead_detail' | 'whatsapp_conversation'
    | 'whatsapp_message' | 'service_request' | 'bulk' | 'recurrence';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskFrequency = 'daily' | 'weekly' | 'monthly';
export type TaskNotificationType =
    | 'task_assigned'
    | 'task_comment'
    | 'task_status'
    | 'task_approved'
    | 'task_due_soon'
    | 'task_overdue';

/** Sayfa içi görünümler — URL query'de taşınır (?view=board). */
export type TaskView = 'list' | 'board' | 'calendar' | 'workload' | 'routines';

/** Liste gruplaması — 'date' = Geciken/Bugün/Yaklaşan/Tarihsiz (My Tasks). */
export type TaskGroupBy = 'status' | 'date' | 'priority' | 'project' | 'assignee';
/** Panom (kendi görevlerim) / Ekip (tümü — yalnız yönetici). */
/** mine = bana atananlar; created = benim atadıklarım; team = tüm ekip. */
export type TaskScope = 'mine' | 'created' | 'team';

/** sales_users'tan join'lenen kimlik parçası (ad göstermek için yeterli). */
export interface TaskUserRef {
    full_name: string | null;
    email: string | null;
}

export interface HrTaskProject {
    id: string;
    name: string;
    color: string;
    position: number;
    is_archived: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface HrTask {
    id: string;
    title: string;
    description: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    due_at: string | null;
    assigned_to: string;
    created_by: string;
    completed_at: string | null;
    approved_by: string | null;
    approved_at: string | null;
    recurrence_id: string | null;
    occurrence_date: string | null;
    source_type: TaskSourceType | null;
    source_id: string | null;
    /** İnsan-okur kod (CFP-{task_no}); DB sequence, değiştirilemez. */
    task_no: number | null;
    /** Zaman takibi: toplam sn + çalışan sayacın başlangıcı (null=durmuş). */
    time_spent_seconds: number;
    timer_started_at: string | null;
    project_id: string | null;
    labels: string[];
    board_position: number;
    created_at: string;
    updated_at: string;
    /** join: sales_users!hr_tasks_assigned_to_fkey */
    assignee?: TaskUserRef | null;
    /** join: sales_users!hr_tasks_created_by_fkey */
    creator?: TaskUserRef | null;
    /** join: hr_task_projects */
    project?: Pick<HrTaskProject, 'id' | 'name' | 'color'> | null;
    /** Kart rozetleri: checklist ilerlemesi + sayaçlar (TASK_SELECT join'lerinden). */
    items?: { is_done: boolean }[];
    comments_count?: number;
    attachments_count?: number;
}

export interface HrTaskItem {
    id: string;
    task_id: string;
    label: string;
    is_done: boolean;
    done_at: string | null;
    done_by: string | null;
    position: number;
    created_at: string;
}

export interface HrTaskComment {
    id: string;
    task_id: string;
    author_id: string;
    body: string;
    created_at: string;
    author?: TaskUserRef | null;
}

export interface HrTaskRecurrence {
    id: string;
    title: string;
    description: string | null;
    priority: TaskPriority;
    assigned_to: string;
    created_by: string;
    frequency: TaskFrequency;
    weekday: number | null;       // weekly: 0=Pazar ... 6=Cumartesi
    day_of_month: number | null;  // monthly: 1-31, ay sonuna clamp'lenir
    due_time: string;             // 'HH:MM:SS'
    checklist: string[];
    project_id: string | null;
    labels: string[];
    next_run_at: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    assignee?: TaskUserRef | null;
}

export interface HrTaskNotification {
    id: string;
    recipient_id: string;
    task_id: string | null;
    type: TaskNotificationType;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

export interface HrTaskAttachment {
    id: string;
    task_id: string;
    comment_id: string | null;
    storage_path: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    uploaded_by: string;
    created_at: string;
}

export type TaskLinkEntityType = 'lead' | 'whatsapp' | 'offer' | 'service_request';

export interface HrTaskLink {
    id: string;
    task_id: string;
    entity_type: TaskLinkEntityType;
    entity_id: string;
    /** Bağlama anının görüntü anlığı — varlık silinse bile çip okunur kalır. */
    label: string;
    meta: Record<string, string | undefined>;
    created_by: string;
    created_at: string;
}

export interface TaskFilters {
    status?: TaskStatus | 'open' | 'all';  // 'open' = pending + in_progress
    priority?: TaskPriority;
    assignedTo?: string;
    createdBy?: string;
    overdueOnly?: boolean;
    projectId?: string;
    label?: string;
    search?: string;
}

export const TASK_STATUS_META: Record<TaskStatus, ChipMeta> = {
    pending: { label: 'Yapılacak', tone: 'neutral' },
    in_progress: { label: 'Devam Ediyor', tone: 'info' },
    waiting: { label: 'Beklemede', tone: 'warning' },
    done: { label: 'Kontrol', tone: 'warning' },      // onay kuyruğu vurgusu
    approved: { label: 'Tamamlandı', tone: 'success' },
    cancelled: { label: 'İptal', tone: 'danger' },
};

export const TASK_SOURCE_LABEL: Record<TaskSourceType, string> = {
    manual: 'Elle oluşturuldu',
    lead_detail: 'Lead ekranından',
    whatsapp_conversation: 'WhatsApp konuşmasından',
    whatsapp_message: 'WhatsApp mesajından',
    service_request: 'Servis talebinden',
    bulk: 'Toplu oluşturma',
    recurrence: 'Rutin kural',
};

export const TASK_PRIORITY_META: Record<TaskPriority, ChipMeta> = {
    low: { label: 'Düşük', tone: 'neutral' },
    normal: { label: 'Orta', tone: 'info' },     // mockup adlandırması
    high: { label: 'Yüksek', tone: 'warning' },
    urgent: { label: 'Acil', tone: 'danger' },
};

export const TASK_FREQUENCY_LABEL: Record<TaskFrequency, string> = {
    daily: 'Her gün',
    weekly: 'Her hafta',
    monthly: 'Her ay',
};

export const WEEKDAY_LABELS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/** Kişisel görev mü? Kolon yok, türetilir — tek doğruluk kaynağı bu ikili. */
export function isSelfTask(t: Pick<HrTask, 'assigned_to' | 'created_by'>): boolean {
    return t.assigned_to === t.created_by;
}

/** Açık (kapanmamış) durumlar — geciken/açık sayımlarının tek kaynağı. */
export const OPEN_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'waiting'];

export function isTaskOpen(t: Pick<HrTask, 'status'>): boolean {
    return OPEN_STATUSES.includes(t.status);
}

export function isTaskOverdue(t: Pick<HrTask, 'due_at' | 'status'>): boolean {
    return !!t.due_at
        && isTaskOpen(t)
        && new Date(t.due_at).getTime() < Date.now();
}

// Etiket rengi KAYITTAN DEĞİL, metinden deterministik türetilir: registry
// tablosu/migration maliyeti olmadan aynı etiket her yüzeyde aynı renkte olur.
const LABEL_PALETTE = [
    'bg-rose-100 text-rose-700',
    'bg-orange-100 text-orange-700',
    'bg-amber-100 text-amber-700',
    'bg-lime-100 text-lime-700',
    'bg-emerald-100 text-emerald-700',
    'bg-teal-100 text-teal-700',
    'bg-sky-100 text-sky-700',
    'bg-indigo-100 text-indigo-700',
    'bg-violet-100 text-violet-700',
    'bg-fuchsia-100 text-fuchsia-700',
];

export function labelColor(label: string): string {
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
        hash = ((hash * 31) + label.charCodeAt(i)) | 0;
    }
    return LABEL_PALETTE[Math.abs(hash) % LABEL_PALETTE.length];
}

/** Proje renk seçenekleri (ProjectManagerModal swatch'ları). */
export const PROJECT_COLORS = [
    '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#8b5cf6', '#64748b',
];

// Avatar zemin renkleri — etiketle aynı ilke: kayıtsız, isimden deterministik.
const AVATAR_PALETTE = [
    'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500',
    'bg-teal-500', 'bg-sky-500', 'bg-indigo-500', 'bg-violet-500',
];

export function avatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = ((hash * 31) + name.charCodeAt(i)) | 0;
    }
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/** Kanban kolonu / liste bölümü renk kimliği — durum başına tek kaynak. */
// Mockup renk şeması: Yapılacak=mavi, Devam Ediyor=mor, Beklemede=amber,
// Kontrol=turuncu, Tamamlandı=yeşil, İptal=gri.
export const TASK_STATUS_ACCENT: Record<TaskStatus, {
    bar: string; headerBg: string; countBg: string; columnBg: string;
}> = {
    pending: { bar: 'bg-blue-500', headerBg: 'bg-blue-100 text-blue-700', countBg: 'bg-blue-200 text-blue-700', columnBg: 'bg-blue-50/50' },
    in_progress: { bar: 'bg-violet-500', headerBg: 'bg-violet-100 text-violet-700', countBg: 'bg-violet-200 text-violet-700', columnBg: 'bg-violet-50/50' },
    waiting: { bar: 'bg-amber-500', headerBg: 'bg-amber-100 text-amber-700', countBg: 'bg-amber-200 text-amber-700', columnBg: 'bg-amber-50/50' },
    done: { bar: 'bg-orange-500', headerBg: 'bg-orange-100 text-orange-700', countBg: 'bg-orange-200 text-orange-700', columnBg: 'bg-orange-50/50' },
    approved: { bar: 'bg-emerald-500', headerBg: 'bg-emerald-100 text-emerald-700', countBg: 'bg-emerald-200 text-emerald-700', columnBg: 'bg-emerald-50/50' },
    cancelled: { bar: 'bg-slate-300', headerBg: 'bg-slate-100 text-slate-400 line-through', countBg: 'bg-slate-200 text-slate-500', columnBg: 'bg-slate-50' },
};

/** Liste DURUM hücresi + bölüm başlığı: "• Yapılacak" nokta+metin rengi. */
export const STATUS_DOT: Record<TaskStatus, { dot: string; text: string }> = {
    pending: { dot: 'bg-blue-500', text: 'text-blue-600' },
    in_progress: { dot: 'bg-violet-500', text: 'text-violet-600' },
    waiting: { dot: 'bg-amber-500', text: 'text-amber-600' },
    done: { dot: 'bg-orange-500', text: 'text-orange-600' },
    approved: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
    cancelled: { dot: 'bg-slate-400', text: 'text-slate-400' },
};

/** İnsan-okur görev kodu (mockup: CFP-101). */
export function taskCode(t: Pick<HrTask, 'task_no' | 'id'>): string {
    return t.task_no != null ? `CFP-${t.task_no}` : t.id.slice(0, 8).toUpperCase();
}

/** Toplam süre + (çalışıyorsa) canlı fark → "H:MM:SS". */
export function formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Kart sol kenar öncelik aksanı — normal/low aksansız (gürültü olmasın). */
export const TASK_PRIORITY_ACCENT: Record<TaskPriority, string | null> = {
    low: null,
    normal: null,
    high: 'border-l-[3px] border-l-amber-400',
    urgent: 'border-l-[3px] border-l-rose-500',
};
