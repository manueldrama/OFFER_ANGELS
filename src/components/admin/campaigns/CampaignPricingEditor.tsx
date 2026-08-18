import React, { useEffect, useState } from 'react';
import { Campaign } from '../../../services/admin/campaignsService';
import { AdminProductCatalogService } from '../../../services/admin/productCatalogService';
import { CatalogProduct, PricingRule } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';
import { X, Save, Tag, Check } from 'lucide-react';

interface CampaignPricingEditorProps {
    campaign: Campaign;
    onClose: () => void;
}

interface PricingRow {
    product: CatalogProduct;
    listPriceRule: PricingRule | null;
    launchPriceRule: PricingRule | null;
    listPrice: string;
    launchPrice: string;
    dirty: boolean;
}

// INVARIANT (31 Tem 2026 vakası): kampanya kuralları özgüllükte (1000+) ülke
// kurallarını (100) ezer. Bu editör eskiden country/market YAZMADAN ve TRY
// sabitleyerek kural üretiyordu → tek kayıt tüm dünyada (EUR/USD/GBP dahil)
// TL fiyatı zorluyordu. Artık her kural kampanyanın hedef pazarına kapsamlanır.
const CURRENCY_BY_MARKET: Record<string, string> = {
    TR: 'TRY', EU: 'EUR', GB: 'GBP', US: 'USD', SA: 'SAR', AE: 'AED', GLOBAL: 'USD',
};
const CURRENCY_SYMBOL: Record<string, string> = {
    TRY: '₺', EUR: '€', GBP: '£', USD: '$', SAR: 'SAR', AED: 'AED',
};

