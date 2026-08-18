import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, RefreshCw, Search, Plus, Minus, Check, Copy, Package, Globe2 } from 'lucide-react';
import { AdminLeadsService, Lead } from '../../../services/admin/leadsService';
import { AdminCampaignsService, Campaign } from '../../../services/admin/campaignsService';
import { AdminProductCatalogService } from '../../../services/admin/productCatalogService';
import { AdminManualOfferService, ManualOfferItem } from '../../../services/admin/manualOfferService';
import { generateOfferShortCode } from '../../../services/admin/shortCode';
import { supabase } from '../../../lib/supabase/client';
import { CatalogProduct, PricingRule } from '../../../types';
import { COUNTRIES, getCountriesByMarket, getCountryByCode } from '../../../utils/countries';
import { formatDate } from '../../../hooks/useAppSettings';
import { OfferDisplayPrefs, OfferDisplayToggles, deriveOfferDisplayDefaults } from '../../../lib/offerDisplayPrefs';

const OFFER_MARKET_OPTIONS = [
    { code: 'TR', label: 'TR — Türkiye' },
    { code: 'EU', label: 'EU — European Union' },
    { code: 'GB', label: 'GB — United Kingdom' },
    { code: 'US', label: 'US — United States' },
    { code: 'SA', label: 'SA — Saudi Arabia' },
    { code: 'AE', label: 'AE — United Arab Emirates' },
];

interface OfferLinkFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: {
        lead_id: string;
        token: string;
        campaign_id?: string;
        expires_at?: string;
        offer_snapshot?: any;
        market_code?: string | null;
        country_code?: string | null;
    }) => Promise<void>;
    preselectedLeadId?: string | null;
    /**
     * Reclaim "Yeni Teklif Hazırla" akışı: doluysa yeni link AÇMAZ, bu mevcut
     * token'lı linki tazeler (süre uzat + aktifleştir + yeni generated_offer).
     * Müşteri başına tek link kalır.
     */
    refreshOfferToken?: string | null;
}

interface ProductRow {
    product: CatalogProduct;
    selected: boolean;
    quantity: number;
    /** Gerçek satış fiyatı (lansman / kampanya fiyatı) — items[].price olarak gider */
    customPrice: string;
    /** Liste fiyatı (üstü çizili gözükecek "oldPrice") — opsiyonel, müşteri kartında strikethrough */
    customListPrice: string;
    defaultPrice: number;
    defaultListPrice: number;
}

