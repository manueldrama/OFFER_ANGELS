import React, { useEffect, useMemo, useState } from 'react';
import { Campaign } from '../../../services/admin/campaignsService';
import CollapsibleSection from '../../ui/CollapsibleSection';
import { COUNTRIES, getCountriesByMarket, getCountryByCode } from '../../../utils/countries';
import {
    X,
    Megaphone,
    FileText,
    Calendar,
    Banknote,
    Package,
    Settings2,
    Globe2
} from 'lucide-react';

const MARKET_OPTIONS = [
    { code: 'TR', label: 'TR — Türkiye' },
    { code: 'EU', label: 'EU — European Union' },
    { code: 'GB', label: 'GB — United Kingdom' },
    { code: 'US', label: 'US — United States' },
    { code: 'SA', label: 'SA — Saudi Arabia' },
    { code: 'AE', label: 'AE — United Arab Emirates' },
];

interface CampaignFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Campaign>) => Promise<void>;
    editingCampaign: Campaign | null;
}

const defaultForm = {
    name: '',
    batch_number: '',
    campaign_description: '',
    campaign_start_date: '',
    valid_until: '',
    estimated_delivery: '',
    market_code: '' as string,
    country_code: '' as string,
    max_offer_validity_days: 7,
    deposit_percentage: 20,
    deposit_lock_duration_days: 14,
    deposit_extension_days: 5,
    reissued_offer_validity_hours: 48,
    total_launch_quota: '',
    capacity_percentage: 30,
    auto_close_when_quota_full: false,
    offer_cannot_exceed_campaign_end: true,
    expired_offers_require_manual_reapproval: true,
    auto_reserve_price_and_stock_after_deposit: true,
    offer_flow_type: 'auto' as 'auto' | 'approval_required' | 'manual_only',
    is_active: true,
};

type FormData = typeof defaultForm;

function toDateString(val: string | null | undefined): string {
    if (!val) return '';
    try { return new Date(val).toISOString().split('T')[0]; } catch { return ''; }
}

