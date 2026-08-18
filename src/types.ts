import {
  LayoutGrid,
  FileText,
  CreditCard,
  ShoppingBag,
  LucideIcon,
  Home,
  Search,
  User,
  MessageCircle,
  Phone
} from 'lucide-react';

export type SupportedLanguage = string;

export interface CartItem {
  id: string;
  type: 'product' | 'accessory';
  name: string;
  description: string;
  price: number;        // effective selling price (launch_price or campaign-discounted)
  listPrice?: number;   // original market price for strikethrough display
  image: string;
  quantity: number;
  originalItem: Product | Accessory;
}

export type ViewType = 'summary' | 'config' | 'payment' | 'support' | 'offer-details' | 'final-offer' | 'my-offers' | 'reservations' | 'offer-deleted' | 'offer-expired' | 'lead-capture';

export interface SavedOffer {
  id: string;
  offerNumber: string;
  customerName: string;
  companyName: string;
  date: string;
  total: number;
  items: CartItem[];
  selectedReservation?: string;
  reservationStatus?: string;
  paymentMethod?: string;
  createdAt?: string;
  depositPaidAt?: string;
  /** Bank transfer flow: customer pressed "Ödemeyi Yaptım" and completed the invoice form. Admin approval pending. */
  bankTransferNotifiedAt?: string;
  /** ISO-4217 currency this offer's total/items are denominated in. Falls back to current locale when missing. */
  currency?: string;
  /** ISO country this offer was issued for. Used to look up the original VAT/payment context. */
  countryCode?: string;
  /** Etkin son kullanma tarihi (ISO). Tüm "expired" kontrolleri burayı okur; createdAt+maxDays
   * formülü ve admin'in link uzatması birlikte değerlendirilerek offerContext yükleme anında set edilir. */
  expiryAt: string;
}

export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  oldPrice: number;
  image: string;
  desktopImage?: string;
  stockStatus: string;
  isBestSeller?: boolean;
  features: {
    title: string;
    description: string;
    icon: any;
  }[];
  shortFeatures: {
    text: string;
    icon: string;
  }[];
  specs: {
    speed: string;
    resolution: string;
    connectivity: string;
  };
  contentSections?: ProductDetailSection[];
  customBadge?: string;
  subtitle?: string;
  recommendedConsumables?: string[];
  hero_video_url?: string;
  /** Final teklif sayfasındaki hero için ürün başına özel video. Boşsa hero_video_url kullanılır. */
  final_offer_video_url?: string;
  pdp_hero_images?: string[];
  use_case_tags?: { label: string; active: boolean }[];
  isRecommended?: boolean;
  speed?: string;
  capacity?: string;
  capacityLabel?: string;
  /** Country/market-specific deposit percent override from pricing_rules.deposit_percent. */
  depositPercent?: number;
  /** ISO-4217 currency code from the matched pricing_rules row. Source of truth
   *  for offer-creation stamping — kills the cold-paint race where locale.currency
   *  briefly resolved to navigator-language-derived EUR before offerContext loaded. */
  currency?: string;
  /** Localized compare-modal rows (label + value pairs). Editable from admin. */
  compareSpecs?: { label: string; value: string }[];
}

export const PRODUCTS: Product[] = [
  {
    id: 'pro',
    name: 'CAFEPASTE Pro',
    tagline: 'Yüksek Kapasite',
    description: 'Yoğun trafikli mekanlar için yüksek performanslı Art.',
    price: 201150, // 149,000 * 1.35
    oldPrice: 255150, // 189,000 * 1.35
    image: 'https://maglev.com.tr/img/cafepaste-banner.png',
    stockStatus: 'En Popüler',
    isBestSeller: true,
    features: [
      {
        title: 'Aynı Anda Çift Bardağa ve Kek Üzerine Art',
        description: 'Aynı anda iki bardak veya geniş yüzeyli kek/pasta üzerine Art uygulayabilme özelliği.',
        icon: 'Coffee'
      }
    ],
    shortFeatures: [
      { text: 'Çift Bardak & Geniş Yüzey', icon: 'Layers' },
      { text: '10 Saniye Art Hızı', icon: 'Zap' },
      { text: '1200 DPI Çözünürlük', icon: 'Image' },
      { text: 'Wi-Fi + 5G Bağlantı', icon: 'Wifi' }
    ],
    specs: {
      speed: '10 sn',
      resolution: '1200 dpi',
      connectivity: 'Wi-Fi + 5G'
    }
  },
  {
    id: 'std',
    name: 'CAFEPASTE',
    tagline: 'Başlangıç Paketi',
    description: 'Küçük ve orta ölçekli işletmeler için ideal çözüm.',
    price: 149000,
    oldPrice: 189000,
    image: 'https://maglev.com.tr/img/cafepaste-banner.png',
    stockStatus: 'Stokta',
    features: [
      {
        title: 'Tek Bardakta Art',
        description: 'Günde 50-100 bardak servis eden butik işletmeler için ideal çözüm.',
        icon: 'Coffee'
      }
    ],
    shortFeatures: [
      { text: 'Tek Bardak Art', icon: 'Coffee' },
      { text: '10 Saniye Art Hızı', icon: 'Zap' },
      { text: '1200 DPI Çözünürlük', icon: 'Image' },
      { text: 'Wi-Fi Bağlantı', icon: 'Wifi' }
    ],
    specs: {
      speed: '10 sn',
      resolution: '1200 dpi',
      connectivity: 'Wi-Fi'
    }
  }
];

