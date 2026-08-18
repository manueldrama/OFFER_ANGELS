import React from 'react';

interface Props {
    page: number;
    pageSize: number;
    total: number;
    shown: number;
    onPageChange: (page: number) => void;
}

/** Tablo kartının alt şeridi — "X / Y sipariş gösteriliyor" + Önceki/Sonraki. */
export const OrdersPagination: React.FC<Props> = ({ page, pageSize, total, shown, onPageChange }) => {
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    const rangeEnd = (page - 1) * pageSize + shown;

    return (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200">
            <span className="text-xs text-slate-500 tabular-nums">
                {total === 0 ? '0 sipariş' : `${rangeEnd} / ${total} sipariş gösteriliyor`}
            </span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                    Önceki
                </button>
                <button
                    type="button"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= lastPage}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                    Sonraki
                </button>
            </div>
        </div>
    );
};