export default function CampaignPricingEditor({ campaign, onClose }: CampaignPricingEditorProps) {
    const [rows, setRows] = useState<PricingRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { success, error } = useToast();

    // Kampanyanın hedef pazarı; alanlar boşsa TR varsayılır (ana pazar).
    const scopeMarket = campaign.market_code || 'TR';
    const scopeCountry = campaign.country_code || (campaign.market_code ? null : 'TR');
    const scopeCurrency = CURRENCY_BY_MARKET[scopeMarket] || 'TRY';
    const scopeSymbol = CURRENCY_SYMBOL[scopeCurrency] || scopeCurrency;
    const scopeLabel = scopeCountry || scopeMarket;

    useEffect(() => {
        loadData();
    }, [campaign.id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [{ products }, { rules }] = await Promise.all([
                AdminProductCatalogService.listProducts({ activeOnly: true, limit: 100 }),
                AdminProductCatalogService.listPricingRules({ activeOnly: true, limit: 500 })
            ]);

            // Aynı kapsamla filtrele ki güncelleme doğru kuralı hedeflesin
            // (kapsamsız eski kurallar varsa da yakala — geriye dönük uyum).
            const campaignRules = rules.filter(r =>
                r.campaign_id === campaign.id &&
                (!r.country_code || r.country_code === scopeCountry) &&
                (!r.market_code || r.market_code === scopeMarket)
            );

            const pricingRows: PricingRow[] = products.map(product => {
                const productRules = campaignRules.filter(r => r.product_id === product.id);
                const listRule = productRules.find(r => r.price_type === 'full_price') || null;
                const launchRule = productRules.find(r => r.price_type === 'deposit') || null;

                return {
                    product,
                    listPriceRule: listRule,
                    launchPriceRule: launchRule,
                    listPrice: listRule ? String(listRule.amount) : '',
                    launchPrice: launchRule ? String(launchRule.amount) : '',
                    dirty: false
                };
            });

            setRows(pricingRows);
        } catch {
            error('Hata', 'Fiyat verileri yüklenemedi.');
        } finally {
            setLoading(false);
        }
    };

    const updateRow = (index: number, field: 'listPrice' | 'launchPrice', value: string) => {
        setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value, dirty: true } : row));
    };

    const handleSave = async () => {
        const dirtyRows = rows.filter(r => r.dirty);
        if (dirtyRows.length === 0) { onClose(); return; }

        setSaving(true);
        try {
            for (const row of dirtyRows) {
                // List price (full_price)
                if (row.listPrice) {
                    const amount = parseFloat(row.listPrice);
                    if (row.listPriceRule) {
                        await AdminProductCatalogService.updatePricingRule(row.listPriceRule.id, { amount });
                    } else {
                        await AdminProductCatalogService.createPricingRule({
                            product_id: row.product.id,
                            campaign_id: campaign.id,
                            country_code: scopeCountry,
                            market_code: scopeMarket,
                            currency_code: scopeCurrency,
                            price_type: 'full_price',
                            amount,
                            is_active: true,
                            priority: 100
                        });
                    }
                }

                // Launch price (deposit type used as launch price in this system)
                if (row.launchPrice) {
                    const amount = parseFloat(row.launchPrice);
                    if (row.launchPriceRule) {
                        await AdminProductCatalogService.updatePricingRule(row.launchPriceRule.id, { amount });
                    } else {
                        await AdminProductCatalogService.createPricingRule({
                            product_id: row.product.id,
                            campaign_id: campaign.id,
                            country_code: scopeCountry,
                            market_code: scopeMarket,
                            currency_code: scopeCurrency,
                            price_type: 'deposit',
                            amount,
                            is_active: true,
                            priority: 100
                        });
                    }
                }
            }

            success('Başarılı', `${dirtyRows.length} ürün fiyatı güncellendi.`);
            onClose();
        } catch {
            error('Hata', 'Fiyat kaydetme başarısız.');
        } finally {
            setSaving(false);
        }
    };

    const dirtyCount = rows.filter(r => r.dirty).length;
    const productName = (p: CatalogProduct) => {
        const loc = p.localized?.find(l => l.language_code === 'tr');
        return loc?.name || p.product_code;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl flex flex-col overflow-hidden max-h-[85vh]">
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                <Tag className="w-4 h-4 text-indigo-600" />
                            </div>
                            Kampanya Fiyatları
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5 ml-[42px]">{campaign.name}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scope banner */}
                <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700 shrink-0">
                    Bu editör yalnız <span className="font-semibold">{scopeLabel}</span> pazarı için ({scopeSymbol}) kural yazar.
                    Diğer ülkeler fiyatını kendi ülke kurallarından alır (Ürünler → Ülke Bazlı Fiyatlandırma).
                </div>

                {/* Table */}
                <div className="overflow-y-auto flex-1 px-5 py-4">
                    {loading ? (
                        <div className="py-16 text-center text-sm text-slate-400">Yükleniyor...</div>
                    ) : rows.length === 0 ? (
                        <div className="py-16 text-center text-sm text-slate-400">Aktif ürün bulunamadı.</div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    <th className="pb-3 pl-1">Ürün</th>
                                    <th className="pb-3 text-right pr-3">Liste Fiyatı ({scopeSymbol})</th>
                                    <th className="pb-3 text-right pr-1">Lansman Fiyatı ({scopeSymbol})</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {rows.map((row, i) => (
                                    <tr key={row.product.id} className={`${row.dirty ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'} transition-colors`}>
                                        <td className="py-3 pl-1">
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700">{productName(row.product)}</p>
                                                    <p className="text-[10px] text-slate-400">{row.product.product_code} · {row.product.product_type}</p>
                                                </div>
                                                {row.dirty && <Check className="w-3 h-3 text-indigo-500" />}
                                            </div>
                                        </td>
                                        <td className="py-3 pr-3">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={row.listPrice}
                                                onChange={e => updateRow(i, 'listPrice', e.target.value)}
                                                placeholder="—"
                                                className="w-full text-right h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                            />
                                        </td>
                                        <td className="py-3 pr-1">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={row.launchPrice}
                                                onChange={e => updateRow(i, 'launchPrice', e.target.value)}
                                                placeholder="—"
                                                className="w-full text-right h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                    <p className="text-xs text-slate-400">
                        {dirtyCount > 0 ? `${dirtyCount} ürün değişti` : 'Değişiklik yok'}
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onClose} disabled={saving} className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors">
                            İptal
                        </button>
                        <button onClick={handleSave} disabled={saving || dirtyCount === 0} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                            <Save className="w-4 h-4" />
                            {saving ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
