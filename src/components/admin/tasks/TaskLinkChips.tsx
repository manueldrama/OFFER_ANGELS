import { useNavigate } from 'react-router-dom';
import { X, ExternalLink } from 'lucide-react';
import { TASK_ENTITY_REGISTRY } from '../../../lib/tasks/entityRegistry';
import { usePanelBase } from '../../../contexts/PanelBaseContext';
import type { HrTaskLink } from '../../../types/hrTasks';

// Görev detayındaki bağlı-varlık çipleri. Tıkla → varlığın kendi ekranına
// derin link (taban-duyarlı, withBase registry route'unda). x → bağı kaldır
// (varlığa dokunmaz, yalnız bağ silinir).

export function TaskLinkChips({ links, onRemove }: {
    links: HrTaskLink[];
    onRemove: (link: HrTaskLink) => void;
}) {
    const navigate = useNavigate();
    const base = usePanelBase();

    if (links.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1.5">
            {links.map(link => {
                const def = TASK_ENTITY_REGISTRY[link.entity_type];
                if (!def) return null;
                const Icon = def.icon;
                return (
                    <span
                        key={link.id}
                        className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-[12px] font-semibold transition-colors ${def.chipCls}`}
                    >
                        <button
                            onClick={() => navigate(def.route(link, base))}
                            title={`${def.label}: ${link.label} — aç`}
                            className="inline-flex items-center gap-1.5 cursor-pointer min-w-0"
                        >
                            <Icon size={12} className="shrink-0" />
                            <span className="truncate max-w-[180px]">{link.label}</span>
                            <ExternalLink size={10} className="opacity-50 shrink-0" />
                        </button>
                        <button
                            onClick={() => onRemove(link)}
                            title="Bağlantıyı kaldır"
                            className="p-0.5 rounded hover:bg-white/60 cursor-pointer shrink-0"
                            aria-label={`${link.label} bağlantısını kaldır`}
                        >
                            <X size={10} />
                        </button>
                    </span>
                );
            })}
        </div>
    );
}