export default function CampaignFormModal({ isOpen, onClose, onSave, editingCampaign }: CampaignFormModalProps) {
    const [form, setForm] = useState<FormData>({ ...defaultForm });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (editingCampaign) {
            setForm({
                name: editingCampaign.name || '',
                batch_number: editingCampaign.batch_number || '',
                campaign_description: editingCampaign.campaign_description || '',
                campaign_start_date: toDateString(editingCampaign.campaign_start_date),
                valid_until: toDateString(editingCampaign.valid_until),
                estimated_delivery: editingCampaign.estimated_delivery || '',
                market_code: editingCampaign.market_code || '',
                country_code: editingCampaign.country_code || '',
                max_offer_validity_days: editingCampaign.max_offer_validity_days ?? 7,
                deposit_percentage: editingCampaign.deposit_percentage ?? 20,
                deposit_lock_duration_days: editingCampaign.deposit_lock_duration_days ?? 14,
                deposit_extension_days: editingCampaign.deposit_extension_days ?? 5,
                reissued_offer_validity_hours: editingCampaign.reissued_offer_validity_hours ?? 48,
                total_launch_quota: editingCampaign.total_launch_quota != null ? String(editingCampaign.total_launch_quota) : '',
                capacity_percentage: editingCampaign.capacity_percentage ?? 30,
                auto_close_when_quota_full: editingCampaign.auto_close_when_quota_full ?? false,
                offer_cannot_exceed_campaign_end: editingCampaign.offer_cannot_exceed_campaign_end ?? true,
                expired_offers_require_manual_reapproval: editingCampaign.expired_offers_require_manual_reapproval ?? true,
                auto_reserve_price_and_stock_after_deposit: editingCampaign.auto_reserve_price_and_stock_after_deposit ?? true,
                offer_flow_type: editingCampaign.offer_flow_type ?? 'auto',
                is_active: editingCampaign.is_active,
            });
        } else {
            setForm({ ...defaultForm });
        }
    }, [isOpen, editingCampaign]);

    if (!isOpen) return null;

    const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSave({
                name: form.name,
                batch_number: form.batch_number,
                campaign_description: form.campaign_description || undefined,
                campaign_start_date: form.campaign_start_date ? new Date(form.campaign_start_date).toISOString() : undefined,
                valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
                estimated_delivery: form.estimated_delivery,
                market_code: form.market_code || null,
                country_code: form.country_code || null,
                max_offer_validity_days: form.max_offer_validity_days,
                deposit_percentage: form.deposit_percentage,
                deposit_lock_duration_days: form.deposit_lock_duration_days,
                deposit_extension_days: form.deposit_extension_days,
                reissued_offer_validity_hours: form.reissued_offer_validity_hours,
                total_launch_quota: form.total_launch_quota ? Number(form.total_launch_quota) : undefined,
                capacity_percentage: form.capacity_percentage,
                auto_close_when_quota_full: form.auto_close_when_quota_full,
                offer_cannot_exceed_campaign_end: form.offer_cannot_exceed_campaign_end,
                expired_offers_require_manual_reapproval: form.expired_offers_require_manual_reapproval,
                auto_reserve_price_and_stock_after_deposit: form.auto_reserve_price_and_stock_after_deposit,
                offer_flow_type: form.offer_flow_type,
                is_active: form.is_active,
            });
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const usedQuota = editingCampaign?.used_quota ?? 0;
    const totalQuota = form.total_launch_quota ? Number(form.total_launch_quota) : 0;
    const remainingQuota = Math.max(0, totalQuota - usedQuota);
    const quotaPercent = totalQuota > 0 ? Math.round((usedQuota / totalQuota) * 100) : 0;

    const inputClass = 'w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-colors';
    const labelClass = 'block text-xs font-medium text-slate-600 mb-1';
    const requiredStar = <span className="text-red-400 ml-0.5">*</span>;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Megaphone className="w-4 h-4 text-indigo-600" />
                        </div>
                        {editingCampaign ? 'Kampanya Düzenle' : 'Yeni Kampanya'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form id="campaignFormV2" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

                    {/* Section 1: Kampanya Bilgileri */}
                    <CollapsibleSection title="Kampanya Bilgileri" icon={FileText} defaultOpen={true}>
                        <div>
                            <label className={labelClass}>Kampanya Adı {requiredStar}</label>
                            <input required type="text" value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} placeholder="Örn: 2025 Q1 Lansman" />
                        </div>
                        <div>
                            <label className={labelClass}>Parti / Grup Numarası {requiredStar}</label>
                            <input required type="text" value={form.batch_number} onChange={e => set('batch_number', e.target.value)} className={inputClass} placeholder="Örn: BATCH-2025-01" />
                        </div>
                        <div>
                            <label className={labelClass}>Kampanya Açıklaması</label>
                            <textarea value={form.campaign_description} onChange={e => set('campaign_description', e.target.value)} rows={2} className={`${inputClass} h-auto resize-none`} placeholder="Kampanya hakkında kısa açıklama..." />
                        </div>
                    </CollapsibleSection>

                    {/* Section 1b: Hedef Pazar / Ülke */}
                    <CollapsibleSection title="Hedef Pazar / Ülke" icon={Globe2} defaultOpen={!editingCampaign}>
                        <p className="text-[11px] text-slate-500 -mt-1 mb-2">
                            Bu kampanya altında oluşturulan teklifler varsayılan olarak buradaki pazar/ülke ile bağlanır.
                            Boş bırakılırsa kampanya tüm pazarlara açıktır.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Pazar</label>
                                <select
                                    value={form.market_code}
                                    onChange={e => {
                                        const next = e.target.value;
                                        set('market_code', next);
                                        // If current country no longer belongs to selected market, clear it.
                                        if (next && form.country_code) {
                                            const c = getCountryByCode(form.country_code);
                                            if (c && c.market_code !== next) set('country_code', '');
                                        }
                                    }}
                                    className={inputClass}
                                >
                                    <option value="">Tüm pazarlar (global)</option>
                                    {MARKET_OPTIONS.map(m => (
                                        <option key={m.code} value={m.code}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Ülke (opsiyonel)</label>
                                <select
                                    value={form.country_code}
                                    onChange={e => {
                                        const next = e.target.value;
                                        set('country_code', next);
                                        // Auto-fill market from chosen country.
                                        if (next) {
                                            const c = getCountryByCode(next);
                                            if (c) set('market_code', c.market_code);
                                        }
                                    }}
                                    className={inputClass}
                                >
                                    <option value="">Tüm ülkeler</option>
                                    {(form.market_code ? getCountriesByMarket(form.market_code) : COUNTRIES).map(c => (
                                        <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </CollapsibleSection>

                    {/* Section 2: Zamanlama */}
                    <CollapsibleSection title="Zamanlama" icon={Calendar} defaultOpen={true}>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Başlangıç Tarihi</label>
                                <input type="date" value={form.campaign_start_date} onChange={e => set('campaign_start_date', e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Bitiş Tarihi {requiredStar}</label>
                                <input required type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} className={inputClass} />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Tahmini Teslimat Metni</label>
                            <input type="text" value={form.estimated_delivery} onChange={e => set('estimated_delivery', e.target.value)} className={inputClass} placeholder="Örn: Haziran 2025" />
                        </div>
                    </CollapsibleSection>

                    {/* Section 3: Ticari Kurallar */}
                    <CollapsibleSection title="Ticari Kurallar" icon={Banknote} defaultOpen={!editingCampaign}>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Maks. Teklif Süresi</label>
                                <div className="relative">
                                    <input type="number" min={1} max={365} value={form.max_offer_validity_days} onChange={e => set('max_offer_validity_days', Number(e.target.value))} className={`${inputClass} pr-12`} />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">gün</span>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Ön Ödeme Oranı</label>
                                <div className="relative">
                                    <input type="number" min={1} max={100} value={form.deposit_percentage} onChange={e => set('deposit_percentage', Number(e.target.value))} className={`${inputClass} pr-8`} />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">%</span>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Ön Ödeme Koruma Süresi</label>
                                <div className="relative">
                                    <input type="number" min={1} max={365} value={form.deposit_lock_duration_days} onChange={e => set('deposit_lock_duration_days', Number(e.target.value))} className={`${inputClass} pr-12`} />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">gün</span>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Ek Ödeme Süresi</label>
                                <div className="relative">
                                    <input type="number" min={1} max={30} value={form.deposit_extension_days} onChange={e => set('deposit_extension_days', Number(e.target.value))} className={`${inputClass} pr-12`} />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">gün</span>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Yeniden Teklif Geçerliliği</label>
                                <div className="relative">
                                    <input type="number" min={1} max={720} value={form.reissued_offer_validity_hours} onChange={e => set('reissued_offer_validity_hours', Number(e.target.value))} className={`${inputClass} pr-12`} />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">saat</span>
                                </div>
                            </div>
                        </div>
                    </CollapsibleSection>

                    {/* Section 4: Stok / Kapasite */}
                    <CollapsibleSection title="Stok / Kapasite" icon={Package} defaultOpen={!editingCampaign}>
                        <div>
                            <label className={labelClass}>Toplam Kontenjan</label>
                            <input type="number" min={0} value={form.total_launch_quota} onChange={e => set('total_launch_quota', e.target.value)} className={inputClass} placeholder="Sınırsız için boş bırakın" />
                        </div>

                        <div>
                            <label className={labelClass}>Müşteri Görünümünde Doluluk Yüzdesi</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={form.capacity_percentage}
                                    onChange={e => set('capacity_percentage', Number(e.target.value))}
                                    className={`${inputClass} pr-8`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">%</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Müşteri teklif ekranında gösterilen "%X kontenjan doldu" çubuğunun değeri. Aciliyet/yoğunluk hissi yaratır.</p>
                        </div>

                        {totalQuota > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>Kullanılan: <span className="font-semibold text-slate-700">{usedQuota}</span></span>
                                    <span>Kalan: <span className="font-semibold text-emerald-600">{remainingQuota}</span></span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${quotaPercent >= 90 ? 'bg-red-500' : quotaPercent >= 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                        style={{ width: `${Math.min(100, quotaPercent)}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400">%{quotaPercent} doluluk</p>
                            </div>
                        )}

                        <ToggleField
                            label="Kontenjan dolduğunda otomatik kapat"
                            description="Kontenjan tamamlandığında yeni teklif oluşturulmasını engeller."
                            checked={form.auto_close_when_quota_full}
                            onChange={v => set('auto_close_when_quota_full', v)}
                        />
                    </CollapsibleSection>

                    {/* Section 5: İş Akışı Kuralları */}
                    <CollapsibleSection title="İş Akışı Kuralları" icon={Settings2} defaultOpen={false}>
                        {/* Offer Flow Type */}
                        <div>
                            <p className="text-xs font-medium text-slate-600 mb-2">Teklif Akış Tipi</p>
                            <div className="space-y-2">
                                {([
                                    { value: 'auto', label: 'Otomatik', desc: 'Müşteri teklif oluşturduğunda otomatik aktif olur.' },
                                    { value: 'approval_required', label: 'Onay Gerekli', desc: 'Müşteri teklif oluşturur, admin onayına düşer.' },
                                    { value: 'manual_only', label: 'Sadece Manuel', desc: 'Sadece admin panelden teklif oluşturulabilir.' },
                                ] as const).map(opt => (
                                    <label key={opt.value} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${form.offer_flow_type === opt.value ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-100 hover:border-slate-200'}`}>
                                        <input
                                            type="radio"
                                            name="offer_flow_type"
                                            checked={form.offer_flow_type === opt.value}
                                            onChange={() => set('offer_flow_type', opt.value)}
                                            className="mt-0.5 accent-indigo-600"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-slate-700">{opt.label}</p>
                                            <p className="text-xs text-slate-400">{opt.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100" />

                        <ToggleField
                            label="Teklif kampanya bitişini aşamaz"
                            description="Teklif süresi kampanya bitiş tarihinden sonraya uzanamaz."
                            checked={form.offer_cannot_exceed_campaign_end}
                            onChange={v => set('offer_cannot_exceed_campaign_end', v)}
                        />
                        <ToggleField
                            label="Süresi dolan teklifler manuel onay gerektirir"
                            description="Süresi dolan teklifler otomatik yenilenmez, müşteri talep eder, admin onaylar."
                            checked={form.expired_offers_require_manual_reapproval}
                            onChange={v => set('expired_offers_require_manual_reapproval', v)}
                        />
                        <ToggleField
                            label="Ön ödeme sonrası fiyat ve stok kilitle"
                            description="Ön ödeme yapıldığında fiyat ve stok koruma süresi boyunca sabitlenir."
                            checked={form.auto_reserve_price_and_stock_after_deposit}
                            onChange={v => set('auto_reserve_price_and_stock_after_deposit', v)}
                        />
                        <div className="pt-2 border-t border-slate-100">
                            <ToggleField
                                label="Aktif Kampanya"
                                description="Pasif kampanyalar müşterilere gösterilmez."
                                checked={form.is_active}
                                onChange={v => set('is_active', v)}
                            />
                        </div>
                    </CollapsibleSection>
                </form>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors">
                        İptal
                    </button>
                    <button type="submit" form="campaignFormV2" disabled={isSubmitting} className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ToggleField({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-start justify-between gap-4 py-1">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors ${checked ? 'bg-indigo-500' : 'bg-slate-200'}`}
            >
                <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`} />
            </button>
        </div>
    );
}
