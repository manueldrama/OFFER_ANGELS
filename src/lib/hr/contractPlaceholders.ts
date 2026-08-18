import type { HrCandidate, HrCompany, HrEmployeeWithUser, HrKpiConfig } from '../../types/hr';
import { employeeDisplayName } from '../../types/hr';
import { resolveEmployeeBonus, type BonusScaleBand } from './kpiScoring';

// İş sözleşmesi yer tutucuları.
//
// İKİ YERDE KULLANILIR:
//   1) Editörde tıklanabilir çip olarak — İK metne token ekler
//   2) AI promptunda liste olarak — model hangi tokenları kullanacağını bilir
//
// GİZLİLİK: AI'ya YALNIZCA bu token listesi gider, gerçek çalışan verisi ASLA.
// Doldurma tarayıcıda, gönderim anında yapılır (bkz. buildHrContractVars).
//
// Doldurma motoru yeniden yazılmadı: applyContractPlaceholders()
// (src/services/admin/contractsService.ts) tamamen generic ve zaten müşteri
// sözleşmelerinde çalışıyor.

export interface PlaceholderDef {
    token: string;
    description: string;
    group: 'employee' | 'bonus' | 'company';
}

export const HR_CONTRACT_PLACEHOLDERS: PlaceholderDef[] = [
    // Çalışan
    { token: 'adSoyad', description: 'Çalışanın adı soyadı', group: 'employee' },
    { token: 'tcKimlik', description: 'Kimlik / vergi numarası', group: 'employee' },
    { token: 'adres', description: 'Çalışanın adresi', group: 'employee' },
    { token: 'telefon', description: 'Çalışanın telefonu', group: 'employee' },
    { token: 'unvan', description: 'Görev / ünvan', group: 'employee' },
    { token: 'departman', description: 'Departman', group: 'employee' },
    { token: 'iseGirisTarihi', description: 'İşe giriş tarihi', group: 'employee' },
    { token: 'brutUcret', description: 'Ücret tutarı (rakam ve para birimiyle)', group: 'employee' },
    { token: 'ucretTuru', description: 'Ücretin brüt mü net mi olduğu', group: 'employee' },
    { token: 'paraBirimi', description: 'Ücret para birimi', group: 'employee' },
    { token: 'odemePeriyodu', description: 'Ödeme periyodu (aylık/günlük/saatlik)', group: 'employee' },
    { token: 'haftalikSaat', description: 'Haftalık çalışma saati', group: 'employee' },
    { token: 'mesaiBaslangic', description: 'Mesai başlangıç saati', group: 'employee' },
    { token: 'mesaiBitis', description: 'Mesai bitiş saati', group: 'employee' },
    { token: 'calismaUlkesi', description: 'Çalışma ülkesi', group: 'employee' },
    { token: 'calismaGunleri', description: 'Haftalık çalışma günleri', group: 'employee' },
    { token: 'denemeSuresi', description: 'Deneme süresi (ay)', group: 'employee' },
    { token: 'iseBaslamaTarihi', description: 'İşe başlama tarihi', group: 'employee' },
    { token: 'teklifSonTarihi', description: 'Teklife yanıt son tarihi (iş teklifi mektubu)', group: 'employee' },

    // Prim / performans
    { token: 'primTavani', description: 'Aylık maksimum performans primi', group: 'bonus' },
    { token: 'primParaBirimi', description: 'Prim para birimi', group: 'bonus' },
    { token: 'kpiEsikTablosu', description: 'KPI puanı → prim yüzdesi tablosu', group: 'bonus' },
    { token: 'kpiBilesenleri', description: 'KPI bileşenleri ve ağırlıkları', group: 'bonus' },

    // İşveren
    { token: 'sirketUnvani', description: 'İşveren unvanı', group: 'company' },
    { token: 'sirketAdresi', description: 'İşveren adresi', group: 'company' },
    { token: 'sirketVergi', description: 'Vergi dairesi / numarası', group: 'company' },
    { token: 'sirketSicilNo', description: 'Ticaret sicil / kayıt numarası', group: 'company' },
    { token: 'sozlesmeTarihi', description: 'Sözleşme düzenlenme tarihi', group: 'company' },
];

export const PLACEHOLDER_GROUP_LABELS: Record<PlaceholderDef['group'], string> = {
    employee: 'Çalışan',
    bonus: 'Prim & Performans',
    company: 'İşveren',
};

