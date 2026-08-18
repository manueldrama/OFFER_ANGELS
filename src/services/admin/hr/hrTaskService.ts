import { supabase } from '../../../lib/supabase/client';
import { hrAudit } from './hrAudit';
import type {
    HrTask, HrTaskAttachment, HrTaskComment, HrTaskItem, HrTaskLink,
    HrTaskProject, HrTaskRecurrence, TaskFilters, TaskFrequency,
    TaskLinkEntityType, TaskPriority, TaskSourceType, TaskStatus,
} from '../../../types/hrTasks';

// Görev yönetimi (hr_tasks ailesi).
//
// GÜVENLİK NOTU: Burada hiçbir yetki kontrolü YOKTUR ve olmamalıdır. Kimin
// neyi görüp değiştirebileceğine hr_tasks* tablolarındaki RLS + trigger'lar
// karar verir (20260901a_hr_tasks.sql):
//   - okuma: task_can_manage() or assigned_to/created_by = auth.uid()
//   - çalışan yalnız KENDİNE görev açabilir (self-task)
//   - atanmış görevde çalışan yalnız status/completed_at değiştirebilir;
//     diğer kolonlar DB trigger'ıyla sessizce geri alınır
//   - 'approved' yalnız yönetici; ihlal DB'den hata döner
// Yetkisiz sorgu hata değil BOŞ döner — ekranlar bunu doğal karşılamalı.
//
// Bildirim fan-out'u da DB trigger'larındadır: burada createTask/setStatus
// sonrası elle bildirim YAZILMAZ, yazılamaz da (INSERT policy'si yok).

const TASK_SELECT = `*,
    assignee:sales_users!hr_tasks_assigned_to_fkey(full_name, email),
    creator:sales_users!hr_tasks_created_by_fkey(full_name, email),
    project:hr_task_projects(id, name, color),
    items:hr_task_items(is_done),
    comments:hr_task_comments(count),
    attachments:hr_task_attachments(count)`;

const TASKS_BUCKET = 'hr-tasks';

/**
 * Lead timeline'ına görev olayı düşer (leadCallsService.logCall deseni:
 * yeni tablo yok, lead_events'e yeni event_type). Sessizce başarısız olur —
 * timeline kaydı asıl işlemi engellemez.
 */
async function logLeadTaskEvent(
    leadId: string,
    eventType: 'task_created' | 'task_completed',
    metadata: Record<string, unknown>,
): Promise<void> {
    try {
        await supabase.from('lead_events').insert({ lead_id: leadId, event_type: eventType, metadata });
    } catch (e) {
        console.error('[hrTaskService] lead event error:', e);
    }
}

/** PostgREST count join'lerini ([{count:n}]) düz sayıya indirger. */
function normalizeTask(row: any): HrTask {
    const { comments, attachments, ...rest } = row;
    return {
        ...rest,
        comments_count: Array.isArray(comments) ? (comments[0]?.count ?? 0) : 0,
        attachments_count: Array.isArray(attachments) ? (attachments[0]?.count ?? 0) : 0,
    } as HrTask;
}

/** Rutin kuralın bir sonraki çalışma anını hesaplar (ilk kayıt için TS tarafı). */
export function computeNextRunAt(
    frequency: TaskFrequency,
    weekday: number | null,
    dayOfMonth: number | null,
    dueTime: string, // 'HH:MM'
    from = new Date(),
): Date {
    const [hh, mm] = dueTime.split(':').map(n => parseInt(n, 10) || 0);
    const candidate = new Date(from);
    candidate.setHours(hh, mm, 0, 0);

    if (frequency === 'daily') {
        if (candidate <= from) candidate.setDate(candidate.getDate() + 1);
        return candidate;
    }

    if (frequency === 'weekly') {
        const target = weekday ?? 1; // varsayılan Pazartesi
        let diff = (target - candidate.getDay() + 7) % 7;
        if (diff === 0 && candidate <= from) diff = 7;
        candidate.setDate(candidate.getDate() + diff);
        return candidate;
    }

    // monthly — istenen gün ayın uzunluğunu aşarsa ay sonuna clamp'lenir
    const day = dayOfMonth ?? 1;
    const clamp = (year: number, month: number) =>
        Math.min(day, new Date(year, month + 1, 0).getDate());
    candidate.setDate(clamp(candidate.getFullYear(), candidate.getMonth()));
    if (candidate <= from) {
        const y = candidate.getMonth() === 11 ? candidate.getFullYear() + 1 : candidate.getFullYear();
        const m = (candidate.getMonth() + 1) % 12;
        candidate.setFullYear(y, m, clamp(y, m));
    }
    return candidate;
}

