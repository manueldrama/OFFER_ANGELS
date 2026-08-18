import { Product, Accessory, OfferExperience, CatalogProduct, PricingRule, ProductDetailSection, MarketPaymentSettings, CountryPaymentSettings } from '../types';
import { supabase } from '../lib/supabase/client';
import { PricingResolutionService } from './admin/pricingResolutionService';
import { MarketPaymentSettingsService } from './admin/marketPaymentSettingsService';
import { CountryPaymentSettingsService } from './admin/countryPaymentSettingsService';
import i18n, { getDefaultMarketForLanguage } from '../i18n';
import { getCountryForLanguage, getCountryByCode, getCountryByPhone } from '../utils/countries';
import { computeOfferExpiry } from '../lib/offerExpiry';
import { deriveOfferPrice } from '../lib/pricingRules';
import { OfferDisplayPrefs, parseOfferDisplayPrefs } from '../lib/offerDisplayPrefs';

/**
 * Override section/item texts using i18n cache (translations table 'products' ns).
 * This is the bridge between the structural DB rows and i18n-driven instant
 * language switching: structure comes from DB (sections/items, sort_order, media),
 * but text fields (title/description/etc.) come from t() lookups so language
 * switch is purely in-memory.
 *
 * Ensures the 'products' namespace is loaded for the requested language before
 * doing any t() lookups. Falls back to the DB row's text if no translation found.
 */
async function applyI18nToSections(sections: ProductDetailSection[], languageCode: string): Promise<ProductDetailSection[]> {
    if (sections.length === 0) return sections;
    try {
        await i18n.loadNamespaces('products');
        await i18n.loadLanguages([languageCode]);
    } catch { /* network blip — fall back to DB values */ }

    const tx = (key: string, fallback?: string | null) => {
        const val = i18n.getResource(languageCode, 'products', key) as string | undefined;
        return (val && val.trim()) || fallback || null;
    };

    return sections.map(sec => {
        const pid = String((sec as any).product_id);
        const stype = sec.section_type;
        const prefix = `${pid}.${stype}`;
        const merged: ProductDetailSection = {
            ...sec,
            title: tx(`${prefix}.config.title`, sec.title) as any,
            eyebrow: tx(`${prefix}.config.eyebrow`, (sec as any).eyebrow) as any,
            items: (sec.items || []).map(it => ({
                ...it,
                title: tx(`${prefix}.${it.id}.title`, it.title) as any,
                description: tx(`${prefix}.${it.id}.description`, it.description) as any,
                value_text: tx(`${prefix}.${it.id}.value_text`, it.value_text) as any,
                sub_text: tx(`${prefix}.${it.id}.sub_text`, (it as any).sub_text) as any,
                icon_value: tx(`${prefix}.${it.id}.icon_value`, (it as any).icon_value) as any,
            })),
        };
        return merged;
    });
}

export interface LeadInfo {
    id?: string;
    customerName: string;
    companyName: string;
    companyNumber?: string;
    phoneNumber?: string;
    email?: string;
}

export interface OfferContextData {
    token: string;
    lead: LeadInfo;
    campaignInfo: {
        /** Linkte gerçek bir kampanya var mı? false ise diğer alanlar fallback
         *  varsayılanlardır — müşteri UI'ı lansman/kontenjan iddiası GÖSTERMEMELİ. */
        hasCampaign: boolean;
        name: string;
        discountRate: number;
        validUntil: string;
        /** Etkin link son kullanma tarihi (ISO). Müşteri tarafı expiry hesabı için tek otorite —
         * formatlanmış `validUntil`'i parse etmek yerine bunu kullan. */
        validUntilRaw: string | null;
        maxOfferValidityDays: number;
        offerNumber: string;
        capacityPercentage: number;
        batchNumber: string;
        estimatedDelivery: string;
        depositPercentage: number;
        depositLockDays: number;
        depositExtensionDays: number;
    };
    products: Product[];
    accessories: Accessory[];
    experience: OfferExperience;
    /** Market code from offer link or campaign (e.g. 'TR', 'EU', 'GB') */
    marketCode?: string;
    /** ISO country code (e.g. 'IT', 'PL') — drives VAT and currency. */
    countryCode?: string | null;
    /** Language code from offer link or campaign (e.g. 'tr', 'en', 'de') */
    languageCode?: string;
    /**
     * Country-resolved payment settings (gateway, options, per-method admin config,
     * VAT, WhatsApp, min order). Falls back to country defaults from countries.ts
     * when no DB row exists.
     */
    paymentSettings?: CountryPaymentSettings | MarketPaymentSettings;
    /**
     * Süresi dolan teklif linki açıldığında true. Müşteri-tarafı normal model
     * seçim → konfigüratör → "Fiyat Al" akışını izler AMA submit noktasında
     * customer_reservations.insert yerine /api/offer/reclaim-request çağrılır
     * (admin onayı şart). Guest token'larda ve aktif tekliflerde false.
     */
    isExpiredRecovery?: boolean;
    /**
     * isExpiredRecovery'nin alt-türü: link 'pending_review' durumunda, yani
     * teklif oluşturulurken ortada GEÇERLİ aktif kampanya yoktu (yok veya süresi
     * dolmuş). Müşteri "süresi doldu" DEĞİL "teklifiniz hazırlanıyor" mesajını
     * görmeli. Submit yine /api/offer/reclaim-request'e gider (admin onayı).
     */
    isAwaitingCampaign?: boolean;
    /** offer_links.created_at — teklifin GERÇEK oluşturulma tarihi (ISO).
     *  Reclaim modal'ında "X tarihinde paylaştığımız teklif" için kullanılır.
     *  validUntilRaw (expiry) ile karıştırma. */
    offerCreatedAt?: string | null;
    /** offer_links.offer_snapshot.display — admin'in teklif oluştururken seçtiği
     *  görünüm tercihleri. null/yok ise render tarafı deriveOfferDisplayDefaults
     *  ile otomatik türetir. */
    displayPrefs?: OfferDisplayPrefs | null;
}

export interface OfferContextResponse {
    data: OfferContextData | null;
    error: 'invalid' | 'expired' | null;
}

export const DEFAULT_PAYMENT_OPTIONS = [
    { id: 'pre-payment' as const, label: '%{ppDeposit} Ödeme ile Rezerve Et', sublabel: '₺{on_odeme} Ön Rezervasyon · {ppLockDays} gün fiyat garantisi', enabled: true, sort_order: 0 },
    { id: 'credit-card' as const, label: 'Tek Çekim', sublabel: 'Kredi kartı ile anında ödeme · Toplam ₺{ccTotal}', enabled: true, sort_order: 1 },
    { id: 'installment-3' as const, label: '3 Taksit', sublabel: 'Dengeli plan · Ayda ₺{taksit3}', enabled: true, sort_order: 2, interest_rate: 9.25 },
    { id: 'installment-6' as const, label: '6 Taksit', sublabel: 'Esnek vade · Ayda ₺{taksit6}', enabled: true, sort_order: 3, interest_rate: 16.37 },
    { id: 'installment-12' as const, label: '12 Taksit', sublabel: 'Uzun vade · Ayda ₺{taksit12}', enabled: true, sort_order: 4, interest_rate: 25 },
    { id: 'bank-transfer' as const, label: 'Havale / EFT', sublabel: '%{btDiscount} Ek İndirim Avantajı', enabled: true, sort_order: 5 },
];

export const DEFAULT_PAYMENT_OPTIONS_EN = [
    { id: 'pre-payment' as const, label: 'Reserve with {ppDeposit}% Deposit', sublabel: '{on_odeme} Reservation Deposit · {ppLockDays}-day price guarantee', enabled: true, sort_order: 0 },
    { id: 'credit-card' as const, label: 'Single Charge', sublabel: 'Instant credit card payment · Total {ccTotal}', enabled: true, sort_order: 1 },
    { id: 'installment-3' as const, label: '3 Installments', sublabel: 'Balanced plan · {taksit3}/month', enabled: true, sort_order: 2, interest_rate: 9.25 },
    { id: 'installment-6' as const, label: '6 Installments', sublabel: 'Flexible term · {taksit6}/month', enabled: true, sort_order: 3, interest_rate: 16.37 },
    { id: 'installment-12' as const, label: '12 Installments', sublabel: 'Long term · {taksit12}/month', enabled: true, sort_order: 4, interest_rate: 25 },
    { id: 'bank-transfer' as const, label: 'Bank Transfer', sublabel: '{btDiscount}% Extra Discount', enabled: true, sort_order: 5 },
];

