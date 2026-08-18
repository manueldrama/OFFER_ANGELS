// CAFEPASTE'i işleten tüzel kişiliğin yasal künyesi — TEK KAYNAK.
//
// Neden ayrı bir modül:
//   Bu bilgi iki ayrı yüzeyde birden kullanılıyor —
//     1) genel erişime açık yasal sayfalar (mesafeli satış, ön bilgilendirme,
//        iade, teslimat, gizlilik, kurumsal iletişim),
//     2) sözleşme motoru ({{sellerName}}, {{sellerAddress}} … placeholder'larını
//        dolduran services/admin/contractsService).
//   Daha önce yalnızca contractsService içine gömülüydü; genel sayfaların bir
//   admin servisini import etmesi gerekiyordu. Künye buraya alınınca her iki
//   taraf da aynı değerden besleniyor ve tek yerden güncelleniyor.
//
// ÖNEMLİ: Boş bırakılan alanlar (MERSIS, ticaret sicil) hiçbir yerde render
// EDİLMEZ — renderIdentityRows() boşları atlar. Değerler elde edilince sadece
// bu dosyayı doldurmak yeterli; sayfalar ve sözleşmeler otomatik güncellenir.

export interface CompanyIdentity {
    /** Ticaret unvanı — sözleşmelerde SATICI olarak geçen tüzel kişilik. */
    legalName: string;
    /** Markanın kendisi. Tüzel kişilikle aynı değil. */
    brandName: string;
    address: string;
    phone: string;
    email: string;
    taxOffice: string;
    taxNumber: string;
    /** Mesafeli Sözleşmeler Yönetmeliği gereği zorunlu. Boşsa gösterilmez. */
    mersis: string;
    /** Opsiyonel künye bilgisi. Boşsa gösterilmez. */
    tradeRegistryNo: string;
    website: string;
}

export const COMPANY: CompanyIdentity = {
    legalName: 'MAGLEV ELEKTRONİK İTH. İHR. SAN. TİC. LTD. ŞTİ',
    brandName: 'CAFEPASTE',
    address: 'Adalet Mah. Manas Bulvarı No:47 Folkart Towers A Kule Kat:35 No:3509 İzmir / Bayraklı',
    phone: '+90 850 850 50 40',
    email: 'maglev@maglev.com.tr',
    taxOffice: 'Karşıyaka VD.',
    taxNumber: '6100427251',
    // TODO: Değerler alınınca doldurulacak. Boş kaldığı sürece ilgili satır
    // hiçbir sayfada görünmez; sözleşmelerde de boş string olarak geçer.
    mersis: '',
    tradeRegistryNo: '',
    website: 'https://cafepaste.com',
};

/** İade gönderimlerinin yapılacağı adres. Şu an merkez adresle aynı; ayrı bir
 *  iade deposu tanımlanırsa yalnızca burası değişir. */
export const RETURN_ADDRESS = COMPANY.address;

/** Anlaşmalı kargo firması — teslimat ve iade sayfalarında referans verilir. */
export const SHIPPING_CARRIER = 'Yurtiçi Kargo';

/** Cihazlar için verilen garanti süresi (yıl). */
export const WARRANTY_YEARS = 2;

/** Mesafeli satışta yasal cayma süresi (gün). */
export const WITHDRAWAL_DAYS = 14;

/** Mevzuatın öngördüğü azami teslim süresi (gün). */
export const MAX_DELIVERY_DAYS = 30;

export interface IdentityRow {
    label: string;
    value: string;
}

/**
 * Künyeyi etiket/değer satırlarına çevirir. Boş alanlar (MERSIS, ticaret sicil
 * gibi henüz doldurulmamış olanlar) listeden düşer — böylece sayfalarda
 * "MERSIS No: —" gibi eksik görünen satırlar oluşmaz.
 */
export function renderIdentityRows(): IdentityRow[] {
    const rows: IdentityRow[] = [
        { label: 'Unvan', value: COMPANY.legalName },
        { label: 'Adres', value: COMPANY.address },
        { label: 'Telefon', value: COMPANY.phone },
        { label: 'E-posta', value: COMPANY.email },
        { label: 'Vergi Dairesi', value: COMPANY.taxOffice },
        { label: 'Vergi No', value: COMPANY.taxNumber },
        { label: 'MERSIS No', value: COMPANY.mersis },
        { label: 'Ticaret Sicil No', value: COMPANY.tradeRegistryNo },
        { label: 'Web Sitesi', value: COMPANY.website },
    ];
    return rows.filter((r) => r.value.trim() !== '');
}
