import React, { useEffect, useState, useCallback } from 'react';
import { Zap, Send, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { AdminAutomationStatsService, AutomationKpiStats } from '../../../services/admin/automationStatsService';
import { useAdminRealtime } from '../../../hooks/useAdminRealtime';

export function AutomationKpiCards() {
    const [stats, setStats] = useState<AutomationKpiStats | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await AdminAutomationStatsService.getKpis();
            setStats(data);
        } catch {
            // sessiz
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    useAdminRealtime(['follow_up_tasks', 'automation_settings', 'automation_rules', 'whatsapp_messages'], load);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card
                icon={<Zap size={16} className="text-emerald-600" />}
                bg="bg-emerald-50"
                label="Aktif Senaryo"
                value={stats ? `${stats.activeScenarios} / ${stats.totalScenarios}` : '—'}
                loading={loading}
            />
            <Card
                icon={<Send size={16} className="text-indigo-600" />}
                bg="bg-indigo-50"
                label="Bugün Gönderilen"
                value={stats ? String(stats.todaySent) : '—'}
                loading={loading}
            />
            <Card
                icon={<AlertCircle size={16} className="text-rose-600" />}
                bg="bg-rose-50"
                label="Bugün Hata"
                value={stats ? String(stats.todayFailed) : '—'}
                loading={loading}
            />
            <Card
                icon={<Clock size={16} className="text-amber-600" />}
                bg="bg-amber-50"
                label="Bekleyen"
                value={stats ? String(stats.pendingTasks) : '—'}
                loading={loading}
            />
        </div>
    );
}

function Card({ icon, bg, label, value, loading }: { icon: React.ReactNode; bg: string; label: string; value: string; loading: boolean }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</p>
                <p className="text-lg font-bold text-slate-900 leading-tight">
                    {loading ? <span className="inline-block w-12 h-5 bg-slate-100 rounded animate-pulse" /> : value}
                </p>
            </div>
        </div>
    );
}
