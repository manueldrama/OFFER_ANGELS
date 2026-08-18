// Per-country, per-language contract content: admin CRUD + public read.
//
// Resolves the legal HTML shown in the "Ön Bilgilendirme Formu" and "Mesafeli
// Satış Sözleşmesi" modals on the customer offer page. Resolution order:
//   1) (country, language)
//   2) (country, '*')
//   3) ('*',     language)
//   4) ('*',     '*')
//   5) hardcoded TR fallback (so the modal never renders empty)

import { supabase } from '../../lib/supabase/client';
import { COMPANY } from '../../lib/companyIdentity';

export interface CountryContract {
    country_code: string;
    language_code: string;
    pre_info_title?: string | null;
    pre_info_html: string;
    distance_sales_title?: string | null;
    distance_sales_html: string;
    updated_at?: string;
}

// DB'den okuma başarısız olduğunda render edilen sabit TR metinleri.
//
// Bunlar `supabase/migrations/20260724_tr_contract_texts.sql` ile
// country_contracts('TR','tr') satırına yazılan metinlerin birebir aynısıdır —
// biri değişirse diğeri de değişmeli, aksi halde DB erişilemediğinde müşteri
// farklı bir sözleşme görür.
//
// Satıcı kimliği bilerek {{seller*}} placeholder'ları ile yazıldı: künye
// src/lib/companyIdentity.ts'te tek yerde duruyor, metne sabit gömülmüyor.
// (Önceki sürüm "CAFEPASTE Makine A.Ş. / Şirket Adresi, Mahallesi, İstanbul"
// gibi gerçek olmayan bir tüzel kişilik gösteriyordu.)
//
// Kapsam, functions/api/internal/ai/contract/generate.ts içindeki
// TR_PRE_INFO_CHECKLIST (12 zorunlu unsur) ve TR_DISTANCE_CHECKLIST (10 madde)
// listelerine göre yazıldı.
//
// NOT: Ön ödeme/kapora ile yapılan rezervasyonlarda kaporanın akıbetine dair
// özel hüküm bilinçli olarak yazılmadı — arayüzdeki "kaporanız iade
// edilmeyecektir" ifadesinin hukuki dayanağı henüz netleşmedi. Metin bu konuda
// yalnızca yasal cayma hükümlerine atıf yapıyor.
const TR_FALLBACK_PRE_INFO = [
    "<p><strong>MADDE 1: KONU</strong><br />İşbu Ön Bilgilendirme Formu'nun (\"Form\") konusu, ALICI'nın SATICI'ya ait internet sitesinden elektronik ortamda siparişini yaptığı, aşağıda nitelikleri ve satış fiyatı belirtilen ürünlerin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince bilgilendirilmesidir.</p>",
    "<p><strong>MADDE 2: SATICI BİLGİLERİ</strong><br />Unvanı: {{sellerName}}<br />Adresi: {{sellerAddress}}<br />Telefon: {{sellerPhone}}<br />E-posta: {{sellerEmail}}<br />Vergi Dairesi / No: {{sellerTaxOffice}} / {{sellerTaxNumber}}<br />MERSIS No: {{sellerMersis}}<br />Web Sitesi: {{sellerWebsite}}</p>",
    "<p><strong>MADDE 3: ALICI BİLGİLERİ</strong><br />Adı/Soyadı/Unvanı: {{customerName}}<br />Firma: {{companyName}}<br />Telefon: {{customerPhone}}<br />E-posta: {{customerEmail}}<br />Teslimat Adresi: {{deliveryAddress}}</p>",
    "<p><strong>MADDE 4: SÖZLEŞME KONUSU ÜRÜNLER VE TEMEL NİTELİKLERİ</strong><br />Sipariş No: {{orderNumber}} &nbsp;|&nbsp; Tarih: {{orderDate}}</p>{{productList}}<p>Ürünlerin cinsi, türü, miktarı, marka/modeli ve teknik özellikleri teklif detaylarında belirtildiği gibidir. Görseller tanıtım amaçlıdır.</p>",
    "<p><strong>MADDE 5: BEDEL VE ÖDEME</strong><br />Ara toplam (KDV hariç): {{subtotal}} {{currency}}<br />KDV (%{{vatRate}}): {{vat}} {{currency}}<br /><strong>Tüm vergiler dâhil toplam bedel: {{total}} {{currency}}</strong><br />Ödeme şekli: {{paymentMethod}}<br />Kredi kartı ile yapılan ödemeler PayTR altyapısı üzerinden alınır; kart bilgileri SATICI tarafından görülmez ve saklanmaz. Taksitli ödemelerde bankanızın uyguladığı vade farkları kart ekstrenize yansıyabilir.</p>",
    "<p><strong>MADDE 6: TESLİMAT VE KARGO MASRAFI</strong><br />Ürün, ALICI'nın bildirdiği teslimat adresine anlaşmalı kargo firması ile gönderilir. Teslim süresi, siparişin onaylanmasından itibaren yasal azami 30 (otuz) günü aşmaz. Aksi teklifte belirtilmedikçe kargo masrafı SATICI'ya aittir. Cihaz teslim edildikten sonra teknik ekip, yerinde kurulum için 24 saat içinde ALICI ile randevu oluşturur; kurulum bedeli satış bedeline dâhildir.</p>",
    "<p><strong>MADDE 7: CAYMA HAKKI</strong><br />ALICI, ürünün kendisine veya gösterdiği adresteki kişi/kuruluşa tesliminden itibaren 14 (on dört) gün içinde, hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir. Cayma hakkı, {{sellerEmail}} adresine e-posta göndererek veya {{sellerPhone}} numarasından bildirimde bulunarak, süre dolmadan kullanılabilir. Cayma bildirimi SATICI'ya ulaştıktan sonra 14 gün içinde ürün bedeli ALICI'ya ödediği şekilde iade edilir.</p>",
    "<p><strong>MADDE 8: CAYMA HAKKININ İSTİSNALARI</strong><br />Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca aşağıdaki ürünlerde cayma hakkı kullanılamaz:</p><ul><li>ALICI'nın istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan, kişiselleştirilmiş ürünler,</li><li>Tesliminden sonra ambalajı açılmış olması sebebiyle iadesi sağlık ve hijyen açısından uygun olmayan sarf malzemeleri (yenilebilir mürekkep kartuşları vb.),</li><li>Çabuk bozulabilen veya son kullanma tarihi geçebilecek ürünler.</li></ul>",
    "<p><strong>MADDE 9: İADE ADRESİ VE İADE MASRAFI</strong><br />Cayma hakkının kullanılması hâlinde ürün, tüm aksesuarları ve faturası ile birlikte aşağıdaki adrese gönderilir:<br />{{sellerName}}<br />{{sellerAddress}}<br />Cayma süresi içindeki iade gönderimi SATICI'nın anlaşmalı kargo firması ile yapıldığı takdirde iade kargo masrafı SATICI'ya aittir. ALICI'nın farklı bir taşıyıcı tercih etmesi hâlinde masraf ALICI'ya aittir.</p>",
    "<p><strong>MADDE 10: GARANTİ VE SATIŞ SONRASI HİZMETLER</strong><br />Cihazlar, teslim tarihinden itibaren 2 (iki) yıl süreyle parça ve işçilik garantisi kapsamındadır. Kullanım hatası, düşme/darbe, sıvı teması, yetkisiz servis müdahalesi ve orijinal olmayan sarf malzemesi kullanımından doğan arızalar garanti kapsamı dışındadır. Sarf malzemeleri (kartuş, temizlik kiti) garanti kapsamında değildir.</p>",
    "<p><strong>MADDE 11: UYUŞMAZLIKLARIN ÇÖZÜMÜ</strong><br />ALICI, şikâyet ve itirazlarını, Ticaret Bakanlığı'nca her yıl Aralık ayında belirlenen parasal sınırlar dâhilinde, yerleşim yerinin bulunduğu veya tüketici işleminin yapıldığı yerdeki Tüketici Hakem Heyetine ya da Tüketici Mahkemesine iletebilir.</p>",
    "<p><strong>MADDE 12: SÖZLEŞMENİN SAKLANMASI</strong><br />İşbu Form ve Mesafeli Satış Sözleşmesi, ALICI tarafından elektronik ortamda onaylandığı anda içeriği ve onay zamanı ile birlikte kayıt altına alınır; ALICI dilediğinde {{sellerEmail}} adresine başvurarak bir kopyasını talep edebilir.</p>",
].join('');

