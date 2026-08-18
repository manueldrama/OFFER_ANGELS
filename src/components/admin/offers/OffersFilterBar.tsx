import React from 'react';
import { Search, Filter, ArrowUpDown, CalendarRange, Thermometer, ChevronDown, Store } from 'lucide-react';
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS } from '../../../lib/leadStatus';
import { OFFER_CLIENT_SORTS, OFFER_PERIODS, type OfferClientSort } from '../../../lib/offerPriority';
import { cn } from '../../../lib/utils';

interface OffersFilterBarProps {
    search: string;
    onSearchChange: (v: string) => void;
    /** offer_links.is_active tabanlı link durumu. */
    linkStatus: string;
    onLinkStatusChange: (v: string) => void;
    /** leads.status (sıcaklık) tek-odak filtresi — KPI/çip/priority queue ile ortak. */
    leadStatus: string;
    onLeadStatusChange: (v: string) => void;
    /** leads.business_type (işletme türü) filtresi — sheet'ten gelen ham değerler. */
    businessType: string;
    onBusinessTypeChange: (v: string) => void;
    businessTypeOptions: string[];
    period: string;
    onPeriodChange: (v: string) => void;
    sort: OfferClientSort;
    onSortChange: (v: OfferClientSort) => void;
    actionOnly: boolean;
    onActionOnlyChange: (v: boolean) => void;
}

const LINK_STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: 'Tüm linkler' },
    { value: 'active', label: 'Aktif' },
    { value: 'expiring_soon', label: 'Süresi yaklaşan' },
    { value: 'time_expired', label: 'Süresi dolmuş' },
    { value: 'expired', label: 'İptal edilmiş' },
    { value: 'completed', label: 'Ödeme alınmış' },
];

/** Hızlı sıcaklık çipleri → leadStatus tek-odak filtresi. */
const QUICK_CHIPS: { key: string; label: string; token: string }[] = [
    { key: 'hot', label: 'Hot', token: 'hot' },
    { key: 'warm', label: 'Warm', token: 'warm' },
    { key: 'new', label: 'Yeni', token: 'new' },
    { key: 'follow_up', label: 'Takipte', token: 'follow' },
    { key: 'cold', label: 'Soğuk', token: 'ice' },
    { key: 'offer_sent', label: 'Yakın', token: 'closing' },
];

const Select: React.FC<{
    value: string; onChange: (v: string) => void; title: string;
    icon: React.ReactNode; children: React.ReactNode; width?: string;
}> = ({ value, onChange, title, icon, children, width }) => (
    <div className={cn('relative', width)}>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            title={title}
            className="h-[40px] w-full cursor-pointer appearance-none rounded-[10px] border border-slate-200 bg-white pl-9 pr-8 text-[12.5px] font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-50"
        >
            {children}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
);

/** Premium filtre barı — arama · link durumu · sıcaklık · dönem · 8 sıralama · toggle · hızlı çipler. */
export const OffersFilterBar: React.FC<OffersFilterBarProps> = ({
    search, onSearchChange, linkStatus, onLinkStatusChange, leadStatus, onLeadStatusChange,
    businessType, onBusinessTypeChange, businessTypeOptions,
    period, onPeriodChange, sort, onSortChange, actionOnly, onActionOnlyChange,
}) => (
    <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)]">
        {/* arama */}
        <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Müşteri adı, telefon veya teklif kodu ara…"
                className="h-[40px] w-full rounded-[10px] border border-slate-200 bg-[var(--color-slate-50)] pl-9 pr-3 text-[12.5px] text-slate-700 outline-none transition-colors focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-50"
            />
        </div>

        <Select value={linkStatus} onChange={onLinkStatusChange} title="Link durumu" icon={<Filter size={14} />} width="w-full sm:w-[150px]">
            {LINK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>

        <Select value={leadStatus} onChange={onLeadStatusChange} title="Sıcaklık" icon={<Thermometer size={14} />} width="w-full sm:w-[160px]">
            <option value="all">Tüm sıcaklıklar</option>
            {LEAD_STATUS_ORDER.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
        </Select>

        {businessTypeOptions.length > 0 && (
            <Select value={businessType} onChange={onBusinessTypeChange} title="İşletme türü" icon={<Store size={14} />} width="w-full sm:w-[170px]">
                <option value="all">Tüm işletme türleri</option>
                {businessTypeOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
        )}

        <Select value={period} onChange={onPeriodChange} title="Dönem" icon={<CalendarRange size={14} />} width="w-full sm:w-[140px]">
            {OFFER_PERIODS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
        </Select>

        <Select value={sort} onChange={(v) => onSortChange(v as OfferClientSort)} title="Sıralama" icon={<ArrowUpDown size={14} />} width="w-full sm:w-[185px]">
            {OFFER_CLIENT_SORTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>

        {/* sadece aksiyon bekleyenler toggle */}
        <button
            onClick={() => onActionOnlyChange(!actionOnly)}
            className="inline-flex select-none items-center gap-2 px-1 text-[12px] font-semibold text-slate-700"
        >
            <span
                className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', actionOnly ? 'bg-brand-600' : 'bg-slate-300')}
            >
                <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', actionOnly ? 'left-0.5 translate-x-[14px]' : 'left-0.5')} />
            </span>
            Sadece aksiyon bekleyenler
        </button>

        {/* hızlı sıcaklık çipleri */}
        <div className="ml-auto flex items-center gap-1.5">
            {QUICK_CHIPS.map((c) => {
                const active = leadStatus === c.key;
                return (
                    <button
                        key={c.key}
                        onClick={() => onLeadStatusChange(active ? 'all' : c.key)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors',
                            active ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                        )}
                        style={active ? { background: `var(--color-${c.token})` } : undefined}
                    >
                        <span
                            className="h-[7px] w-[7px] rounded-full"
                            style={{ background: active ? '#fff' : `var(--color-${c.token})` }}
                        />
                        {c.label}
                    </button>
                );
            })}
        </div>
    </div>
);