export interface Offer {
  id: string;
  customerName: string;
  companyName: string;
  companyNumber: string;
  date: string;
  batch: string;
  capacity: number;
  validUntil: string;
}

export const MOCK_OFFER: Offer = {
  id: 'TR-8492',
  customerName: 'Ahmet Yılmaz',
  companyName: 'CompanyName',
  companyNumber: '0850 308 49 21',
  date: '15 Ekim',
  batch: '#42',
  capacity: 85,
  validUntil: '28 Şubat 2026'
};

export interface Accessory {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
}

export const ACCESSORIES: Accessory[] = [
  {
    id: 'cartridge-brown',
    name: 'Kahverengi Kartuş',
    description: '800 Art Kapasitesi - Standart',
    price: 2500,
    image: 'https://maglev.com.tr/img/cafepaste-banner.png'
  },
  {
    id: 'cartridge-color',
    name: 'Renkli Kartuş',
    description: '600 Art Kapasitesi - Premium',
    price: 3500,
    image: 'https://maglev.com.tr/img/cafepaste-banner.png'
  },
  {
    id: 'cleaning-kit',
    name: 'Temizlik Kiti',
    description: '1 Yıllık Bakım Seti',
    price: 750,
    image: 'https://maglev.com.tr/img/cafepaste-banner.png'
  }
];

export interface PaymentOptionConfig {
  id: 'credit-card' | 'bank-transfer' | 'pre-payment' | 'installment-3' | 'installment-6' | 'installment-12';
  label: string;
  sublabel: string; // Supports tokens: {taksit} → monthly installment, {on_odeme} → deposit amount
  enabled: boolean;
  sort_order: number;
  interest_rate?: number; // % faiz/komisyon oranı — taksit seçenekleri için
}