const TR_FALLBACK_DISTANCE = [
    "<p><strong>MADDE 1: TARAFLAR</strong><br /><strong>SATICI:</strong> {{sellerName}}, {{sellerAddress}}, Tel: {{sellerPhone}}, E-posta: {{sellerEmail}}, Vergi Dairesi/No: {{sellerTaxOffice}} / {{sellerTaxNumber}}, MERSIS: {{sellerMersis}}<br /><strong>ALICI:</strong> {{customerName}} ({{companyName}}), Tel: {{customerPhone}}, E-posta: {{customerEmail}}, Teslimat Adresi: {{deliveryAddress}}</p>",
    "<p><strong>MADDE 2: KONU VE KAPSAM</strong><br />İşbu Sözleşme'nin konusu, ALICI'nın SATICI'ya ait internet sitesi üzerinden elektronik ortamda siparişini verdiği ürünlerin satışı ve teslimi ile ilgili olarak tarafların hak ve yükümlülüklerinin belirlenmesidir. Taraflar, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümlerini bildiklerini ve kabul ettiklerini beyan eder.</p>",
    "<p><strong>MADDE 3: SÖZLEŞME KONUSU ÜRÜN BİLGİLERİ</strong><br />Sipariş No: {{orderNumber}} &nbsp;|&nbsp; Sipariş Tarihi: {{orderDate}}</p>{{productList}}",
    "<p><strong>MADDE 4: BEDEL, ÖDEME VE TESLİMAT</strong><br />Ara toplam: {{subtotal}} {{currency}} — KDV (%{{vatRate}}): {{vat}} {{currency}} — <strong>Toplam (KDV dâhil): {{total}} {{currency}}</strong><br />Ödeme şekli: {{paymentMethod}}. Ürün, siparişin onaylanmasından itibaren yasal azami 30 (otuz) günlük süreyi aşmamak kaydıyla, ALICI'nın bildirdiği adrese anlaşmalı kargo firması ile teslim edilir. Teslimattan sonraki 24 saat içinde yerinde kurulum için randevu oluşturulur. ALICI, teslim sırasında paketi kontrol etmek ve hasar tespiti hâlinde kargo görevlisine tutanak tutturmakla yükümlüdür.</p>",
    "<p><strong>MADDE 5: CAYMA HAKKI</strong><br />ALICI, ürünün tesliminden itibaren 14 (on dört) gün içinde hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayabilir. Cayma bildirimi, süre dolmadan {{sellerEmail}} adresine yazılı olarak iletilir. Ürün, kutusu, aksesuarları ve faturası ile birlikte {{sellerAddress}} adresine gönderilir. Bedel, cayma bildiriminin SATICI'ya ulaşmasından itibaren 14 gün içinde ALICI'nın ödeme yaptığı şekilde iade edilir.</p>",
    "<p><strong>MADDE 6: CAYMA HAKKININ İSTİSNALARI</strong><br />Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca; ALICI'nın istekleri doğrultusunda kişiselleştirilen ürünler, ambalajı açıldığında iadesi hijyen açısından uygun olmayan sarf malzemeleri (yenilebilir mürekkep kartuşları vb.) ve çabuk bozulabilen ürünler bakımından cayma hakkı kullanılamaz. Ayrıca ALICI'nın tacir sıfatıyla, ticari veya mesleki amaçlarla hareket ettiği işlemlerde 6502 sayılı Kanun'un tüketici lehine öngördüğü hükümler uygulanmaz.</p>",
    "<p><strong>MADDE 7: TEMERRÜT HÂLİ VE HUKUKİ SONUÇLARI</strong><br />ALICI'nın kredi kartı ile yaptığı ödemelerde temerrüde düşmesi hâlinde, kart sahibi banka ile arasındaki kredi kartı sözleşmesi çerçevesinde faiz ödeyeceğini ve bankaya karşı sorumlu olacağını kabul eder. SATICI'nın teslim yükümlülüğünü yerine getirmemesi hâlinde ALICI sözleşmeyi feshedebilir; bu durumda ödenen bedel 14 gün içinde iade edilir.</p>",
    "<p><strong>MADDE 8: YETKİLİ MAHKEME</strong><br />İşbu Sözleşme'den doğan uyuşmazlıklarda, Ticaret Bakanlığı'nca her yıl Aralık ayında belirlenen parasal sınırlar dâhilinde ALICI'nın yerleşim yerinin bulunduğu veya tüketici işleminin yapıldığı yerdeki Tüketici Hakem Heyetleri, bu sınırların üzerindeki uyuşmazlıklarda ise Tüketici Mahkemeleri yetkilidir.</p>",
    "<p><strong>MADDE 9: KİŞİSEL VERİLERİN KORUNMASI</strong><br />ALICI'nın paylaştığı kişisel veriler, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, yalnızca siparişin ifası, faturalandırma, teslimat, garanti ve satış sonrası hizmetlerin yürütülmesi ile yasal saklama yükümlülüklerinin yerine getirilmesi amacıyla işlenir. Detaylı bilgi ve KVKK Md. 11 kapsamındaki haklarınızın kullanımı için Gizlilik Politikası sayfasına bakınız.</p>",
    "<p><strong>MADDE 10: YÜRÜRLÜK</strong><br />İşbu Sözleşme, ALICI tarafından elektronik ortamda okunup onaylanması ve ödemenin gerçekleşmesi ile yürürlüğe girer. Sözleşme metni, onay zamanı ve içeriği ile birlikte kayıt altına alınır; ALICI dilediğinde {{sellerEmail}} adresinden bir kopyasını talep edebilir.</p>",
].join('');

