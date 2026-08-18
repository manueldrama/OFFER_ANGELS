import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, ExternalLink, Edit2, MessageCircle, Activity, Phone, Trash2, Share2, Clock, Sparkles, RefreshCw, CheckSquare, ArrowUpDown, Download, Send, X, Bot, Loader2, Copy, ArrowRight, Zap, FileText, Smartphone, Monitor, ChevronDown } from 'lucide-react';
import { Link as LinkIcon } from 'lucide-react';
import type { Lead } from '../../../services/admin/leadsService';
import { businessTypeI18nKey } from '../../../services/admin/businessTypesService';
import { useTranslation } from 'react-i18next';
import { whatsappChatService, ChatMessage } from '../../../services/admin/whatsappChatService';
import { apiAssistanceService } from '../../../services/admin/aiAssistanceService';
import { formatDate, formatTime } from '../../../hooks/useAppSettings';
import { supabase } from '../../../lib/supabase/client';
import { countryFlag } from '../../../utils/geoFormat';
import { resolveLeadCountry } from '../../../utils/countries';
import { leadChannel } from '../../../utils/leadChannel';
import { LEAD_STATUS_LABELS as StatusLabels, LEAD_STATUS_COLORS as statusColors } from '../../../lib/leadStatus';
import { WhatsAppQuickSend } from './WhatsAppQuickSend';
import { LeadDetailPanel } from './LeadDetailPanel';

interface PriorityLeadTableProps {
    leads: Lead[];
    loading: boolean;
    selectedIds: Set<string>;
    toggleSelect: (id: string) => void;
    toggleSelectAll: () => void;
    isSalesRole: boolean;
    salesReps: { id: string; full_name: string; email: string }[];
    page: number;
    total: number;
    limit: number;
    setPage: (p: number) => void;
    scoringLeadId: string | null;
    onScoreLead: (id: string) => void;
    onViewDetail: (id: string) => void;
    onEdit: (lead: Lead) => void;
    onCreateOffer: (lead: Lead) => void;
    onCreateTask: (lead: Lead) => void;
    onSendWhatsApp: (lead: Lead) => void;
    onUpdateStatus: (lead: Lead) => void;
    onDelete: (lead: Lead) => void;
    onSharePortal: (lead: Lead) => void;
    onStatusChange: (leadId: string, status: string) => void;
    onAssignChange: (leadId: string, assignedTo: string | null) => void;
    onBulkDelete: () => void;
    bulkDeleting: boolean;
    onBulkCreateTask: () => void;
    onBulkAssign: (assignedTo: string | null) => void;
    bulkAssigning: boolean;
    onClearSelection: () => void;
    onToggleInsights?: () => void;
}