export const DEFAULT_PAYMENT_OPTIONS_DE = [
    { id: 'pre-payment' as const, label: 'Mit {ppDeposit}% Anzahlung reservieren', sublabel: '{on_odeme} Reservierungsanzahlung · {ppLockDays} Tage Preisgarantie', enabled: true, sort_order: 0 },
    { id: 'credit-card' as const, label: 'Einmalzahlung', sublabel: 'Sofortzahlung mit Kreditkarte · Gesamt {ccTotal}', enabled: true, sort_order: 1 },
    { id: 'installment-3' as const, label: '3 Raten', sublabel: 'Ausgewogener Plan · {taksit3}/Monat', enabled: true, sort_order: 2, interest_rate: 9.25 },
    { id: 'installment-6' as const, label: '6 Raten', sublabel: 'Flexible Laufzeit · {taksit6}/Monat', enabled: true, sort_order: 3, interest_rate: 16.37 },
    { id: 'installment-12' as const, label: '12 Raten', sublabel: 'Lange Laufzeit · {taksit12}/Monat', enabled: true, sort_order: 4, interest_rate: 25 },
    { id: 'bank-transfer' as const, label: 'Banküberweisung', sublabel: '{btDiscount}% Extra-Rabatt', enabled: true, sort_order: 5 },
];

export const DEFAULT_PAYMENT_OPTIONS_FR = [
    { id: 'pre-payment' as const, label: 'Réserver avec {ppDeposit}% d\'acompte', sublabel: '{on_odeme} Acompte de réservation · garantie prix {ppLockDays} jours', enabled: true, sort_order: 0 },
    { id: 'credit-card' as const, label: 'Paiement comptant', sublabel: 'Paiement instantané par carte · Total {ccTotal}', enabled: true, sort_order: 1 },
    { id: 'installment-3' as const, label: '3 mensualités', sublabel: 'Plan équilibré · {taksit3}/mois', enabled: true, sort_order: 2, interest_rate: 9.25 },
    { id: 'installment-6' as const, label: '6 mensualités', sublabel: 'Échéance flexible · {taksit6}/mois', enabled: true, sort_order: 3, interest_rate: 16.37 },
    { id: 'installment-12' as const, label: '12 mensualités', sublabel: 'Longue échéance · {taksit12}/mois', enabled: true, sort_order: 4, interest_rate: 25 },
    { id: 'bank-transfer' as const, label: 'Virement bancaire', sublabel: '{btDiscount}% de réduction supplémentaire', enabled: true, sort_order: 5 },
];

export const DEFAULT_PAYMENT_OPTIONS_ES = [
    { id: 'pre-payment' as const, label: 'Reservar con {ppDeposit}% de anticipo', sublabel: '{on_odeme} Depósito de reserva · garantía de precio {ppLockDays} días', enabled: true, sort_order: 0 },
    { id: 'credit-card' as const, label: 'Pago único', sublabel: 'Pago instantáneo con tarjeta · Total {ccTotal}', enabled: true, sort_order: 1 },
    { id: 'installment-3' as const, label: '3 cuotas', sublabel: 'Plan equilibrado · {taksit3}/mes', enabled: true, sort_order: 2, interest_rate: 9.25 },
    { id: 'installment-6' as const, label: '6 cuotas', sublabel: 'Plazo flexible · {taksit6}/mes', enabled: true, sort_order: 3, interest_rate: 16.37 },
    { id: 'installment-12' as const, label: '12 cuotas', sublabel: 'Plazo largo · {taksit12}/mes', enabled: true, sort_order: 4, interest_rate: 25 },
    { id: 'bank-transfer' as const, label: 'Transferencia bancaria', sublabel: '{btDiscount}% de descuento extra', enabled: true, sort_order: 5 },
];

function getPaymentOptionsForLanguage(lang: string) {
    switch (lang) {
        case 'en': return DEFAULT_PAYMENT_OPTIONS_EN;
        case 'de': return DEFAULT_PAYMENT_OPTIONS_DE;
        case 'fr': return DEFAULT_PAYMENT_OPTIONS_FR;
        case 'es': return DEFAULT_PAYMENT_OPTIONS_ES;
        default: return DEFAULT_PAYMENT_OPTIONS;
    }
}

export const DEFAULT_OFFER_EXPERIENCE: OfferExperience = {
    language_code: 'tr',
    hero_title: 'Teklif oluşturmak için model seçin',
    hero_subtitle: 'Modeli seçin; paket içeriği ve fiyatlandırma otomatik olarak oluşturulsun',
    tab_models_label: 'Cihaz Seçimi',
    tab_summary_label: 'Teklif Özeti',
    tab_support_label: 'Destek',
    card_shipping_label: 'ÜCRETSİZ',
    card_shipping_value: 'Hızlı',
    card_shipping_status: 'Kargo',
    card_capacity_label: 'AYLIK YÜKSEK',
    card_capacity_value: 'Kapasite',
    card_capacity_status: 'Garantili',
    card_delivery_label: 'TÜM TÜRKİYE\'YE',
    card_delivery_value: 'Kurulum',
    card_delivery_status: 'Desteği',
    cta_primary: 'Bu Cihaz İçin Teklif Oluştur',
    cta_secondary: 'Cihazı İncele',
    cta_payment: 'Ödemeye Geç',
    support_helper_text: 'Kurulum ve kullanım ile ilgili kafanıza takılan tüm sorular için bize ulaşabilirsiniz.',
    support_disclaimer_text: 'Ürünlerimiz 2 yıl resmi distribütör garantisi altındadır. Ödeme işleminizin ardından ekibimiz iletişime geçecektir.',
    badge_text: 'Sadece Size Özel Teklif',
    payment_options: DEFAULT_PAYMENT_OPTIONS,
    final_offer_title: 'Size Özel Teklif Hazır!',
    final_offer_description: 'Seçtiğiniz ürünler için özel lansman avantajı uygulandı.',
    final_offer_subtotal_label: 'Ara Toplam',
    final_offer_discount_label: 'Lansman Avantajı',
    final_offer_total_label: 'Ödenecek Toplam Tutar',
    final_offer_confirm_button: 'Teklifi Onayla ve Rezerve Et',
    final_offer_reservation_title: 'Rezervasyon Seçeneği',
    final_offer_trust_badge: 'Size Özel Lansman Teklifimiz',
    final_offer_demand_title: 'Bu hafta yoğun talep var',
    final_offer_demand_subtitle: 'işletme cihazını rezerve etti',
    info_strip_launch_label: 'Lansman\nDönemi',
    info_strip_launch_value: 'Mayıs 2026',
    info_strip_capacity_label: 'Kontenjan',
    info_strip_shipping_label: 'Türkiye\nGeneli',
    info_strip_shipping_value: 'Ücretsiz',
    info_strip_delivery_value: 'Mayıs 2026',
    deposit_badge_label: 'Kapora Ödendi',
    deposit_price_updated_label: 'Fiyat Güncellendi',
    deposit_expired_label: 'Süre Doldu',
    deposit_pay_button: 'Kalanı Öde',
    deposit_pay_updated_button: 'Güncel Fiyattan Öde',
    deposit_expired_message: 'Ödeme süresi dolmuştur',
    deposit_expired_submessage: 'Kaporanız iade edilmeyecektir. Yeniden sipariş vermek için danışmanınızla iletişime geçin.',
    deposit_countdown_text: 'Ödeme için {days} gün kaldı',
    deposit_fomo_reapply_text: 'Yeniden Başvur',
};

