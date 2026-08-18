import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../../../../lib/supabase/client';
import { useAdminRealtime } from '../../../../hooks/useAdminRealtime';
import { WidgetState } from '../WidgetState';

interface MonthData {
    label: string;
    actual: number;
    target: number;
    isCurrent: boolean;
}

const MONTH_LABELS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// leadIds verilirse gelir sadece o leadlerin ödemelerinden hesaplanır
// (temsilci dashboard'u); verilmezse global davranış birebir aynı.
export function RevenueChartWidget({ leadIds }: { leadIds?: string[] } = {}) {
    const [months, setMonths] = useState<MonthData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const leadIdsKey = leadIds ? leadIds.join(',') : undefined;

    const loadMonthlyRevenue = useCallback(async () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Fetch last 12 months of successful payments
        const startDate = new Date(currentYear, currentMonth - 11, 1);
        let payments: { amount: any; created_at: string }[] = [];
        // Lead'i olmayan temsilcide (leadIds=[]) sorgu atlanır → 12 ay sıfır.
        if (!leadIds || leadIds.length > 0) {
            let query = supabase
                .from('payment_transactions')
                .select('amount, created_at, status')
                .eq('status', 'success')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true });
            if (leadIds) query = query.in('lead_id', leadIds);
            const { data, error: qErr } = await query;
            if (qErr) {
                // Hata halinde 12 ay sıfır çubuk çizmek "bu yıl hiç ciro olmadı"
                // demektir — grafikte boş durum bile yok, düz bir taban görünür.
                console.error('[RevenueChartWidget] load failed:', qErr);
                setError(qErr.message || 'Bilinmeyen hata');
                setMonths([]);
                return;
            }
            payments = data || [];
        }
        setError(null);

        // Aggregate by month
        const monthlyTotals: Record<string, number> = {};
        (payments || []).forEach(p => {
            const d = new Date(p.created_at);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            monthlyTotals[key] = (monthlyTotals[key] || 0) + (Number(p.amount) || 0);
        });

        // Build 12 months of data
        const result: MonthData[] = [];
        for (let i = 11; i >= 0; i--) {
            const m = new Date(currentYear, currentMonth - i, 1);
            const key = `${m.getFullYear()}-${m.getMonth()}`;
            const actual = monthlyTotals[key] || 0;
            // Target is a rough average baseline (can be replaced with real targets)
            const allValues = Object.values(monthlyTotals);
            const avgRevenue = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;
            const target = avgRevenue > 0 ? Math.round(avgRevenue * 1.1) : 0;

            result.push({
                label: MONTH_LABELS[m.getMonth()],
                actual,
                target,
                isCurrent: i === 0,
            });
        }

        setMonths(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadIdsKey]);

    useEffect(() => { loadMonthlyRevenue(); }, [loadMonthlyRevenue]);
    useAdminRealtime(['payment_transactions'], loadMonthlyRevenue);

    const maxVal = Math.max(...months.map(m => Math.max(m.actual, m.target)), 1);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex flex-col gap-1">
                    <h3 className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">
                        Aylık Gelir ve Hedef Analizi
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">Gerçekleşen gelir ile aylık hedeflerin karşılaştırması</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-slate-200" />
                            <span className="text-xs text-slate-500 font-medium">Hedef</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
                            <span className="text-xs text-slate-500 font-medium">Gerçekleşen</span>
                        </div>
                    </div>
                    {/* reports/revenue temsilciye kapalı — scoped görünümde linki gizle */}
                    {!leadIds && (
                        <Link to="/admin/reports/revenue" className="text-sky-500 text-[13px] font-medium flex items-center gap-1 hover:text-sky-700 transition-colors">
                            Detay <ArrowRight size={14} />
                        </Link>
                    )}
                </div>
            </div>

            {/* Chart */}
            {error ? (
                <div className="flex-1 min-h-[220px] flex items-center justify-center">
                    <WidgetState kind="error" detail={error} onRetry={loadMonthlyRevenue} />
                </div>
            ) : (
            <div className="flex items-end gap-5 flex-1 min-h-[220px] pt-4">
                {months.map((m, i) => (
                    <div key={i} className="flex flex-col items-center gap-3 flex-1 h-full justify-end">
                        <div className="flex gap-1 items-end w-full justify-center h-full relative">
                            {/* Target bar */}
                            <div
                                className="w-[18px] rounded-t bg-slate-200"
                                style={{ height: `${maxVal > 0 ? (m.target / maxVal) * 100 : 0}%`, minHeight: m.target > 0 ? 4 : 0 }}
                            />
                            {/* Actual bar */}
                            <div
                                className={`w-[18px] rounded-t ${m.isCurrent ? 'bg-sky-500' : 'bg-sky-200'}`}
                                style={{ height: `${maxVal > 0 ? (m.actual / maxVal) * 100 : 0}%`, minHeight: m.actual > 0 ? 4 : 0 }}
                            />
                        </div>
                        <span className={`text-[13px] font-medium ${m.isCurrent ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                            {m.label}
                        </span>
                    </div>
                ))}
            </div>
            )}
        </div>
    );
}