export function PriorityLeadTable({
    leads, loading, selectedIds, toggleSelect, toggleSelectAll, isSalesRole,
    salesReps, page, total, limit, setPage, scoringLeadId,
    onScoreLead, onViewDetail, onEdit, onCreateOffer, onCreateTask, onSendWhatsApp,
    onUpdateStatus, onDelete, onSharePortal, onStatusChange, onAssignChange,
    onBulkDelete, bulkDeleting, onBulkCreateTask, onBulkAssign, bulkAssigning, onClearSelection, onToggleInsights,
}: PriorityLeadTableProps) {
    const { t } = useTranslation('common');
    const [waLead, setWaLead] = useState<Lead | null>(null);
    // Toplu atama hedefi: '' = seçilmedi, '__unassign__' = atamayı kaldır, aksi rep id.
    const [bulkAssignTarget, setBulkAssignTarget] = useState('');
    useEffect(() => { if (selectedIds.size === 0) setBulkAssignTarget(''); }, [selectedIds.size]);
    // Satır içi akordiyon: tıklanan lead detayını alt satırda inline açar.
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const toggleExpand = (id: string) => setExpandedId(prev => (prev === id ? null : id));
    // Görünür sütun sayısı (colSpan): checkbox + Lead + Telefon + Segment + Sinyal
    // + Kaynak + (Temsilci?) + Son Aksiyon + AI + İşlem.
    const colSpan = isSalesRole ? 9 : 10;

    return (
        <>
        {waLead && <WhatsAppQuickSend lead={waLead} onClose={() => setWaLead(null)} />}
        <div className="bg-white rounded-lg border border-slate-200 flex flex-col relative min-h-0">
            {/* Table Header */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div>
                    <h3 className="text-sm font-bold text-slate-900">Öne çıkan lead listesi</h3>
                    <p className="text-[10px] text-slate-400">Toplam havuz içinde en yüksek öncelikli kayıtlar segment, temsilci ve son aksiyon bilgileriyle öne çıkarılır.</p>
                </div>
                <div className="flex items-center gap-2">
                    {onToggleInsights && (
                        <button
                            onClick={onToggleInsights}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50 transition-colors cursor-pointer font-semibold"
                        >
                            <Sparkles size={11} /> Icgoruler
                        </button>
                    )}
                    <button className="text-[10px] text-slate-500 hover:text-slate-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-50 transition-colors cursor-pointer">
                        <ArrowUpDown size={11} /> Skora gore sirala
                    </button>
                    <button className="text-[10px] text-slate-500 hover:text-slate-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-50 transition-colors cursor-pointer">
                        <Download size={11} /> Dışa aktar
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                        <tr>
                            <th className="px-4 py-3 w-10">
                                <input
                                    type="checkbox"
                                    checked={leads.length > 0 && selectedIds.size === leads.length}
                                    onChange={toggleSelectAll}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                            </th>
                            <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Lead / Şirket</th>
                            <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Telefon</th>
                            <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Segment</th>
                            <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Sinyal</th>
                            <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Kaynak / Reklam</th>
                            {!isSalesRole && <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Temsilci</th>}
                            <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Son Aksiyon</th>
                            <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">AI & Olasılık</th>
                            <th className="relative px-3 py-3 w-10"><span className="sr-only">İşlem</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {leads.map(lead => {
                            const isExpanded = expandedId === lead.id;
                            return (
                            <React.Fragment key={lead.id}>
                            <tr
                                className={`transition-colors ${isExpanded ? 'bg-indigo-50/40' : selectedIds.has(lead.id) ? 'bg-indigo-50/40' : 'hover:bg-slate-50/50'}`}
                            >
                                <td className="px-4 py-3.5 w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(lead.id)}
                                        onChange={() => toggleSelect(lead.id)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                </td>
                                <td className="px-3 py-3.5">
                                    <div>
                                        <button
                                            onClick={() => toggleExpand(lead.id)}
                                            aria-expanded={isExpanded}
                                            className="flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
                                        >
                                            <ChevronDown
                                                size={14}
                                                className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`}
                                            />
                                            {lead.customer_name}
                                        </button>
                                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                            <span>{lead.company_name || '—'}</span>
                                            {lead.business_type && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                                                    {t(businessTypeI18nKey(lead.business_type), { defaultValue: lead.business_type })}
                                                </span>
                                            )}
                                        </p>
                                        {(() => {
                                            // Ülke sekmeleriyle aynı çözümleme: beyan yoksa telefon
                                            // ön ekinden türetilir. Aksi halde lead 🇩🇪 sekmesinde
                                            // listelenirken satırında bayrağı görünmezdi.
                                            const flag = countryFlag(resolveLeadCountry(lead) || lead.country);
                                            const cityPart = lead.city;
                                            const countryPart = lead.country || lead.country_code;
                                            // Kaynak/kanal: masaüstünde ayrı sütunda gösterilir; burada yalnızca
                                            // mobilde (sütun gizliyken) okunabilir rozet olarak görünür.
                                            const ch = leadChannel(lead);
                                            const lat = lead.latitude != null ? Number(lead.latitude) : null;
                                            const lng = lead.longitude != null ? Number(lead.longitude) : null;
                                            const hasCoords = Number.isFinite(lat as number) && Number.isFinite(lng as number);
                                            const hasPlace = cityPart || countryPart || flag;
                                            const os = lead.os;
                                            const isMobileOs = !!os && /ios|android|ipados/i.test(os);
                                            const deviceLabel = os
                                                ? `${os}${lead.browser && lead.browser !== 'Unknown' ? ` · ${lead.browser}` : ''}`
                                                : null;
                                            // Geo de OS de yoksa: masaüstünde sütun kanalı gösterdiği için burada
                                            // sadece mobil kanal rozetini bırak (desktop'ta tamamen gizli).
                                            if (!hasPlace && !os) {
                                                return (
                                                    <p className="md:hidden text-[10px] mt-0.5 flex items-center gap-1 truncate">
                                                        <span style={{ color: ch.color }} className="font-medium">{ch.label}</span>
                                                        {ch.campaign && <span className="text-slate-400 truncate">· {ch.campaign}</span>}
                                                    </p>
                                                );
                                            }
                                            // Maps URL — koordinat varsa ona git, yoksa metinle ara.
                                            const mapsUrl = hasCoords
                                                ? `https://www.google.com/maps?q=${lat},${lng}`
                                                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([cityPart, countryPart].filter(Boolean).join(', '))}`;
                                            const tooltip = [
                                                hasCoords && `Konum: ${lat?.toFixed(4)}, ${lng?.toFixed(4)} — tıkla haritada aç`,
                                                lead.region && `Bölge: ${lead.region}`,
                                                deviceLabel && `Cihaz: ${deviceLabel}`,
                                                lead.utm_campaign && `Kampanya: ${lead.utm_campaign}`,
                                                lead.utm_term && `Term: ${lead.utm_term}`,
                                                lead.utm_content && `Content: ${lead.utm_content}`,
                                                lead.referrer && `Referrer: ${lead.referrer}`,
                                            ].filter(Boolean).join(' · ');
                                            return (
                                                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 truncate" title={tooltip || undefined}>
                                                    {hasPlace && (
                                                        <a
                                                            href={mapsUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="inline-flex items-center gap-1 hover:text-indigo-600 hover:underline cursor-pointer"
                                                        >
                                                            {flag && <span aria-hidden>{flag}</span>}
                                                            {cityPart && <span>{cityPart}</span>}
                                                            {cityPart && countryPart && <span className="text-slate-300">,</span>}
                                                            {countryPart && <span>{countryPart}</span>}
                                                        </a>
                                                    )}
                                                    {os && (
                                                        <span className="inline-flex items-center gap-0.5">
                                                            {hasPlace && <span className="text-slate-300">·</span>}
                                                            {isMobileOs ? <Smartphone size={10} /> : <Monitor size={10} />}
                                                            <span>{deviceLabel}</span>
                                                        </span>
                                                    )}
                                                    <span className="md:hidden inline-flex items-center gap-1">
                                                        {(hasPlace || os) && <span className="text-slate-300">·</span>}
                                                        <span style={{ color: ch.color }} className="font-medium">{ch.label}</span>
                                                        {ch.campaign && <span className="text-slate-400 truncate">· {ch.campaign}</span>}
                                                    </span>
                                                </p>
                                            );
                                        })()}
                                    </div>
                                </td>
                                <td className="px-3 py-3.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-slate-600">{lead.phone_number || '—'}</span>
                                        {lead.phone_number && (
                                            <button
                                                onClick={() => setWaLead(lead)}
                                                className="p-1 rounded-md hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                                                title="WhatsApp mesaj gonder"
                                            >
                                                <MessageCircle size={14} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-3.5">
                                    <select
                                        value={lead.status}
                                        onChange={e => onStatusChange(lead.id, e.target.value)}
                                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer appearance-none ${statusColors[lead.status] || 'bg-slate-100 text-slate-600'}`}
                                    >
                                        {Object.entries(StatusLabels).map(([val, label]) => (
                                            <option key={val} value={val}>{label}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-3 py-3.5">
                                    {(() => {
                                        const totalViews = lead.offer_links?.reduce((acc: number, link: any) => acc + (link.offer_analytics?.filter((a: any) => a.action_type === 'link_opened').length || 0), 0) || 0;
                                        const hasPaymentSignal = lead.offer_links?.some((link: any) => link.offer_analytics?.some((a: any) => a.action_type === 'payment_started' || a.action_type === 'payment_completed'));
                                        
                                        let bClass = 'bg-slate-100 text-slate-600', txt = 'Durgun ❄️', dot = 'bg-slate-400';
                                        if (hasPaymentSignal) { bClass = 'bg-rose-50 text-rose-700'; txt = 'Çok Sıcak 💸'; dot = 'bg-rose-500'; }
                                        else if (totalViews > 5) { bClass = 'bg-orange-50 text-orange-700'; txt = 'Sıcak 🔥'; dot = 'bg-orange-500'; }
                                        else if (totalViews > 0) { bClass = 'bg-indigo-50 text-indigo-700'; txt = 'Ilık 👁️'; dot = 'bg-indigo-500'; }

                                        return (
                                            <div className="flex flex-col gap-1" title={totalViews > 0 ? `Toplam ${totalViews} açılma` : 'Henüz açılmadı'}>
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit ${bClass}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
                                                    {txt}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </td>
                                <td className="hidden md:table-cell px-3 py-3.5">
                                    {(() => {
                                        const ch = leadChannel(lead);
                                        return (
                                            <div className="flex flex-col gap-1 max-w-[160px]">
                                                <span
                                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit"
                                                    style={{ backgroundColor: `${ch.color}1a`, color: ch.color }}
                                                    title={`Kanal: ${ch.label}`}
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ch.color }}></span>
                                                    {ch.label}
                                                </span>
                                                <span className="text-[11px] text-slate-500 truncate" title={ch.campaign || undefined}>
                                                    {ch.campaign || '—'}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </td>
                                {!isSalesRole && (
                                    <td className="px-3 py-3.5">
                                        <select
                                            value={lead.assigned_to || ''}
                                            onChange={e => onAssignChange(lead.id, e.target.value || null)}
                                            className="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[130px]"
                                        >
                                            <option value="">Atanmamış</option>
                                            {salesReps.map(rep => (
                                                <option key={rep.id} value={rep.id}>{rep.full_name || rep.email}</option>
                                            ))}
                                        </select>
                                    </td>
                                )}
                                <td className="px-3 py-3.5">
                                    <div className="text-[11px] text-slate-500">
                                        <div className="flex items-center gap-1.5">
                                            <Clock size={11} className="text-slate-400" />
                                            {formatDate(lead.updated_at || lead.created_at)}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-3.5">
                                    <div className="flex items-center gap-1.5">
                                        {lead.ai_state?.score != null ? (
                                            <span
                                                title={lead.ai_state.score_reason || undefined}
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                                    lead.ai_state.score >= 80
                                                        ? 'bg-rose-50 text-rose-700'
                                                        : lead.ai_state.score >= 50
                                                            ? 'bg-amber-50 text-amber-700'
                                                            : 'bg-slate-50 text-slate-600'
                                                } ${lead.ai_state.score_reason ? 'cursor-help' : ''}`}
                                            >
                                                {lead.ai_state.score}/100
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400">—</span>
                                        )}
                                        <button
                                            onClick={() => onScoreLead(lead.id)}
                                            disabled={scoringLeadId === lead.id}
                                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40 cursor-pointer"
                                        >
                                            {scoringLeadId === lead.id
                                                ? <RefreshCw size={11} className="animate-spin" />
                                                : <Sparkles size={11} />
                                            }
                                        </button>
                                    </div>
                                </td>
                                <td className="px-3 py-3.5 text-right">
                                    <RowActions
                                        lead={lead}
                                        onViewDetail={onViewDetail}
                                        onEdit={onEdit}
                                        onCreateOffer={onCreateOffer}
                                        onCreateTask={onCreateTask}
                                        onSendWhatsApp={onSendWhatsApp}
                                        onUpdateStatus={onUpdateStatus}
                                        onDelete={onDelete}
                                        onSharePortal={onSharePortal}
                                    />
                                </td>
                            </tr>
                            {isExpanded && (
                                <tr className="bg-slate-50/60">
                                    <td colSpan={colSpan} className="p-0 border-t border-dashed border-slate-200">
                                        <LeadDetailPanel leadId={lead.id} />
                                    </td>
                                </tr>
                            )}
                            </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>

                {loading && (
                    <div className="absolute inset-x-0 bottom-0 top-[45px] bg-white/70 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {!loading && leads.length === 0 && (
                    <div className="p-16 text-center text-slate-400 text-sm">
                        Arama kriterlerinize uyan kayıt bulunamadı.
                    </div>
                )}
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedIds.size > 0 && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-lg shadow-2xl z-30 flex-wrap max-w-[95vw]">
                    <CheckSquare size={16} className="text-indigo-400" />
                    <span className="text-sm font-medium">{selectedIds.size} lead seçildi</span>
                    <button onClick={onClearSelection} className="text-xs text-slate-400 hover:text-white transition-colors ml-2 cursor-pointer">
                        Seçimi Temizle
                    </button>
                    {/* Toplu temsilci atama — satış rolü kendi dışına atayamaz */}
                    {!isSalesRole && salesReps.length > 0 && (
                        <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
                            <select
                                value={bulkAssignTarget}
                                onChange={e => setBulkAssignTarget(e.target.value)}
                                className="h-[30px] bg-slate-800 border border-slate-600 rounded-md text-xs text-white px-2 outline-none focus:border-indigo-400 cursor-pointer"
                            >
                                <option value="">Temsilci seç...</option>
                                {salesReps.map(rep => (
                                    <option key={rep.id} value={rep.id}>{rep.full_name || rep.email}</option>
                                ))}
                                <option value="__unassign__">— Atamayı Kaldır —</option>
                            </select>
                            <button
                                onClick={() => onBulkAssign(bulkAssignTarget === '__unassign__' ? null : bulkAssignTarget)}
                                disabled={bulkAssigning || !bulkAssignTarget}
                                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-1.5 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                <Send size={13} />
                                {bulkAssigning ? 'Atanıyor...' : 'Ata'}
                            </button>
                        </div>
                    )}
                    <button
                        onClick={onBulkCreateTask}
                        className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold px-4 py-1.5 rounded-md transition-colors cursor-pointer"
                    >
                        <CheckSquare size={14} />
                        Görev Oluştur
                    </button>
                    <button
                        onClick={onBulkDelete}
                        disabled={bulkDeleting}
                        className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-1.5 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <Trash2 size={14} />
                        {bulkDeleting ? 'Siliniyor...' : `${selectedIds.size} Sil`}
                    </button>
                </div>
            )}

            {/* Pagination */}
            <div className="bg-slate-50/50 border-t border-slate-200 p-3 flex items-center justify-between shrink-0 rounded-b-lg">
                <span className="text-[11px] text-slate-500">
                    {total === 0 ? '0' : (page - 1) * limit + 1}-{Math.min(page * limit, total)} / {total} Kayıt
                </span>
                <div className="flex gap-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        className="px-3 py-1.5 border border-slate-200 bg-white text-slate-600 rounded-md hover:bg-slate-50 text-[11px] font-medium disabled:opacity-50 cursor-pointer"
                    >
                        Önceki
                    </button>
                    <button
                        disabled={page * limit >= total}
                        onClick={() => setPage(page + 1)}
                        className="px-3 py-1.5 border border-slate-200 bg-white text-slate-600 rounded-md hover:bg-slate-50 text-[11px] font-medium disabled:opacity-50 cursor-pointer"
                    >
                        Sonraki
                    </button>
                </div>
            </div>
        </div>
        </>
    );
}


// Row Actions Menu (extracted from original)
function RowActions({ lead, onViewDetail, onEdit, onCreateOffer, onCreateTask, onSendWhatsApp, onUpdateStatus, onDelete, onSharePortal }: {
    lead: Lead;
    onViewDetail: (id: string) => void;
    onEdit: (lead: Lead) => void;
    onCreateOffer: (lead: Lead) => void;
    onCreateTask: (lead: Lead) => void;
    onSendWhatsApp: (lead: Lead) => void;
    onUpdateStatus: (lead: Lead) => void;
    onDelete: (lead: Lead) => void;
    onSharePortal: (lead: Lead) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const btnRef = React.useRef<HTMLButtonElement>(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
                btnRef.current && !btnRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        if (!isOpen && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 }); // 192 = w-48
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="flex justify-end">
            <button ref={btnRef} onClick={handleToggle} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer">
                <MoreVertical size={16} />
            </button>
            {isOpen && (
                <div ref={menuRef} className="fixed w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-[9999]" style={{ top: menuPos.top, left: menuPos.left }}>
                    <MenuItem icon={ExternalLink} label="Müşteri Kartı" onClick={() => { setIsOpen(false); onViewDetail(lead.id); }} />
                    <MenuItem icon={Edit2} label="Düzenle" onClick={() => { setIsOpen(false); onEdit(lead); }} />
                    <div className="border-t border-slate-100 my-1" />
                    <MenuItem icon={LinkIcon} label="Teklif Linki Oluştur" onClick={() => { setIsOpen(false); onCreateOffer(lead); }} className="text-amber-600 hover:bg-amber-50" />
                    <MenuItem icon={CheckSquare} label="Görev Oluştur" onClick={() => { setIsOpen(false); onCreateTask(lead); }} className="text-sky-600 hover:bg-sky-50" />
                    <MenuItem icon={MessageCircle} label="WhatsApp Gönder" onClick={() => { setIsOpen(false); onSendWhatsApp(lead); }} className="text-indigo-600 hover:bg-indigo-50" />
                    <MenuItem icon={Share2} label="Müşteri Portalı" onClick={() => { setIsOpen(false); onSharePortal(lead); }} className="text-indigo-600 hover:bg-indigo-50" />
                    <div className="border-t border-slate-100 my-1" />
                    <MenuItem icon={Activity} label="Durum Güncelle" onClick={() => { setIsOpen(false); onUpdateStatus(lead); }} className="text-blue-600 hover:bg-blue-50" />
                    <MenuItem icon={Trash2} label="Lead'i Sil" onClick={() => { setIsOpen(false); onDelete(lead); }} className="text-red-600 hover:bg-red-50" />
                </div>
            )}
        </div>
    );
}

function MenuItem({ icon: Icon, label, onClick, className = 'text-slate-700 hover:bg-slate-50 hover:text-indigo-600' }: {
    icon: React.ElementType; label: string; onClick: () => void; className?: string;
}) {
    return (
        <button onClick={onClick} className={`w-full text-left px-4 py-2 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${className}`}>
            <Icon size={13} /> {label}
        </button>
    );
}
