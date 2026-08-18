import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { OFFER_GROUPS } from './offerGroups';
import { OfferGroupAccordion, type OfferRowItem } from './OfferGroupAccordion';
import { cn } from '../../../lib/utils';

interface MonthBucket {
    key: string;
    mo: string;
    yr: string;
    label: string;
    items: OfferRowItem[];
    sent: number;
    opened: number;
    won: number;
    lost: number;
    conversion: number;
}

const TR_SHORT = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];
const TR_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function groupByMonth(items: OfferRowItem[]): MonthBucket[] {
    const map = new Map<string, OfferRowItem[]>();
    for (const it of items) {
        const dt = new Date(it.offer.created_at);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        let arr = map.get(key);
        if (!arr) { arr = []; map.set(key, arr); }
        arr.push(it);
    }
    const buckets: MonthBucket[] = [];
    for (const [key, list] of map) {
        const [yr, m] = key.split('-');
        const mi = Number(m) - 1;
        const opened = list.filter((i) => i.d.opens > 0).length;
        const won = list.filter((i) => i.d.status === 'won').length;
        const lost = list.filter((i) => i.d.status === 'lost').length;
        buckets.push({
            key, mo: TR_SHORT[mi], yr, label: `${TR_LONG[mi]} ${yr}`,
            items: list, sent: list.length, opened, won, lost,
            conversion: list.length ? Math.round((won / list.length) * 100) : 0,
        });
    }
    return buckets.sort((a, b) => (a.key < b.key ? 1 : -1));
}

const MonthStat: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
    <div className={cn('min-w-0', className)}>
        <div className="text-[15px] font-bold tracking-tight tabular-nums text-slate-900">{value}</div>
        <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
    </div>
);

const MonthRow: React.FC<{
    bucket: MonthBucket;
    defaultOpen: boolean;
    renderRow: (item: OfferRowItem) => React.ReactNode;
}> = ({ bucket, defaultOpen, renderRow }) => {
    const [open, setOpen] = useState(defaultOpen);
    const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(OFFER_GROUPS.filter(g => g.defaultOpen).map(g => g.key)));
    const [showAll, setShowAll] = useState<Set<string>>(() => new Set());

    const openedPct = bucket.sent ? Math.round((bucket.opened / bucket.sent) * 100) : 0;
    const activeCount = bucket.sent - bucket.won - bucket.lost;

    return (
        <div className="mb-2.5">
            <button
                onClick={() => setOpen(o => !o)}
                className={cn(
                    'flex w-full items-center gap-3.5 border border-slate-200 bg-white px-4 py-3 text-left shadow-[var(--shadow-card)] transition-shadow hover:shadow-md',
                    open ? 'rounded-t-2xl border-b-transparent' : 'rounded-2xl',
                )}
            >
                <div
                    className="flex h-[42px] w-[38px] shrink-0 flex-col items-center justify-center rounded-[11px] border"
                    style={{ background: 'var(--color-brand-50)', borderColor: 'var(--color-brand-100)' }}
                >
                    <span className="text-[13px] font-extrabold leading-none tracking-tight" style={{ color: 'var(--color-brand-700)' }}>{bucket.mo}</span>
                    <span className="mt-0.5 text-[8.5px] font-semibold text-slate-400">{bucket.yr}</span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold text-slate-900">{bucket.label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">{activeCount} aktif · {bucket.won} kapatıldı</div>
                </div>
                <MonthStat label="Gönderilen" value={bucket.sent} className="hidden w-[78px] sm:block" />
                <MonthStat label="Açılan" value={<>{bucket.opened}<span className="ml-1 text-[11px] font-semibold text-slate-400">%{openedPct}</span></>} className="hidden w-[92px] md:block" />
                <MonthStat label="Kapanan" value={bucket.won} className="hidden w-[70px] md:block" />
                <MonthStat label="Kayıp" value={bucket.lost} className="hidden w-[64px] lg:block" />
                <div className="hidden w-[140px] shrink-0 lg:block">
                    <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">Dönüşüm</span>
                        <span className="text-[13px] font-extrabold tabular-nums text-slate-900">%{bucket.conversion}</span>
                    </div>
                    <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full" style={{ width: `${bucket.conversion}%`, background: 'linear-gradient(90deg, var(--color-brand-500), var(--color-ok))' }} />
                    </div>
                </div>
                <span className={cn('grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-slate-400 transition-transform', open && 'rotate-180')}>
                    <ChevronDown size={16} />
                </span>
            </button>

            {open && (
                <div className="rounded-b-2xl border border-t-0 border-slate-200 bg-[var(--color-slate-50)] p-2.5" style={{ animation: 'cpFadeIn .18s ease' }}>
                    {OFFER_GROUPS.map((g) => {
                        const groupItems = bucket.items.filter((i) => i.d.group === g.key);
                        if (groupItems.length === 0) return null;
                        return (
                            <OfferGroupAccordion
                                key={g.key}
                                groupKey={g.key}
                                items={groupItems}
                                open={openGroups.has(g.key)}
                                onToggle={() => setOpenGroups((s) => { const n = new Set(s); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n; })}
                                showAll={showAll.has(g.key)}
                                onToggleShowAll={() => setShowAll((s) => { const n = new Set(s); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n; })}
                                renderRow={renderRow}
                                hideWhenEmpty
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface OffersMonthlyViewProps {
    items: OfferRowItem[];
    renderRow: (item: OfferRowItem) => React.ReactNode;
}

/** Aylık görünüm — her ay, öncelik listesiyle aynı GroupAccordion kartlarını kullanır. */
export const OffersMonthlyView: React.FC<OffersMonthlyViewProps> = ({ items, renderRow }) => {
    const months = useMemo(() => groupByMonth(items), [items]);
    return (
        <div>
            {months.map((b, i) => (
                <MonthRow key={b.key} bucket={b} defaultOpen={i === 0} renderRow={renderRow} />
            ))}
        </div>
    );
};
