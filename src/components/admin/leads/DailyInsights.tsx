import React from 'react';
import { Sparkles, Clock, TrendingUp } from 'lucide-react';
import type { Lead } from '../../../services/admin/leadsService';
import type { RepLoad } from '../../../services/admin/leadPoolService';
import type { PoolStats } from '../../../services/admin/leadPoolService';

interface DailyInsightsProps {
    priorityLeads: Lead[];
    repDistribution: RepLoad[];
    stats: PoolStats | null;
}

function getStatusBadge(status: RepLoad['status']) {
    switch (status) {
        case 'En aktif': return 'bg-emerald-50 text-emerald-700';
        case 'Dengeli': return 'bg-blue-50 text-blue-700';
        case 'Yakın kapanış': return 'bg-amber-50 text-amber-700';
        case 'Düşük': return 'bg-slate-100 text-slate-500';
    }
}

export function DailyInsights({ priorityLeads, repDistribution, stats }: DailyInsightsProps) {
    // Top 3 priority leads for AI insights
    const topLeads = priorityLeads.slice(0, 3);

    // Segment metrics
    const hotWarm = (stats?.byStatus['hot'] || 0) + (stats?.byStatus['warm'] || 0) + (stats?.byStatus['payment_started'] || 0);
    const contacted = stats?.byStatus['contacted'] || 0;
    const followUp = stats?.byStatus['follow_up'] || 0;
    const total = stats?.total || 1;

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-5 lg:p-5 space-y-5">
            {/* AI Priority Insights */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900">Günün içgörüleri</h3>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Canlı</span>
                </div>

                {topLeads.length > 0 ? (
                    <>
                        <div className="flex items-start gap-2 mb-3 p-3 bg-violet-50 rounded-lg">
                            <Sparkles size={14} className="text-violet-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-semibold text-violet-800">AI öncelik önerisi</p>
                                <p className="text-[11px] text-violet-600 mt-0.5">
                                    İlk 3 kayıt: {topLeads.map(l => l.customer_name).join(', ')} — yüksek skor, yakın aksiyon ve güçlü satın alma sinyali nedeniyle ilk blokta takip edilmeli.
                                </p>
                            </div>
                        </div>

                        {/* Action Timeline */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-600">Aksiyon zaman çizelgesi</p>
                            {topLeads.map((lead, i) => (
                                <div key={lead.id} className="flex items-start gap-3 py-2">
                                    <div className="text-[10px] font-bold text-slate-400 w-12 shrink-0 pt-0.5">
                                        {lead.ai_state?.score ? `${lead.ai_state.score}/100` : '—'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-800 truncate">{lead.customer_name}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                                            {lead.ai_state?.next_action || lead.ai_state?.summary || 'Henüz AI analizi yapılmadı.'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="py-8 text-center text-sm text-slate-400">Henüz öncelikli lead yok.</div>
                )}
            </div>

            {/* Segment Metrics */}
            <div>
                <p className="text-xs font-semibold text-slate-600 mb-3">Segment metrikleri</p>
                <p className="text-[10px] text-slate-400 mb-3">Havuz içindeki dağılım hızlı okuyun</p>
                <div className="space-y-3">
                    <SegmentBar label="Sıcak + karar aşaması" count={hotWarm} total={total} color="bg-orange-500" />
                    <SegmentBar label="İlk temas bekleyenler" count={contacted} total={total} color="bg-indigo-500" />
                    <SegmentBar label="Takip geçikenler" count={followUp} total={total} color="bg-slate-400" />
                </div>
            </div>

            {/* Rep Distribution */}
            <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Temsilci bazlı dağılım</p>
                <p className="text-[10px] text-slate-400 mb-3">Toplam lead kartından sonra ekip yükünü detaylı görün</p>
                <div className="space-y-3">
                    {repDistribution.map(rep => (
                        <div key={rep.id} className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                {rep.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-slate-800">{rep.name}</p>
                                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${getStatusBadge(rep.status)}`}>
                                        {rep.status}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    {rep.leadCount} lead · {rep.hotCount} sıcak fırsat
                                </p>
                            </div>
                        </div>
                    ))}
                    {repDistribution.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">Temsilci verisi yok.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function SegmentBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
    const pct = Math.round((count / total) * 100);
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-600">{label}</span>
                <span className="text-[10px] text-slate-400">{count} kayıt</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-lg font-black text-slate-900">%{pct}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                </div>
            </div>
        </div>
    );
}
