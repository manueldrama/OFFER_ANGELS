import React from 'react';
import { OfferExperience } from '../../../types';
import { Box, LayoutGrid, FileText, Headset, User, ShieldCheck, Scale, HelpCircle, CreditCard, Building2, PieChart, Flame, Rocket, Clock, Truck, Check, Ticket, Minus, Plus } from 'lucide-react';
import { DEFAULT_PAYMENT_OPTIONS } from '../../../services/offerContext';

interface PreviewProps {
    content: OfferExperience;
    view?: 'selection' | 'final' | 'deposit';
}

export function OfferExperiencePreview({ content, view = 'selection' }: PreviewProps) {
    if (view === 'deposit') return <DepositPreview content={content} />;
    if (view === 'final') return <FinalOfferPreview content={content} />;

    return (
        <div className="mx-auto w-[320px] md:w-[375px] h-[667px] md:h-[812px] bg-slate-50 border-[8px] border-slate-800 rounded-[3rem] overflow-hidden my-4 relative shadow-2xl flex flex-col">

            {/* Hero Section - White with subtle gradient (matches real page) */}
            <div className="bg-white border-b border-slate-100 p-5 shrink-0 relative overflow-hidden">
                {/* Subtle background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/20" />

                <div className="relative z-10 flex flex-col gap-3">
                    {/* Customer Pill */}
                    <div className="inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm self-start">
                        <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <User size={9} strokeWidth={2.5} />
                        </div>
                        <p className="text-slate-600 text-[10px] font-semibold tracking-wide">Sayın Örnek Müşteri</p>
                    </div>

                    {/* Hero Title */}
                    <h1 className="text-lg font-black leading-tight tracking-tight text-slate-900">
                        {content.hero_title.split('\n').map((line, i) => (
                            <React.Fragment key={i}>{line}<br /></React.Fragment>
                        ))}
                    </h1>

                    {/* Hero Subtitle */}
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                        {content.hero_subtitle}
                    </p>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-20">

                {/* Info Cards */}
                <div className="flex gap-2 px-3 pt-3 pb-1 overflow-x-hidden">
                    <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-100 flex-1 min-w-0">
                        <div className="text-[8px] text-slate-500 font-bold uppercase mb-0.5 truncate">{content.card_shipping_label || 'SEVKİYAT'}</div>
                        <div className="text-[11px] font-black text-slate-900 truncate">{content.card_shipping_value || 'Değer'}</div>
                        <div className="text-[8px] font-semibold text-indigo-600 truncate">{content.card_shipping_status || 'Durum'}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-100 flex-1 min-w-0">
                        <div className="text-[8px] text-slate-500 font-bold uppercase mb-0.5 truncate">{content.card_capacity_label || 'KONTENJAN'}</div>
                        <div className="text-[11px] font-black text-slate-900 truncate">{content.card_capacity_value || 'Değer'}</div>
                        <div className="text-[8px] font-semibold text-indigo-600 truncate">{content.card_capacity_status || 'Durum'}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-100 flex-1 min-w-0">
                        <div className="text-[8px] text-slate-500 font-bold uppercase mb-0.5 truncate">{content.card_delivery_label || 'TESLİMAT'}</div>
                        <div className="text-[11px] font-black text-slate-900 truncate">{content.card_delivery_value || 'Değer'}</div>
                        <div className="text-[8px] font-semibold text-indigo-600 truncate">{content.card_delivery_status || 'Durum'}</div>
                    </div>
                </div>

                {/* Product Card */}
                <div className="px-3 pt-2 space-y-2">
                    <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex gap-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 shrink-0">
                            <Box size={20} />
                        </div>
                        <div className="flex-1 py-0.5 min-w-0">
                            <div className="text-[9px] text-indigo-600 font-bold mb-0.5">{content.badge_text || 'Örnek Model'}</div>
                            <div className="text-xs font-black text-slate-900 leading-none mb-1">Cihaz Adı</div>
                            <div className="text-[9px] text-slate-500 mb-2 leading-tight">Açıklama metni burada gösterilir.</div>
                            <button className="w-full bg-slate-900 text-white rounded-lg py-1 text-[9px] font-bold">{content.cta_secondary}</button>
                        </div>
                    </div>

                    {/* Second mock product */}
                    <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex gap-3 opacity-60">
                        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 shrink-0">
                            <Box size={20} />
                        </div>
                        <div className="flex-1 py-0.5 min-w-0">
                            <div className="text-[9px] text-indigo-600 font-bold mb-0.5">{content.badge_text || 'Örnek Model'}</div>
                            <div className="text-xs font-black text-slate-900 leading-none mb-1">Cihaz Adı 2</div>
                            <div className="text-[9px] text-slate-500 mb-2 leading-tight">Açıklama metni burada gösterilir.</div>
                            <button className="w-full bg-slate-900 text-white rounded-lg py-1 text-[9px] font-bold">{content.cta_secondary}</button>
                        </div>
                    </div>
                </div>

                {/* Action Pills removed — moved to bottom tab bar */}

                {/* Support Section */}
                <div className="mx-3 mt-3 bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                    <div className="flex items-center gap-1.5 mb-1.5 text-indigo-900">
                        <ShieldCheck size={12} />
                        <span className="font-bold text-[10px]">Satış Sonrası Destek</span>
                    </div>
                    <p className="text-[9px] text-indigo-800 leading-relaxed mb-2">{content.support_helper_text}</p>
                    <button className="bg-white text-indigo-900 w-full py-1.5 rounded-lg text-[9px] font-bold border border-indigo-100 shadow-sm">
                        Müşteri Temsilcisi ile Görüş
                    </button>
                </div>

                <p className="text-[8px] text-slate-400 text-center px-4 mt-3 leading-relaxed pb-2">
                    {content.support_disclaimer_text}
                </p>
            </div>

            {/* Primary CTA - Two buttons like real page */}
            <div className="absolute bottom-[52px] left-0 right-0 px-3 pb-2 bg-gradient-to-t from-white via-white/95 to-transparent pt-4">
                <button className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-[11px] shadow-lg shadow-indigo-200 mb-1.5">
                    {content.cta_primary}
                </button>
                <button className="w-full border border-slate-200 bg-white text-slate-700 py-2 rounded-lg font-semibold text-[10px]">
                    {content.cta_secondary}
                </button>
            </div>

            {/* Bottom Tab Bar - matches real page */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/95 border-t border-slate-200/80 h-[52px] flex items-center justify-around px-2">
                <div className="flex flex-col items-center gap-0.5 text-indigo-600">
                    <LayoutGrid size={16} strokeWidth={2.5} />
                    <span className="text-[7px] font-bold uppercase tracking-wider">{content.tab_models_label}</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-slate-400">
                    <FileText size={16} strokeWidth={2} />
                    <span className="text-[7px] font-bold uppercase tracking-wider">Tekliflerim</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-slate-400">
                    <Headset size={16} strokeWidth={2} />
                    <span className="text-[7px] font-bold uppercase tracking-wider">{content.tab_support_label}</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-slate-400">
                    <Scale size={16} strokeWidth={2} />
                    <span className="text-[7px] font-bold uppercase tracking-wider">Karşılaştır</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-slate-400">
                    <HelpCircle size={16} strokeWidth={2} />
                    <span className="text-[7px] font-bold uppercase tracking-wider">Yardım</span>
                </div>
            </div>
        </div>
    );
}

function DepositPreview({ content }: { content: OfferExperience }) {
    const badgeLabel = content.deposit_badge_label || 'Kapora Ödendi';
    const priceUpdatedLabel = content.deposit_price_updated_label || 'Fiyat Güncellendi';
    const expiredLabel = content.deposit_expired_label || 'Süre Doldu';
    const payButton = content.deposit_pay_button || 'Kalanı Öde';
    const payUpdatedButton = content.deposit_pay_updated_button || 'Güncel Fiyattan Öde';
    const expiredMessage = content.deposit_expired_message || 'Ödeme süresi dolmuştur';
    const expiredSubmessage = content.deposit_expired_submessage || 'Kaporanız iade edilmeyecektir.';
    const countdownText = (content.deposit_countdown_text || 'Ödeme için {days} gün kaldı').replace('{days}', '12');

    return (
        <div className="mx-auto w-[320px] md:w-[375px] h-[667px] md:h-[812px] bg-[#F7F7F8] border-[8px] border-slate-800 rounded-[3rem] overflow-hidden my-4 relative shadow-2xl flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-4 py-3 shrink-0">
                <h2 className="text-[11px] font-black text-slate-900">Siparişlerim</h2>
                <p className="text-[8px] text-slate-400">Kapora & ödeme durumu önizlemesi</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Card 1: Active deposit - price lock active */}
                <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[9px] text-slate-400">#CFP-2026-0001</span>
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-semibold bg-emerald-100 text-emerald-800">{badgeLabel}</span>
                    </div>
                    <div className="space-y-1 mb-2">
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500">Cafepaste Pro ×1</span>
                            <span className="font-medium text-slate-900">₺204.000</span>
                        </div>
                    </div>
                    <div className="bg-gradient-to-r from-emerald-50 to-amber-50 border border-emerald-100 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500">Ödenen kapora</span>
                            <span className="font-bold text-emerald-600">₺40.800</span>
                        </div>
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500">Kalan tutar</span>
                            <span className="font-bold text-slate-700">₺163.200</span>
                        </div>
                        <div className="text-center py-1 rounded-lg text-[9px] font-bold bg-white/60 text-slate-600">
                            {countdownText}
                        </div>
                        <button className="w-full py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg">
                            {payButton}
                        </button>
                    </div>
                </div>

                {/* Card 2: Price lock expired */}
                <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[9px] text-slate-400">#CFP-2026-0002</span>
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-semibold bg-amber-100 text-amber-800">{priceUpdatedLabel}</span>
                    </div>
                    <div className="space-y-1 mb-2">
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500">Cafepaste Başlangıç ×1</span>
                            <span className="font-medium text-slate-900">₺120.000</span>
                        </div>
                    </div>
                    <div className="bg-gradient-to-r from-emerald-50 to-amber-50 border border-emerald-100 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500">Ödenen kapora</span>
                            <span className="font-bold text-emerald-600">₺24.000</span>
                        </div>
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500">Kalan tutar</span>
                            <span className="font-bold text-amber-600">₺106.000</span>
                        </div>
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500">Eski lansman fiyatı</span>
                            <span className="font-medium text-slate-400 line-through">₺120.000</span>
                        </div>
                        <div className="text-center py-1 rounded-lg text-[9px] font-bold bg-red-100 text-red-600">
                            {(content.deposit_countdown_text || 'Ödeme için {days} gün kaldı').replace('{days}', '3')}
                        </div>
                        <button className="w-full py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg">
                            {payUpdatedButton}
                        </button>
                    </div>
                </div>

                {/* Card 3: Expired / cancelled */}
                <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-3 opacity-70">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[9px] text-slate-400">#CFP-2026-0003</span>
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-semibold bg-red-100 text-red-800">{expiredLabel}</span>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-center">
                        <p className="text-[9px] font-bold text-red-500">{expiredMessage}</p>
                        <p className="text-[7px] text-red-400 mt-0.5">{expiredSubmessage}</p>
                    </div>
                </div>
            </div>

            {/* Bottom Tab Bar */}
            <div className="shrink-0 bg-white border-t border-slate-200/80 h-[44px] flex items-center justify-around px-2">
                <div className="flex flex-col items-center gap-0.5 text-slate-400">
                    <LayoutGrid size={14} strokeWidth={2} />
                    <span className="text-[6px] font-bold uppercase tracking-wider">{content.tab_models_label}</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-primary">
                    <FileText size={14} strokeWidth={2.5} />
                    <span className="text-[6px] font-bold uppercase tracking-wider">Tekliflerim</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-slate-400">
                    <Headset size={14} strokeWidth={2} />
                    <span className="text-[6px] font-bold uppercase tracking-wider">{content.tab_support_label}</span>
                </div>
            </div>
        </div>
    );
}

