import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { AdminProductCatalogService } from '../../../services/admin/productCatalogService';
import { CatalogProduct, PricingRule } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';
import { COUNTRIES, CountryInfo } from '../../../utils/countries';
import PricingRuleFormModal from '../pricing/PricingRuleFormModal';

type InlineField = 'amount' | 'launch_amount' | 'deposit_percent';
interface EditingCell { country: string; field: InlineField; }

/**
 * Synthetic "country" row for the GLOBAL fallback price. It is NOT a real
 * country: it persists as a pricing_rule with country_code=null and
 * market_code='GLOBAL', which the resolver applies ONLY to undeclared /
 * not-listed international visitors (never to TR or a listed market — a
 * 'GLOBAL' market never equals 'TR'/'EU'/etc, so home pricing stays safe).
 * Fixed to USD: this is the international list price the operator sets by hand.
 */
const GLOBAL_ROW_CODE = '__global__';
const GLOBAL_MARKET_CODE = 'GLOBAL';
const GLOBAL_ROW: CountryInfo = {
    code: GLOBAL_ROW_CODE,
    name: 'Listede olmayan ülkeler',
    currency: 'USD',
    market_code: GLOBAL_MARKET_CODE,
    flag: '🌍',
    vat_rate: 0,
};

interface ProductMarketPricingTableProps {
    productId: string;
    /** Used to power the dropdowns inside the rule form modal. */
    products: CatalogProduct[];
}

/**
 * Country-level pricing panel that lives on the product edit page.
 * Each row is one country with its own currency. Lists list/launch price
 * and deposit % directly on the row, with one-click create/edit/delete.
 */
