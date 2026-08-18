import React from 'react';
import { Sparkles, Flame, Target, Bell, Sun, TimerOff, ArrowRight, LucideIcon } from 'lucide-react';

export interface PriorityQueueStats {
    /** Henüz aranmamış yeni lead (noContact). */
    newLeads: number;
    /** Sıcak lead sayısı. */
    hot: number;
    /** Kapanışa yakın (offer_sent + payment_started). */
    closing: number;
    /** Aktif + 48 saat içinde süresi dolacak. */
    expiring: number;
    /** Süresi geçmiş (valid_until doldu) — yenileme/aksiyon gerekiyor. */
    expired: number;
}

interface PriorityQueuePanelProps {
    stats: PriorityQueueStats;
    /** Bir önceliğe odaklan (leadStatus filtresi veya özel '__urgent'). */
    onJump: (key: string) => void;
    /** Öncelik sırasına göre listele (filtreleri sıfırla). */
    onShowPriority: () => void;
}

interface QItem {
    key: string; value: number; icon: LucideIcon; color: string; text: string;
}

/** Koyu mor "Bugünün Öncelikleri" komuta paneli — referans PriorityQueue. */
export const PriorityQueuePanel: React.FC<PriorityQueuePanelProps> = ({ stats, onJump, onShowPriority }) => {
    const items: QItem[] = [
        { key: 'new', value: stats.newLeads, icon: Sun, color: 'var(--color-new)', text: 'yeni lead henüz aranmadı' },
        { key: 'hot', value: stats.hot, icon: Flame, color: 'var(--color-hot)', text: 'sıcak lead satışa en yakın' },
        { key: 'offer_sent', value: stats.closing, icon: Target, color: 'var(--color-closing)', text: 'teklif kapanışa yakın' },
        { key: '__urgent', value: stats.expiring, icon: Bell, color: 'var(--color-warm)', text: 'teklif 48 saat içinde doluyor' },
        { key: '__expired', value: stats.expired, icon: TimerOff, color: 'var(--color-hot)', text: 'teklif süresi doldu' },
    ];

    return (
        <div
            className="relative overflow-hidden rounded-2xl p-5 text-white"
            style={{
                background:
                    'radial-gradient(120% 140% at 100% 0%, rgba(99,84,242,.16), transparent 55%), linear-gradient(135deg,#201A4D,#2E2566 55%, #3A2E7A)',
                boxShadow: '0 14px 38px rgba(32,26,77,.30)',
            }}
        >
            <span
                className="pointer-events-none absolute -right-10 -top-10 h-[200px] w-[200px] rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(131,121,247,.30), transparent 70%)' }}
            />
            <div className="relative mb-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-white/10 backdrop-blur-sm">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-bold leading-tight">Bugünün Öncelikleri</h3>
                        <p className="mt-0.5 text-[11.5px] text-white/60">Satış ekibinin önce ilgilenmesi gereken linkler.</p>
                    </div>
                </div>
                <button
                    onClick={onShowPriority}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[11px] bg-white px-3.5 py-2 text-[12.5px] font-bold transition-transform hover:-translate-y-px"
                    style={{ color: 'var(--color-brand-700)' }}
                >
                    Öncelikli Lead’leri Göster<ArrowRight size={14} />
                </button>
            </div>

            <div className="relative grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
                {items.map((it) => (
                    <button
                        key={it.key}
                        onClick={() => onJump(it.key)}
                        className="rounded-[13px] border border-white/10 bg-white/[0.07] p-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.13]"
                    >
                        <div className="mb-2 grid h-7 w-7 place-items-center rounded-[9px]" style={{ background: `${it.color}26`, color: it.color }}>
                            <it.icon size={15} />
                        </div>
                        <div className="text-[20px] font-bold leading-none tracking-tight tabular-nums">{it.value}</div>
                        <div className="mt-1 text-[11.5px] leading-snug text-white/75">{it.text}</div>
                    </button>
                ))}
            </div>
        </div>
    );
};