/** AI promptuna gömülecek token listesi. */
export function placeholderPromptBlock(): string {
    return HR_CONTRACT_PLACEHOLDERS
        .map(p => `{{${p.token}}} — ${p.description}`)
        .join('\n');
}

// ── Dile duyarlı biçimlendirme ───────────────────────────────────────────────
// İngilizce bir sözleşmede "12 Ağustos 2026" veya "Pazartesi, Salı" yazması
// metni amatör gösterir. Biçimlendirme sözleşmenin diline uyar.

/**
 * Sözleşme dili.
 *
 * Eskiden 'tr' | 'en' ile SINIRLIYDI; hr_companies.default_language ise
 * de/fr/es/pl döndürebiliyordu. Sonuç: Alman sözleşmesi İngilizce tarih ve
 * etiketlerle basılıyordu.
 *
 * İKİ KATMAN AYRIDIR — bilinçli:
 *   • BİÇİMLENDİRME (tarih, para) her dil için doğru yapılabilir; Intl bunu
 *     zaten biliyor. Genişletildi.
 *   • ETİKETLER (gün adı, departman, brüt/net) GERÇEK ÇEVİRİ ister. Sözlüğü
 *     olmayan dil İNGİLİZCEYE düşer — uydurma Almanca hukuki etiket yazmak,
 *     İngilizce bırakmaktan kötüdür. Sözlük eklendikçe otomatik devreye girer.
 */
type Locale = string;

/** Etiket sözlüğü OLAN diller. */
type LabelLocale = 'tr' | 'en';

const LOCALE_TAGS: Record<string, string> = {
    tr: 'tr-TR', en: 'en-GB', de: 'de-DE',
    fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pl: 'pl-PL', ar: 'ar-AE',
};

function localeTag(lang: Locale): string {
    return LOCALE_TAGS[lang] || 'en-GB';
}

/** Sözlüğü olmayan dil İngilizceye düşer (yukarıdaki nota bakınız). */
function labelLang(lang: Locale): LabelLocale {
    return lang === 'tr' ? 'tr' : 'en';
}