const DEFAULT_OFFER_EXPERIENCE_EN: OfferExperience = {
    language_code: 'en',
    hero_title: 'Select a model to create your offer',
    hero_subtitle: 'Choose your model and the package contents and pricing will be generated automatically',
    tab_models_label: 'Device Selection',
    tab_summary_label: 'Offer Summary',
    tab_support_label: 'Support',
    card_shipping_label: 'FREE',
    card_shipping_value: 'Express',
    card_shipping_status: 'Shipping',
    card_capacity_label: 'HIGH MONTHLY',
    card_capacity_value: 'Capacity',
    card_capacity_status: 'Guaranteed',
    card_delivery_label: 'NATIONWIDE',
    card_delivery_value: 'Installation',
    card_delivery_status: 'Support',
    cta_primary: 'Create Offer for This Device',
    cta_secondary: 'View Device',
    cta_payment: 'Proceed to Payment',
    support_helper_text: 'Contact us for any questions about installation and usage.',
    support_disclaimer_text: 'Our products come with a 2-year official distributor warranty. Our team will contact you after your payment is processed.',
    badge_text: 'Exclusive Offer Just for You',
    payment_options: DEFAULT_PAYMENT_OPTIONS_EN,
    final_offer_title: 'Your Exclusive Offer is Ready!',
    final_offer_description: 'Special launch advantages have been applied for your selected products.',
    final_offer_subtotal_label: 'Subtotal',
    final_offer_discount_label: 'Launch Advantage',
    final_offer_total_label: 'Total Amount Due',
    final_offer_confirm_button: 'Confirm Offer & Reserve',
    final_offer_reservation_title: 'Reservation Option',
    final_offer_trust_badge: 'Your Exclusive Launch Offer',
    final_offer_demand_title: 'High demand this week',
    final_offer_demand_subtitle: 'businesses reserved their device',
    info_strip_launch_label: 'Launch\nPeriod',
    info_strip_launch_value: 'May 2026',
    info_strip_capacity_label: 'Capacity',
    info_strip_shipping_label: 'Nationwide',
    info_strip_shipping_value: 'Free',
    info_strip_delivery_value: 'May 2026',
    deposit_badge_label: 'Deposit Paid',
    deposit_price_updated_label: 'Price Updated',
    deposit_expired_label: 'Expired',
    deposit_pay_button: 'Pay Remaining',
    deposit_pay_updated_button: 'Pay at Updated Price',
    deposit_expired_message: 'Payment period has expired',
    deposit_expired_submessage: 'Your deposit will not be refunded. Please contact your advisor to place a new order.',
    deposit_countdown_text: '{days} days left to pay',
    deposit_fomo_reapply_text: 'Reapply',
};

const DEFAULT_OFFER_EXPERIENCE_DE: OfferExperience = {
    language_code: 'de',
    hero_title: 'Wählen Sie ein Modell für Ihr Angebot',
    hero_subtitle: 'Wählen Sie Ihr Modell – Paketinhalt und Preisgestaltung werden automatisch erstellt',
    tab_models_label: 'Geräteauswahl',
    tab_summary_label: 'Angebotsübersicht',
    tab_support_label: 'Support',
    card_shipping_label: 'KOSTENLOS',
    card_shipping_value: 'Express',
    card_shipping_status: 'Versand',
    card_capacity_label: 'HOHE MONATLICHE',
    card_capacity_value: 'Kapazität',
    card_capacity_status: 'Garantiert',
    card_delivery_label: 'DEUTSCHLANDWEIT',
    card_delivery_value: 'Installation',
    card_delivery_status: 'Support',
    cta_primary: 'Angebot für dieses Gerät erstellen',
    cta_secondary: 'Gerät ansehen',
    cta_payment: 'Zur Zahlung',
    support_helper_text: 'Kontaktieren Sie uns bei Fragen zu Installation und Nutzung.',
    support_disclaimer_text: 'Unsere Produkte haben eine 2-jährige offizielle Händlergarantie. Unser Team kontaktiert Sie nach Zahlungseingang.',
    badge_text: 'Exklusives Angebot nur für Sie',
    payment_options: DEFAULT_PAYMENT_OPTIONS_DE,
    final_offer_title: 'Ihr exklusives Angebot ist fertig!',
    final_offer_description: 'Besondere Einführungsvorteile wurden auf Ihre ausgewählten Produkte angewendet.',
    final_offer_subtotal_label: 'Zwischensumme',
    final_offer_discount_label: 'Einführungsvorteil',
    final_offer_total_label: 'Gesamtbetrag',
    final_offer_confirm_button: 'Angebot bestätigen & reservieren',
    final_offer_reservation_title: 'Reservierungsoption',
    final_offer_trust_badge: 'Ihr exklusives Einführungsangebot',
    final_offer_demand_title: 'Hohe Nachfrage diese Woche',
    final_offer_demand_subtitle: 'Unternehmen haben ihr Gerät reserviert',
    info_strip_launch_label: 'Einführungs-\nzeitraum',
    info_strip_launch_value: 'Mai 2026',
    info_strip_capacity_label: 'Kontingent',
    info_strip_shipping_label: 'Deutschlandweit',
    info_strip_shipping_value: 'Kostenlos',
    info_strip_delivery_value: 'Mai 2026',
    deposit_badge_label: 'Anzahlung geleistet',
    deposit_price_updated_label: 'Preis aktualisiert',
    deposit_expired_label: 'Abgelaufen',
    deposit_pay_button: 'Restbetrag zahlen',
    deposit_pay_updated_button: 'Zum aktualisierten Preis zahlen',
    deposit_expired_message: 'Zahlungsfrist abgelaufen',
    deposit_expired_submessage: 'Ihre Anzahlung wird nicht erstattet. Bitte kontaktieren Sie Ihren Berater für eine neue Bestellung.',
    deposit_countdown_text: 'Noch {days} Tage zur Zahlung',
    deposit_fomo_reapply_text: 'Erneut bewerben',
};

const DEFAULT_OFFER_EXPERIENCE_FR: OfferExperience = {
    language_code: 'fr',
    hero_title: 'Sélectionnez un modèle pour créer votre offre',
    hero_subtitle: 'Choisissez votre modèle – le contenu du pack et les tarifs seront générés automatiquement',
    tab_models_label: 'Sélection d\'appareil',
    tab_summary_label: 'Résumé de l\'offre',
    tab_support_label: 'Support',
    card_shipping_label: 'GRATUIT',
    card_shipping_value: 'Express',
    card_shipping_status: 'Livraison',
    card_capacity_label: 'CAPACITÉ MENSUELLE',
    card_capacity_value: 'Élevée',
    card_capacity_status: 'Garantie',
    card_delivery_label: 'NATIONAL',
    card_delivery_value: 'Installation',
    card_delivery_status: 'Support',
    cta_primary: 'Créer une offre pour cet appareil',
    cta_secondary: 'Voir l\'appareil',
    cta_payment: 'Passer au paiement',
    support_helper_text: 'Contactez-nous pour toute question concernant l\'installation et l\'utilisation.',
    support_disclaimer_text: 'Nos produits bénéficient d\'une garantie distributeur officiel de 2 ans. Notre équipe vous contactera après le traitement de votre paiement.',
    badge_text: 'Offre exclusive rien que pour vous',
    payment_options: DEFAULT_PAYMENT_OPTIONS_FR,
    final_offer_title: 'Votre offre exclusive est prête !',
    final_offer_description: 'Des avantages de lancement spéciaux ont été appliqués à vos produits sélectionnés.',
    final_offer_subtotal_label: 'Sous-total',
    final_offer_discount_label: 'Avantage lancement',
    final_offer_total_label: 'Montant total dû',
    final_offer_confirm_button: 'Confirmer l\'offre et réserver',
    final_offer_reservation_title: 'Option de réservation',
    final_offer_trust_badge: 'Votre offre de lancement exclusive',
    final_offer_demand_title: 'Forte demande cette semaine',
    final_offer_demand_subtitle: 'entreprises ont réservé leur appareil',
    info_strip_launch_label: 'Période\nde lancement',
    info_strip_launch_value: 'Mai 2026',
    info_strip_capacity_label: 'Capacité',
    info_strip_shipping_label: 'National',
    info_strip_shipping_value: 'Gratuit',
    info_strip_delivery_value: 'Mai 2026',
    deposit_badge_label: 'Acompte payé',
    deposit_price_updated_label: 'Prix mis à jour',
    deposit_expired_label: 'Expiré',
    deposit_pay_button: 'Payer le solde',
    deposit_pay_updated_button: 'Payer au prix mis à jour',
    deposit_expired_message: 'La période de paiement a expiré',
    deposit_expired_submessage: 'Votre acompte ne sera pas remboursé. Veuillez contacter votre conseiller pour passer une nouvelle commande.',
    deposit_countdown_text: '{days} jours restants pour payer',
    deposit_fomo_reapply_text: 'Postuler à nouveau',
};

