import React from 'react';
import { Activity, RefreshCw, Download } from 'lucide-react';
import { istanbulMidnightUTC } from '../../../utils/turkeyTime';

export type Range = 'today' | '7d' | '30d' | '90d';

const RANGE_OPTIONS: { id: Range; label: string }[] = [
    { id: 'today', label: 'Bugün' },
    { id: '7d', label: '7 Gün' },
    { id: '30d', label: '30 Gün' },
    { id: '90d', label: '90 Gün' },
];

interface Props {
    range: Range;
    onRangeChange: (r: Range) => void;
    onRefresh: () => void;
    onExport?: () => void;
    loading: boolean;
}

export const AnalyticsHeader: React.FC<Props> = ({ range, onRangeChange, onRefresh, onExport, loading }) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="text-indigo-600" /> Atribüsyon Komuta Merkezi
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Ziyaretçi, oturum, kampanya, reklam ve müşteri yolculuğu dağılımı — tek panelde.
                </p>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {RANGE_OPTIONS.map(r => (
                        <button
                            key={r.id}
                            onClick={() => onRangeChange(r.id)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${range === r.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
                {onExport && (
                    <button
                        onClick={onExport}
                        disabled={loading}
                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600 disabled:opacity-50"
                        title="CSV indir"
                    >
                        <Download size={16} />
                    </button>
                )}
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600 disabled:opacity-50"
                    title="Yenile"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
        </div>
    );
};

/**
 * Range bounds anchored to Europe/Istanbul wall-clock — independent of the
 * browser's timezone, so "Bugün" is always Türkiye's today even if admin is
 * abroad / on VPN / on a mobile with a different TZ setting.
 *
 *   today : [Istanbul midnight today, now]
 *   N day : [Istanbul midnight N days ago, now]
 *
 * Previous-period bounds use the same midnight anchoring so KPI deltas are
 * apples-to-apples (no rolling-window drift across DST or day boundaries).
 */
export function rangeBounds(range: Range): { startISO: string; endISO: string; previous: { startISO: string; endISO: string } } {
    const end = new Date();
    const days = range === 'today' ? 0 : range === '7d' ? 7 : range === '30d' ? 30 : 90;

    const start = range === 'today' ? istanbulMidnightUTC(0) : istanbulMidnightUTC(days);

    const prevStart = range === 'today' ? istanbulMidnightUTC(1) : istanbulMidnightUTC(days * 2);
    const prevEnd = new Date(start.getTime() - 1);

    return {
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        previous: { startISO: prevStart.toISOString(), endISO: prevEnd.toISOString() },
    };
}
