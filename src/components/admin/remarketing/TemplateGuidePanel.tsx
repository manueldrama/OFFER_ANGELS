// Meta Şablon Rehberi — segment başına hazır WhatsApp şablonu tarifi.
//
// Remarketing sihirbazı mesaj metnini kendisi yazmaz; yalnız Meta onaylı şablon
// gönderir. Bu panel her segment için kopyala-yapıştır hazır gövde metni, Meta'da
// oluşturma adımları, buton konfigürasyonu ve sihirbazın Gönder adımındaki slot
// eşlemesini gösterir. Salt rehber: hiçbir API çağrısı yapmaz, veri yazmaz.
// Şablon metinleri backend'in doldurabildiği kaynaklarla sınırlıdır
// (name/offer_number/model_names/aylar) — fiyat veya tarih değişkeni YOKTUR.

import React, { useState } from 'react';
import {
    BookOpen, ChevronDown, Copy, CheckCircle2, ExternalLink,
    Tag, MessageCircle, Zap, Hourglass, Users, Clock,
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import type { RemarketingSegment } from '../../../services/admin/remarketingService';

type WaTemplate = { name: string; body: string; language: string };

type SlotSpec = { n: number; source: string; label: string };

type TemplateGuide = {
    segment: RemarketingSegment;
    metaName: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    recommendedContent: string[]; // sihirbazın İçerik adımındaki etiketler
    body: string;
    slots: SlotSpec[];
    notes?: string;
};

// Buton metinleri webhook'un classifyRemarketingReply regex'iyle birebir uyumlu:
// "Hayır, teşekkürler" → opt-out (bir daha remarketing almaz),
// "Detaylı bilgi istiyorum" → "bilgi/istiyorum" kelimeleriyle interested sınıfına
// düşer (İlgilenenler panelinde öne çıkar) — "Evet, ilgileniyorum" ile aynı işlev,
// ama müşterinin gerçek niyetine ("sorum var") daha yakın olduğu için tercih edildi.
const BTN_YES = 'Detaylı bilgi istiyorum';
const BTN_NO = 'Hayır, teşekkürler';
const BTN_URL_TEXT = 'Teklifi Gör';

export const TEMPLATE_GUIDES: TemplateGuide[] = [
    {
        segment: 'payment_abandoned',
        metaName: 'rmk_payment_abandoned_v1',
        title: 'Ödemeyi yarıda bırakanlar',
        icon: Tag,
        recommendedContent: ['Aynı teklif + süre uzatma', 'Kısa süreli aciliyet'],
        body: 'Merhaba {{1}}, {{2}} siparişinizde ödeme adımı yarım kaldı. Teklifiniz hâlâ sizin için ayrılmış durumda; ancak geçerliliği için yalnızca {{3}} gün kaldı — süre dolunca fiyat koruması kalkıyor. Aşağıdaki bağlantıdan kaldığınız yerden 2 dakikada tamamlayabilirsiniz.',
        slots: [
            { n: 1, source: 'customer_salutation', label: 'Müşteri adı + Bey/Hanım (otomatik hitap)' },
            { n: 2, source: 'model_names', label: 'Teklifteki model adları' },
            { n: 3, source: 'days_left', label: 'Teklifin kalan gün sayısı (otomatik)' },
        ],
        notes: 'En sıcak kitle — mesajda pazarlık yok, sadece "kaldığın yerden devam et". Kalan gün gönderim anında teklifin gerçek bitişinden hesaplanır. URL butonu ödeme sayfasını değil teklif sayfasını açar; müşteri oradan ödemeye geçer.',
    },
    {
        segment: 'model_unselected',
        metaName: 'rmk_model_unselected_v1',
        title: 'Model seçmemiş (yarım kalmış)',
        icon: MessageCircle,
        recommendedContent: ['Yeni teklif / model seçim sayfası gönder'],
        body: 'Merhaba {{1}}, CAFEPASTE Beverage Art teklifiniz için model seçiminiz tamamlanmadı ve fiyatınız henüz sabitlenmedi. {{2}} kampanya koşulları kapanmadan aşağıdaki bağlantıdan makinenizi seçin; seçim yapılmayan başvurular kampanya dışında kalıyor.',
        slots: [
            { n: 1, source: 'customer_salutation', label: 'Müşteri adı + Bey/Hanım (otomatik hitap)' },
            { n: 2, source: 'current_month', label: 'İçinde bulunulan ay (otomatik)' },
        ],
    },
    {
        segment: 'offer_live_unpaid',
        metaName: 'rmk_offer_live_unpaid_v1',
        title: 'Teklifi aktif, satın almamış',
        icon: Zap,
        recommendedContent: ['Kısa süreli aciliyet'],
        body: 'Merhaba {{1}}, {{2}} için hazırlanan teklifinizin süresinin dolmasına yalnızca {{3}} gün kaldı. Kampanya yenilendiğinde aynı koşulları tekrar sunamıyoruz; süre dolduğunda teklif otomatik kapanır. Onaylamak için aşağıdaki bağlantıyı kullanın.',
        slots: [
            { n: 1, source: 'customer_salutation', label: 'Müşteri adı + Bey/Hanım (otomatik hitap)' },
            { n: 2, source: 'model_names', label: 'Teklifteki model adları' },
            { n: 3, source: 'days_left', label: 'Teklifin kalan gün sayısı (otomatik)' },
        ],
        notes: 'Dikkat: "Kısa süreli aciliyet" içeriği aktif teklifin süresini de kısa pencereyle EZER — metindeki "süresi dolmak üzere" ifadesi böylece her alıcı için doğru olur.',
    },
    {
        segment: 'fresh_expired',
        metaName: 'rmk_fresh_expired_v1',
        title: 'Teklifi taze dolmuş',
        icon: Hourglass,
        recommendedContent: ['Aynı teklif + süre uzatma', 'Aynı model, güncel kampanya fiyatı'],
        body: 'Merhaba {{1}}, {{2}} teklifinizin süresi geçtiğimiz günlerde doldu. Sizin için tek seferlik yeniden aktif ettik — bu uzatma {{3}} içinde tekrar yapılmayacak. Güncel teklifinize aşağıdaki bağlantıdan ulaşabilirsiniz.',
        slots: [
            { n: 1, source: 'customer_salutation', label: 'Müşteri adı + Bey/Hanım (otomatik hitap)' },
            { n: 2, source: 'model_names', label: 'Teklifteki model adları' },
            { n: 3, source: 'current_month', label: 'İçinde bulunulan ay (otomatik)' },
        ],
        notes: '"Aynı model, güncel kampanya fiyatı" içeriğiyle kullanacaksan "yeniden aktif ettik" yerine "güncel kampanya fiyatıyla yeniledik" diyen ayrı bir varyant (rmk_fresh_repriced_v1) onaylatman daha dürüst olur.',
    },
    {
        segment: 'offer_unpaid',
        metaName: 'rmk_offer_unpaid_v1',
        title: 'Teklif almış, ödememiş',
        icon: Users,
        recommendedContent: ['Geri kazanım indirimi'],
        body: 'Merhaba {{1}}, {{2}} yatırım planınızı yeniden değerlendirmeniz için öncekinden daha iyi koşullarla yeni bir teklif hazırladık. Bu teklif sınırlı sayıda işletme için açıldı ve {{3}} kapanmadan geçerli. Detaylar aşağıdaki bağlantıda.',
        slots: [
            { n: 1, source: 'customer_salutation', label: 'Müşteri adı + Bey/Hanım (otomatik hitap)' },
            { n: 2, source: 'model_names', label: 'Teklifteki model adları' },
            { n: 3, source: 'current_month', label: 'İçinde bulunulan ay (otomatik)' },
        ],
        notes: 'İndirim oranını metne yazma — sistemde fiyat değişkeni yok ve orana her kampanyada karar veriyorsun. "Öncekinden daha iyi koşullar" yeterli merak yaratır; rakamı teklif sayfası gösterir.',
    },
    {
        segment: 'dead_silent',
        metaName: 'rmk_dead_silent_v1',
        title: 'Ölü / sessiz adaylar',
        icon: Clock,
        recommendedContent: ['Geri kazanım indirimi', 'Yeni teklif / model seçim sayfası gönder'],
        body: 'Merhaba {{1}}, bir süre önce CAFEPASTE Beverage Art makinesiyle ilgilenmiştiniz. {{2}} itibarıyla koşullarımız yenilendi ve size özel yeni bir teklif oluşturduk. İlgileniyorsanız aşağıdaki bağlantıdan inceleyin; ilgilenmiyorsanız "Hayır" demeniz yeterli, bir daha yazmayız.',
        slots: [
            { n: 1, source: 'customer_salutation', label: 'Müşteri adı + Bey/Hanım (otomatik hitap)' },
            { n: 2, source: 'current_month', label: 'İçinde bulunulan ay (otomatik)' },
        ],
        notes: '"Bir daha yazmayız" sözü teknik olarak doğru: Hayır butonuna basan lead otomatik opt-out olur ve bir daha remarketing almaz. Bu segmentte ton yumuşak tutuldu — spam şikayeti riski en yüksek kitle.',
    },
];

/** Şablon adı rehberdeki bir rmk_* şablonuyla eşleşiyorsa önerilen {{n}} eşlemesini
 *  döner ({"1":"customer_salutation",...}); eşleşmiyorsa null. Sihirbaz ve otomasyon
 *  paneli şablon seçiminde bununla ön-doldurur (admin yine serbestçe değiştirir). */
export function guideParamMapFor(templateName: string): Record<string, string> | null {
    const g = TEMPLATE_GUIDES.find((x) => x.metaName === templateName);
    if (!g) return null;
    return Object.fromEntries(g.slots.map((s) => [String(s.n), s.source]));
}

type Props = {
    templates: WaTemplate[];
    open: boolean;
    onToggle: () => void;
};

const TemplateGuidePanel: React.FC<Props> = ({ templates, open, onToggle }) => {
    const { success, error: toastError } = useToast();
    const [expanded, setExpanded] = useState<RemarketingSegment | null>(null);

    // DİKKAT: buton suffix'i teklif KISA KODUdur (offer_short_code) — kısa kodu
    // çözen route /o/:shortCode (ShortLinkResolver). /offer/:token DEĞİL; o route
    // tam token bekler, kısa kodla açılmaz.
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cafepaste.com';
    const buttonUrl = `${origin}/o/{{1}}`;

    const copy = async (text: string, what: string) => {
        try {
            await navigator.clipboard.writeText(text);
            success('Kopyalandı', what);
        } catch {
            toastError('Kopyalanamadı', 'Tarayıcı pano erişimine izin vermedi.');
        }
    };

    const isCreated = (metaName: string) => templates.some((t) => t.name === metaName);

    return (
        <div className="rounded-2xl border border-sky-100 bg-sky-50/30 p-4 space-y-3">
            <button onClick={onToggle} className="w-full flex items-center justify-between gap-2 text-left">
                <span className="flex items-center gap-2 text-sm font-medium text-sky-900">
                    <BookOpen className="h-4 w-4 text-sky-500" /> Meta Şablon Rehberi — segment başına hazır şablonlar
                </span>
                <ChevronDown className={`h-4 w-4 text-sky-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <>
                    <p className="text-xs text-sky-900/60">
                        Sihirbaz yalnız <b>Meta onaylı şablon</b> gönderebilir. Aşağıdaki 6 şablonu bir kez Meta'da
                        oluşturup onaylattığında her segment için doğru mesaj hazır olur. Metinler, sistemin
                        doldurabildiği değişkenlerle sınırlı yazıldı (fiyat/tarih değişkeni yoktur).
                    </p>

                    {/* Ortak Meta talimatı — her şablon için aynı */}
                    <div className="rounded-xl bg-white border border-sky-100 p-4 space-y-2">
                        <div className="text-sm font-medium text-gray-900">Meta'da şablon nasıl oluşturulur? (her şablon için aynı adımlar)</div>
                        <ol className="list-decimal ml-4 space-y-1 text-xs text-gray-600">
                            <li>
                                <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noreferrer"
                                    className="text-sky-600 hover:underline inline-flex items-center gap-1">
                                    WhatsApp Manager → Mesaj Şablonları <ExternalLink className="h-3 w-3" />
                                </a>
                                {' '}sayfasında <b>Şablon oluştur</b>'a tıkla.
                            </li>
                            <li>Kategori: <b>Pazarlama (Marketing)</b> · Dil: <b>Türkçe (tr)</b> · Ad: aşağıdaki karttan kopyala (küçük harf, boşluksuz).</li>
                            <li>Gövde metnini karttan kopyalayıp yapıştır. Meta örnek değer isterse: {'{{1}}'} = "Ahmet Bey", {'{{2}}'} = "CAFEPASTE X1" gibi gerçekçi örnekler gir.</li>
                            <li>
                                Butonları ekle — üçü de aynı şablonda:
                                <span className="block mt-1 space-y-0.5">
                                    <span className="block">• <b>URL butonu</b> "{BTN_URL_TEXT}" → tür <b>Dinamik</b>, adres: <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">{buttonUrl}</code> (sistem {'{{1}}'} yerine her alıcının kendi teklif kodunu koyar)</span>
                                    <span className="block">• <b>Hızlı yanıt</b>: "{BTN_YES}" (sıcak lead sinyali — basan müşteri İlgilenenler paneline düşer, "Evet, ilgileniyorum" da aynı işlevi görür)</span>
                                    <span className="block">• <b>Hızlı yanıt</b>: "{BTN_NO}" (basan müşteri otomatik olarak bir daha remarketing almaz)</span>
                                    <span className="block text-amber-700">• Toplam 3 butonu geçme — WhatsApp 4+ butonu menüye katlar, tıklama düşer. Buton metnine asla "hayır / iptal / istemiyorum" gibi kelimeler koyma; sistem basanı yanlışlıkla remarketing'den çıkarır.</span>
                                </span>
                            </li>
                            <li>Onaya gönder — genelde 5 dk ile 24 saat arası sürer.</li>
                            <li>
                                Onaylanınca <a href="/admin/whatsapp/templates" className="text-sky-600 hover:underline">Şablonlar sayfasından</a>{' '}
                                <b>Meta'dan senkronize et</b> — şablon bu sihirbazın Gönder adımındaki listeye düşer.
                            </li>
                        </ol>
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                            Meta kuralları: mesaj değişkenle başlayamaz/bitemez, iki değişken yan yana olamaz. Aşağıdaki
                            metinler bu kurallara uygun yazıldı — değiştirirsen buna dikkat et.
                        </p>
                        <p className="text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-lg px-2.5 py-1.5">
                            <b>Bey/Hanım hitabı:</b> Gönder adımında {'{{1}}'} için "Müşteri adı + Bey/Hanım (otomatik hitap)" seçersen
                            mesaj "Merhaba Ahmet Bey," diye gider. Cinsiyet otomatik çözülür (isim sözlüğü → geçmiş kayıtlar → AI);
                            çözülemezse güvenli şekilde tam ad yazılır — asla yanlış hitap gitmez. Yanlış çözülen bir isim görürsen{' '}
                            <a href="/admin/settings/name-gender" className="text-sky-600 hover:underline">isim-cinsiyet düzeltme sayfasından</a>{' '}
                            kalıcı düzeltebilirsin.
                        </p>
                    </div>

                    {/* Segment kartları */}
                    <div className="space-y-2">
                        {TEMPLATE_GUIDES.map((g) => {
                            const isOpen = expanded === g.segment;
                            const created = isCreated(g.metaName);
                            const Icon = g.icon;
                            return (
                                <div key={g.segment} className="rounded-xl bg-white border border-sky-100 overflow-hidden">
                                    <button onClick={() => setExpanded(isOpen ? null : g.segment)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-sky-50/50 transition">
                                        <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${created ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm font-medium text-gray-900">{g.title}</span>
                                            <span className="block text-xs text-gray-400 font-mono truncate">{g.metaName}</span>
                                        </span>
                                        {created ? (
                                            <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 shrink-0">
                                                <CheckCircle2 className="h-3 w-3" /> Hazır
                                            </span>
                                        ) : (
                                            <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-500 shrink-0">
                                                Henüz oluşturulmadı
                                            </span>
                                        )}
                                        <ChevronDown className={`h-4 w-4 text-gray-300 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isOpen && (
                                        <div className="px-4 pb-4 space-y-3 border-t border-sky-50">
                                            {/* Şablon adı */}
                                            <div className="flex items-center gap-2 pt-3">
                                                <code className="flex-1 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs font-mono text-gray-700 truncate">{g.metaName}</code>
                                                <button onClick={() => void copy(g.metaName, 'Şablon adı panoya alındı.')}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100 shrink-0">
                                                    <Copy className="h-3.5 w-3.5" /> Adı kopyala
                                                </button>
                                            </div>

                                            {/* Gövde metni */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-gray-600">Gövde metni (Meta'ya yapıştır)</span>
                                                    <button onClick={() => void copy(g.body, 'Gövde metni panoya alındı.')}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100">
                                                        <Copy className="h-3 w-3" /> Metni kopyala
                                                    </button>
                                                </div>
                                                <p className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs leading-relaxed text-gray-700 whitespace-pre-line">{g.body}</p>
                                            </div>

                                            {/* Sihirbaz eşlemesi */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <span className="text-xs font-medium text-gray-600">Sihirbazda önerilen içerik tipi</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {g.recommendedContent.map((c) => (
                                                            <span key={c} className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">{c}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs font-medium text-gray-600">Gönder adımında değişken eşlemesi</span>
                                                    <div className="space-y-0.5">
                                                        {g.slots.map((s) => (
                                                            <div key={s.n} className="flex items-center gap-2 text-xs text-gray-600">
                                                                <span className="font-mono text-gray-400 w-9">{`{{${s.n}}}`}</span>
                                                                <span>→ {s.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Butonlar — ortak talimatla aynı, kartta da görünür olsun diye tekrar */}
                                            <div className="space-y-1">
                                                <span className="text-xs font-medium text-gray-600">Meta'da eklenecek butonlar (üçü de aynı şablonda)</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">🔗 {BTN_URL_TEXT} (URL)</span>
                                                    <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">{BTN_YES}</span>
                                                    <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">{BTN_NO}</span>
                                                </div>
                                            </div>

                                            {g.notes && (
                                                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{g.notes}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

export default TemplateGuidePanel;