function FinalOfferPreview({ content }: { content: OfferExperience }) {
    const trustBadge = content.final_offer_trust_badge || 'Size Özel Lansman Teklifimiz';
    const demandTitle = content.final_offer_demand_title || 'Bu hafta yoğun talep var';
    const demandSubtitle = content.final_offer_demand_subtitle || 'işletme cihazını rezerve etti';
    const subtotalLabel = content.final_offer_subtotal_label || 'Ara Toplam';
    const totalLabel = content.final_offer_total_label || 'Toplam';
    const reservationTitle = content.final_offer_reservation_title || 'Rezervasyon Seçeneği';
    const confirmButton = content.final_offer_confirm_button || 'Teklifi Onayla ve Rezerve Et';
    const infoLaunchLabel = content.info_strip_launch_label || 'Lansman\nDönemi';
    const infoLaunchValue = content.info_strip_launch_value || 'Mayıs 2026';
    const infoCapacityLabel = content.info_strip_capacity_label || 'Kontenjan';
    const infoShippingLabel = content.info_strip_shipping_label || 'Türkiye\nGeneli';
    const infoShippingValue = content.info_strip_shipping_value || 'Ücretsiz';

    const paymentOptions = (content.payment_options?.length ? content.payment_options : DEFAULT_PAYMENT_OPTIONS)
        .filter(o => o.enabled)
        .sort((a, b) => a.sort_order - b.sort_order);

    const ICONS: Record<string, React.ElementType> = { 'credit-card': CreditCard, 'bank-transfer': Building2, 'pre-payment': PieChart };

    return (
        <div className="mx-auto w-[320px] md:w-[375px] h-[667px] md:h-[812px] bg-[#F7F7F8] border-[8px] border-slate-800 rounded-[3rem] overflow-hidden my-4 relative shadow-2xl flex flex-col">

            {/* Trust Banner */}
            <div className="bg-white border-b border-slate-100 px-3 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                        <Check size={8} className="text-white" strokeWidth={3.5} />
                    </div>
                    <span className="text-[10px] font-bold text-[#1E1E1E]">{trustBadge}</span>
                </div>
                <span className="text-[8px] text-slate-400 font-mono">#CFP-2026-0001</span>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto pb-20">
                <div className="px-3 pt-3 space-y-2">

                    {/* Demand Alert */}
                    <div className="bg-white rounded-md border border-slate-100 shadow-sm p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
                                <Flame size={13} className="text-primary" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 text-[10px] leading-tight">{demandTitle}</p>
                                <p className="text-slate-400 text-[8px]">%85 {demandSubtitle}</p>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: '85%' }} />
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-[7px] text-slate-400">%85 rezerve</span>
                            <span className="text-[7px] font-bold text-primary">Sınırlı kontenjan</span>
                        </div>
                    </div>

                    {/* Offer Card */}
                    <div className="bg-white rounded-md border border-slate-100 shadow-sm divide-y divide-slate-50">
                        <div className="flex justify-between items-center px-3 py-2">
                            <span className="text-[8px] text-slate-400">Hazırlanan</span>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-900 block">MAGLEV ELEKTRONİK</span>
                                <span className="text-[8px] text-slate-400">Örnek Müşteri</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center px-3 py-2">
                            <span className="text-[8px] text-slate-400">Teklif Geçerliliği</span>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-900 block">7 Nisan 2026</span>
                                <span className="text-[8px] text-primary flex items-center gap-0.5 justify-end">
                                    <Clock size={8} /> 29 gün kaldı
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Info Strip */}
                    <div className="bg-white rounded-md border border-slate-100 shadow-sm flex divide-x divide-slate-100">
                        {[
                            { icon: <Rocket size={11} />, label: infoLaunchLabel, value: infoLaunchValue },
                            { icon: <Clock size={11} />, label: infoCapacityLabel, value: '%15 Kaldı' },
                            { icon: <Truck size={11} />, label: infoShippingLabel, value: infoShippingValue },
                        ].map((item, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center text-center gap-1 py-3 px-1">
                                <div className="w-6 h-6 rounded-full bg-primary/8 flex items-center justify-center text-primary">{item.icon}</div>
                                <div className="text-[6px] font-bold text-slate-400 uppercase whitespace-pre-line leading-tight">{item.label}</div>
                                <div className="text-[9px] font-black text-slate-900 leading-tight">{item.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Geri Sayım Notu (fiyat & teslimat sabitleme) — örnek değerlerle önizleme */}
                    <p className="text-[7px] leading-relaxed text-slate-500 px-1">
                        {(content.info_strip_reservation_note
                            || "{{launchMonth}} Lansmanı'na özel bu fiyat yalnızca sınırlı süre geçerlidir. Fiyat ve {{delivery}} teslimat hakkı, rezervasyon ödemesi tamamlandığında sizin adınıza sabitlenir. Bu, sınırlı sayıda işletmeye ayrılan özel bir kontenjandır.")
                            .replace(/\{\{\s*launchMonth\s*\}\}/g, 'Haziran')
                            .replace(/\{\{\s*delivery\s*\}\}/g, content.info_strip_delivery_value || 'Mayıs 2026')}
                    </p>

                    {/* Product Card */}
                    <div className="bg-white rounded-lg border border-slate-100 overflow-hidden shadow-sm">
                        <div className="px-3 py-2 flex items-center justify-end border-b border-slate-50">
                            <div className="bg-primary/8 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Ticket size={8} className="rotate-45" />
                                <span className="text-[7px] font-bold">Özel Lansman Avantajı Uygulandı</span>
                            </div>
                        </div>
                        <div className="p-3 flex gap-3">
                            <div className="w-14 h-14 shrink-0 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                                <Box size={18} className="text-slate-300" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[11px] font-[900] text-slate-900">Cafepaste Pro</p>
                                <p className="text-[8px] text-slate-400 mt-0.5">Yüksek Hacimli İşletmeler İçin</p>
                                <div className="flex gap-1 mt-1">
                                    <span className="bg-primary/8 text-primary px-1.5 py-0.5 rounded text-[7px] font-bold">Profesyonel seri</span>
                                    <span className="bg-primary/8 text-primary px-1.5 py-0.5 rounded text-[7px] font-bold">Hızlı kurulum</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-primary/[0.03] px-3 py-2.5 flex justify-between items-center border-t border-primary/8">
                            <div>
                                <span className="text-[7px] font-bold text-slate-400 uppercase block">Liste Fiyatı</span>
                                <span className="text-[9px] text-slate-400 line-through">₺200.000</span>
                                <div className="flex items-center gap-1 mt-1 bg-white rounded-full border border-slate-200 px-1 py-0.5 w-fit">
                                    <button className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-50 text-slate-500"><Minus size={8} strokeWidth={3} /></button>
                                    <span className="text-[8px] font-bold w-2 text-center">1</span>
                                    <button className="w-4 h-4 flex items-center justify-center rounded-full bg-primary/10 text-primary"><Plus size={8} strokeWidth={3} /></button>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[7px] font-bold text-primary uppercase block">Lansman Fiyatı</span>
                                <span className="text-lg font-[900] text-primary leading-none">₺170.000</span>
                                <span className="inline-flex items-center gap-0.5 mt-1 bg-green-50 text-green-600 text-[7px] font-bold px-1.5 py-0.5 rounded-full border border-green-100">
                                    ₺30.000 lansman avantajı
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Price Summary */}
                    <div className="bg-white rounded-md border border-slate-100 shadow-sm p-3 space-y-2">
                        <div className="flex justify-between text-[9px] text-slate-400">
                            <span>{subtotalLabel}</span><span>₺170.000</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400">
                            <span>KDV (%20)</span><span>₺34.000</span>
                        </div>
                        <div className="border-t border-slate-100 pt-2 flex justify-between items-center">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{totalLabel}</span>
                            <span className="text-base font-black text-slate-900">₺204.000</span>
                        </div>
                    </div>

                    {/* Reservation Options */}
                    <div className="bg-white rounded-md border border-slate-100 shadow-sm p-3">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2">{reservationTitle}</p>
                        <div className="space-y-1.5">
                            {paymentOptions.map((opt, i) => {
                                const Icon = ICONS[opt.id] || CreditCard;
                                return (
                                    <div key={opt.id} className={`flex items-center gap-2 p-2 rounded-lg border ${i === 0 ? 'border-primary/30 bg-primary/[0.03] ring-1 ring-primary/20' : 'border-slate-100 bg-slate-50'}`}>
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${i === 0 ? 'bg-primary' : 'bg-white border border-slate-200'}`}>
                                            <Icon size={12} className={i === 0 ? 'text-white' : 'text-slate-500'} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-bold text-slate-900 truncate">{opt.label}</p>
                                            <p className="text-[7px] text-slate-400 truncate">{opt.sublabel.replace('{taksit}', '14.167').replace('{on_odeme}', '34.000')}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky CTA */}
            <div className="shrink-0 bg-white/95 border-t border-slate-100 px-3 py-2">
                <button className="w-full bg-primary text-white py-3 rounded-md font-bold text-[10px] shadow-lg shadow-primary/20">
                    {confirmButton}
                </button>
            </div>

            {/* Bottom Tab Bar */}
            <div className="shrink-0 bg-white border-t border-slate-200/80 h-[44px] flex items-center justify-around px-2">
                <div className="flex flex-col items-center gap-0.5 text-slate-400">
                    <LayoutGrid size={14} strokeWidth={2} />
                    <span className="text-[6px] font-bold uppercase tracking-wider">{content.tab_models_label}</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-primary">
                    <FileText size={14} strokeWidth={2.5} />
                    <span className="text-[6px] font-bold uppercase tracking-wider">Tekliflerim</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-slate-400">
                    <Headset size={14} strokeWidth={2} />
                    <span className="text-[6px] font-bold uppercase tracking-wider">{content.tab_support_label}</span>
                </div>
            </div>
        </div>
    );
}
