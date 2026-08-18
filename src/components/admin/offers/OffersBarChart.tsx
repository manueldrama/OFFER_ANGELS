import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { OfferLinkWeeklyPoint } from '../../../services/admin/offerLinksService';

interface OffersBarChartProps {
    /** Son 7 günün açılma dağılımı (en eski → bugün). */
    data: OfferLinkWeeklyPoint[];
}

/** Haftalık açılma dağılımı — recharts BarChart. Son gün (bugün) vurgulanır. */
export const OffersBarChart: React.FC<OffersBarChartProps> = ({ data }) => {
    const lastIndex = data.length - 1;

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    labelStyle={{ fontWeight: 600, color: '#0f172a' }}
                    formatter={(value: number) => [`${value} açılma`, '']}
                    separator=""
                />
                <Bar dataKey="opens" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {data.map((_, i) => (
                        <Cell key={i} fill={i === lastIndex ? '#6366f1' : '#c7d2fe'} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};