function fmtDate(iso: string | null | undefined, lang: Locale = 'tr'): string {
    if (!iso) return '';
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(localeTag(lang), { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtMoney(amount: number | null | undefined, currency: string, lang: Locale = 'tr'): string {
    if (amount == null) return '';
    try {
        return new Intl.NumberFormat(localeTag(lang), {
            style: 'currency', currency, maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${amount} ${currency}`;
    }
}

const DAY_NAMES: Record<LabelLocale, string[]> = {
    tr: ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
    en: ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

const PAY_PERIOD_LABELS: Record<LabelLocale, Record<string, string>> = {
    tr: { monthly: 'aylık', daily: 'günlük', hourly: 'saatlik' },
    en: { monthly: 'monthly', daily: 'daily', hourly: 'hourly' },
};

const DEPARTMENT_LABELS: Record<LabelLocale, Record<string, string>> = {
    tr: {
        sales: 'Satış', support: 'Destek', service: 'Teknik Servis',
        logistics: 'Lojistik', finance: 'Finans', management: 'Yönetim', other: 'Diğer',
    },
    en: {
        sales: 'Sales', support: 'Support', service: 'Technical Service',
        logistics: 'Logistics', finance: 'Finance', management: 'Management', other: 'Other',
    },
};

const AMOUNT_TYPE_LABELS: Record<LabelLocale, Record<string, string>> = {
    tr: { gross: 'brüt', net: 'net' },
    en: { gross: 'gross', net: 'net' },
};

/**
 * Yer tutucu değerlerini üretir.
 *
 * BOŞ BIRAKILAN alan '' döner — ham {{token}} metinde kalır ve doldurma
 * ekranında "eksik alan" olarak listelenir. Burada '—' yazılsaydı eksik veri
 * sessizce sözleşmeye girer, kimse fark etmezdi.
 */
export function buildHrContractVars(params: {
    employee?: HrEmployeeWithUser | null;
    /**
     * Aday kaynağı — iş teklifi mektubu için. Token isimleri PERSONELLE AYNI
     * kalır ({{adSoyad}}, {{brutUcret}}…), böylece tek bir şablon hem adayda
     * hem personelde çalışır. İkisi birden verilirse personel önceliklidir.
     */
    candidate?: HrCandidate | null;
    kpiConfig?: HrKpiConfig | null;
    /**
     * Kişinin ÜLKESİNDEKİ işveren. Verilmezse şirket alanları boş kalır ve
     * doldurma ekranında eksik olarak listelenir — başka bir ülkenin
     * şirketine düşmek, sözleşmeye yanlış tüzel kişilik yazmaktır.
     */
    company?: HrCompany | null;
    contractDate?: Date;
    /** Teklife yanıt son tarihi (YYYY-MM-DD) — {{teklifSonTarihi}}. */
    responseDeadline?: string | null;
}): Record<string, string> {
    const {
        employee, candidate, kpiConfig, company,
        contractDate = new Date(), responseDeadline,
    } = params;
    const comp = employee?.current_compensation ?? null;

    // Biçimlendirme dili işverenin diline uyar; tanımlı değilse ülkeye bakılır.
    const country = employee?.work_country ?? candidate?.work_country ?? null;
    // Biçimlendirme dili işverenin dilidir; tanımlı değilse ülkeye bakılır.
    const lang: Locale = company?.default_language || (country === 'TR' ? 'tr' : 'en');
    const L = labelLang(lang);
    const DAYS = DAY_NAMES[L];
    const PERIODS = PAY_PERIOD_LABELS[L];
    const DEPTS = DEPARTMENT_LABELS[L];

    const salaryCurrency = employee
        ? (comp?.currency || employee.salary_currency || 'TRY')
        : (candidate?.offered_currency || candidate?.expected_currency || 'TRY');

    // Ücret: personelde yürürlükteki ücret, adayda TEKLİF EDİLEN tutar.
    // Adayın kendi beklentisi (expected_salary) BİLEREK kullanılmaz — teklif
    // mektubuna adayın istediği rakamı yazmak, şirketin teklifini kaybetmektir.
    const salaryAmount = employee ? (comp?.base_amount ?? null) : (candidate?.offered_salary ?? null);

    const vars: Record<string, string> = {
        adSoyad: employee ? employeeDisplayName(employee) : (candidate?.full_name ?? ''),
        tcKimlik: employee?.national_id ?? '',
        adres: employee?.address ?? '',
        telefon: employee?.phone ?? candidate?.phone ?? '',
        unvan: employee?.job_title ?? candidate?.position_title ?? '',
        departman: (() => {
            const d = employee?.department ?? candidate?.department ?? null;
            return d ? (DEPTS[d] ?? d) : '';
        })(),
        iseGirisTarihi: fmtDate(employee?.hire_date ?? candidate?.offered_start_date, lang),
        iseBaslamaTarihi: fmtDate(candidate?.offered_start_date ?? employee?.hire_date, lang),
        teklifSonTarihi: fmtDate(responseDeadline, lang),
        brutUcret: fmtMoney(salaryAmount, salaryCurrency, lang),
        // Token adı geçmişten "brutUcret" kaldı ama tutar net de olabilir;
        // metinde hangisi olduğu AÇIKÇA yazılsın diye ayrı token var.
        ucretTuru: AMOUNT_TYPE_LABELS[L][
            (employee ? (comp?.amount_type ?? 'gross') : (candidate?.offered_amount_type ?? 'gross'))
        ],
        paraBirimi: salaryCurrency,
        // Adayda ücret periyodu ayrı tutulmaz; teklif edilen tutar aylık brüttür
        // (hr_compensation varsayılanıyla aynı kabul).
        odemePeriyodu: comp?.pay_period
            ? (PERIODS[comp.pay_period] ?? comp.pay_period)
            : (candidate ? PERIODS.monthly : ''),
        haftalikSaat: employee?.weekly_hours != null ? `${employee.weekly_hours}` : '',
        mesaiBaslangic: employee?.shift_start?.slice(0, 5) ?? '',
        mesaiBitis: employee?.shift_end?.slice(0, 5) ?? '',
        calismaUlkesi: country ?? '',
        calismaGunleri: (employee?.work_days ?? [])
            .filter(d => d >= 1 && d <= 7).map(d => DAYS[d]).join(', '),
        denemeSuresi: employee?.probation_months != null
            ? (lang === 'tr' ? `${employee.probation_months} ay` : `${employee.probation_months} months`)
            : '',

        // Şirket bilgisi artık kişinin ÜLKESİNDEKİ işverenden gelir.
        // kpiConfig'teki eski global alanlar 20260821a ile terk edildi.
        sirketUnvani: company?.legal_name ?? '',
        sirketAdresi: company?.address ?? '',
        sirketVergi: company?.tax_info ?? '',
        sirketSicilNo: company?.registration_no ?? '',
        sozlesmeTarihi: fmtDate(contractDate.toISOString().slice(0, 10), lang),

        primTavani: '',
        primParaBirimi: '',
        kpiEsikTablosu: '',
        kpiBilesenleri: '',
    };

    if (kpiConfig) {
        // Zincir: kişiye özel → ülke → global — ekran, prim hesabı ve sözleşme
        // aynı fonksiyondan geçsin ki üç yerde üç farklı rakam çıkmasın.
        // company satırı dil çözümü için zaten elimizde; ülke bonusu da ondan
        // gelir (kur = ülkenin default_currency'si, 20260901a).
        const { maxBonus, currency } = resolveEmployeeBonus(employee ?? null, kpiConfig,
            company ? {
                max_monthly_bonus: company.max_monthly_bonus ?? null,
                currency: company.default_currency ?? null,
            } : null);
        if (maxBonus > 0) {
            vars.primTavani = fmtMoney(maxBonus, currency);
            vars.primParaBirimi = currency;
        }

        const scale = (kpiConfig.bonus_scale ?? []) as BonusScaleBand[];
        if (scale.length > 0) {
            vars.kpiEsikTablosu = [...scale]
                .sort((a, b) => a.min - b.min)
                .map(b => `${b.min}–${b.max} puan: %${b.pct}`)
                .join('; ');
        }

        vars.kpiBilesenleri = [
            ['Lead → Satış Dönüşümü', kpiConfig.weight_conversion],
            ['Takip Uyumu', kpiConfig.weight_followup],
            ['Öncelikli Lead Kapsamı', kpiConfig.weight_priority],
            ['İlk Temas SLA', kpiConfig.weight_sla],
            ['CRM Bütünlüğü', kpiConfig.weight_crm],
            ['Mesai Doluluğu', kpiConfig.weight_activity],
        ].filter(([, w]) => Number(w) > 0)
            .map(([label, w]) => `${label} (${w} puan)`)
            .join(', ');
    }

    return vars;
}

/**
 * Metni doldurur ve doldurulamayanları bildirir.
 *
 * Müşteri sözleşmelerindeki applyContractPlaceholders() BİLEREK kullanılmadı:
 * o, değeri olmayan token'ı boş dizeyle değiştirir. İş sözleşmesinde bu, "T.C.
 * kimlik: ____" yerine hiç görünmeyen bir boşluk demektir — eksik veri fark
 * edilmeden imzaya gider. Burada token yerinde BIRAKILIR ve listelenir.
 */
export function fillContractPlaceholders(
    html: string,
    vars: Record<string, string>,
): { html: string; missing: PlaceholderDef[] } {
    if (!html) return { html: '', missing: [] };

    const missingTokens = new Set<string>();
    const filled = html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (raw, key: string) => {
        const v = vars[key];
        if (v == null || v === '') {
            missingTokens.add(key);
            return raw;
        }
        return v;
    });

    // Bilinen token'ları tanımlı sırayla, tanınmayanları sonda döndür.
    const known = HR_CONTRACT_PLACEHOLDERS.filter(p => missingTokens.has(p.token));
    const knownSet = new Set(known.map(p => p.token));
    const unknown: PlaceholderDef[] = [...missingTokens]
        .filter(t => !knownSet.has(t))
        .map(t => ({ token: t, description: 'Tanınmayan yer tutucu', group: 'employee' as const }));

    return { html: filled, missing: [...known, ...unknown] };
}

/** Metinde doldurulmadan kalan token'lar — gönderimden önce uyarmak için. */
export function findUnfilledPlaceholders(html: string): PlaceholderDef[] {
    if (!html) return [];
    const found = new Set<string>();
    for (const m of html.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
        found.add(m[1]);
    }
    return HR_CONTRACT_PLACEHOLDERS.filter(p => found.has(p.token));
}

/**
 * AI çıktısı denetimi: model yer tutucuları doldurup uydurma isim/tutar yazmış
 * olabilir. Hiç token içermeyen bir çıktı bunun güçlü işaretidir.
 */
export function countPlaceholders(html: string): number {
    if (!html) return 0;
    return [...html.matchAll(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g)].length;
}