const HARDCODED_FALLBACK: CountryContract = {
    country_code: '*',
    language_code: '*',
    pre_info_title: 'Ön Bilgilendirme Formu',
    pre_info_html: TR_FALLBACK_PRE_INFO,
    distance_sales_title: 'Mesafeli Satış Sözleşmesi',
    distance_sales_html: TR_FALLBACK_DISTANCE,
};

const cache = new Map<string, CountryContract>();
const cacheKey = (c: string, l: string) => `${c.toUpperCase()}::${l.toLowerCase()}`;

function normalize(row: any): CountryContract {
    return {
        country_code: (row.country_code || '*').toUpperCase(),
        language_code: (row.language_code || '*').toLowerCase(),
        pre_info_title: row.pre_info_title ?? null,
        pre_info_html: row.pre_info_html ?? '',
        distance_sales_title: row.distance_sales_title ?? null,
        distance_sales_html: row.distance_sales_html ?? '',
        updated_at: row.updated_at,
    };
}

/** Replace {{customerName}} / {{companyName}} etc. inside the HTML body. */
export function applyContractPlaceholders(
    html: string,
    vars: Record<string, string | undefined | null>,
): string {
    if (!html) return '';
    return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        const v = vars[key];
        return v == null ? '' : String(v);
    });
}

