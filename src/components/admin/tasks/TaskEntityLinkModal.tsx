import { useEffect, useState } from 'react';
import { X, Search, Loader2, Link2 } from 'lucide-react';
import { HrTaskService } from '../../../services/admin/hr/hrTaskService';
import { useToast } from '../../../contexts/ToastContext';
import { TASK_ENTITY_REGISTRY, TASK_ENTITY_TYPES, type EntitySearchResult } from '../../../lib/tasks/entityRegistry';
import type { TaskLinkEntityType } from '../../../types/hrTasks';

// Göreve sistem varlığı bağlama modalı — tip sekmeleri + 300ms debounce'lu
// arama (OfferLinkFormModal deseni). Arama mantığı entityRegistry'dedir;
// modal yalnız kabuktur.

export function TaskEntityLinkModal({ open, taskId, onClose, onLinked, onPick }: {
    open: boolean;
    /** Var olan göreve bağlarken dolu; onPick kipinde (henüz görev yokken) boş. */
    taskId?: string;
    onClose: () => void;
    onLinked?: () => void;
    /** Doluysa DB'ye yazılmaz — seçim çağırana verilir (Yeni Görev formu:
        görev oluşturulduktan SONRA bağlanır). */
    onPick?: (type: TaskLinkEntityType, result: EntitySearchResult) => void;
}) {
    const toast = useToast();
    const [type, setType] = useState<TaskLinkEntityType>('lead');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<EntitySearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [linkingId, setLinkingId] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setQuery('');
        setResults([]);
    }, [open, type]);

    useEffect(() => {
        if (!open) return;
        // WhatsApp/servis aramaları boş sorguda anlamsız; lead/teklifte boş
        // sorgu "son kayıtlar"ı getirir (teklif zaten istemcide süzülüyor).
        if (!query.trim() && (type === 'whatsapp' || type === 'service_request')) {
            setResults([]);
            return;
        }
        setSearching(true);
        const t = setTimeout(() => {
            TASK_ENTITY_REGISTRY[type].search(query)
                .then(setResults)
                .catch(e => {
                    console.error('[TaskEntityLinkModal] search error:', e);
                    setResults([]);
                })
                .finally(() => setSearching(false));
        }, 300);
        return () => clearTimeout(t);
    }, [open, type, query]);

    if (!open) return null;

    const link = async (r: EntitySearchResult) => {
        if (onPick) {
            onPick(type, r);
            onClose();
            return;
        }
        if (!taskId) return;
        setLinkingId(r.entity_id);
        try {
            await HrTaskService.addLink(taskId, {
                entity_type: type,
                entity_id: r.entity_id,
                label: r.label,
                meta: r.meta,
            });
            toast.success('Bağlantı eklendi');
            onLinked?.();
            onClose();
        } catch (e: any) {
            // unique(task_id, entity_type, entity_id) ihlali = zaten bağlı
            toast.error(String(e?.message || '').includes('duplicate')
                ? 'Bu kayıt zaten bağlı'
                : e?.message || 'Bağlanamadı');
        } finally {
            setLinkingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40" onMouseDown={onClose}>
            <div
                className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl max-h-[80vh] flex flex-col"
                onMouseDown={e => e.stopPropagation()}
            >
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                        <Link2 size={15} className="text-slate-400" /> Sistemden Bağla
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Kapat">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 pt-4">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 mb-3">
                        {TASK_ENTITY_TYPES.map(t => {
                            const def = TASK_ENTITY_REGISTRY[t];
                            const Icon = def.icon;
                            return (
                                <button
                                    key={t}
                                    onClick={() => setType(t)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer ${
                                        type === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <Icon size={13} /> {def.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative mb-3">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            autoFocus
                            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-[13.5px] outline-none focus:border-slate-400"
                            placeholder={`${TASK_ENTITY_REGISTRY[type].label} ara…`}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-[180px]">
                    {searching ? (
                        <div className="py-8 flex justify-center"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
                    ) : results.length === 0 ? (
                        <p className="py-8 text-center text-[12.5px] text-slate-400">
                            {query.trim() ? 'Sonuç yok' : 'Aramak için yazın'}
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {results.map(r => (
                                <li key={r.entity_id}>
                                    <button
                                        onClick={() => void link(r)}
                                        disabled={linkingId !== null}
                                        className="w-full text-left px-2 py-2.5 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-medium text-slate-800 truncate">{r.label}</p>
                                                {r.sublabel && <p className="text-[11px] text-slate-400 truncate">{r.sublabel}</p>}
                                            </div>
                                            {linkingId === r.entity_id && <Loader2 size={13} className="animate-spin text-slate-400" />}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
