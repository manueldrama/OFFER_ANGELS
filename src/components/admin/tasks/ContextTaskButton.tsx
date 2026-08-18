import { useContext, useEffect, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { AuthContext } from '../../auth/AuthProvider';
import { HrEmployeeService } from '../../../services/admin/hr/hrEmployeeService';
import { TaskFormModal, type StagedLink } from './TaskFormModal';
import type { AssigneeOption } from './EmployeeSelect';
import type { HrTask, TaskLinkEntityType, TaskSourceType } from '../../../types/hrTasks';

// BAĞLAMSAL GÖREV DÜĞMESİ — panelin her yerinde tek bileşen (spec §33):
// Lead detayı, WhatsApp başlığı, servis talebi, satır menüleri... hepsi bunu
// kullanır; modül başına ayrı görev modalı YASAK. Görev, bulunduğun işin
// yanında oluşur: varlık bağı otomatik, atanan bağlamdan gelir, kaynak izlenir.

export interface TaskContext {
    entityType: TaskLinkEntityType;
    entityId: string;
    entityLabel: string;
    /** Bağlamın sorumlusu (lead sahibi, teknisyen...) — kullanıcı değiştirebilir. */
    defaultAssignee?: string | null;
    sourceType?: TaskSourceType;
    sourceId?: string | null;
    initialTitle?: string;
    initialDescription?: string;
    /** Kalıtılan ek bağlar (örn. WhatsApp görevi lead'e de bağlanır — spec §27). */
    extraLinks?: StagedLink[];
}

export function buildContextLinks(ctx: TaskContext): StagedLink[] {
    const primary: StagedLink = {
        entity_type: ctx.entityType,
        entity_id: ctx.entityId,
        label: ctx.entityLabel,
    };
    const extras = (ctx.extraLinks ?? []).filter(
        l => !(l.entity_type === primary.entity_type && l.entity_id === primary.entity_id),
    );
    return [primary, ...extras];
}

export function ContextTaskButton({ context, onCreated, variant = 'button', className }: {
    context: TaskContext;
    onCreated?: (task: HrTask) => void;
    /** 'button' = dolgulu "+ Görev"; 'compact' = metin linki; 'icon' = ikon-sıralı aksiyon hücreleri için tek ikon. */
    variant?: 'button' | 'compact' | 'icon';
    className?: string;
}) {
    const { session, role } = useContext(AuthContext);
    const canManage = !!role && role !== 'employee';
    const currentUserId = session?.user?.id ?? null;

    const [open, setOpen] = useState(false);
    const [assignees, setAssignees] = useState<AssigneeOption[]>([]);

    // Çalışan listesi yalnız modal İLK açıldığında yüklenir — bağlamsal düğme
    // her sayfada bulunur, sayfa başına bedava API isteği üretmemeli (spec §65).
    useEffect(() => {
        if (!open || !canManage || assignees.length > 0) return;
        HrEmployeeService.listEmployees()
            .then(rows => setAssignees(rows.map(e => ({
                id: e.employee_id,
                label: e.user?.full_name || e.user?.email || e.employee_id.slice(0, 8),
                department: e.department ?? null,
            }))))
            .catch(() => setAssignees([]));
    }, [open, canManage, assignees.length]);

    const defaultAssignee = context.defaultAssignee || (canManage ? '' : (currentUserId ?? ''));

    return (
        <>
            {variant === 'icon' ? (
                <button
                    onClick={() => setOpen(true)}
                    title="Görev Oluştur"
                    aria-label="Görev Oluştur"
                    className={className ?? 'p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 cursor-pointer transition-colors'}
                >
                    <ClipboardList size={15} />
                </button>
            ) : variant === 'button' ? (
                <button
                    onClick={() => setOpen(true)}
                    className={className ?? 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer transition-colors'}
                >
                    <Plus size={13} /> Görev
                </button>
            ) : (
                <button
                    onClick={() => setOpen(true)}
                    className={className ?? 'inline-flex items-center gap-1 text-[11.5px] font-semibold text-sky-600 hover:underline cursor-pointer'}
                >
                    <Plus size={12} /> Görev Ekle
                </button>
            )}

            <TaskFormModal
                open={open}
                onClose={() => setOpen(false)}
                onSaved={created => { if (created) onCreated?.(created); }}
                canManage={canManage}
                currentUserId={currentUserId}
                assignees={assignees}
                initialTitle={context.initialTitle}
                initialDescription={context.initialDescription}
                initialAssignee={defaultAssignee || undefined}
                initialLinks={buildContextLinks(context)}
                sourceType={context.sourceType ?? 'manual'}
                sourceId={context.sourceId ?? null}
            />
        </>
    );
}