/**
 * Sözleşme metnine yerleştirilecek tüm dinamik değerleri tek yerden toplar.
 * AI üretirken bu placeholder'ları koruyor; rezervasyon anında müşterinin
 * gerçek teklif verisi ile doldurularak hukuki delile snapshot olarak yazılır.
 */
export interface ContractVarInput {
    // Müşteri
    customerName?: string | null;
    companyName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    deliveryAddress?: string | null;
    // Satıcı (CAFEPASTE varsayılanları kullanılır; admin'den özelleştirilebilir)
    sellerName?: string;
    sellerAddress?: string;
    sellerPhone?: string;
    sellerEmail?: string;
    sellerTaxOffice?: string;
    sellerTaxNumber?: string;
    sellerMersis?: string;
    sellerWebsite?: string;
    // Sipariş
    orderNumber?: string | null;
    orderDate?: string | null;
    currency?: string;
    subtotal?: string;
    vat?: string;
    vatRate?: string;
    total?: string;
    paymentMethod?: string;
    // Ürün listesi — HTML <ul><li>... biçiminde önceden formatlanmış
    productList?: string;
}

const SELLER_DEFAULTS: Required<Pick<ContractVarInput,
    'sellerName' | 'sellerAddress' | 'sellerPhone' | 'sellerEmail' | 'sellerTaxOffice' | 'sellerTaxNumber' | 'sellerMersis' | 'sellerWebsite'
