import React from 'react';

const Bar: React.FC<{ w: string; h?: string }> = ({ w, h = 'h-3' }) => (
    <span className={`block ${h} ${w} rounded bg-slate-100 animate-pulse`} />
);

/** Yükleme iskeleti — tablo satırı yüksekliğini korur, layout zıplamaz. */
export const OrderRowSkeletonList: React.FC<{ count?: number }> = ({ count = 6 }) => (
    <>
        {Array.from({ length: count }).map((_, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-b-0">
                <td className="px-4 py-3"><Bar w="w-4" h="h-4" /></td>
                <td className="px-4 py-3"><Bar w="w-32" /><span className="block h-1.5" /><Bar w="w-44" h="h-2.5" /></td>
                <td className="px-4 py-3"><Bar w="w-28" /><span className="block h-1.5" /><Bar w="w-20" h="h-2.5" /></td>
                <td className="px-4 py-3"><Bar w="w-24" /><span className="block h-1.5" /><Bar w="w-16" h="h-2.5" /></td>
                <td className="px-4 py-3"><Bar w="w-24" h="h-6" /></td>
                <td className="px-4 py-3"><Bar w="w-20" h="h-6" /></td>
                <td className="px-4 py-3"><Bar w="w-14" h="h-6" /></td>
            </tr>
        ))}
    </>
);

/** Mobil kart iskeleti. */
export const OrderCardSkeletonList: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="p-4 border-b border-slate-200 last:border-b-0 flex flex-col gap-3">
                <Bar w="w-32" />
                <Bar w="w-48" h="h-2.5" />
                <Bar w="w-24" h="h-6" />
            </div>
        ))}
    </>
);
