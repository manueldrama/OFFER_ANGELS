import React, { useEffect, useState } from 'react';
import { AdminOfferReissueService, OfferReissueRequest } from '../../../services/admin/offerReissueService';
import { useToast } from '../../../contexts/ToastContext';
import { CheckCircle2, XCircle, Clock, RefreshCw, Inbox } from 'lucide-react';
import { formatDate } from '../../../hooks/useAppSettings';

interface OfferReissueQueueProps {
    campaignId?: string;
    defaultValidityHours?: number;
}

export default function OfferReissueQueue({ campaignId, defaultValidityHours = 48 }: OfferReissueQueueProps) {
    const [requests, setRequests] = useState<OfferReissueRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { success, error } = useToast();

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await AdminOfferReissueService.listRequests(campaignId);
            setRequests(data);
        } catch {
            error('Hata', 'Talepler yüklenemedi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRequests(); }, [campaignId]);

    const handleApprove = async (id: string) => {
        setProcessingId(id);
        try {
            await AdminOfferReissueService.approveRequest(id, defaultValidityHours);
            success('Onaylandı', 'Yeniden teklif oluşturuldu.');
            fetchRequests();
        } catch {
            error('Hata', 'Onaylama başarısız.');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        setProcessingId(id);
        try {
            await AdminOfferReissueService.rejectRequest(id);
            success('Reddedildi', 'Talep reddedildi.');
            fetchRequests();
        } catch {
            error('Hata', 'Red işlemi başarısız.');
        } finally {
            setProcessingId(null);
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700"><Clock className="w-3 h-3" /> Bekliyor</span>;
            case 'approved': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700"><CheckCircle2 className="w-3 h-3" /> Onaylandı</span>;
            case 'rejected': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700"><XCircle className="w-3 h-3" /> Reddedildi</span>;
            default: return null;
        }
    };

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                    <RefreshCw className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-slate-800">Yeniden Teklif Talepleri</h3>
                    {pendingCount > 0 && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                    )}
                </div>
                <button onClick={fetchRequests} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Yenile</button>
            </div>

            {loading ? (
                <div className="p-8 text-center text-sm text-slate-400">Yükleniyor...</div>
            ) : requests.length === 0 ? (
                <div className="p-10 text-center">
                    <Inbox className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Henüz yeniden teklif talebi yok.</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-50">
                    {requests.map(req => (
                        <div key={req.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-medium text-slate-700 truncate">{req.customer_name || 'İsimsiz'}</p>
                                    {statusBadge(req.status)}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${req.request_type === 'new_offer_approval' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                                        {req.request_type === 'new_offer_approval' ? 'Yeni Teklif' : 'Yeniden Teklif'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 truncate">
                                    {req.reason || 'Sebep belirtilmedi'} — {formatDate(req.created_at)}
                                </p>
                            </div>
                            {req.status === 'pending' && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleApprove(req.id)}
                                        disabled={processingId === req.id}
                                        className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 rounded-md hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                    >
                                        Onayla
                                    </button>
                                    <button
                                        onClick={() => handleReject(req.id)}
                                        disabled={processingId === req.id}
                                        className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50 transition-colors"
                                    >
                                        Reddet
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
