import React, { useEffect, useState } from 'react';
import { Campaign } from '../../../services/admin/campaignsService';
import { AdminProductCatalogService } from '../../../services/admin/productCatalogService';
import { AdminLeadsService } from '../../../services/admin/leadsService';
import { AdminManualOfferService } from '../../../services/admin/manualOfferService';
import {
    ProductCartPicker,
    CartRow,
    buildCartRows,
    cartRowsToItems,
    cartTotals,
} from '../products/ProductCartPicker';
import { useToast } from '../../../contexts/ToastContext';
import { X, FileText, Copy, Check, Search } from 'lucide-react';

interface ManualOfferModalProps {
    campaign: Campaign;
    onClose: () => void;
}

export default function ManualOfferModal({ campaign, onClose }: ManualOfferModalProps) {
    const [leads, setLeads] = useState<any[]>([]);
    const [leadSearch, setLeadSearch] = useState('');
    const [selectedLeadId, setSelectedLeadId] = useState('');
    const [products, setProducts] = useState<CartRow[]>([]);
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ token: string; offerId: string; shortCode?: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const { success, error } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            searchLeads();
        }, 300);
        return () => clearTimeout(timer);
    }, [leadSearch]);

    const searchLeads = async () => {
        try {
            const data = await AdminLeadsService.listLeads({ search: leadSearch, page: 1, limit: 20 });
            setLeads(data.leads || []);
        } catch { /* ignore */ }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [{ products: prods }, leadsData, { rules }] = await Promise.all([
                AdminProductCatalogService.listProducts({ activeOnly: true, limit: 100 }),
                AdminLeadsService.listLeads({ page: 1, limit: 20 }),
                AdminProductCatalogService.listPricingRules({ activeOnly: true, limit: 500 })
            ]);

            setLeads(leadsData.leads || []);

            const campaignRules = rules.filter(r => r.campaign_id === campaign.id);

            // Kampanya fiyat kuralı varsa katalog fiyatını ezer — bu mantık
            // Manuel Teklif'e özgüdür, bu yüzden priceFor olarak enjekte edilir.
            setProducts(buildCartRows(prods, p => {
                const launchRule = campaignRules.find(r => r.product_id === p.id && r.price_type === 'deposit');
                const listRule = campaignRules.find(r => r.product_id === p.id && r.price_type === 'full_price');
                return launchRule?.amount || listRule?.amount || p.launch_price || p.list_price || 0;
            }));
        } catch {
            error('Hata', 'Veriler yüklenemedi.');
        } finally {
            setLoading(false);
        }
    };

    const items = cartRowsToItems(products);
    const { subtotal, vat, total } = cartTotals(items);

    const handleSubmit = async () => {
        if (!selectedLeadId) { error('Hata', 'Müşteri seçiniz.'); return; }
        if (items.length === 0) { error('Hata', 'En az bir ürün seçiniz.'); return; }

        setSubmitting(true);
        try {
            const res = await AdminManualOfferService.createManualOffer({
                leadId: selectedLeadId,
                campaignId: campaign.id,
                items,
                note: note || undefined
            });

            setResult(res);
            success('Başarılı', 'Manuel teklif oluşturuldu.');
        } catch (err: any) {
            error('Hata', err.message || 'Teklif oluşturulamadı.');
        } finally {
            setSubmitting(false);
        }
    };

    const copyUrl = () => {
        if (!result) return;
        const url = result.shortCode
            ? `${window.location.origin}/o/${result.shortCode}`
            : `${window.location.origin}/offer/${result.token}/teklif/${result.offerId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const inputClass = 'w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-emerald-600" />
                        </div>
                        Manuel Teklif Oluştur
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                {result ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                            <Check className="w-7 h-7 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Teklif Oluşturuldu</h3>
                        <p className="text-sm text-slate-500 text-center">Token: <span className="font-mono font-medium text-slate-700">{result.token}</span></p>
                        <button onClick={copyUrl} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors">
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Kopyalandı' : 'Teklif Linkini Kopyala'}
                        </button>
                        <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 transition-colors mt-2">Kapat</button>
                    </div>
                ) : (
                    <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
                        {loading ? (
                            <div className="py-16 text-center text-sm text-slate-400">Yükleniyor...</div>
                        ) : (
                            <>
                                {/* Lead Selection */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Müşteri <span className="text-red-400">*</span></label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                                        <input
                                            type="text"
                                            value={leadSearch}
                                            onChange={e => setLeadSearch(e.target.value)}
                                            placeholder="Müşteri ara..."
                                            className={`${inputClass} pl-9`}
                                        />
                                    </div>
                                    <select
                                        value={selectedLeadId}
                                        onChange={e => setSelectedLeadId(e.target.value)}
                                        className={`${inputClass} mt-2`}
                                    >
                                        <option value="">Müşteri seçiniz</option>
                                        {leads.map((l: any) => (
                                            <option key={l.id} value={l.id}>
                                                {l.customer_name} {l.company_name ? `(${l.company_name})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Campaign Info */}
                                <div className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-500">
                                    Kampanya: <span className="font-medium text-slate-700">{campaign.name}</span> · Parti: {campaign.batch_number}
                                </div>

                                {/* Product Selection */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-2">Ürünler</label>
                                    <ProductCartPicker rows={products} onChange={setProducts} />
                                </div>

                                {/* Note */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Not (opsiyonel)</label>
                                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={`${inputClass} h-auto resize-none`} placeholder="Admin notu..." />
                                </div>

                                {/* Totals */}
                                {items.length > 0 && (
                                    <div className="bg-slate-50 rounded-lg p-4 space-y-1.5">
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>Ara Toplam</span>
                                            <span>{subtotal.toLocaleString('tr-TR')} ₺</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>KDV (%20)</span>
                                            <span>{vat.toLocaleString('tr-TR')} ₺</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-bold text-slate-800 pt-1.5 border-t border-slate-200">
                                            <span>Toplam</span>
                                            <span>{total.toLocaleString('tr-TR')} ₺</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Footer */}
                {!result && (
                    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                        <button onClick={onClose} disabled={submitting} className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors">
                            İptal
                        </button>
                        <button onClick={handleSubmit} disabled={submitting || items.length === 0 || !selectedLeadId} className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                            {submitting ? 'Oluşturuluyor...' : 'Teklif Oluştur'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