const DEFAULT_OFFER_EXPERIENCE_ES: OfferExperience = {
    language_code: 'es',
    hero_title: 'Seleccione un modelo para crear su oferta',
    hero_subtitle: 'Elija su modelo y el contenido del paquete y los precios se generarán automáticamente',
    tab_models_label: 'Selección de dispositivo',
    tab_summary_label: 'Resumen de oferta',
    tab_support_label: 'Soporte',
    card_shipping_label: 'GRATIS',
    card_shipping_value: 'Express',
    card_shipping_status: 'Envío',
    card_capacity_label: 'ALTA MENSUAL',
    card_capacity_value: 'Capacidad',
    card_capacity_status: 'Garantizada',
    card_delivery_label: 'A NIVEL NACIONAL',
    card_delivery_value: 'Instalación',
    card_delivery_status: 'Soporte',
    cta_primary: 'Crear oferta para este dispositivo',
    cta_secondary: 'Ver dispositivo',
    cta_payment: 'Proceder al pago',
    support_helper_text: 'Contáctenos para cualquier pregunta sobre instalación y uso.',
    support_disclaimer_text: 'Nuestros productos tienen una garantía oficial del distribuidor de 2 años. Nuestro equipo se pondrá en contacto con usted después de procesar su pago.',
    badge_text: 'Oferta exclusiva solo para usted',
    payment_options: DEFAULT_PAYMENT_OPTIONS_ES,
    final_offer_title: '¡Su oferta exclusiva está lista!',
    final_offer_description: 'Se han aplicado ventajas especiales de lanzamiento a sus productos seleccionados.',
    final_offer_subtotal_label: 'Subtotal',
    final_offer_discount_label: 'Ventaja de lanzamiento',
    final_offer_total_label: 'Importe total a pagar',
    final_offer_confirm_button: 'Confirmar oferta y reservar',
    final_offer_reservation_title: 'Opción de reserva',
    final_offer_trust_badge: 'Su oferta de lanzamiento exclusiva',
    final_offer_demand_title: 'Alta demanda esta semana',
    final_offer_demand_subtitle: 'empresas reservaron su dispositivo',
    info_strip_launch_label: 'Período\nde lanzamiento',
    info_strip_launch_value: 'Mayo 2026',
    info_strip_capacity_label: 'Capacidad',
    info_strip_shipping_label: 'A nivel nacional',
    info_strip_shipping_value: 'Gratis',
    info_strip_delivery_value: 'Mayo 2026',
    deposit_badge_label: 'Anticipo pagado',
    deposit_price_updated_label: 'Precio actualizado',
    deposit_expired_label: 'Expirado',
    deposit_pay_button: 'Pagar el resto',
    deposit_pay_updated_button: 'Pagar al precio actualizado',
    deposit_expired_message: 'El período de pago ha expirado',
    deposit_expired_submessage: 'Su anticipo no será reembolsado. Contacte a su asesor para realizar un nuevo pedido.',
    deposit_countdown_text: 'Quedan {days} días para pagar',
    deposit_fomo_reapply_text: 'Volver a solicitar',
};

/**
 * Metin alanlari BOS olan bir deneyim iskeleti.
 *
 * NEDEN: CustomerOffer her alani `exp.<alan> || t('offer:...')` kalibiyla okur.
 * Alan doluysa i18n'e HIC gidilmez. Bu yuzden dile ozel satiri/varsayilani
 * olmayan diller icin Turkce DEFAULT_OFFER_EXPERIENCE dondurmek, teklif
 * sayfasindaki etiketleri (Ara Toplam, Odenecek Toplam Tutar, ...) o dilde
 * Turkce'ye kilitliyordu — ceviriler DB'de mevcut olsa bile.
 *
 * Bos string'ler falsy oldugu icin `||` fallback'i calisir ve metin i18n'den
 * (translations tablosu + tr bundle fallback) gelir. Yeni bir dil Dil
 * Yoneticisi'nden eklendiginde de bu sayede kendiliginden dogru davranir.
 */
function createI18nFallbackExperience(lang: string): OfferExperience {
    return {
        language_code: lang,
        hero_title: '',
        hero_subtitle: '',
        tab_models_label: '',
        tab_summary_label: '',
        tab_support_label: '',
        card_shipping_label: '',
        card_shipping_value: '',
        card_shipping_status: '',
        card_capacity_label: '',
        card_capacity_value: '',
        card_capacity_status: '',
        card_delivery_label: '',
        card_delivery_value: '',
        card_delivery_status: '',
        cta_primary: '',
        cta_secondary: '',
        cta_payment: '',
        support_helper_text: '',
        support_disclaimer_text: '',
        badge_text: '',
        // Odeme etiketleri zaten offer:reservation.methods.<id>.* uzerinden
        // i18n'e cozuluyor (CustomerOffer'daki methodText); buradaki degerler
        // yalnizca TR kaynak/defaultValue gorevi gorur.
        payment_options: getPaymentOptionsForLanguage(lang),
        final_offer_title: '',
        final_offer_description: '',
        final_offer_subtotal_label: '',
        final_offer_discount_label: '',
        final_offer_total_label: '',
        final_offer_confirm_button: '',
        final_offer_reservation_title: '',
        final_offer_trust_badge: '',
        final_offer_demand_title: '',
        final_offer_demand_subtitle: '',
        info_strip_launch_label: '',
        info_strip_launch_value: '',
        info_strip_capacity_label: '',
        info_strip_shipping_label: '',
        info_strip_shipping_value: '',
        info_strip_delivery_value: '',
        info_strip_reservation_note: '',
        deposit_badge_label: '',
        deposit_price_updated_label: '',
        deposit_expired_label: '',
        deposit_pay_button: '',
        deposit_pay_updated_button: '',
        deposit_expired_message: '',
        deposit_expired_submessage: '',
        deposit_countdown_text: '',
        deposit_fomo_reapply_text: '',
    };
}

/** Get the default offer experience for a given language code */
export function getDefaultOfferExperience(lang: string): OfferExperience {
    switch (lang) {
        case 'tr': return { ...DEFAULT_OFFER_EXPERIENCE };
        case 'en': return { ...DEFAULT_OFFER_EXPERIENCE_EN };
        case 'de': return { ...DEFAULT_OFFER_EXPERIENCE_DE };
        case 'fr': return { ...DEFAULT_OFFER_EXPERIENCE_FR };
        case 'es': return { ...DEFAULT_OFFER_EXPERIENCE_ES };
        // it, pl, pt, ro, hr, hu ve ileride eklenecek her dil: Turkce'ye
        // dusmek yerine i18n'e devret.
        default: return createI18nFallbackExperience(lang);
    }
}

export async function resolveOfferExperienceContent(campaignId?: string | null, languageCode: string = 'tr'): Promise<OfferExperience> {
    try {
        if (campaignId) {
            const { data: campaignData, error: campaignError } = await supabase
                .from('offer_experiences')
                .select('*')
                .eq('campaign_id', campaignId)
                .eq('language_code', languageCode)
                .single();

            if (!campaignError && campaignData) {
                console.log('[OfferExperience] Campaign row loaded. hero_title:', (campaignData as any).hero_title, '| payment_options:', (campaignData as any).payment_options);
                const merged = DEFAULT_PAYMENT_OPTIONS.map(def => {
                    const saved = ((campaignData as any).payment_options || []).find((o: any) => o.id === def.id);
                    return saved ? { ...def, ...saved } : def;
                });
                return { ...campaignData, payment_options: merged } as OfferExperience;
            }
            console.warn('[OfferExperience] Campaign row NOT found, falling back to global. campaignError:', campaignError);
        }

        const { data: globalData, error: globalError } = await supabase
            .from('offer_experiences')
            .select('*')
            .is('campaign_id', null)
            .eq('language_code', languageCode)
            .single();

        if (!globalError && globalData) {
            const merged = DEFAULT_PAYMENT_OPTIONS.map(def => {
                const saved = ((globalData as any).payment_options || []).find((o: any) => o.id === def.id);
                return saved ? { ...def, ...saved } : def;
            });
            console.log('[OfferExperience] Global row loaded, payment_options from DB:', (globalData as any).payment_options);
            return { ...globalData, payment_options: merged } as OfferExperience;
        }

        console.warn('[OfferExperience] No global row found, using fallback. globalError:', globalError);

    } catch (e) {
        console.warn('Failed to resolve dynamic offer experience configs, using fallback.', e);
    }

    // Safety fallback — use language-specific defaults
    return getDefaultOfferExperience(languageCode);
}

