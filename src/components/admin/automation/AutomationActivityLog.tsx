import React, { useEffect, useState, useCallback } from 'react';
import { Activity, RefreshCw, CheckCircle2, XCircle, Clock as ClockIcon } from 'lucide-react';
import { AdminAutomationStatsService, ActivityRow } from '../../../services/admin/automationStatsService';
import { useAdminRealtime } from '../../../hooks/useAdminRealtime';

function relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diffMs / 60000);
    if (m < 1) return 'az önce';
    if (m < 60) return `${m} dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} sa önce`;
    const d = Math.floor(h / 24);
    return `${d} gün önce`;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    sent: { label: 'Gönderildi', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <CheckCircle2 size={11} /> },
    failed: { label: 'Hata', bg: 'bg-rose-50', text: 'text-rose-700', icon: <XCircle size={11} /> },
    pending: { label: 'Bekliyor', bg: 'bg-amber-50', text: 'text-amber-700', icon: <ClockIcon size={11} /> },
    processing: { label: 'İşleniyor', bg: 'bg-indigo-50', text: 'text-indigo-700', icon: <ClockIcon size={11} /> },
};

export function AutomationActivityLog() {
    const [rows, setRows] = useState<ActivityRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { rows: data } = await AdminAutomationStatsService.getUnifiedActivity(50);
            setRows(data);
        } catch {
            // sessiz
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    useAdminRealtime(['follow_up_tasks', 'whatsapp_messages'], load);

    const filtered = filterStatus === 'all' ? rows : rows.filter(r => r.status === filterStatus);

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Activity size={16} className="text-indigo-600" />
                    <h3 className="font-semibold text-slate-800 text-sm">Son Aktivite</h3>
                    <span className="text-xs text-slate-500">{rows.length} kayıt</span>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-700 focus:border-slate-400 focus:outline-none"
                    >
                        <option value="all">Tüm Durumlar</option>
                        <option value="sent">Gönderildi</option>
                        <option value="failed">Hata</option>
                        <option value="pending">Bekliyor</option>
                    </select>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50"
                        title="Yenile"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="p-8 text-center">
                        <Activity size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">{loading ? 'Yükleniyor…' : 'Henüz aktivite yok'}</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr className="text-left">
                                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Zaman</th>
                                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Müşteri</th>
                                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Senaryo</th>
                                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ülke</th>
                                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Şablon</th>
                                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(r => {
                                const style = STATUS_STYLES[r.status] || { label: r.status, bg: 'bg-slate-100', text: 'text-slate-600', icon: null };
                                const lead = r.leads;
                                return (
                                    <tr key={r.id} className="hover:bg-slate-50/60">
                                        <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{relativeTime(r.created_at)}</td>
                                        <td className="px-3 py-2 text-xs">
                                            <p className="text-slate-700 font-medium truncate max-w-[140px]">{lead?.customer_name || lead?.phone_number || '—'}</p>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-600">{r.scenario}</td>
                                        <td className="px-3 py-2 text-xs text-slate-500">{lead?.country_code || '—'}</td>
                                        <td className="px-3 py-2 text-xs">
                                            <span className="font-mono text-[10px] text-indigo-600 truncate max-w-[160px] inline-block align-middle">
                                                {r.template_name || '—'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.bg} ${style.text}`}>
                                                {style.icon}
                                                {style.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