export default function ProductMarketPricingTable({ productId, products }: ProductMarketPricingTableProps) {
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<PricingRule | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [seedRule, setSeedRule] = useState<Partial<PricingRule> | null>(null);
    const [showAllCountries, setShowAllCountries] = useState(false);
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [cellValue, setCellValue] = useState<string>('');
    const [savingCountry, setSavingCountry] = useState<string | null>(null);
    const savedRef = useRef(false);
    const toast = useToast();

    const reload = async () => {
        if (!productId) return;
        setLoading(true);
        try {
            const rs = await AdminProductCatalogService.listPricingRules({ productId, activeOnly: undefined });
            setRules(rs.rules || []);
        } catch (err) {
            console.error('[ProductMarketPricingTable] load failed', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        reload();
    }, [productId]);

    // Group rules by country_code so each country row sees what already exists.
    const rulesByCountry = useMemo(() => {
        const map = new Map<string, PricingRule[]>();
        rules.forEach(r => {
            const key = (r.country_code || '').toUpperCase() || '__global__';
            const list = map.get(key) || [];
            list.push(r);
            map.set(key, list);
        });
        return map;
    }, [rules]);

    // Decide which countries to show: by default only countries that already have a rule
    // plus TR (so admin always sees the home market). "Tümünü göster" expands to all.
    const visibleCountries = useMemo(() => {
        if (showAllCountries) return COUNTRIES;
        const seen = new Set<string>();
        seen.add('TR');
        rules.forEach(r => { if (r.country_code) seen.add(r.country_code.toUpperCase()); });
        return COUNTRIES.filter(c => seen.has(c.code));
    }, [showAllCountries, rules]);

    const handleEdit = (rule: PricingRule) => {
        setEditing(rule);
        setSeedRule(null);
        setShowModal(true);
    };

    const handleDelete = async (rule: PricingRule) => {
        if (!confirm(`${rule.country_code || rule.market_code || 'Global'} kuralını silmek istediğinize emin misiniz?`)) return;
        try {
            await AdminProductCatalogService.deletePricingRule(rule.id);
            toast.success('Başarılı', 'Kural silindi.');
            reload();
        } catch {
            toast.error('Hata', 'Silme işlemi başarısız.');
        }
    };

    const handleClose = (saved?: boolean) => {
        setShowModal(false);
        setEditing(null);
        setSeedRule(null);
        if (saved) reload();
    };

    const formatAmount = (amount: number, currency: string) =>
        `${Number(amount).toLocaleString()} ${currency}`;

    const startEdit = (country: string, field: InlineField, currentValue: number | null | undefined) => {
        savedRef.current = false;
        setEditingCell({ country, field });
        setCellValue(currentValue == null ? '' : String(currentValue));
    };

    const cancelEdit = () => {
        savedRef.current = false;
        setEditingCell(null);
        setCellValue('');
    };

    const handleInlineSave = async (country: CountryInfo, field: InlineField, raw: string) => {
        if (savedRef.current) return;
        savedRef.current = true;

        const trimmed = raw.trim();
        const existing = rulesByCountry.get(country.code)?.find(r => r.price_type === 'full_price' && r.is_active) || null;
        const previousValue =
            field === 'amount' ? existing?.amount ?? null :
            field === 'launch_amount' ? existing?.launch_amount ?? null :
            existing?.deposit_percent ?? null;

        if (trimmed === '' && previousValue == null) {
            setEditingCell(null);
            setCellValue('');
            return;
        }

        const numeric = trimmed === '' ? null : Number(trimmed);
        if (trimmed !== '' && (numeric === null || Number.isNaN(numeric))) {
            toast.warning('Geçersiz Değer', 'Sayısal bir değer girin.');
            setEditingCell(null);
            setCellValue('');
            return;
        }

        if (String(previousValue ?? '') === String(numeric ?? '')) {
            setEditingCell(null);
            setCellValue('');
            return;
        }

        if (!existing && field !== 'amount') {
            toast.warning('Önce Liste Fiyatı Girin', 'Lansman veya ön ödeme % için önce liste fiyatı tanımlanmalı.');
            setEditingCell(null);
            setCellValue('');
            return;
        }

        if (field === 'amount' && (numeric == null || numeric <= 0)) {
            toast.warning('Geçersiz Liste Fiyatı', 'Liste fiyatı 0\'dan büyük olmalı.');
            setEditingCell(null);
            setCellValue('');
            return;
        }

        const nextAmount = field === 'amount' ? (numeric as number) : existing?.amount ?? 0;
        const nextLaunch = field === 'launch_amount' ? numeric : existing?.launch_amount ?? null;
        if (nextLaunch != null && nextLaunch > nextAmount) {
            toast.warning('Geçersiz Lansman Fiyatı', 'Lansman fiyatı liste fiyatından büyük olamaz.');
            setEditingCell(null);
            setCellValue('');
            return;
        }
        if (field === 'deposit_percent' && numeric != null && (numeric < 0 || numeric > 100)) {
            toast.warning('Geçersiz Oran', 'Ön ödeme % 0-100 arasında olmalı.');
            setEditingCell(null);
            setCellValue('');
            return;
        }

        setSavingCountry(country.code);
        try {
            if (existing) {
                await AdminProductCatalogService.updatePricingRule(existing.id, { [field]: numeric } as Partial<PricingRule>);
            } else {
                await AdminProductCatalogService.createPricingRule({
                    product_id: productId,
                    product_package_id: null,
                    market_code: country.market_code,
                    // Global row persists as a wildcard rule (country_code null);
                    // the 'GLOBAL' market_code keeps it from matching TR/listed markets.
                    country_code: country.code === GLOBAL_ROW_CODE ? null : country.code,
                    campaign_id: null,
                    currency_code: country.currency,
                    price_type: 'full_price',
                    amount: numeric as number,
                    launch_amount: null,
                    deposit_percent: null,
                    priority: 0,
                    is_active: true,
                });
            }
            toast.success('Kaydedildi', `${country.code} fiyatı güncellendi.`);
            setEditingCell(null);
            setCellValue('');
            await reload();
        } catch (err) {
            console.error('[ProductMarketPricingTable] inline save failed', err);
            toast.error('Hata', 'Fiyat kaydedilemedi.');
            savedRef.current = false;
        } finally {
            setSavingCountry(null);
        }
    };

    const renderEditableCell = (
        country: CountryInfo,
        field: InlineField,
        currentValue: number | null | undefined,
        display: React.ReactNode,
    ) => {
        const isEditing = editingCell?.country === country.code && editingCell.field === field;
        const isSaving = savingCountry === country.code;
        if (isEditing) {
            return (
                <input
                    type="number"
                    step={field === 'deposit_percent' ? '0.5' : '0.01'}
                    min={field === 'deposit_percent' ? 0 : undefined}
                    max={field === 'deposit_percent' ? 100 : undefined}
                    autoFocus
                    value={cellValue}
                    onChange={e => setCellValue(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                        else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                    }}
                    onBlur={() => handleInlineSave(country, field, cellValue)}
                    className="w-24 px-2 py-1 text-right font-mono text-sm border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder={field === 'deposit_percent' ? '%' : '0'}
                />
            );
        }
        return (
            <button
                type="button"
                onClick={() => startEdit(country.code, field, currentValue)}
                disabled={isSaving}
                className="inline-flex items-center justify-end gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-200 transition-colors w-full text-right"
                title="Tıkla ve düzenle"
            >
                {isSaving && <Loader2 size={11} className="animate-spin text-indigo-500" />}
                {display}
            </button>
        );
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                    <Globe2 className="text-indigo-600 mt-0.5" size={18} />
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-slate-800">Ülke Bazlı Fiyatlandırma</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Her ülke için ayrı liste/lansman fiyatı ve ön ödeme oranı tanımlayın. Para birimi ülkeye göre otomatik gelir.
                            En üstteki <span className="font-semibold text-indigo-600">🌍 Global</span> satırı, listede olmayan / ülkesi belirsiz
                            uluslararası müşteriler için geçerli USD fiyattır (boşsa onlar TL görür).
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAllCountries(s => !s)}
                    className="shrink-0 text-xs font-medium text-indigo-600 hover:underline whitespace-nowrap"
                >
                    {showAllCountries ? 'Sadece tanımlı ülkeler' : `Tümünü göster (${COUNTRIES.length})`}
                </button>
            </div>

            {loading ? (
                <div className="text-center text-xs text-slate-400 py-6">Yükleniyor…</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left border-b border-slate-100 text-[11px] text-slate-500 uppercase tracking-wider">
                                <th className="pb-2 pr-4 font-semibold">Ülke</th>
                                <th className="pb-2 pr-4 font-semibold">Para Birimi</th>
                                <th className="pb-2 pr-4 font-semibold text-right">Liste Fiyatı</th>
                                <th className="pb-2 pr-4 font-semibold text-right">Lansman Fiyatı</th>
                                <th className="pb-2 pr-4 font-semibold text-right">Ön Ödeme %</th>
                                <th className="pb-2 font-semibold text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[GLOBAL_ROW, ...visibleCountries].map(country => {
                                const isGlobalRow = country.code === GLOBAL_ROW_CODE;
                                const countryRules = rulesByCountry.get(country.code) || [];
                                const fullPrice = countryRules.find(r => r.price_type === 'full_price' && r.is_active);
                                const legacyDeposit = countryRules.find(r => r.price_type === 'deposit' && r.is_active);
                                const launchAmount = fullPrice?.launch_amount;
                                const depositPct = fullPrice?.deposit_percent;
                                const currency = fullPrice?.currency_code || country.currency;
                                return (
                                    <tr key={country.code} className={`border-b ${isGlobalRow ? 'border-indigo-100 bg-indigo-50/40' : 'border-slate-50 hover:bg-slate-50/50'}`}>
                                        <td className="py-3 pr-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base leading-none">{country.flag}</span>
                                                <div>
                                                    <div className="font-semibold text-slate-900">{isGlobalRow ? 'Global' : country.code}</div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {isGlobalRow ? 'Listede olmayan ülkeler · USD' : country.name}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 pr-4 text-slate-700">{currency}</td>
                                        <td className="py-3 pr-4 text-right">
                                            {renderEditableCell(country, 'amount', fullPrice?.amount ?? null,
                                                fullPrice ? (
                                                    <span className="font-mono font-semibold text-slate-900">
                                                        {formatAmount(fullPrice.amount, fullPrice.currency_code)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )
                                            )}
                                        </td>
                                        <td className="py-3 pr-4 text-right">
                                            {renderEditableCell(country, 'launch_amount', launchAmount ?? null,
                                                launchAmount ? (
                                                    <span className="font-mono text-emerald-700 font-semibold">
                                                        {formatAmount(launchAmount, currency)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )
                                            )}
                                        </td>
                                        <td className="py-3 pr-4 text-right">
                                            {legacyDeposit && depositPct == null ? (
                                                <span className="text-[11px] text-amber-700" title="Eski 'deposit' kuralı — kuralı düzenleyip Ön Ödeme % alanına taşıyın">
                                                    legacy
                                                </span>
                                            ) : (
                                                renderEditableCell(country, 'deposit_percent', depositPct ?? null,
                                                    depositPct != null ? (
                                                        <span className="font-mono text-slate-700">%{depositPct}</span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">—</span>
                                                    )
                                                )
                                            )}
                                        </td>
                                        <td className="py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {fullPrice ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleEdit(fullPrice)}
                                                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                            title="Düzenle"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(fullPrice)}
                                                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                            title="Sil"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => startEdit(country.code, 'amount', null)}
                                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                    >
                                                        <Plus size={12} /> Fiyat ekle
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {visibleCountries.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-6 text-center text-xs text-slate-400">
                                        Henüz fiyat tanımlanmadı. "Tümünü göster" ile bir ülke seçip fiyat ekleyin.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <PricingRuleFormModal
                    rule={editing || (seedRule as PricingRule | null)}
                    products={products}
                    onClose={handleClose}
                />
            )}
        </div>
    );
}