/**
 * Resolves live product catalog and pricing from the DB, mapping it to the UI Product format.
 *
 * `marketCode` is the broad region (TR / EU / GB / US / SA / AE).
 * `countryCode` is the specific ISO country (TR / IT / FR / DE / PL …); used by
 * PricingResolutionService to pick the most-specific rule when one exists.
 */
export async function getLiveProducts(
    campaignId?: string,
    marketCode: string = 'TR',
    languageCode: string = 'tr',
    countryCode?: string,
): Promise<Product[]> {
    try {
        // Fetch all active products that are machines
        const { data: rawProducts, error } = await supabase
            .from('products')
            .select(`
                *,
                localized:product_localized_content(*),
                packages:product_packages(*, localized:product_package_localized_content(*)),
                media:product_media(*)
            `)
            .eq('is_active', true)
            .eq('product_type', 'machine')
            .order('sort_order', { ascending: true });

        if (error || !rawProducts) return [];

        // Fetch all active detail sections for the requested language.
        // Eğer hedef dilde hiçbir bölüm yoksa TR'ye fallback ederiz — kullanıcı
        // tamamen bos sayfa görmektense TR icerik gormeli.
        const sectionsRes = await supabase
            .from('product_detail_sections')
            .select('*, items:product_detail_items(*)')
            .eq('language_code', languageCode)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        let sectionsData = sectionsRes.data;
        if ((!sectionsData || sectionsData.length === 0) && languageCode !== 'tr') {
            const fallback = await supabase
                .from('product_detail_sections')
                .select('*, items:product_detail_items(*)')
                .eq('language_code', 'tr')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            sectionsData = fallback.data;
        }

        // Sort items inside sections
        sectionsData?.forEach(sec => {
            if (sec.items) {
                sec.items = sec.items.filter((i: any) => i.is_active).sort((a: any, b: any) => a.sort_order - b.sort_order);
            }
        });

        // Resolve all product prices in parallel instead of sequentially.
        // We pass both market_code and country_code so the resolver can pick the
        // most specific row (e.g. country IT > market EU > global).
        const priceResults = await Promise.all(
            (rawProducts as CatalogProduct[]).map(rp =>
                PricingResolutionService.resolvePrices({
                    product_id: rp.id,
                    campaign_id: campaignId,
                    market_code: marketCode,
                    country_code: countryCode,
                })
            )
        );

        const uiProducts: Product[] = await Promise.all((rawProducts as CatalogProduct[]).map(async (rp, idx) => {
            // Locale fallback: requested -> TR (master) -> EN -> first available.
            // 'rp.localized[0]' fallback yerine deterministik: cevirilmemis dillerin
            // gostereceği dili kontrol edilebilir hale getiriyoruz (admin ne TR ne EN
            // doldurmus ürünler için son çare olarak [0] kalır).
            const translated =
                rp.localized?.find(l => l.language_code === languageCode) ||
                rp.localized?.find(l => l.language_code === 'tr') ||
                rp.localized?.find(l => l.language_code === 'en') ||
                rp.localized?.[0];
            // Görsel yoksa dış URL'ye (maglev) düşme — boş bırak; UI nötr kutu gösterir.
            // KRİTİK: yalnızca media_type='image' satırları müşteri-facing görseldir.
            // product_media artık 'whatsapp_marketing' (final teklif WhatsApp header'ı,
            // sort_order=0, is_active=true) gibi sergilenmeyen tipler de tutuyor —
            // media_type filtresi olmadan bu banner product.image'a sızıp FinalOfferHero
            // fallback'inde hero görseli olarak çıkıyordu.
            const media = rp.media?.find(m => m.is_active && m.media_type === 'image' && m.sort_order !== 99)?.url || '';
            const desktopMedia = rp.media?.find(m => m.is_active && m.media_type === 'image' && m.sort_order === 99)?.url;
            const priceRes = priceResults[idx];

            // Pricing resolution — SINGLE SOURCE OF TRUTH = pricing_rules.
            // The system stores two prices via two conventions (must mirror the
            // offer-creation flow in OfferLinkFormModal / ManualOfferModal, else the
            // customer page drifts from what the salesperson set):
            //   • price_type='full_price'.amount        → LİSTE FİYATI (strikethrough)
            //   • price_type='full_price'.launch_amount → ülke-bazlı lansman (country rows)
            //   • price_type='deposit'.amount           → KAMPANYA LANSMAN FİYATI (campaign rows)
            // Campaign rules outrank country rules by specificity, so a campaign's
            // launch price (deposit rule) wins when present — exactly as the user
            // expects ("kampanya kazanmalı").
            //
            // BUG FIX: previously launch fell back to the legacy products.launch_price
            // column whenever the matched rule had no launch_amount. That MIXED a
            // fresh rule list price with a stale legacy launch price (e.g. list 230k
            // from the campaign rule, launch 200k from an old frozen column) and the
            // numbers the operator typed never appeared. Now, once ANY rule governs
            // the product, launch comes ONLY from the rules (campaign deposit →
            // full_price.launch_amount → list). Legacy columns are used solely when
            // NO rule matched at all.
            // Kural semantiği (kampanya lansmanı > launch_amount > liste; currency kuralı
            // izler) src/lib/pricingRules.deriveOfferPrice'ta yaşar — remarketing worker'ı
            // da aynı fonksiyonu kullanır. Legacy products kolonu fallback'i ise ürün
            // satırına ihtiyaç duyduğu için BURADA kalır.
            const derived = deriveOfferPrice(priceRes as any);
            const ruleMatched = derived.ruleMatched;
            const ruleCurrency = derived.currency;
            let listPrice: number;
            let launchPrice: number;
            if (ruleMatched) {
                listPrice = derived.listPrice > 0 ? derived.listPrice : ((rp as any).list_price || 0);
                launchPrice = derived.launchPrice > 0 ? derived.launchPrice : listPrice;
            } else {
                // No rule at all → legacy TRY columns as last resort.
                // INVARIANT: bu dala düşülmesi bir veri hatasıdır (31 Tem 2026 vakası:
                // kampanya değişti, TR kuralları eski kampanyaya kilitliydi → müşterilere
                // bayat legacy fiyat gitti). Ülke kuralları campaign_id NULL tutulduğu
                // sürece buraya asla düşülmemeli.
                console.error('[pricing] NO pricing_rule matched — legacy products columns used', {
                    productId: rp.id, campaignId, countryCode, marketCode,
                });
                listPrice = (rp as any).list_price || 0;
                launchPrice = (rp as any).launch_price || listPrice;
            }
            // price = effective selling price (launch), oldPrice = list price for strikethrough
            const price = launchPrice > 0 ? launchPrice : listPrice;
            const oldPrice = listPrice > launchPrice && launchPrice > 0 ? listPrice : 0;

            // Build features
            const featureTitle = languageCode === 'tr' ? 'Özellik' : languageCode === 'de' ? 'Merkmal' : languageCode === 'fr' ? 'Caractéristique' : languageCode === 'es' ? 'Característica' : 'Feature';
            const features = (translated?.feature_list || []).map((f: string) => ({
                title: featureTitle,
                description: f,
                icon: 'Check'
            }));

            // Extract content sections for this product, then override text fields
            // from i18n cache (translations table 'products' namespace). This is
            // what enables INSTANT language switching — texts come from in-memory
            // i18n cache instead of being baked from per-language DB rows.
            const rawSections = (sectionsData as ProductDetailSection[] || []).filter(s => s.product_id === rp.id);
            const contentSections = await applyI18nToSections(rawSections, languageCode);

            const rawName = translated?.name || rp.product_code;
            const nameParts = rawName.split('|');
            const mainName = nameParts[0].trim();
            const subtitle = nameParts.length > 1 ? nameParts[1].trim() : undefined;

            const ruleDepositPercent = (priceRes.fullPrice as any)?.deposit_percent;
            return {
                id: rp.id,
                name: mainName,
                subtitle: subtitle,
                tagline: translated?.short_description || '',
                description: translated?.description || '',
                price,
                oldPrice,
                image: media,
                desktopImage: desktopMedia,
                stockStatus: languageCode === 'tr' ? 'Stokta Var' : languageCode === 'de' ? 'Auf Lager' : languageCode === 'fr' ? 'En stock' : languageCode === 'es' ? 'En stock' : 'In Stock',
                isBestSeller: translated?.badge_text ? true : false,
                customBadge: translated?.badge_text || undefined,
                features,
                shortFeatures: [],
                specs: { speed: 'N/A', resolution: 'N/A', connectivity: 'N/A' },
                contentSections,
                recommendedConsumables: (rp as any).recommended_products || [],
                hero_video_url: (rp as any).hero_video_url || undefined,
                final_offer_video_url: (rp as any).final_offer_video_url || undefined,
                pdp_hero_images: (rp as any).pdp_hero_images || [],
                use_case_tags: (translated as any)?.use_case_tags || [],
                isRecommended: (translated as any)?.is_recommended || false,
                speed: (translated as any)?.speed || undefined,
                depositPercent: typeof ruleDepositPercent === 'number' ? ruleDepositPercent : undefined,
                currency: ruleCurrency || undefined,
                capacity: (translated as any)?.capacity || undefined,
                capacityLabel: (translated as any)?.capacity_label || undefined,
                compareSpecs: Array.isArray((translated as any)?.compare_specs) ? (translated as any).compare_specs : [],
            };
        }));

        return uiProducts;
    } catch (e) {
        console.error('Failed to load live products', e);
        return [];
    }
}