export const HrTaskService = {
    // ── Görevler ────────────────────────────────────────────────────────────

    async listTasks(filters: TaskFilters = {}): Promise<HrTask[]> {
        let query = supabase.from('hr_tasks').select(TASK_SELECT);

        if (filters.status === 'open') query = query.in('status', ['pending', 'in_progress']);
        else if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
        if (filters.priority) query = query.eq('priority', filters.priority);
        if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
        if (filters.createdBy) query = query.eq('created_by', filters.createdBy);
        if (filters.projectId) query = query.eq('project_id', filters.projectId);
        if (filters.label) query = query.contains('labels', [filters.label]);
        if (filters.search) query = query.ilike('title', `%${filters.search}%`);
        if (filters.overdueOnly) {
            query = query
                .in('status', ['pending', 'in_progress'])
                .lt('due_at', new Date().toISOString());
        }

        const { data, error } = await query
            .order('due_at', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(500);
        if (error) throw error;
        return (data || []).map(normalizeTask);
    },

    /** Kişinin kendi görevleri (atanan). RLS zaten daraltır; filtre netlik için. */
    async myTasks(userId: string): Promise<HrTask[]> {
        const { data, error } = await supabase
            .from('hr_tasks')
            .select(TASK_SELECT)
            .eq('assigned_to', userId)
            .order('due_at', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(300);
        if (error) throw error;
        return (data || []).map(normalizeTask);
    },

    async getTask(id: string): Promise<HrTask | null> {
        const { data, error } = await supabase
            .from('hr_tasks')
            .select(TASK_SELECT)
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return data ? normalizeTask(data) : null;
    },

    /**
     * Görev + opsiyonel kontrol listesi. created_by DB default'u (auth.uid());
     * elle gönderilmez — RLS "dürüst created_by" kontrolüyle çelişmesin.
     */
    async createTask(input: {
        title: string;
        description?: string | null;
        priority?: TaskPriority;
        due_at?: string | null;
        assigned_to: string;
        project_id?: string | null;
        labels?: string[];
        checklist?: string[];
        source_type?: TaskSourceType;
        source_id?: string | null;
        /** Başlangıç durumu (composer'da seçilebilir); trigger INSERT'e karışmaz. */
        status?: 'pending' | 'in_progress' | 'waiting';
    }): Promise<HrTask> {
        const { checklist, ...task } = input;
        const { data, error } = await supabase
            .from('hr_tasks')
            .insert(task)
            .select(TASK_SELECT)
            .single();
        if (error) throw error;
        const created = normalizeTask(data);
        void hrAudit('hr.task.create', 'hr_tasks', created.id, {
            title: created.title, assigned_to: created.assigned_to, source: input.source_type ?? 'manual',
        });

        if (checklist && checklist.length > 0) {
            const rows = checklist
                .map(s => s.trim())
                .filter(Boolean)
                .map((label, i) => ({ task_id: created.id, label, position: i }));
            if (rows.length > 0) {
                const { error: itemsError } = await supabase.from('hr_task_items').insert(rows);
                if (itemsError) throw itemsError;
            }
        }
        return created;
    },

    async updateTask(id: string, patch: Partial<Pick<HrTask,
        'title' | 'description' | 'priority' | 'due_at' | 'assigned_to'
        | 'project_id' | 'labels' | 'board_position'>>): Promise<HrTask> {
        const { data, error } = await supabase
            .from('hr_tasks')
            .update(patch)
            .eq('id', id)
            .select(TASK_SELECT)
            .single();
        if (error) throw error;
        void hrAudit(patch.assigned_to ? 'hr.task.assign' : 'hr.task.update', 'hr_tasks', id, patch as Record<string, unknown>);
        return normalizeTask(data);
    },

    /**
     * Durum ilerletme. completed_at burada da gönderilir: çalışan yolunda
     * DB trigger'ı zaten yeniden türetir (istemci beyanı ezilir), yönetici
     * yolunda ise trigger erken döndüğü için buradaki değer geçerli olur —
     * gönderilmeseydi yöneticinin "done" yaptığı görev tamamlanma tarihi
     * boş kalırdı.
     */
    async setStatus(id: string, status: TaskStatus): Promise<HrTask> {
        const patch: Record<string, unknown> = { status };
        if (status === 'done') patch.completed_at = new Date().toISOString();
        else if (status !== 'approved') patch.completed_at = null;
        const { data, error } = await supabase
            .from('hr_tasks')
            .update(patch)
            .eq('id', id)
            .select(TASK_SELECT)
            .single();
        if (error) throw error;
        const updated = normalizeTask(data);
        void hrAudit('hr.task.status', 'hr_tasks', id, { status });
        // Lead bağlıysa timeline'a düşür — takip lead ekranında görünür olsun.
        if (status === 'done') {
            void this.listLinks(id)
                .then(links => links
                    .filter(l => l.entity_type === 'lead')
                    .forEach(l => void logLeadTaskEvent(l.entity_id, 'task_completed', { task_id: id, title: updated.title })))
                .catch(() => undefined);
        }
        return updated;
    },

    /** Yönetici onayı. RLS/trigger yönetici olmayanı DB'de durdurur. */
    async approveTask(id: string): Promise<HrTask> {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_tasks')
            .update({
                status: 'approved',
                approved_by: user?.id ?? null,
                approved_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select(TASK_SELECT)
            .single();
        if (error) throw error;
        void hrAudit('hr.task.approve', 'hr_tasks', id, {});
        return normalizeTask(data);
    },

    /** "Geri gönder" — done'daki görevi tekrar çalışmaya açar (reddetme yok). */
    async sendBack(id: string): Promise<HrTask> {
        return this.setStatus(id, 'in_progress');
    },

    /**
     * HAYALET SİLME KAPALI: RLS izin vermezse Supabase hata DEĞİL 0 satır
     * döndürür — kullanıcı "sildim" sanır, görev widget'ta yaşamaya devam
     * eder (gerçekten yaşandı). .select ile silinen satır doğrulanır;
     * silinmediyse açık hata fırlatılır.
     */
    async deleteTask(id: string): Promise<void> {
        const { data, error } = await supabase
            .from('hr_tasks')
            .delete()
            .eq('id', id)
            .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error('Görev silinemedi — silme yetkiniz yok ya da görev zaten silinmiş');
        }
        void hrAudit('hr.task.delete', 'hr_tasks', id, {});
    },

    /**
     * TERS SORGU — "bu varlığa bağlı görevler" (lead kartı, WhatsApp paneli,
     * servis detayı). idx_hr_task_links_entity (20260904a) bunu taşır. RLS
     * gereği yalnız çağıranın görebildiği görevler döner: temsilci lead'de
     * ekibin değil KENDİ görevlerini görür — bilinçli.
     */
    async listTasksForEntity(entityType: TaskLinkEntityType, entityId: string): Promise<HrTask[]> {
        const { data, error } = await supabase
            .from('hr_task_links')
            .select(`task:hr_tasks(${TASK_SELECT})`)
            .eq('entity_type', entityType)
            .eq('entity_id', entityId);
        if (error) throw error;
        return (data || [])
            .map((r: any) => r.task)
            .filter(Boolean)
            .map(normalizeTask)
            .sort((a, b) => (a.due_at || '9999').localeCompare(b.due_at || '9999'));
    },

    // ── Zaman takibi (mockup kronometresi) ─────────────────────────────────

    /** Sayacı başlat — timer_started_at=now. Hesap istemcide, kalıcılık DB'de. */
    async startTimer(id: string): Promise<HrTask> {
        const { data, error } = await supabase
            .from('hr_tasks')
            .update({ timer_started_at: new Date().toISOString() })
            .eq('id', id)
            .select(TASK_SELECT)
            .single();
        if (error) throw error;
        return normalizeTask(data);
    },

    /** Sayacı durdur — geçen süreyi toplama ekler, sayacı sıfırlar. */
    async stopTimer(task: Pick<HrTask, 'id' | 'time_spent_seconds' | 'timer_started_at'>): Promise<HrTask> {
        const elapsed = task.timer_started_at
            ? Math.max(0, Math.floor((Date.now() - new Date(task.timer_started_at).getTime()) / 1000))
            : 0;
        const { data, error } = await supabase
            .from('hr_tasks')
            .update({
                time_spent_seconds: (task.time_spent_seconds ?? 0) + elapsed,
                timer_started_at: null,
            })
            .eq('id', task.id)
            .select(TASK_SELECT)
            .single();
        if (error) throw error;
        return normalizeTask(data);
    },

    /**
     * Pano sürükle-bırak yazımı: durum ve/veya sütun içi konum. Personelin
     * geçersiz geçişini (örn. approved'a bırakma) DB trigger'ı reddeder —
     * çağıran optimistic güncellemeyi hata durumunda geri almalı.
     */
    async moveTask(id: string, patch: { status?: TaskStatus; board_position?: number }): Promise<HrTask> {
        const { data, error } = await supabase
            .from('hr_tasks')
            .update(patch)
            .eq('id', id)
            .select(TASK_SELECT)
            .single();
        if (error) throw error;
        return normalizeTask(data);
    },

    // ── Projeler ────────────────────────────────────────────────────────────

    async listProjects(includeArchived = false): Promise<HrTaskProject[]> {
        let query = supabase.from('hr_task_projects').select('*');
        if (!includeArchived) query = query.eq('is_archived', false);
        const { data, error } = await query.order('position', { ascending: true });
        if (error) throw error;
        return (data || []) as HrTaskProject[];
    },

    async createProject(name: string, color: string): Promise<HrTaskProject> {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_task_projects')
            .insert({ name, color, created_by: user?.id })
            .select()
            .single();
        if (error) throw error;
        return data as HrTaskProject;
    },

    async updateProject(id: string, patch: Partial<Pick<HrTaskProject, 'name' | 'color' | 'position' | 'is_archived'>>): Promise<void> {
        const { error } = await supabase.from('hr_task_projects').update(patch).eq('id', id);
        if (error) throw error;
    },

    /** Hard delete YOK (migration INVARIANT B) — geçmiş görevlerin bağlamı kalır. */
    async archiveProject(id: string): Promise<void> {
        return this.updateProject(id, { is_archived: true });
    },

    // ── Dosya ekleri (hr-tasks ÖZEL bucket'ı) ───────────────────────────────

    /**
     * Yükleme sırası: önce nesne, sonra DB satırı; satır yazılamazsa nesne
     * silinir (orphan temizliği — hrRecruitmentService deseni). Path istemci
     * dosya adından ASLA türetilmez: tasks/<taskId>/<uuid>.<ext>; orijinal ad
     * yalnız file_name kolonunda yaşar. Boyut/MIME limiti bucket'tadır.
     */
    async uploadAttachment(taskId: string, file: File, commentId?: string): Promise<HrTaskAttachment> {
        const ext = (file.name.split('.').pop() || 'bin')
            .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
        const path = `tasks/${taskId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(TASKS_BUCKET)
            .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (uploadError) throw uploadError;

        const { data, error } = await supabase
            .from('hr_task_attachments')
            .insert({
                task_id: taskId,
                comment_id: commentId ?? null,
                storage_path: path,
                file_name: file.name.slice(0, 200),
                mime_type: file.type || null,
                size_bytes: file.size,
            })
            .select()
            .single();
        if (error) {
            await supabase.storage.from(TASKS_BUCKET).remove([path]).catch(() => undefined);
            throw error;
        }
        return data as HrTaskAttachment;
    },

    async listAttachments(taskId: string): Promise<HrTaskAttachment[]> {
        const { data, error } = await supabase
            .from('hr_task_attachments')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []) as HrTaskAttachment[];
    },

    /** 10 dakikalık imzalı URL — bucket özel, kalıcı public link YOK. */
    async getAttachmentUrl(storagePath: string): Promise<string> {
        const { data, error } = await supabase.storage
            .from(TASKS_BUCKET)
            .createSignedUrl(storagePath, 600);
        if (error || !data?.signedUrl) throw error ?? new Error('İmzalı URL üretilemedi');
        return data.signedUrl;
    },

    async deleteAttachment(id: string, storagePath: string): Promise<void> {
        // Önce satır (RLS bekçisi), sonra nesne; nesne silinemezse satır zaten
        // gitti — erişim kapandı, artık nesne süpürülebilir çöp.
        const { error } = await supabase.from('hr_task_attachments').delete().eq('id', id);
        if (error) throw error;
        await supabase.storage.from(TASKS_BUCKET).remove([storagePath]).catch(() => undefined);
    },

    // ── Sistem-içi varlık bağları ───────────────────────────────────────────

    async listLinks(taskId: string): Promise<HrTaskLink[]> {
        const { data, error } = await supabase
            .from('hr_task_links')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []) as HrTaskLink[];
    },

    async addLink(taskId: string, link: {
        entity_type: TaskLinkEntityType;
        entity_id: string;
        label: string;
        meta?: Record<string, string | undefined>;
    }): Promise<HrTaskLink> {
        const { data, error } = await supabase
            .from('hr_task_links')
            .insert({
                task_id: taskId,
                entity_type: link.entity_type,
                entity_id: link.entity_id,
                label: link.label.slice(0, 200),
                meta: link.meta ?? {},
            })
            .select()
            .single();
        if (error) throw error;
        // Lead bağı = lead timeline'ında "Görev açıldı" (leadCallsService deseni).
        if (link.entity_type === 'lead') {
            void logLeadTaskEvent(link.entity_id, 'task_created', { task_id: taskId });
        }
        return data as HrTaskLink;
    },

    async removeLink(id: string): Promise<void> {
        const { error } = await supabase.from('hr_task_links').delete().eq('id', id);
        if (error) throw error;
    },

    // ── Kontrol listesi ─────────────────────────────────────────────────────

    async listItems(taskId: string): Promise<HrTaskItem[]> {
        const { data, error } = await supabase
            .from('hr_task_items')
            .select('*')
            .eq('task_id', taskId)
            .order('position', { ascending: true });
        if (error) throw error;
        return (data || []) as HrTaskItem[];
    },

    async addItem(taskId: string, label: string, position: number): Promise<HrTaskItem> {
        const { data, error } = await supabase
            .from('hr_task_items')
            .insert({ task_id: taskId, label, position })
            .select()
            .single();
        if (error) throw error;
        return data as HrTaskItem;
    },

    async toggleItem(id: string, isDone: boolean): Promise<HrTaskItem> {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('hr_task_items')
            .update({
                is_done: isDone,
                done_at: isDone ? new Date().toISOString() : null,
                done_by: isDone ? (user?.id ?? null) : null,
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as HrTaskItem;
    },

    async deleteItem(id: string): Promise<void> {
        const { error } = await supabase.from('hr_task_items').delete().eq('id', id);
        if (error) throw error;
    },

    // ── Yorumlar ────────────────────────────────────────────────────────────

    async listComments(taskId: string): Promise<HrTaskComment[]> {
        const { data, error } = await supabase
            .from('hr_task_comments')
            .select('*, author:sales_users!hr_task_comments_author_id_fkey(full_name, email)')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []) as unknown as HrTaskComment[];
    },

    async addComment(taskId: string, body: string): Promise<HrTaskComment> {
        const { data, error } = await supabase
            .from('hr_task_comments')
            .insert({ task_id: taskId, body })
            .select('*, author:sales_users!hr_task_comments_author_id_fkey(full_name, email)')
            .single();
        if (error) throw error;
        return data as unknown as HrTaskComment;
    },

    // ── Rutin kurallar ──────────────────────────────────────────────────────

    async listRecurrences(): Promise<HrTaskRecurrence[]> {
        const { data, error } = await supabase
            .from('hr_task_recurrences')
            .select('*, assignee:sales_users!hr_task_recurrences_assigned_to_fkey(full_name, email)')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as unknown as HrTaskRecurrence[];
    },

    async createRecurrence(input: {
        title: string;
        description?: string | null;
        priority?: TaskPriority;
        assigned_to: string;
        frequency: TaskFrequency;
        weekday?: number | null;
        day_of_month?: number | null;
        due_time?: string;        // 'HH:MM'
        checklist?: string[];
        project_id?: string | null;
        labels?: string[];
    }): Promise<HrTaskRecurrence> {
        const { data: { user } } = await supabase.auth.getUser();
        const dueTime = input.due_time || '18:00';
        const nextRun = computeNextRunAt(
            input.frequency, input.weekday ?? null, input.day_of_month ?? null, dueTime);

        const { data, error } = await supabase
            .from('hr_task_recurrences')
            .insert({
                title: input.title,
                description: input.description ?? null,
                priority: input.priority ?? 'normal',
                assigned_to: input.assigned_to,
                created_by: user?.id,
                frequency: input.frequency,
                weekday: input.frequency === 'weekly' ? (input.weekday ?? 1) : null,
                day_of_month: input.frequency === 'monthly' ? (input.day_of_month ?? 1) : null,
                due_time: dueTime,
                checklist: (input.checklist || []).map(s => s.trim()).filter(Boolean),
                project_id: input.project_id ?? null,
                labels: input.labels ?? [],
                next_run_at: nextRun.toISOString(),
            })
            .select()
            .single();
        if (error) throw error;
        return data as unknown as HrTaskRecurrence;
    },

    async toggleRecurrence(id: string, isActive: boolean): Promise<void> {
        const { error } = await supabase
            .from('hr_task_recurrences')
            .update({ is_active: isActive })
            .eq('id', id);
        if (error) throw error;
    },

    async deleteRecurrence(id: string): Promise<void> {
        const { data, error } = await supabase
            .from('hr_task_recurrences')
            .delete()
            .eq('id', id)
            .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error('Kural silinemedi — silme yetkiniz yok ya da kural zaten silinmiş');
        }
    },

    /** Menü/buton görünürlüğü için (veriyi korumaz — onu RLS yapar). */
    async canManage(): Promise<boolean> {
        const { data, error } = await supabase.rpc('task_can_manage');
        if (error) return false;
        return data === true;
    },
};