>> = {
    // Değerler src/lib/companyIdentity.ts'ten gelir — künye tek yerde tutuluyor
    // ki genel yasal sayfalar ile sözleşme metinleri asla ayrışmasın.
    sellerName: COMPANY.legalName,
    sellerAddress: COMPANY.address,
    sellerPhone: COMPANY.phone,
    sellerEmail: COMPANY.email,
    sellerTaxOffice: COMPANY.taxOffice,
    sellerTaxNumber: COMPANY.taxNumber,
    sellerMersis: COMPANY.mersis,
    sellerWebsite: COMPANY.website,
};

/** Build the full placeholder map. Missing fields fall back to '—' so the
 *  contract never shows raw "{{xxx}}" tokens to the customer. */
export function buildContractVars(input: ContractVarInput): Record<string, string> {
    const v = (x: string | null | undefined, fallback = '—'): string =>
        x == null || x === '' ? fallback : String(x);

    return {
        customerName: v(input.customerName, 'Müşteri'),
        companyName: v(input.companyName, ''),
        customerPhone: v(input.customerPhone),
        customerEmail: v(input.customerEmail),
        deliveryAddress: v(input.deliveryAddress),
        sellerName: input.sellerName || SELLER_DEFAULTS.sellerName,
        sellerAddress: input.sellerAddress || SELLER_DEFAULTS.sellerAddress,
        sellerPhone: input.sellerPhone || SELLER_DEFAULTS.sellerPhone,
        sellerEmail: input.sellerEmail || SELLER_DEFAULTS.sellerEmail,
        sellerTaxOffice: input.sellerTaxOffice || SELLER_DEFAULTS.sellerTaxOffice,
        sellerTaxNumber: input.sellerTaxNumber || SELLER_DEFAULTS.sellerTaxNumber,
        sellerMersis: input.sellerMersis || SELLER_DEFAULTS.sellerMersis,
        sellerWebsite: input.sellerWebsite || SELLER_DEFAULTS.sellerWebsite,
        orderNumber: v(input.orderNumber),
        orderDate: v(input.orderDate),
        currency: input.currency || 'TRY',
        subtotal: v(input.subtotal),
        vat: v(input.vat),
        vatRate: v(input.vatRate, '20'),
        total: v(input.total),
        paymentMethod: v(input.paymentMethod),
        productList: input.productList || '',
    };
}

/** Tüm bilinen placeholder anahtarları — admin UI'da chip olarak gösterilir +
 *  AI prompt'una enjekte edilir (model bilmesi gereken tüm tokenlar). */
export const CONTRACT_PLACEHOLDERS: { token: string; description: string }[] = [
    { token: '{{customerName}}', description: 'Müşteri adı' },
    { token: '{{companyName}}', description: 'Firma ünvanı' },
    { token: '{{customerPhone}}', description: 'Müşteri telefon' },
    { token: '{{customerEmail}}', description: 'Müşteri e-posta' },
    { token: '{{deliveryAddress}}', description: 'Teslimat adresi' },
    { token: '{{sellerName}}', description: 'Satıcı ünvanı' },
    { token: '{{sellerAddress}}', description: 'Satıcı adresi' },
    { token: '{{sellerPhone}}', description: 'Satıcı telefonu' },
    { token: '{{sellerEmail}}', description: 'Satıcı e-postası' },
    { token: '{{sellerTaxOffice}}', description: 'Satıcı vergi dairesi' },
    { token: '{{sellerTaxNumber}}', description: 'Satıcı vergi no' },
    { token: '{{sellerMersis}}', description: 'Satıcı MERSIS no' },
    { token: '{{sellerWebsite}}', description: 'Satıcı web sitesi' },
    { token: '{{orderNumber}}', description: 'Teklif/sipariş numarası' },
    { token: '{{orderDate}}', description: 'Sipariş tarihi' },
    { token: '{{currency}}', description: 'Para birimi (TRY/EUR/USD)' },
    { token: '{{subtotal}}', description: 'Ara toplam (KDV hariç)' },
    { token: '{{vat}}', description: 'KDV tutarı' },
    { token: '{{vatRate}}', description: 'KDV oranı (%)' },
    { token: '{{total}}', description: 'Toplam tutar (KDV dahil)' },
    { token: '{{paymentMethod}}', description: 'Ödeme yöntemi' },
    { token: '{{productList}}', description: 'Ürün listesi (HTML)' },
];