/**
 * Resolves live accessory/consumable catalog from the DB.
 *
 * `marketCode` is the broad region; `countryCode` (optional) is the specific
 * ISO country used by PricingResolutionService for finer-grained lookup.
 */
async function getLiveConsumables(
    campaignId?: string,
    marketCode: string = 'TR',
    languageCode: string = 'tr',
    countryCode?: string,
): Promise<Accessory[]> {
    try {
        const { data: rawConsumables, error } = await supabase
            .from('products')
            .select(`
                *,
                localized:product_localized_content(*),
                media:product_media(*)
            `)
            .eq('is_active', true)
            .eq('product_type', 'consumable')
            .order('sort_order', { ascending: true });

        if (error || !rawConsumables) return [];

        // Resolve all consumable prices in parallel
        const priceResults = await Promise.all(
            (rawConsumables as CatalogProduct[]).map(rp =>
                PricingResolutionService.resolvePrices({
                    product_id: rp.id,
                    campaign_id: campaignId,
                    market_code: marketCode,
                    country_code: countryCode,
                })
            )
        );

        const uiAccessories: Accessory[] = (rawConsumables as CatalogProduct[]).map((rp, idx) => {
            // Locale fallback: requested -> TR (master) -> EN -> first available.
            const translated =
                rp.localized?.find(l => l.language_code === languageCode) ||
                rp.localized?.find(l => l.language_code === 'tr') ||
                rp.localized?.find(l => l.language_code === 'en') ||
                rp.localized?.[0];
            // Görsel yoksa dış URL'ye (unsplash stok) düşme — boş bırak; UI nötr kutu gösterir.
            const media = rp.media?.find(m => m.is_active)?.url || '';
            const priceRes = priceResults[idx];

            // SINGLE SOURCE OF TRUTH — same convention as getLiveProducts above:
            // a matched pricing_rule fully governs the price; the stale legacy
            // launch_price column is used only when NO rule matched at all (never
            // mixed with a rule-derived list price).
            const ruleListPrice = priceRes.fullPrice?.amount;
            const ruleLaunchAmount = (priceRes.fullPrice as any)?.launch_amount;
            const campaignLaunch = priceRes.deposit?.campaign_id
                ? (priceRes.deposit as any)?.amount
                : undefined;
            const ruleMatched =
                (typeof ruleListPrice === 'number' && ruleListPrice > 0) ||
                (typeof campaignLaunch === 'number' && campaignLaunch > 0);
            let listPrice: number;
            let launchPrice: number;
            if (ruleMatched) {
                listPrice = (typeof ruleListPrice === 'number' && ruleListPrice > 0)
                    ? ruleListPrice
                    : ((rp as any).list_price || 0);
                launchPrice =
                    (typeof campaignLaunch === 'number' && campaignLaunch > 0) ? campaignLaunch
                    : (typeof ruleLaunchAmount === 'number' && ruleLaunchAmount > 0) ? ruleLaunchAmount
                    : (typeof ruleListPrice === 'number' && ruleListPrice > 0) ? ruleListPrice
                    : listPrice;
            } else {
                // INVARIANT: veri hatası sinyali — bkz. getLiveProducts'taki aynı dal.
                console.error('[pricing] NO pricing_rule matched (consumable) — legacy products columns used', {
                    productId: rp.id, campaignId, countryCode, marketCode,
                });
                listPrice = (rp as any).list_price || 0;
                launchPrice = (rp as any).launch_price || listPrice;
            }
            const price = launchPrice > 0 ? launchPrice : listPrice;

            const rawName = translated?.name || rp.product_code;
            const nameParts = rawName.split('|');
            const mainName = nameParts[0].trim();

            return {
                id: rp.id,
                name: mainName,
                description: translated?.short_description || translated?.description || '',
                price: price,
                image: media
            };
        });

        return uiAccessories;
    } catch (e) {
        console.error('Failed to load live consumables', e);
        return [];
    }
}

/**
 * Loads the offer context by fetching real data from Supabase.
 * Falls back to mock data only if the token is not found in the database.
 */
