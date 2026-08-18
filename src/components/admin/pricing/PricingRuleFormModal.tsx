import React, { useState, useEffect } from 'react';
import { X, Save, Tag } from 'lucide-react';
import { AdminProductCatalogService } from '../../../services/admin/productCatalogService';
import { AdminCampaignsService, Campaign } from '../../../services/admin/campaignsService';
import { CatalogProduct, PricingRule } from '../../../types';
import { COUNTRIES, getCountryByCode, SUPPORTED_CURRENCIES } from '../../../utils/countries';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { useToast } from '../../../contexts/ToastContext';

interface PricingRuleFormModalProps {
    rule: PricingRule | null;
    products: CatalogProduct[]; // For the dropdowns
    onClose: (wasSaved?: boolean) => void;
}

export default function PricingRuleFormModal({ rule, products, onClose }: PricingRuleFormModalProps) {
    const toast = useToast();
    const isEdit = !!rule;
    const [loading, setLoading] = useState(false);

    // State
    const [targetType, setTargetType] = useState<'product' | 'package'>(rule?.product_package_id ? 'package' : 'product');
    const [selectedProductId, setSelectedProductId] = useState(rule?.product_id || products[0]?.id || '');
    const [selectedPackageId, setSelectedPackageId] = useState(rule?.product_package_id || '');

    const [countryCode, setCountryCode] = useState(rule?.country_code || '');
    const [campaignId, setCampaignId] = useState(rule?.campaign_id || '');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);

    useEffect(() => {
        let cancelled = false;
        AdminCampaignsService.listCampaigns().then(list => {
            if (!cancelled) setCampaigns(list);
        }).catch(err => console.error('[PricingRuleFormModal] Could not load campaigns', err));
        return () => { cancelled = true; };
    }, []);

    const [currencyCode, setCurrencyCode] = useState(rule?.currency_code || 'TRY');
    const [priceType, setPriceType] = useState(rule?.price_type || 'full_price');
    const [amount, setAmount] = useState(rule?.amount || 0);
    const [launchAmount, setLaunchAmount] = useState<number | ''>(rule?.launch_amount ?? '');
    const [depositPercent, setDepositPercent] = useState<number | ''>(rule?.deposit_percent ?? '');
    const [priority, setPriority] = useState(rule?.priority || 0);
    const [isActive, setIsActive] = useState(rule?.is_active ?? true);

    const activeProduct = products.find(p => p.id === selectedProductId);

    // When the user picks a country, derive market + currency from the static country table.
    const handleCountryChange = (next: string) => {
        setCountryCode(next);
        const c = getCountryByCode(next);
        if (c) setCurrencyCode(c.currency);
    };

    const resolvedMarketCode = (() => {
        const c = getCountryByCode(countryCode);
        return c?.market_code || rule?.market_code || null;
    })();

    const handleSave = async () => {
        try {
            setLoading(true);

            // Payload validation
            if (!selectedProductId && targetType === 'product') { toast.warning('Eksik Bilgi', 'Ürün seçilmelidir.'); return; }
            if (!selectedPackageId && targetType === 'package') { toast.warning('Eksik Bilgi', 'Paket seçilmelidir.'); return; }
            if (amount <= 0) { toast.warning('Eksik Bilgi', 'Geçerli bir liste fiyatı girin.'); return; }
            if (launchAmount !== '' && Number(launchAmount) > amount) {
                toast.warning('Geçersiz Lansman Fiyatı', 'Lansman fiyatı liste fiyatından büyük olamaz.');
                return;
            }

            const payload: Partial<PricingRule> = {
                product_id: targetType === 'product' ? selectedProductId : null,
                product_package_id: targetType === 'package' ? selectedPackageId : null,
                market_code: resolvedMarketCode,
                country_code: countryCode || null,
                campaign_id: campaignId || null,
                currency_code: currencyCode,
                price_type: priceType as any,
                amount,
                launch_amount: launchAmount === '' ? null : Number(launchAmount),
                deposit_percent: depositPercent === '' ? null : Number(depositPercent),
                priority,
                is_active: isActive
            };

            if (isEdit && rule?.id) {
                await AdminProductCatalogService.updatePricingRule(rule.id, payload);
            } else {
                await AdminProductCatalogService.createPricingRule(payload);
            }

            onClose(true);
        } catch (error) {
            console.error(error);
            toast.error('Hata', 'Kural kaydedilirken hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-lg">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Tag className="text-indigo-600 w-5 h-5" />
                        {isEdit ? 'Fiyat Kuralı Düzenle' : 'Yeni Fiyat Kuralı Ekle'}
                    </h2>
                    <button onClick={() => onClose()} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-5 overflow-y-auto flex-1 space-y-6">
                    {/* Target Selection */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                        <h3 className="text-sm font-semibold text-slate-800">1. Hedef Ürün veya Paket</h3>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" checked={targetType === 'product'} onChange={() => setTargetType('product')} className="text-indigo-600 focus:ring-primary" />
                                Tüm Ürün Geneli
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" checked={targetType === 'package'} onChange={() => setTargetType('package')} className="text-indigo-600 focus:ring-primary" />
                                Belirli Bir Varyant/Paket
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Ürün</label>
                                <select
                                    value={selectedProductId}
                                    onChange={e => { setSelectedProductId(e.target.value); setSelectedPackageId(''); }}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">Seçiniz</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.product_code}</option>
                                    ))}
                                </select>
                            </div>

                            {targetType === 'package' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Varyant/Paket</label>
                                    <select
                                        value={selectedPackageId}
                                        onChange={e => setSelectedPackageId(e.target.value)}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="">Seçiniz</option>
                                        {activeProduct?.packages?.map(pkg => (
                                            <option key={pkg.id} value={pkg.id}>{pkg.package_code}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Conditions */}
                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-4">
                        <h3 className="text-sm font-semibold text-slate-800">2. Hedef Ülke ve Para Birimi</h3>
                        <p className="text-xs text-slate-500">
                            Ülke seçildiğinde para birimi otomatik gelir; isterseniz farklı bir para birimi seçebilirsiniz.
                            Pazar kodu ülkeye göre otomatik belirlenir{resolvedMarketCode && <> (<span className="font-mono">{resolvedMarketCode}</span>)</>}.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Ülke <span className="text-red-500">*</span></label>
                                <select
                                    value={countryCode}
                                    onChange={e => handleCountryChange(e.target.value)}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="">Seçiniz</option>
                                    {COUNTRIES.map(c => (
                                        <option key={c.code} value={c.code}>
                                            {c.flag} {c.code} — {c.name} ({c.currency})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Para Birimi</label>
                                <select
                                    value={currencyCode}
                                    onChange={e => setCurrencyCode(e.target.value)}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    {SUPPORTED_CURRENCIES.map(cur => (
                                        <option key={cur} value={cur}>{cur}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Kampanya (opsiyonel)</label>
                                <select
                                    value={campaignId}
                                    onChange={e => setCampaignId(e.target.value)}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="">Tüm kampanyalar</option>
                                    {campaigns.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.is_active ? '🟢' : '⚪'} {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Pricing Details */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-800">3. Fiyatlandırma</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Liste Fiyatı <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={e => setAmount(Number(e.target.value))}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                                    placeholder="0.00"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Üzeri çizilecek "normal" fiyat.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Lansman Fiyatı</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={launchAmount}
                                    onChange={e => setLaunchAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold text-emerald-700"
                                    placeholder="Boş = liste fiyatı kullanılır"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Müşterinin ödeyeceği indirimli fiyat.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Ön Ödeme % (Kapora)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="100"
                                    value={depositPercent}
                                    onChange={e => setDepositPercent(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="20"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Boş = kampanya/global oranı kullanılır.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-2 border-t border-slate-100">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Ödeme Tipi</label>
                                <select value={priceType} onChange={e => setPriceType(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                                    <option value="full_price">Peşin (Liste/Lansman)</option>
                                    <option value="deposit">Depozito (Kapora — eski sistem)</option>
                                    <option value="monthly">Aylık Taksit/Kira</option>
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">Yeni kurallar için "Peşin" seçili kalsın.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Ek Öncelik Puanı</label>
                                <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                <p className="text-[10px] text-slate-400 mt-1">Çakışmalarda yüksek olan uygulanır.</p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer pt-5">
                                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-primary" />
                                <span className="text-sm font-medium text-slate-700">Bu kural aktif</span>
                            </label>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                    <button onClick={() => onClose()} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-md transition-colors text-sm" disabled={loading}>
                        İptal
                    </button>
                    <button onClick={handleSave} disabled={loading || amount <= 0} className="px-6 py-2 bg-slate-900 text-white border-0 font-medium hover:bg-slate-800 rounded-md transition-colors flex items-center gap-2 text-sm disabled:opacity-50">
                        {loading ? <LoadingSpinner size="sm" /> : <Save size={18} />}
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
}
