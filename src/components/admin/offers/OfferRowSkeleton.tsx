import React from 'react';

/** Teklif linki satırının yükleme iskeleti — gerçek satır düzenini taklit eder. */
export const OfferRowSkeleton: React.FC = () => (
    <div className="bg-white rounded-lg p-5 border border-slate-100 flex flex-col md:flex-row gap-6 items-start md:items-center animate-pulse">
        {/* Müşteri */}
        <div className="flex items-start gap-4 w-full md:w-[25%] shrink-0">
            <div className="w-4 h-4 rounded bg-slate-100 mt-1" />
            <div className="space-y-2">
                <div className="h-3.5 w-32 rounded bg-slate-100" />
                <div className="h-3 w-24 rounded bg-slate-100" />
                <div className="h-4 w-16 rounded-full bg-slate-100" />
            </div>
        </div>
        {/* Token */}
        <div className="flex-1 min-w-0 space-y-2">
            <div className="h-7 w-48 rounded bg-slate-100" />
            <div className="h-3 w-40 rounded bg-slate-100" />
        </div>
        {/* İstatistik */}
        <div className="w-full md:w-[20%] shrink-0 space-y-2">
            <div className="h-5 w-24 rounded bg-slate-100" />
            <div className="h-4 w-20 rounded-full bg-slate-100" />
        </div>
        {/* Aksiyon */}
        <div className="flex flex-col gap-2 w-full md:w-[15%] shrink-0">
            <div className="h-8 w-full rounded-lg bg-slate-100" />
            <div className="h-8 w-full rounded-lg bg-slate-100" />
        </div>
    </div>
);

/** Birden çok skeleton satırı. */
export const OfferRowSkeletonList: React.FC<{ count?: number }> = ({ count = 5 }) => (
    <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => <OfferRowSkeleton key={i} />)}
    </div>
);