export const OfferLinkFormModal: React.FC<OfferLinkFormModalProps> = ({ isOpen, onClose, onSave, preselectedLeadId, refreshOfferToken }) => {
    const isRefresh = !!refreshOfferToken;
    const [leads, setLeads] = useState<Lead[]>([]);
    const [leadSearch, setLeadSearch] = useState('');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedLeadId, setSelectedLeadId] = useState(preselectedLeadId || '');
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [marketCode, setMarketCode] = useState<string>('');
    const [countryCode, setCountryCode] = useState<string>('');
    const [marketEdited, setMarketEdited] = useState(false); // tracks whether the user manually overrode inheritance
    const [token, setToken] = useState('');
    const [snapshotDesc, setSnapshotDesc] = useState('');
    const [loadingLeads, setLoadingLeads] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Product mode
    const [withProducts, setWithProducts] = useState(false);
    const [products, setProducts] = useState<ProductRow[]>([]);
    // Teklif sayfası görünüm tercihleri: admin dokunmadıkça kampanya+sepetten
    // otomatik türetilir; dokunulan anahtar override olarak saklanır.
    const [displayOverrides, setDisplayOverrides] = useState<OfferDisplayPrefs>({});
    // Per-teklif tahmini teslimat metni; boşsa kampanya/deneyim/i18n zinciri geçerli.
    const [deliveryText, setDeliveryText] = useState('');
    const [allRules, setAllRules] = useState<PricingRule[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);

    // Success state
    const [result, setResult] = useState<{ token: string; offerId?: string; shortCode?: string } | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchLeads('');
            fetchCampaigns();
            // Reclaim tazeleme: mevcut token korunur; aksi halde rastgele üret.
            if (refreshOfferToken) {
                setToken(refreshOfferToken);
            } else {
                generateRandomToken();
            }
            setSnapshotDesc('');
            setSelectedLeadId(preselectedLeadId || '');
            setSelectedCampaignId('');
            setMarketCode('');
            setCountryCode('');
            setMarketEdited(false);
            setError('');
            // Tazeleme akışında ürün seçimi varsayılan açık (final teklif gönderilecek).
            setWithProducts(!!refreshOfferToken);
            setProducts([]);
            setDisplayOverrides({});
            setDeliveryText('');
            setResult(null);
            setCopied(false);
            setLeadSearch('');
        }
    }, [isOpen]);

    // Inherit market/country from selected campaign when the user hasn't overridden them.
    useEffect(() => {
        if (marketEdited) return;
        const campaign = campaigns.find(c => c.id === selectedCampaignId);
        if (campaign) {
            setMarketCode(campaign.market_code || '');
            setCountryCode(campaign.country_code || '');
        } else {
            setMarketCode('');
            setCountryCode('');
        }
    }, [selectedCampaignId, campaigns, marketEdited]);

    // Debounced lead search
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => fetchLeads(leadSearch), 300);
        return () => clearTimeout(timer);
    }, [leadSearch]);

    // Load products + pricing when product mode activated or campaign changes
    useEffect(() => {
        if (withProducts) loadProducts();
    }, [withProducts, selectedCampaignId]);

    const fetchLeads = async (search: string) => {
        setLoadingLeads(true);
        try {
            const { leads } = await AdminLeadsService.listLeads({ search, limit: 50 });
            setLeads(leads);
        } catch (err) {
            console.error('Leads fetch error', err);
        } finally {
            setLoadingLeads(false);
        }
    };

    const fetchCampaigns = async () => {
        try {
            const data = await AdminCampaignsService.listCampaigns();
            setCampaigns(data.filter(c => c.is_active));
        } catch (err) {
            console.error('Campaigns fetch error', err);
        }
    };

    const loadProducts = async () => {
        setLoadingProducts(true);
        try {
            const [{ products: prods }, { rules }] = await Promise.all([
                AdminProductCatalogService.listProducts({ activeOnly: true, limit: 100 }),
                allRules.length > 0 ? { rules: allRules } : AdminProductCatalogService.listPricingRules({ activeOnly: true, limit: 500 })
            ]);
            if (allRules.length === 0) setAllRules(rules);

            const campaignRules = selectedCampaignId ? rules.filter(r => r.campaign_id === selectedCampaignId) : [];

            setProducts(prods.map(p => {
                // CAFEPASTE pricing rules:
                //   price_type='deposit'    → KAMPANYA LANSMAN FİYATI (gerçek satış, ana fiyat)
                //   price_type='full_price' → LİSTE FİYATI (üstü çizili oldPrice)
                // Önceki turda yanlış yorumlayıp launchRule önceliğini kaldırmıştım,
                // bu yüzden satış fiyatı liste fiyatı olarak gösteriliyordu. Geri eski
                // (doğru) mantığa döndürüldü.
                const launchRule = campaignRules.find(r => r.product_id === p.id && r.price_type === 'deposit');
                const listRule = campaignRules.find(r => r.product_id === p.id && r.price_type === 'full_price');
                const defaultPrice = launchRule?.amount || listRule?.amount || p.launch_price || p.list_price || 0;
                const defaultListPrice = listRule?.amount || p.list_price || p.launch_price || 0;
                return {
                    product: p,
                    selected: false,
                    quantity: 1,
                    customPrice: String(defaultPrice),
                    customListPrice: String(defaultListPrice),
                    defaultPrice,
                    defaultListPrice,
                };
            }));
        } catch {
            setError('Ürünler yüklenemedi.');
        } finally {
            setLoadingProducts(false);
        }
    };

    const generateRandomToken = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        setToken(result);
    };

    const toggleProduct = (index: number) => {
        setProducts(prev => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r));
    };

    const updateProduct = (index: number, field: 'quantity' | 'customPrice' | 'customListPrice', value: any) => {
        setProducts(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
    };

    const productName = (p: CatalogProduct) => {
        const loc = p.localized?.find(l => l.language_code === 'tr');
        return loc?.name || p.product_code;
    };

    const selectedProducts = products.filter(r => r.selected);
    const subtotal = selectedProducts.reduce((sum, r) => sum + parseFloat(r.customPrice || '0') * r.quantity, 0);
    const vat = subtotal * 0.20;
    const total = subtotal + vat;

    const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

    // Görünüm toggle'larının efektif değerleri: override > otomatik varsayılan.
    // Link-only modda makine varsayımı true — müşteri normalde makine konfigüre
    // eder; sarf-only durumda müşteri sayfası ROI'yi zaten makine yokken gizler.
    const displayHasMachine = withProducts
        ? products.some(r => r.selected && r.product.product_type === 'machine')
        : true;
    const displayDefaults = deriveOfferDisplayDefaults({ hasCampaign: !!selectedCampaignId, hasMachine: displayHasMachine });
    const displayValues: OfferDisplayToggles = {
        countdown: displayOverrides.countdown ?? displayDefaults.countdown,
        capacity: displayOverrides.capacity ?? displayDefaults.capacity,
        roi: displayOverrides.roi ?? displayDefaults.roi,
    };
    const toggleDisplay = (key: keyof OfferDisplayToggles) => {
        setDisplayOverrides(prev => ({ ...prev, [key]: !displayValues[key] }));
    };
    // offer_snapshot.display'e yazılacak nihai obje — teslimat metni doluysa eklenir.
    const displayPayload: OfferDisplayPrefs = {
        ...displayValues,
        ...(deliveryText.trim() ? { delivery: deliveryText.trim() } : {}),
    };

    if (!isOpen) return null;

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setError('');

        if (!selectedLeadId) { setError('Lütfen bir müşteri seçin.'); return; }
        if (!token.trim()) { setError('Token zorunludur.'); return; }
        if (withProducts && selectedProducts.length === 0) { setError('En az bir ürün seçiniz.'); return; }
        // Tazeleme akışında final teklif gönderilmeli; ürünsüz tazeleme yeni link
        // doğmasına yol açar (else dalı createManualLink insert eder).
        if (isRefresh && !withProducts) { setError('Bu mevcut teklifi yenilemek için en az bir ürün seçin.'); return; }

        setIsSubmitting(true);
        try {
            // Tazeleme akışında mevcut token AYNEN korunur (yeni link doğmasın).
            const finalToken = isRefresh ? refreshOfferToken!.trim() : token.trim().toUpperCase();

            let createdShortCode: string | undefined;
            let createdOfferId: string | undefined;

            if (withProducts) {
                // Create offer_link + generated_offer with products
                const items: ManualOfferItem[] = selectedProducts.map(r => {
                    const loc = r.product.localized?.find(l => l.language_code === 'tr');
                    const img = r.product.media?.find(m => m.media_type === 'image' && m.is_active);
                    const salePrice = parseFloat(r.customPrice || '0');
                    const listPriceParsed = parseFloat(r.customListPrice || '0');
                    // Sadece liste fiyatı satış fiyatından büyükse oldPrice olarak gönder
                    // (üstü çizili indirim göstergesi için). Aksi halde tek fiyat.
                    const oldPrice = listPriceParsed > salePrice ? listPriceParsed : undefined;
                    return {
                        id: r.product.id,
                        name: productName(r.product),
                        type: r.product.product_type === 'machine' ? 'product' as const : 'accessory' as const,
                        price: salePrice,
                        listPrice: oldPrice,
                        quantity: r.quantity,
                        description: loc?.short_description || loc?.description || '',
                        image: img?.url || ''
                    } as ManualOfferItem;
                });

                const res = isRefresh
                    ? await AdminManualOfferService.refreshOffer({
                        token: finalToken,
                        leadId: selectedLeadId,
                        campaignId: selectedCampaignId || undefined,
                        items,
                        note: snapshotDesc || undefined,
                        display: displayPayload
                    })
                    : await AdminManualOfferService.createManualOffer({
                        leadId: selectedLeadId,
                        campaignId: selectedCampaignId || undefined,
                        token: finalToken,
                        items,
                        note: snapshotDesc || undefined,
                        display: displayPayload
                    });

                createdShortCode = res.shortCode;
                createdOfferId = res.offerId;
                setResult({ token: res.token, offerId: res.offerId, shortCode: res.shortCode });
            } else {
                // Create offer_link only (no products). onSave insert sonrasi
                // DB tarafindan dolan short_code'u tekrar cekiyoruz.
                await onSave({
                    lead_id: selectedLeadId,
                    token: finalToken,
                    campaign_id: selectedCampaignId || undefined,
                    offer_snapshot: { ...(snapshotDesc ? { description: snapshotDesc } : {}), display: displayPayload },
                    market_code: marketCode || null,
                    country_code: countryCode || null,
                });
                try {
                    const { data } = await supabase
                        .from('offer_links')
                        .select('short_code')
                        .eq('token', finalToken)
                        .maybeSingle();
                    createdShortCode = data?.short_code || undefined;
                } catch { /* short_code yoksa uzun link fallback */ }
                setResult({ token: finalToken, shortCode: createdShortCode });
            }

            // Auto-send WhatsApp — short_code varsa kisa link, yoksa uzun fallback.
            // Lead listesi (ilk 50) admin tarafında yüklenmedikse direkt
            // DB'den fetch et — preselectedLeadId ile (örn reclaim akışından)
            // gelen lead'in listede olmama ihtimali var.
            let leadInfo = leads.find(l => l.id === selectedLeadId) || null;
            if (!leadInfo?.phone_number && selectedLeadId) {
                try {
                    const { data: leadRow } = await supabase
                        .from('leads')
                        .select('id, customer_name, phone_number')
                        .eq('id', selectedLeadId)
                        .maybeSingle();
                    if (leadRow) leadInfo = leadRow as any;
                } catch (e) {
                    console.warn('[OfferLinkForm] lead phone fallback fetch failed', e);
                }
            }
            // Short_code yoksa AdminManualOfferService.createManualOffer'dan beklenmeyen
            // durum — DB trigger her offer_link icin short_code generate etmeli.
            // Defensive: short_code yoksa direkt DB'den tekrar fetch et.
            if (!createdShortCode && finalToken) {
                try {
                    const { data: olRow } = await supabase
                        .from('offer_links')
                        .select('short_code')
                        .eq('token', finalToken)
                        .maybeSingle();
                    if (olRow?.short_code) createdShortCode = olRow.short_code;
                } catch { /* ignore — fallback kontrolu asagida */ }
            }

            if (leadInfo?.phone_number) {
                // /api/customer/send-offer-link endpoint'i automation_settings tablosundan
                // dinamik template config okur (template_name, language, header_image,
                // url_button, body_has_link). Sadece offer_token gondermek yeterli;
                // endpoint lead phone'unu offer_links → leads join ile cozer ve
                // Meta API'ya dogru parametre formatinda gonderir.
                //
                // Onceki sabit '/api/whatsapp/send-template' yaklasimi #132012 hatasi
                // veriyordu (Parameter format does not match) cunku template config'i
                // admin paneli ile uyumsuzdu. send-offer-link tek dogru kanal.
                try {
                    const waRes = await fetch('/api/customer/send-offer-link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            offer_token: finalToken,
                            offer_id: createdOfferId,
                            // Admin manuel teklifi → her zaman FINAL: müşteri kendi teklif
                            // oluşturduğunda giden mesajla (offer_template_*) birebir aynı şablon
                            // ve parametre yapısı. createdOfferId boş kalsa bile server en güncel
                            // teklifi bulur.
                            admin_final: true,
                        })
                    });
                    if (!waRes.ok) {
                        const errBody = await waRes.text().catch(() => '');
                        console.error('[OfferLinkForm] send-offer-link FAILED', {
                            status: waRes.status,
                            body: errBody.slice(0, 500),
                        });
                    } else {
                        const okBody = await waRes.json().catch(() => ({}));
                        console.log('[OfferLinkForm] WhatsApp template gonderildi →', leadInfo.phone_number, okBody);
                    }
                } catch (waErr) {
                    console.warn('[OfferLinkForm] send-offer-link exception', waErr);
                }
            } else {
                console.warn('[OfferLinkForm] WhatsApp ATLANDI — lead phone_number bulunamadi', { selectedLeadId });
            }

            // RECLAIM BAGLANTISI: admin /admin/offer-reclaim-requests'ten 'Yeni Teklif
            // Hazirla' butonuyla buraya geldiyse, ilgili pending reclaim_request kaydini
            // fulfilled olarak isaretle ve new_offer_link_token'i set et. Boylece:
            //   1. Admin paneldeki talep durumu 'Tamamlandi' olur
            //   2. Musteri eski expired linki tekrar acarsa, reclaim-status endpoint
            //      bu fulfilled kaydi gorur ve musteriyi YENI teklife otomatik
            //      redirect eder (CustomerOffer mount logic).
            // Best-effort: hata varsa teklif olusturma akisini bloklamasin.
            try {
                const params = new URLSearchParams(window.location.search);
                if (params.get('createOfferForLead') === selectedLeadId) {
                    const { data: pendingRows } = await supabase
                        .from('offer_reclaim_requests')
                        .select('id')
                        .eq('lead_id', selectedLeadId)
                        .eq('status', 'pending')
                        .order('created_at', { ascending: false })
                        .limit(1);
                    if (pendingRows && pendingRows.length > 0) {
                        await supabase
                            .from('offer_reclaim_requests')
                            .update({
                                status: 'fulfilled',
                                new_offer_link_token: finalToken,
                                fulfilled_at: new Date().toISOString(),
                            })
                            .eq('id', pendingRows[0].id);
                        console.log('[OfferLinkForm] reclaim_request fulfilled', { id: pendingRows[0].id, new_token: finalToken });
                    }
                }
            } catch (reclaimErr) {
                console.warn('[OfferLinkForm] reclaim_request fulfilled update failed', reclaimErr);
            }
        } catch (err: any) {
            setError(err.message || 'Kayıt sırasında hata oluştu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyUrl = () => {
        if (!result) return;
        const url = result.shortCode
            ? `${window.location.origin}/o/${result.shortCode}`
            : (result.offerId
                ? `${window.location.origin}/offer/${result.token}/teklif/${result.offerId}`
                : `${window.location.origin}/offer/${result.token}`);
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const inputClass = 'w-full h-10 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <LinkIcon className="w-4 h-4 text-indigo-600" />
                        </div>
                        {isRefresh ? 'Teklifi Yenile' : 'Yeni Teklif Oluştur'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-md transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Success State */}
                {result ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                            <Check className="w-7 h-7 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Teklif Oluşturuldu</h3>
                        <p className="text-sm text-slate-500 text-center">
                            Token: <span className="font-mono font-medium text-slate-700">{result.token}</span>
                            {result.offerId && <span className="block text-xs text-slate-400 mt-1">Ürünlü teklif hazır</span>}
                        </p>
                        <button onClick={copyUrl} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors">
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Kopyalandı' : 'Teklif Linkini Kopyala'}
                        </button>
                        <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 transition-colors mt-2">Kapat</button>
                    </div>
                ) : (
                    <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">{error}</div>
                        )}

                        {isRefresh && (
                            <div className="p-3 text-[12px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg leading-relaxed">
                                <strong>Mevcut teklif yenileniyor.</strong> Yeni link <u>oluşturulmaz</u> — müşterinin
                                aynı linki tazelenir (süre uzar, aktifleşir) ve seçtiğiniz ürünlerle yeni final teklif
                                bu linkin altına eklenir. Token sabit kalır.
                            </div>
                        )}

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
                                disabled={loadingLeads}
                            >
                                <option value="">Müşteri seçiniz</option>
                                {leads.map(l => (
                                    <option key={l.id} value={l.id}>
                                        {l.customer_name} {l.company_name ? `(${l.company_name})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Token */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Link Anahtarı (Token) <span className="text-red-400">*</span></label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={token}
                                    onChange={e => setToken(e.target.value.toUpperCase())}
                                    readOnly={isRefresh}
                                    className={`${inputClass} font-mono uppercase${isRefresh ? ' bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                    placeholder="Örn: GUCER-XYZ"
                                />
                                {!isRefresh && (
                                    <button type="button" onClick={generateRandomToken} className="px-3 h-10 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 flex items-center justify-center shrink-0" title="Rastgele Token Üret">
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                                {isRefresh ? 'Yenileme modunda token değiştirilemez — mevcut link tazelenir.' : 'Müşteriye gönderilecek URL\'nin son kısmı olacaktır.'}
                            </p>
                        </div>

                        {/* Campaign */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Kampanya</label>
                            <select
                                value={selectedCampaignId}
                                onChange={e => setSelectedCampaignId(e.target.value)}
                                className={inputClass}
                            >
                                <option value="">Kampanyasız</option>
                                {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {c.valid_until ? `(Son: ${formatDate(c.valid_until)})` : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedCampaign && (
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Geçerlilik: {selectedCampaign.max_offer_validity_days ?? 7} gün · Ön ödeme: %{selectedCampaign.deposit_percentage ?? 20}
                                    {selectedCampaign.market_code && <> · Pazar: <strong>{selectedCampaign.market_code}</strong></>}
                                    {selectedCampaign.country_code && <> · Ülke: <strong>{selectedCampaign.country_code}</strong></>}
                                </p>
                            )}
                        </div>

                        {/* Market / Country override */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                    <Globe2 size={14} className="text-indigo-500" />
                                    Hedef Pazar / Ülke
                                </div>
                                {marketEdited && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMarketEdited(false);
                                            const c = campaigns.find(c => c.id === selectedCampaignId);
                                            setMarketCode(c?.market_code || '');
                                            setCountryCode(c?.country_code || '');
                                        }}
                                        className="text-[10px] text-indigo-600 hover:underline"
                                    >
                                        Kampanyadan miras al
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                                Boş bırakılırsa kampanyanın hedef pazar/ülkesi kullanılır. Bu seçim müşterinin gördüğü para birimi ve fiyat kuralını belirler.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-medium text-slate-500 mb-1">Pazar</label>
                                    <select
                                        value={marketCode}
                                        onChange={e => {
                                            setMarketEdited(true);
                                            const next = e.target.value;
                                            setMarketCode(next);
                                            if (next && countryCode) {
                                                const c = getCountryByCode(countryCode);
                                                if (c && c.market_code !== next) setCountryCode('');
                                            }
                                        }}
                                        className={inputClass}
                                    >
                                        <option value="">Tüm pazarlar</option>
                                        {OFFER_MARKET_OPTIONS.map(m => (
                                            <option key={m.code} value={m.code}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium text-slate-500 mb-1">Ülke</label>
                                    <select
                                        value={countryCode}
                                        onChange={e => {
                                            setMarketEdited(true);
                                            const next = e.target.value;
                                            setCountryCode(next);
                                            if (next) {
                                                const c = getCountryByCode(next);
                                                if (c) setMarketCode(c.market_code);
                                            }
                                        }}
                                        className={inputClass}
                                    >
                                        <option value="">Tüm ülkeler</option>
                                        {(marketCode ? getCountriesByMarket(marketCode) : COUNTRIES).map(c => (
                                            <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name} ({c.currency})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Product Toggle */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2.5">
                                <Package className="w-4 h-4 text-indigo-500" />
                                <div>
                                    <p className="text-sm font-medium text-slate-700">Ürünlü Teklif</p>
                                    <p className="text-[10px] text-slate-400">Ürün seçip hazır fiyatlı teklif oluştur</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setWithProducts(!withProducts)}
                                className={`relative w-10 h-5.5 rounded-full transition-colors ${withProducts ? 'bg-indigo-500' : 'bg-slate-200'}`}
                            >
                                <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${withProducts ? 'left-5' : 'left-0.5'}`} />
                            </button>
                        </div>

                        {/* Görünüm — teklif sayfasında hangi ikna blokları görünsün */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                <Package size={14} className="text-indigo-500" />
                                Teklif Görünümü
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                                Kampanyasız / sarf malzemesi tekliflerinde lansman-kontenjan blokları otomatik kapanır. Gerekirse elle değiştirin.
                            </p>
                            {([
                                { key: 'countdown' as const, label: 'Geri sayım', desc: 'Süre baskısı bloğu (kalan gün/saat)' },
                                { key: 'capacity' as const, label: 'Kontenjan çubuğu', desc: '"%X kontenjan doldu" göstergesi' },
                                { key: 'roi' as const, label: 'ROI bloğu', desc: '"2 Ayda Amorti" hesaplayıcısı (makinesiz sepette her zaman gizli)' },
                            ]).map(item => (
                                <div key={item.key} className="flex items-center justify-between py-1">
                                    <div>
                                        <p className="text-xs font-medium text-slate-700">{item.label}</p>
                                        <p className="text-[10px] text-slate-400">{item.desc}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleDisplay(item.key)}
                                        className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${displayValues[item.key] ? 'bg-indigo-500' : 'bg-slate-200'}`}
                                    >
                                        <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${displayValues[item.key] ? 'left-5' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            ))}
                            <div className="pt-1">
                                <label className="block text-[10px] font-medium text-slate-500 mb-1">Tahmini Teslimat (opsiyonel)</label>
                                <input
                                    type="text"
                                    value={deliveryText}
                                    onChange={e => setDeliveryText(e.target.value)}
                                    maxLength={80}
                                    placeholder={selectedCampaign?.estimated_delivery || '15-20 İş Günü (varsayılan)'}
                                    className={inputClass}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Boş bırakılırsa kampanya/genel varsayılan kullanılır. Örn: "3-5 İş Günü", "Stoktan Aynı Gün Kargo".</p>
                            </div>
                        </div>

                        {/* Product Selection */}
                        {withProducts && (
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-2">Ürünler</label>
                                {loadingProducts ? (
                                    <div className="py-8 text-center text-sm text-slate-400">Ürünler yükleniyor...</div>
                                ) : (
                                    <div className="space-y-2">
                                        {products.map((row, i) => (
                                            <div key={row.product.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${row.selected ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 hover:border-slate-200'}`}>
                                                <button type="button" onClick={() => toggleProduct(i)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${row.selected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}>
                                                    {row.selected && <Check className="w-3 h-3 text-white" />}
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 truncate">{productName(row.product)}</p>
                                                    <p className="text-[10px] text-slate-400">{row.product.product_code}</p>
                                                </div>
                                                {row.selected && (
                                                    <>
                                                        <div className="flex items-center gap-1">
                                                            <button type="button" onClick={() => updateProduct(i, 'quantity', Math.max(1, row.quantity - 1))} className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                                                                <Minus className="w-3 h-3" />
                                                            </button>
                                                            <span className="w-8 text-center text-sm font-medium">{row.quantity}</span>
                                                            <button type="button" onClick={() => updateProduct(i, 'quantity', row.quantity + 1)} className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                                                                <Plus className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        {/* Liste fiyatı (üstü çizili görünecek oldPrice) — opsiyonel.
                                                            Boş bırakılırsa veya satış fiyatından küçük/eşitse müşteri kartında strikethrough yok. */}
                                                        <div className="flex flex-col items-end">
                                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Liste</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={row.customListPrice}
                                                                onChange={e => updateProduct(i, 'customListPrice', e.target.value)}
                                                                placeholder="—"
                                                                className="w-24 h-8 px-2 text-xs text-right border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 line-through text-slate-400"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <label className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">Satış</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={row.customPrice}
                                                                onChange={e => updateProduct(i, 'customPrice', e.target.value)}
                                                                className="w-28 h-9 px-3 text-sm font-bold text-right border-2 border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Totals */}
                                {selectedProducts.length > 0 && (
                                    <div className="bg-slate-50 rounded-lg p-4 space-y-1.5 mt-3">
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
                            </div>
                        )}

                        {/* Note */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Not (opsiyonel)</label>
                            <textarea
                                value={snapshotDesc}
                                onChange={e => setSnapshotDesc(e.target.value)}
                                rows={2}
                                className={`${inputClass} h-auto resize-none`}
                                placeholder="Bu teklif için özel notlar..."
                            />
                        </div>
                    </div>
                )}

                {/* Footer */}
                {!result && (
                    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                        <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors">
                            İptal
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSubmit()}
                            disabled={isSubmitting || !selectedLeadId || !token.trim() || (withProducts && selectedProducts.length === 0)}
                            className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {isSubmitting ? 'Oluşturuluyor...' : withProducts ? 'Teklif Oluştur' : 'Linki Oluştur'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
