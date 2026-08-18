import React from 'react';
import { RefreshCw, Plus } from 'lucide-react';

interface Props {
    /** Filtreye uyan toplam kayıt — null iken çip gösterilmez. */
    count: number | null;
    refreshing: boolean;
    onRefresh: () => void;
    onManualSale: () => void;
}

/** Sayfa başlığı — başlık + kayıt çipi + Yenile / Manuel Satış aksiyonları. */
export const OrdersHeader: React.FC<Props> = ({ count, refreshing, onRefresh, onManualSale }) => (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0">
            <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Siparişler</h1>
                {count !== null && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold tabular-nums">
                        {count} kayıt
                    </span>
                )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
                Gelen siparişleri, ödeme onaylarını ve kargo süreçlerini tek yerden yönetin.
            </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
            <button
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white text-slate-700 text-sm font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-60 cursor-pointer"
            >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : undefined} />
                Yenile
            </button>
            <button
                onClick={onManualSale}
                title="Dışarıda kapatılan satışı siparişlere aktar"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
                <Plus size={15} />
                Manuel Satış
            </button>
        </div>
    </div>
);