export async function getOfferContextByToken(token: string, clientLanguage?: string, clientCountry?: string): Promise<OfferContextResponse> {
    if (!token || token.length < 3 || token === 'invalid') {
        return { data: null, error: 'invalid' };
    }

    if (token.startsWith('guest_')) {
        const lang = clientLanguage || 'tr';
        const guestMarket = getDefaultMarketForLanguage(lang);
        const guestCountry = clientCountry || getCountryForLanguage(lang) || null;
        // Use allSettled so any one DB call (e.g. an optional table that
        // hasn't been migrated yet) failing won't stall the whole loading
        // screen — we fall back to defaults for whichever piece fails.
        // Guest mode'da bile CountryPaymentSettings'i tercih et (per-country admin
        // toggle'larının kaynağı). Sadece ülke bilgisi yoksa eski market-level
        // ayara düş — böylece admin tarafında yapılan toggle/sort_order/credentials
        // değişiklikleri guest tarafına da yansır.
        const guestCountryUpper = (guestCountry || (lang === 'tr' ? 'TR' : null) || 'TR').toUpperCase();
        const settled = await Promise.allSettled([
            resolveOfferExperienceContent(null, lang),
            getLiveProducts(undefined, guestMarket, lang, guestCountry || undefined),
            getLiveConsumables(undefined, guestMarket, lang, guestCountry || undefined),
            CountryPaymentSettingsService.getEffective(guestCountryUpper, lang),
        ]);
        const experience = settled[0].status === 'fulfilled' ? settled[0].value : getDefaultOfferExperience(lang);
        const liveProducts = settled[1].status === 'fulfilled' ? settled[1].value : [];
        const liveConsumables = settled[2].status === 'fulfilled' ? settled[2].value : [];
        const paymentSettings = settled[3].status === 'fulfilled' ? settled[3].value : undefined;
        // Canlı katalogdan ürün gelmezse (boş katalog / DB hatası) ASLA hardcoded
        // demo veriye düşme — müşteriye sahte ürün/fiyat göstermektense geçersiz dön.
        if (liveProducts.length === 0) {
            return { data: null, error: 'invalid' };
        }
        const finalProducts = liveProducts;
        const finalAccessories = liveConsumables;

        return {
            data: {
                token,
                lead: { id: '', customerName: i18n.t('offer:hero.guestFallback', { lng: lang, defaultValue: 'Değerli Misafirimiz' }), companyName: '' },
                campaignInfo: {
                    hasCampaign: false,
                    name: '',
                    discountRate: 0,
                    validUntil: formatDate(new Date(Date.now() + 30 * 86400000).toISOString()),
                    validUntilRaw: new Date(Date.now() + 30 * 86400000).toISOString(),
                    maxOfferValidityDays: 30,
                    offerNumber: `#GUEST-${token.substring(6).toUpperCase()}`,
                    capacityPercentage: 100,
                    batchNumber: lang === 'tr' ? 'Standart' : 'Standard',
                    estimatedDelivery: lang === 'tr' ? '15-20 İş Günü' : '15-20 Business Days',
                    depositPercentage: 20,
                    depositLockDays: 14,
                    depositExtensionDays: 5,
                },
                products: finalProducts,
                accessories: finalAccessories,
                experience,
                marketCode: guestMarket,
                languageCode: lang,
                paymentSettings,
            },
            error: null
        };
    }

    try {
        // 1. Fetch offer_link by token with related lead and campaign data
        const { data: offerLink, error: linkError } = await supabase
            .from('offer_links')
            .select(`
                *,
                leads (
                    id,
                    customer_name,
                    company_name,
                    phone_number,
                    email
                ),
                campaigns (
                    id,
                    name,
                    batch_number,
                    capacity_percentage,
                    estimated_delivery,
                    valid_until,
                    discount_rate,
                    is_active,
                    max_offer_validity_days,
                    offer_cannot_exceed_campaign_end,
                    deposit_percentage,
                    deposit_lock_duration_days,
                    deposit_extension_days
                )
            `)
            .eq('token', token)
            .single();

        if (linkError || !offerLink) {
            // Token DB'de yok (silinmiş / hiç yaratılmamış) → geçersiz. Hardcoded
            // demo teklife ASLA düşme.
            return { data: null, error: 'invalid' };
        }

        // 2. Check if expired
        // Eskiden burada `null, error: 'expired'` dönülüyordu ve UI eski
        // "Geçersiz Bağlantı" formuna düşüyordu. Yeni davranış: süresi dolmuş
        // link için lead bilgisi + ürün katalogunu döndürüp `isExpiredRecovery: true`
        // flag setliyoruz. CustomerOffer normal model seçim sayfasını render
        // eder, üstüne ExpiredOfferModal açar; son submit'te customer_reservations
        // yerine /api/offer/reclaim-request çağrılır (admin onayı şart).
        const isStatusExpired = offerLink.status === 'expired' || offerLink.is_active === false;
        // 'pending_review' — yeni lead ama oluşturma anında geçerli kampanya yoktu.
        // Reclaim/onay akışına girer ama müşteriye "hazırlanıyor" mesajı gösterilir.
        const isPendingReview = offerLink.status === 'pending_review';
        let isDateExpired = false;
        if (offerLink.expires_at || offerLink.valid_until) {
            const expiry = offerLink.expires_at || offerLink.valid_until;
            if (new Date(expiry) < new Date()) {
                isDateExpired = true;
            }
        }
        if (isStatusExpired || isDateExpired || isPendingReview) {
            const expiredLead = offerLink.leads;
            // Token DB'de var ama lead bilgisi yoksa fallback: eski form göster.
            // (Plan'da: "customer_name boşsa flow'u InvalidLinkState'e düşür.")
            if (!expiredLead?.customer_name) {
                return { data: null, error: 'invalid' };
            }
            const lang = clientLanguage || offerLink.language_code || 'tr';
            const linkCountry = (offerLink as any).country_code || null;
            // Prefer the lead's E.164 phone prefix over the language→country
            // guess: a +90 lead viewing the reclaim page in English must stay TR
            // (₺), not fall to GB (£) on a raw lira amount.
            const country = linkCountry || (clientCountry && getCountryByCode(clientCountry)?.code) || getCountryByPhone(expiredLead?.phone_number) || getCountryForLanguage(lang) || null;
            const market = (country ? getCountryByCode(country)?.market_code : null) || offerLink.market_code || getDefaultMarketForLanguage(lang);
            const upperCountry = (country || 'TR').toUpperCase();
            const settled = await Promise.allSettled([
                resolveOfferExperienceContent(null, lang),
                getLiveProducts(undefined, market, lang, country || undefined),
                getLiveConsumables(undefined, market, lang, country || undefined),
                CountryPaymentSettingsService.getEffective(upperCountry, lang),
            ]);
            const experience = settled[0].status === 'fulfilled' ? settled[0].value : getDefaultOfferExperience(lang);
            const liveProducts = settled[1].status === 'fulfilled' ? settled[1].value : [];
            const liveConsumables = settled[2].status === 'fulfilled' ? settled[2].value : [];
            const paymentSettings = settled[3].status === 'fulfilled' ? settled[3].value : undefined;
            const expiredLeadInfo: LeadInfo = {
                id: expiredLead.id || offerLink.lead_id,
                customerName: expiredLead.customer_name,
                companyName: expiredLead.company_name || '',
                companyNumber: '',
                phoneNumber: expiredLead.phone_number || '',
                email: expiredLead.email || '',
            };
            return {
                data: {
                    token,
                    lead: expiredLeadInfo,
                    campaignInfo: {
                        hasCampaign: false,
                        name: '',
                        discountRate: 0,
                        validUntil: '',
                        validUntilRaw: offerLink.valid_until || null,
                        maxOfferValidityDays: 30,
                        offerNumber: `#RCL-${token.substring(0, 8).toUpperCase()}`,
                        capacityPercentage: 100,
                        batchNumber: lang === 'tr' ? 'Standart' : 'Standard',
                        estimatedDelivery: lang === 'tr' ? '15-20 İş Günü' : '15-20 Business Days',
                        depositPercentage: 20,
                        depositLockDays: 14,
                        depositExtensionDays: 5,
                    },
                    products: liveProducts,
                    accessories: liveConsumables,
                    experience,
                    marketCode: market,
                    countryCode: country,
                    languageCode: lang,
                    paymentSettings,
                    isExpiredRecovery: true,
                    isAwaitingCampaign: isPendingReview,
                    offerCreatedAt: offerLink.created_at || null,
                },
                error: null,
            };
        }

        // 3. Track view (PK is 'token', not 'id')
        await supabase
            .from('offer_links')
            .update({
                open_count: (offerLink.open_count || offerLink.view_count || 0) + 1,
                last_opened_at: new Date().toISOString()
            })
            .eq('token', token);

        // 4. Resolve market/language/country.
        //
        // Country resolution priority (most → least specific):
        //   1. offer_link.country_code — the lead's declared country, derived
        //      from the phone-prefix they picked in the capture form. This is
        //      an explicit customer statement and locks the offer's market.
        //      A later language switch must NOT override it: a +90 lead seeing
        //      the page in German still gets ₺ TRY pricing, only the labels
        //      change. (Same contract as saved offers.)
        //   2. clientCountry — explicit override from the customer flow.
        //      Retained as an escape hatch but no longer driven by IP/browser
        //      heuristics from the offer page.
        //   3. campaign.country_code — campaign default.
        //   4. Current language → country fallback (only when there is no
        //      lead-declared country, e.g. anonymous pre-capture preview).
        //
        // Once country is known, market_code is derived from the country's
        // continent group (countries.ts), so EU pricing rules apply to all
        // EU countries automatically.
        const campaign = offerLink.campaigns;
        const linkLanguage = offerLink.language_code || 'tr';
        const offerLanguageCode = clientLanguage || linkLanguage;
        const linkCountry = (offerLink as any).country_code || null;
        const campaignCountry = (campaign as any)?.country_code || null;
        // Declared / known country ONLY — no language→country guessing here.
        // Previously a web lead with no declared country fell through to
        // getCountryForLanguage(lang); for English that returned 'GB', which made
        // the locale provider stamp a £ symbol on a raw Turkish-lira amount (no GB
        // pricing_rule exists, so the price came from the legacy TRY column).
        // Last-resort recovery: the lead's stored E.164 phone prefix is an
        // explicit customer signal (+90 → TR, +49 → DE). When the link carries
        // no declared country (older leads, CTWA/WhatsApp/imported leads where
        // country_code was never stamped) this stops a +90 lead from falling
        // through to the GLOBAL/USD branch below and getting a USD amount shown
        // with ₺. Purely additive — only fires when declaredCountry would have
        // been null, so it never overrides an explicitly declared country.
        const leadPhoneCountry = getCountryByPhone((offerLink.leads as any)?.phone_number);
        const declaredCountry =
            linkCountry ||
            (clientCountry && getCountryByCode(clientCountry)?.code) ||
            campaignCountry ||
            leadPhoneCountry ||
            null;
        const explicitMarket = offerLink.market_code || (campaign as any)?.market_code || null;
        let offerCountryCode: string | null;
        let offerMarketCode: string;
        if (declaredCountry) {
            // A listed/declared country drives its own market + currency.
            offerCountryCode = declaredCountry;
            offerMarketCode =
                getCountryByCode(declaredCountry)?.market_code ||
                explicitMarket ||
                getDefaultMarketForLanguage(offerLanguageCode);
        } else if (explicitMarket) {
            // Admin pinned a market on the link/campaign but no specific country.
            offerCountryCode = null;
            offerMarketCode = explicitMarket;
        } else if (offerLanguageCode === 'tr') {
            // Turkish UI, nothing declared → home market.
            offerCountryCode = 'TR';
            offerMarketCode = 'TR';
        } else {
            // Undeclared, non-Turkish international visitor → GLOBAL market. The
            // admin's per-product 'GLOBAL' USD price applies; if none exists the
            // resolver falls back to the legacy TRY column (currency-safe).
            offerCountryCode = null;
            offerMarketCode = 'GLOBAL';
        }
        console.log('[OfferContext] Resolution', {
            clientCountry, clientLanguage,
            linkCountry, campaignCountry,
            offerCountryCode, offerMarketCode, offerLanguageCode,
        });

        // 5. Resolve lead info
        const lead = offerLink.leads;
        const leadInfo: LeadInfo = {
            id: lead?.id || offerLink.lead_id,
            customerName: lead?.customer_name || (offerLanguageCode === 'tr' ? 'Sayın Müşterimiz' : 'Dear Customer'),
            companyName: lead?.company_name || '',
            companyNumber: '',
            phoneNumber: lead?.phone_number || '',
            email: lead?.email || ''
        };
        const linkDate = new Date(offerLink.created_at || Date.now());
        // Generate unique offer number from token
        const tokenHash = token.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const seqNum = (tokenHash * 7) % 10000;

        // Fetch translated campaign name/estimated_delivery if a non-TR language is requested.
        // Falls back to original column when translation row missing.
        let campaignTranslations: Record<string, string> = {};
        if (campaign?.id && offerLanguageCode && offerLanguageCode !== 'tr') {
            try {
                const { data: trRows } = await supabase
                    .from('translations')
                    .select('key,value')
                    .eq('namespace', 'campaigns')
                    .eq('language_code', offerLanguageCode)
                    .in('key', [`campaign:${campaign.id}:name`, `campaign:${campaign.id}:estimated_delivery`]);
                campaignTranslations = Object.fromEntries((trRows || []).map((r: any) => [r.key, r.value]));
            } catch (e) {
                // tolerate failure; we fall back to original columns
            }
        }

        // Geçerlilik tarihi: linkin kendi valid_until'i varsa onu kullan. Yoksa
        // KAMPANYANIN BİTİŞ TARİHİNE DEĞİL, kampanyanın max_offer_validity_days
        // ayarına (ör. 7 gün) göre created_at + maxDays hesapla (kampanya bitişini
        // aşmaz). Böylece public teklif sayfası da admin/Tekliflerim gibi kampanya
        // gün ayarını baz alır; 30 günlük kampanya penceresini yanlışlıkla
        // "geri sayım" olarak göstermez. Tek doğruluk noktası: computeOfferExpiry.
        const linkValidUntilRaw: string | null = offerLink.valid_until
            || (campaign
                ? computeOfferExpiry(
                    {
                        max_offer_validity_days: campaign.max_offer_validity_days,
                        valid_until: campaign.valid_until,
                        offer_cannot_exceed_campaign_end: campaign.offer_cannot_exceed_campaign_end,
                    },
                    linkDate,
                ).toISOString()
                : null);
        const campaignInfo = {
            hasCampaign: !!campaign,
            name: campaignTranslations[`campaign:${campaign?.id}:name`] || campaign?.name || '',
            discountRate: (campaign?.discount_rate || 15) / 100,
            validUntil: formatDate(linkValidUntilRaw),
            validUntilRaw: linkValidUntilRaw,
            maxOfferValidityDays: campaign?.max_offer_validity_days ?? 7,
            offerNumber: `#CFP-${linkDate.getFullYear().toString().slice(2)}${String(linkDate.getMonth() + 1).padStart(2, '0')}-${String(seqNum).padStart(4, '0')}`,
            capacityPercentage: campaign?.capacity_percentage ?? 85,
            batchNumber: campaign?.batch_number || 'Standart',
            estimatedDelivery: campaignTranslations[`campaign:${campaign?.id}:estimated_delivery`] || campaign?.estimated_delivery || '15-20 İş Günü',
            depositPercentage: campaign?.deposit_percentage ?? 20,
            depositLockDays: campaign?.deposit_lock_duration_days ?? 14,
            depositExtensionDays: campaign?.deposit_extension_days ?? 5,
        };

        // 6 + 7. Run all four DB-bound resolvers in parallel and tolerate any
        // single failure. Previously experience was awaited *before* products,
        // doubling the loading screen wait. With allSettled, if a table is
        // missing or returns 406 (e.g. offer_experiences row not seeded for
        // the customer's language) we fall back to defaults instead of stalling.
        const settled = await Promise.allSettled([
            resolveOfferExperienceContent(campaign?.id || null, offerLanguageCode),
            getLiveProducts(campaign?.id, offerMarketCode, offerLanguageCode, offerCountryCode),
            getLiveConsumables(campaign?.id, offerMarketCode, offerLanguageCode, offerCountryCode),
            // Always prefer per-country admin settings. If the offer has no
            // declared country, fall back to TR (the master market) so admin
            // toggle/sort changes are still respected — never silently use the
            // legacy market-level table which doesn't track per-method toggles.
            CountryPaymentSettingsService.getEffective(
                (offerCountryCode || 'TR').toUpperCase(),
                offerLanguageCode,
            ),
        ]);
        const experience = settled[0].status === 'fulfilled' ? settled[0].value : getDefaultOfferExperience(offerLanguageCode);
        const liveProducts = settled[1].status === 'fulfilled' ? settled[1].value : [];
        const liveConsumables = settled[2].status === 'fulfilled' ? settled[2].value : [];
        const paymentSettings = settled[3].status === 'fulfilled' ? settled[3].value : undefined;
        // Canlı katalogdan ürün gelmezse (boş katalog / DB hatası) ASLA hardcoded
        // demo veriye düşme — müşteriye sahte ürün/fiyat göstermektense geçersiz dön.
        if (liveProducts.length === 0) {
            return { data: null, error: 'invalid' };
        }
        const finalProducts = liveProducts;
        const finalAccessories = liveConsumables;

        return {
            data: {
                token,
                lead: leadInfo,
                campaignInfo,
                products: finalProducts,
                accessories: finalAccessories,
                experience, // Use the dynamically resolved experience, not a fall-through
                marketCode: offerMarketCode,
                countryCode: offerCountryCode,
                languageCode: offerLanguageCode,
                paymentSettings,
                displayPrefs: parseOfferDisplayPrefs((offerLink.offer_snapshot as Record<string, unknown> | null)?.display),
            },
            error: null
        };

    } catch (e) {
        // DB bağlantısı koparsa bile hardcoded demo teklif gösterme — geçersiz dön.
        console.error('[getOfferContextByToken] Error loading context from DB:', e);
        return { data: null, error: 'invalid' };
    }
}

/**
 * Format date to locale string
 */
function formatDate(dateStr?: string | null, locale: string = 'tr-TR'): string {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString(locale, {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