export interface OfferExperience {
  id?: string;
  campaign_id?: string | null;
  language_code: string;
  hero_title: string;
  hero_subtitle: string;
  tab_models_label: string;
  tab_summary_label: string;
  tab_support_label: string;
  card_shipping_label: string;
  card_shipping_value: string;
  card_shipping_status: string;
  card_capacity_label: string;
  card_capacity_value: string;
  card_capacity_status: string;
  card_delivery_label: string;
  card_delivery_value: string;
  card_delivery_status: string;
  cta_primary: string;
  cta_secondary: string;
  cta_payment: string;
  support_helper_text: string;
  support_disclaimer_text: string;
  badge_text: string;
  payment_options?: PaymentOptionConfig[] | null;
  // Final Offer View content
  final_offer_title?: string;
  final_offer_description?: string;
  final_offer_subtotal_label?: string;
  final_offer_discount_label?: string;
  final_offer_total_label?: string;
  final_offer_confirm_button?: string;
  final_offer_reservation_title?: string;
  // New offer page fields
  final_offer_trust_badge?: string;
  final_offer_demand_title?: string;
  final_offer_demand_subtitle?: string;
  info_strip_launch_label?: string;
  info_strip_launch_value?: string;
  info_strip_capacity_label?: string;
  info_strip_shipping_label?: string;
  info_strip_shipping_value?: string;
  info_strip_delivery_value?: string;
  /** Geri sayım altındaki fiyat & teslimat sabitleme notu. {{launchMonth}} ve
   *  {{delivery}} yer tutucularını destekler. Boşsa i18n offer:urgency.reservationNote'a düşer. */
  info_strip_reservation_note?: string;
  // Deposit lifecycle metinleri
  deposit_badge_label?: string;
  deposit_price_updated_label?: string;
  deposit_expired_label?: string;
  deposit_pay_button?: string;
  deposit_pay_updated_button?: string;
  deposit_expired_message?: string;
  deposit_expired_submessage?: string;
  deposit_countdown_text?: string;
  deposit_fomo_reapply_text?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerDevice {
  id: string;
  lead_id?: string | null;
  product_model: string;
  serial_number?: string | null;
  purchase_date?: string | null;
  warranty_start_date?: string | null;
  warranty_end_date?: string | null;
  status: 'active' | 'inactive' | 'service' | 'retired' | string;
  lifecycle_status?: 'manufactured' | 'in_stock' | 'assigned' | 'active' | 'service' | 'retired' | string;
  country?: string | null;
  notes?: string | null;
  manufactured_at?: string | null;
  assigned_at?: string | null;
  assigned_by?: string | null;
  warranty_months?: number;
  warranty_voided?: boolean;
  warranty_void_reason?: string | null;
  warranty_voided_at?: string | null;
  warranty_voided_by?: string | null;
  batch_number?: string | null;
  firmware_version?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeviceRegistrationRequest {
  id: string;
  lead_id: string;
  serial_number: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  admin_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
}

export interface WarrantyConfiguration {
  id: string;
  product_model: string;
  default_warranty_months: number;
  max_extension_months: number;
  warranty_terms?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LabelSettings {
  widthMm: number;
  heightMm: number;
  dpmm: number;
  showBrandName: boolean;
  showModel: boolean;
  showBarcode: boolean;
  showQrCode: boolean;
  showDate: boolean;
  showBatch: boolean;
  brandText: string;
  brandFontSize: number;
  modelFontSize: number;
  detailFontSize: number;
  barcodeHeight: number;
  qrSize: number;
}

export interface ServiceRequest {
  id: string;
  customer_device_id?: string | null;
  lead_id: string;
  request_type: 'technical_support' | 'maintenance' | 'installation' | 'warranty' | 'other' | string;
  status: 'new' | 'shipped_to_center' | 'triaged' | 'in_progress' | 'testing' | 'shipped_to_customer' | 'resolved' | 'closed' | string;
  priority: 'low' | 'normal' | 'high' | 'urgent' | string;
  title: string;
  description: string;
  preferred_contact_method: 'whatsapp' | 'phone' | 'email' | string;
  shipping_code?: string | null;
  shipping_provider?: string | null;
  shipping_tracking_number?: string | null;
  shipping_status?: 'pending' | 'shipped' | 'delivered' | 'received' | string;
  is_vip_priority?: boolean;
  diagnostic_logs?: any;
  assigned_to?: string | null;
  sla_response_due_at?: string | null;
  sla_resolution_due_at?: string | null;
  first_responded_at?: string | null;
  escalated_at?: string | null;
  escalation_reason?: string | null;
  rma_number?: string | null;
  resolved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ConsumableOrder {
  id: string;
  lead_id: string;
  customer_device_id?: string | null;
  item_type: 'cartridge' | 'cleaning_kit' | 'accessory' | 'other' | string;
  quantity: number;
  notes?: string | null;
  status: 'new' | 'contacted' | 'quoted' | 'paid' | 'fulfilled' | 'cancelled' | string;
  created_at?: string;
  updated_at?: string;
}

// -------------------------------------------------------------
// ROUND 16: PRODUCT CATALOG & PRICING
// -------------------------------------------------------------

export interface ProductCompareSpec {
  label: string;
  value: string;
}

export interface ProductLocalizedContent {
  id: string;
  product_id: string;
  language_code: string;
  name: string;
  short_description: string | null;
  description: string | null;
  feature_list: string[];
  badge_text: string | null;
  use_case_tags: { label: string; active: boolean }[];
  speed: string | null;
  capacity: string | null;
  capacity_label: string | null;
  is_recommended: boolean;
  /** Admin-editable compare-modal rows. Each {label, value} is one row per product. */
  compare_specs?: ProductCompareSpec[];
  created_at: string;
  updated_at: string;
}

export interface ProductMedia {
  id: string;
  product_id: string;
  media_type: 'image' | 'video' | 'doc' | 'whatsapp_marketing';
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductPackageLocalizedContent {
  id: string;
  product_package_id: string;
  language_code: string;
  package_name: string;
  package_description: string | null;
  highlights: string[];
  created_at: string;
  updated_at: string;
}

export interface CatalogProductPackage {
  id: string;
  product_id: string;
  package_code: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  localized?: ProductPackageLocalizedContent[];
}

export interface CatalogProduct {
  id: string;
  product_code: string;
  product_type: 'machine' | 'consumable' | 'accessory' | 'service';
  is_active: boolean;
  sort_order: number;
  list_price: number;
  launch_price: number;
  recommended_products?: string[];
  created_at: string;
  updated_at: string;
  localized?: ProductLocalizedContent[];
  hero_video_url?: string;
  /** Final teklif sayfasındaki hero için ürün başına özel video. Boşsa hero_video_url kullanılır. */
  final_offer_video_url?: string;
  pdp_hero_images?: string[];
  media?: ProductMedia[];
  packages?: CatalogProductPackage[];
}

export interface PricingRule {
  id: string;
  product_id: string | null;
  product_package_id: string | null;
  market_code: string | null;
  country_code: string | null;
  campaign_id: string | null;
  currency_code: string;
  price_type: 'full_price' | 'deposit' | 'monthly';
  amount: number;
  /** Launch / discounted price. NULL means use `amount` unchanged. */
  launch_amount?: number | null;
  /** Reservation deposit percent for this country (overrides campaign default). */
  deposit_percent?: number | null;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  priority: number;
  created_at: string;
  updated_at: string;

  // Relations typically populated via joined queries
  products?: { product_code: string };
  product_packages?: { package_code: string };
  campaigns?: { name: string };
}

// -------------------------------------------------------------
// ROUND 17: PRODUCT DETAIL CONTENT MANAGEMENT
// -------------------------------------------------------------

export interface ProductDetailSection {
  id: string;
  product_id: string;
  language_code: string;
  section_type: string;
  title: string | null;
  eyebrow?: string | null;
  sub_text?: string | null;
  is_active: boolean;
  show_on_desktop: boolean;
  show_on_mobile: boolean;
  hide_header_desktop?: boolean;
  hide_header_mobile?: boolean;
  bg_color_mobile?: string | null;
  bg_color_desktop?: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;

  /** true ise final teklif sayfasında render edilir. Default false. */
  show_on_final_offer?: boolean;
  show_on_final_offer_mobile?: boolean;
  show_on_final_offer_desktop?: boolean;
  /** Final teklif için section başlığı override. Null/boş ise PDP title. */
  final_offer_title?: string | null;
  final_offer_eyebrow?: string | null;
  final_offer_subtitle?: string | null;

  // Joined relation array
  items?: ProductDetailItem[];
}

export interface ProductDetailItem {
  id: string;
  section_id: string;
  title: string | null;
  description: string | null;
  value_text: string | null;
  media_url: string | null;
  icon: string | null;
  icon_name: string | null;
  icon_value: string | null;
  sub_text: string | null;
  extra?: Record<string, any>;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  /** Final teklif sayfasında item gizle. Default false. */
  hidden_on_final_offer?: boolean;
  /** Final teklif sayfası için bu item'a özel metin override'ları. */
  final_offer_overrides?: {
    title?: string | null;
    value_text?: string | null;
    description?: string | null;
    icon_value?: string | null;
  };
}

// -------------------------------------------------------------
// LANDING PAGE CMS
// -------------------------------------------------------------

export interface LandingPageSection {
  id: string;
  section_type: string;
  title: string | null;
  is_active: boolean;
  sort_order: number;
  config: Record<string, any>;
  config_i18n?: Record<string, Record<string, any>>;
  language_code?: string;
  created_at?: string;
  updated_at?: string;
  items?: LandingPageItem[];
}

export interface LandingPageItem {
  id: string;
  section_id: string;
  title: string | null;
  description: string | null;
  value_text: string | null;
  media_url: string | null;
  icon: string | null;
  extra: Record<string, any>;
  item_i18n?: Record<string, Record<string, any>>;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// ═══ A/B Test Variants ═══
export interface LandingVariant {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  weight: number;
  applicable_languages: string[];
  created_at?: string;
  updated_at?: string;
  sections?: LandingVariantSection[];
}

export interface LandingVariantSection {
  id: string;
  variant_id: string;
  section_type: string;
  is_active: boolean;
  sort_order: number;
  config: Record<string, any>;
  config_i18n?: Record<string, Record<string, any>>;
  created_at?: string;
  items?: LandingVariantItem[];
}

export interface LandingVariantItem {
  id: string;
  variant_section_id: string;
  title: string | null;
  description: string | null;
  value_text: string | null;
  media_url: string | null;
  icon: string | null;
  extra: Record<string, any>;
  item_i18n?: Record<string, Record<string, any>>;
  is_active: boolean;
  sort_order: number;
}

export interface LandingAnalyticsEvent {
  variant_id: string | null;
  visitor_id: string;
  event_type: 'page_view' | 'section_view' | 'click' | 'scroll_depth' | 'cta_click' | 'form_submit';
  section_type?: string;
  metadata?: Record<string, any>;
}

export interface CustomerPortal {
  id: string;
  lead_id: string;
  slug: string;
  token: string;
  onboarding_completed: boolean;
  pin_hash?: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  last_accessed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceSubscription {
  id: string;
  lead_id: string;
  package_type: 'vip_priority' | 'cartridge_subscription' | string;
  status: 'active' | 'expired' | 'cancelled' | string;
  starts_at: string;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// -------------------------------------------------------------
// POST-SALE PORTAL & SERVICE OPERATIONS EXPANSION
// -------------------------------------------------------------

export type CustomerType = 'lead' | 'prospect' | 'customer' | 'churned';

export interface SlaDefinition {
  id: string;
  request_type: string;
  priority: string;
  is_vip: boolean;
  response_hours: number;
  resolution_hours: number;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceNote {
  id: string;
  service_request_id: string;
  author_id?: string | null;
  author_type: 'admin' | 'customer' | 'system';
  content: string;
  is_internal: boolean;
  created_at?: string;
}

export interface KnowledgeArticle {
  id: string;
  category: string;
  title: string;
  content_md: string;
  language_code: string;
  is_published: boolean;
  product_model?: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Final teklif altında gösterilen, ülke + dil bazlı SSS girişi.
 * country_code NULL => global varsayılan (override tanımlı olmayan tüm ülkeler).
 */
export interface OfferFaq {
  id: string;
  country_code: string | null;
  language_code: string;
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingStepTemplate {
  id: string;
  step_key: string;
  title: string;
  description?: string | null;
  sort_order: number;
  is_required: boolean;
  product_model?: string | null;
  /** Long-form how-to shown behind the "Talimatlar" toggle on the portal
   *  training screen. Null/empty hides the toggle entirely — never render an
   *  empty disclosure. Added by 20260906a_onboarding_step_detail.sql. */
  instructions?: string | null;
  /** Rough time the step takes, in minutes. Drives the per-step chip and the
   *  "~N dk kaldı" total. Null falls back to a flat 2 min per remaining step. */
  estimated_minutes?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingChecklist {
  id: string;
  lead_id: string;
  portal_id: string;
  step_key: string;
  completed: boolean;
  completed_at?: string | null;
  created_at?: string;
  // Joined template data
  template?: OnboardingStepTemplate;
}

export interface CartridgeSubscription {
  id: string;
  lead_id: string;
  customer_device_id: string;
  cartridge_type: string;
  quantity: number;
  interval_days: number;
  status: 'active' | 'paused' | 'cancelled' | string;
  next_delivery_at?: string | null;
  last_delivered_at?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined relations
  device?: CustomerDevice;
}

export interface PortalDocument {
  id: string;
  lead_id?: string | null;
  document_type: 'manual' | 'invoice' | 'warranty_cert' | 'service_report' | 'guide' | string;
  title: string;
  file_url: string;
  product_model?: string | null;
  language_code: string;
  created_at?: string;
}

export interface AiChatLog {
  id: string;
  lead_id: string;
  session_id: string;
  messages_json: any[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerHealthScore {
  id: string;
  lead_id: string;
  score: number;
  factors_json: {
    portal_activity?: number;
    service_satisfaction?: number;
    consumable_engagement?: number;
    onboarding_completion?: number;
    payment_health?: number;
  };
  calculated_at?: string;
}

// -------------------------------------------------------------
// MARKET CONFIGURATION (i18n + multi-currency + payment gateways)
// -------------------------------------------------------------

export type PaymentGatewayType = 'paytr' | 'stripe';

export interface MarketConfig {
  id: string;
  market_code: string;                    // e.g. 'TR', 'EU', 'GB', 'US', 'SA', 'AE'
  market_name: string;                    // e.g. 'Turkey', 'European Union'
  default_language: string;               // e.g. 'tr', 'en'
  supported_languages: string[];          // e.g. ['tr'], ['en', 'de', 'fr']
  default_currency: string;               // e.g. 'TRY', 'EUR'
  supported_currencies: string[];         // e.g. ['TRY'], ['EUR', 'GBP']
  payment_gateways: PaymentGatewayType[]; // e.g. ['paytr'], ['stripe']
  vat_rate: number;                       // e.g. 20 (percent)
  timezone: string;                       // e.g. 'Europe/Istanbul'
  date_format: string;                    // e.g. 'dd.MM.yyyy'
  phone_prefix?: string;                  // e.g. '+90', '+1'
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Customer-facing payment option as rendered on the offer panel.
// Persisted as JSONB inside market_payment_settings.payment_options.
export type PaymentOptionId =
  | 'credit-card'
  | 'installment-3'
  | 'installment-6'
  | 'installment-12'
  | 'bank-transfer'
  | 'pre-payment';

export interface PaymentOption {
  id: PaymentOptionId | string;
  label: string;
  sublabel?: string;
  enabled: boolean;
  sort_order: number;
  interest_rate?: number;
}

/**
 * Per-country payment configuration. Each country has its own gateway,
 * customer-facing payment methods, VAT, WhatsApp number, and min order amount.
 * This is the new source of truth — `MarketPaymentSettings` (per-market) below
 * is kept for backwards compatibility but no longer drives the customer flow.
 */
export interface CountryPaymentSettings {
  id: string;
  country_code: string;
  gateway: PaymentGatewayType | 'manual';
  payment_options: PaymentOption[];
  credit_card?: {
    enabled?: boolean;
    max_installments?: number;
    min_installment_amount?: number;
  } | null;
  bank_transfer?: {
    enabled?: boolean;
    iban?: string;
    bank_name?: string;
    account_holder?: string;
    discount_percent?: number;
  } | null;
  pre_payment?: {
    enabled?: boolean;
    deposit_percent?: number;
    price_lock_days?: number;
  } | null;
  installment_3?: { enabled?: boolean; interest_rate?: number } | null;
  installment_6?: { enabled?: boolean; interest_rate?: number } | null;
  installment_12?: { enabled?: boolean; interest_rate?: number } | null;
  paytr_config?: {
    merchant_id?: string;
    merchant_key?: string;
    merchant_salt?: string;
    test_mode?: boolean;
    callback_url?: string;
  } | null;
  stripe_config?: {
    publishable_key?: string;
    secret_key?: string;
    webhook_secret?: string;
  } | null;
  vat_rate?: number | null;
  min_order_amount?: number | null;
  whatsapp_number?: string | null;
  // YENİ: per-country WhatsApp + automation timezone (otomasyon cron'unda kullanılır)
  whatsapp_phone_id?: string | null;
  timezone?: string | null;
  working_hours_enabled?: boolean | null;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  // YENİ: final teklif altındaki SSS bölümünün bu ülke için gösterilip gösterilmeyeceği (ana şalter)
  offer_faq_enabled?: boolean | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketPaymentSettings {
  id: string;
  market_code: string;
  gateway: PaymentGatewayType | 'manual';
  payment_options: PaymentOption[];
  credit_card?: {
    enabled?: boolean;
    max_installments?: number;
    min_installment_amount?: number;
  } | null;
  bank_transfer?: {
    enabled?: boolean;
    iban?: string;
    bank_name?: string;
    account_holder?: string;
    discount_percent?: number;
  } | null;
  pre_payment?: {
    enabled?: boolean;
    deposit_percent?: number;
    price_lock_days?: number;
  } | null;
  installment_3?: { enabled?: boolean; interest_rate?: number } | null;
  installment_6?: { enabled?: boolean; interest_rate?: number } | null;
  installment_12?: { enabled?: boolean; interest_rate?: number } | null;
  paytr_config?: {
    merchant_id?: string;
    merchant_key?: string;
    merchant_salt?: string;
    test_mode?: boolean;
    callback_url?: string;
  } | null;
  // Stripe is a placeholder until backend integration lands.
  stripe_config?: {
    publishable_key?: string;
    secret_key?: string;
    webhook_secret?: string;
  } | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Portal auth session (client-side only, not a DB entity)
export interface PortalSession {
  portalId: string;
  leadId: string;
  slug: string;
  authenticated: boolean;
  customerName?: string;
  companyName?: string;
  portalUserId?: string;
  portalUserRole?: 'owner' | 'staff';
  portalUserName?: string;
}