export const ContractsService = {
    /** Admin: list all rows. */
    async listAll(): Promise<CountryContract[]> {
        const { data, error } = await supabase
            .from('country_contracts')
            .select('*')
            .order('country_code')
            .order('language_code');
        if (error) throw error;
        const rows = (data ?? []).map(normalize);
        rows.forEach(r => cache.set(cacheKey(r.country_code, r.language_code), r));
        return rows;
    },

    /**
     * Public: best-match contract for (country, language). Walks the fallback
     * chain and never returns null — guarantees the modal can always render.
     */
    async resolve(
        countryCode: string | null | undefined,
        languageCode: string | null | undefined,
    ): Promise<CountryContract> {
        const c = (countryCode || '*').toUpperCase();
        const l = (languageCode || '*').toLowerCase();

        const candidates: [string, string][] = [
            [c, l],
            [c, '*'],
            ['*', l],
            ['*', '*'],
        ];

        for (const [cc, ll] of candidates) {
            const hit = cache.get(cacheKey(cc, ll));
            if (hit) return hit;
        }

        try {
            const uniquePairs = Array.from(new Set(candidates.map(([cc, ll]) => `${cc}::${ll}`)));
            const orFilter = uniquePairs
                .map(p => {
                    const [cc, ll] = p.split('::');
                    return `and(country_code.eq.${cc},language_code.eq.${ll})`;
                })
                .join(',');
            const { data, error } = await supabase
                .from('country_contracts')
                .select('*')
                .or(orFilter);
            if (error) throw error;
            (data ?? []).forEach(r => {
                const norm = normalize(r);
                cache.set(cacheKey(norm.country_code, norm.language_code), norm);
            });
        } catch (e) {
            console.warn('[ContractsService] fetch failed, using hardcoded fallback:', e);
        }

        for (const [cc, ll] of candidates) {
            const hit = cache.get(cacheKey(cc, ll));
            if (hit) return hit;
        }
        return HARDCODED_FALLBACK;
    },

    /** Admin: upsert. */
    async upsert(row: CountryContract): Promise<CountryContract> {
        const payload = {
            country_code: row.country_code.toUpperCase(),
            language_code: row.language_code.toLowerCase(),
            pre_info_title: row.pre_info_title ?? null,
            pre_info_html: row.pre_info_html ?? '',
            distance_sales_title: row.distance_sales_title ?? null,
            distance_sales_html: row.distance_sales_html ?? '',
            updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
            .from('country_contracts')
            .upsert(payload, { onConflict: 'country_code,language_code' })
            .select()
            .single();
        if (error) throw error;
        const saved = normalize(data);
        cache.set(cacheKey(saved.country_code, saved.language_code), saved);
        return saved;
    },

    /** Admin: delete one (country, language) pair. The '*','*' row is protected. */
    async remove(countryCode: string, languageCode: string): Promise<void> {
        const c = countryCode.toUpperCase();
        const l = languageCode.toLowerCase();
        if (c === '*' && l === '*') {
            throw new Error('Global fallback ("*","*") silinemez.');
        }
        const { error } = await supabase
            .from('country_contracts')
            .delete()
            .eq('country_code', c)
            .eq('language_code', l);
        if (error) throw error;
        cache.delete(cacheKey(c, l));
    },

    clearCache() {
        cache.clear();
    },
};
