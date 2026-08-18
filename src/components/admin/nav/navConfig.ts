import {
    LayoutDashboard,
    Filter,
    FileSignature,
    Video,
    Users,
    MessageSquare,
    CreditCard,
    Settings,
    Link as LinkIcon,
    Bot,
    ListTodo,
    PieChart,
    BarChart3,
    Layers,
    Tag,
    Megaphone,
    LayoutTemplate,
    MonitorSmartphone,
    Headset,
    ShoppingCart,
    Package,
    PhoneCall,
    Wrench,
    Bell,
    Calculator,
    ClipboardList,
    UserCog,
    UserX,
    Shield,
    ShieldCheck,
    ShieldAlert,
    GraduationCap,
    Heart,
    BookOpen,
    RefreshCw,
    DollarSign,
    FileBarChart,
    FileText,
    Sparkles,
    Pencil,
    Globe,
    FlaskConical,
    MousePointer2,
    Smartphone,
    Share2,
    CalendarDays,
    Workflow,
    Activity,
    Flame,
    Radio,
    Timer,
    AlarmClock,
    UserCheck,
    UserPlus,
    Building2,
    Image as ImageIcon,
    FolderCheck,
    Star,
    Briefcase,
    Gauge,
    SquareKanban
} from 'lucide-react';

// pageKey: matches keys in PermissionsContext ALL_PAGES. null = always visible to role.
export type NavItem = {
    path: string;
    icon: any;
    label: string;
    pageKey: string | null;
    adminOnly?: boolean;
    external?: boolean;
    /**
     * "Benim Alanım" öğesi — kişinin KENDİ verisi (puantaj, izin, bordro...).
     *
     * 'employee' rolü menüde YALNIZ bu bayraklıları görür. Bir pageKey ile
     * yapılamazdı: pageKey DB'deki role_permissions satırına bakar ve satırı
     * eksik olan HER rolden öğeyi gizlerdi — çalışanın kendi bordrosunu
     * görmesi bir yetki sorusu değildir, veriyi zaten RLS korur.
     */
    employeeArea?: boolean;
};

/* ─── PANEL TABANLARI ──────────────────────────────────────────────────────
 *
 * Aynı panel İKİ ADRESTE yaşar: /admin (yalnız super_admin) ve /team (diğer
 * herkes). Kabuk, menü ve sayfalar tek kopyadır; değişen yalnızca adres öneki.
 *
 * KANONİK UZAY = '/admin'.
 *   Bu dosyadaki ~118 yol ve navBadges'teki eşlemeler '/admin/...' olarak
 *   YAZILI KALIR. Yolları tabana göre yeniden yazmak, aynı bilgiyi iki uzayda
 *   tutmak demekti; eşleşmeyi kaçıran her yer (rozet, aktif satır, puantaj
 *   bölümü) sessizce yanlış çalışırdı.
 *
 *   Bunun yerine iki yönde çeviri yapılır:
 *     • withBase()        kanonik yol  → kullanıcının göreceği adres  (link üretimi)
 *     • toCanonicalPath() gerçek adres → kanonik yol                 (eşleştirme)
 */
export const ADMIN_BASE = '/admin';
export const TEAM_BASE = '/team';
export type PanelBase = typeof ADMIN_BASE | typeof TEAM_BASE;

/**
 * Kanonik menü yolunu, panelin bulunduğu tabana çevirir.
 *
 * Dış bağlantılara (external: true, ör. '/lp?edit=true') ve '/admin' ile
 * başlamayan her şeye DOKUNMAZ — onlar panelin dışındadır.
 */
export function withBase(path: string, base: PanelBase): string {
    if (base === ADMIN_BASE) return path;
    if (path === ADMIN_BASE) return base;
    if (!path.startsWith(ADMIN_BASE + '/')) return path;
    return base + path.slice(ADMIN_BASE.length);
}

/**
 * Gerçek adresi kanonik uzaya çevirir.
 *
 * Aktif satır hesabı, rozet eşlemesi ve puantaj bölüm eşlemesi bunu kullanır;
 * böylece üç yerde ayrı ayrı "hangi tabandayız" sorusu sorulmaz.
 */
export function toCanonicalPath(pathname: string): string {
    if (pathname === TEAM_BASE) return ADMIN_BASE;
    if (pathname.startsWith(TEAM_BASE + '/')) return ADMIN_BASE + pathname.slice(TEAM_BASE.length);
    return pathname;
}

/**
 * Bir menü öğesinin bu rol için görünür olup olmadığı.
 *
 * TEK KAYNAK: sol menü de, sayfa içi kısayol ızgaraları da bunu kullanır.
 * Kural kopyalanırsa, kullanıcının sol menüde göremediği bir sayfa ızgarada
 * görünür ve tıklayınca yetki hatası alır.
 */
export function isNavItemVisible(
    item: NavItem,
    role: string | null,
    canAccess: (role: string | null, pageKey: string) => boolean,
): boolean {
    // Personel menüde YALNIZ kendi alanını görür. Rolsüz hesap da öyle:
    // fail-closed — rol okunamadıysa şirket menüsü değil kişisel alan açılır.
    if (role === 'employee' || role === null) return item.employeeArea === true;
    if (item.adminOnly) return role === 'super_admin';
    if (role === 'super_admin') return true;
    // pageKey null = herkese açık (ör. "Benim Alanım" — veriyi RLS korur).
    if (item.pageKey === null) return true;
    return canAccess(role, item.pageKey);
}

// key    — kararlı grup kimliği; localStorage'daki açık/kapalı durumu bununla saklanır.
//          Grup ETİKETİ değişse bile kullanıcının tercihi kaybolmasın diye ayrı tutuldu.
// icon   — grup başlığındaki kategori simgesi. Gruplar kapalıyken menü bu 15 başlıktan
//          ibaret kaldığı için her grubun TEKİL ikonu olmalı; tekrar eden ikon,
//          kapalı listeyi taranamaz hale getirir.
// label  — null ise grup katlanmaz ve başlıksız render edilir (her zaman görünen kök menü).
export type NavGroup = {
    key: string;
    label: string | null;
    icon: any;
    items: NavItem[];
};

export const navGroups: NavGroup[] = [
    {
        key: 'general',
        label: null,
        icon: Gauge,
        items: [
            { path: '/admin', icon: LayoutDashboard, label: 'Kontrol Paneli', pageKey: null },
            { path: '/admin/live', icon: Radio, label: 'Canlı İzleme', pageKey: null },
        ]
    },
    {
        // BENİM ALANIM — kişinin KENDİ kayıtları. Her rol görür; 'employee'
        // YALNIZ bunu görür (isNavItemVisible). Yollar TeamPortal'ın sekme
        // anahtarlarıyla birebir aynıdır (me/:tab) — ikisi ayrışırsa menü
        // öğesi var olmayan bir sekmeye götürür.
        key: 'me',
        label: 'Benim Alanım',
        icon: UserCheck,
        items: [
            { path: '/admin/me', icon: UserCheck, label: 'Özet', pageKey: null, employeeArea: true },
            { path: '/admin/me/attendance', icon: CalendarDays, label: 'Puantajım', pageKey: null, employeeArea: true },
            { path: '/admin/me/leave', icon: AlarmClock, label: 'İzinlerim', pageKey: null, employeeArea: true },
            { path: '/admin/me/pay', icon: CreditCard, label: 'Ödemelerim', pageKey: null, employeeArea: true },
            { path: '/admin/me/docs', icon: FileText, label: 'Belgelerim', pageKey: null, employeeArea: true },
            { path: '/admin/me/profile', icon: UserCog, label: 'Profilim', pageKey: null, employeeArea: true },
        ]
    },
    {
        // GÖREVLER — İK'dan bağımsız, kendi bölümü. pageKey null + employeeArea:
        // sayfayı HERKES görür (çalışan dahil); kimin hangi görevi görebildiğine
        // RLS karar verir, sayfa role göre Panom/Ekip kapsamı sunar.
        //
        // Not: menü sırasını özelleştirmiş kullanıcıda yeni grup listenin
        // SONUNA düşer (applyGroupOrder kural 2) — sıfırlayınca yerine oturur.
        key: 'tasks',
        label: 'Görevler',
        icon: SquareKanban,
        items: [
            { path: '/admin/tasks', icon: SquareKanban, label: 'Görevler', pageKey: null, employeeArea: true },
        ]
    },
    {
        key: 'angels',
        label: 'CAFEPASTE Angels',
        icon: Sparkles,
        items: [
            { path: '/admin/angels', icon: Sparkles, label: 'Angels Genel', pageKey: 'angels' },
            { path: '/admin/angels/invitations', icon: LinkIcon, label: 'Davetler', pageKey: 'angels/invitations' },
            { path: '/admin/angels/creators', icon: Users, label: 'Creator’lar', pageKey: 'angels/creators' },
            { path: '/admin/angels/applications', icon: UserPlus, label: 'Creator Başvuruları', pageKey: 'angels/applications' },
            { path: '/admin/angels/content', icon: LayoutTemplate, label: 'Sayfa İçerikleri', pageKey: 'angels/content' },
            { path: '/admin/angels/photo-examples', icon: ImageIcon, label: 'Fotoğraf Örnekleri', pageKey: 'angels/photo-examples' },
            // Platform: venue–creator işbirliği hattı
            { path: '/admin/angels/venue-accounts', icon: Building2, label: 'Mekan Hesapları', pageKey: 'angels/venue-accounts' },
            { path: '/admin/angels/collab-requests', icon: MessageSquare, label: 'Talepler & Teklifler', pageKey: 'angels/collab-requests' },
            { path: '/admin/angels/projects', icon: FolderCheck, label: 'Projeler', pageKey: 'angels/projects' },
            { path: '/admin/angels/payments', icon: CreditCard, label: 'Ödemeler & Payout', pageKey: 'angels/payments' },
            { path: '/admin/angels/spotlight', icon: Star, label: 'Spotlight', pageKey: 'angels/spotlight' },
            { path: '/admin/angels/platform-settings', icon: Settings, label: 'Platform Ayarları', pageKey: 'angels/platform-settings' },
            // Legacy (token dizini dönemi)
            { path: '/admin/angels/requests', icon: MessageSquare, label: 'Eski (Token) Talepler', pageKey: 'angels/requests' },
            { path: '/admin/angels/venues', icon: Building2, label: 'Mekan Partnerlikleri', pageKey: 'angels/venues' },
            { path: '/admin/angels/settings', icon: Settings, label: 'Venue Erişimi (Token)', pageKey: 'angels/settings' },
        ]
    },
    {
        key: 'crm',
        label: 'Müşteri & CRM',
        icon: Users,
        items: [
            { path: '/admin/leads', icon: Users, label: 'Müşteri Yönetimi', pageKey: 'leads' },
            { path: '/admin/call-assistant', icon: PhoneCall, label: 'Arama Asistanı', pageKey: 'offers' },
            { path: '/admin/offers', icon: LinkIcon, label: 'Teklif Linkleri', pageKey: 'offers' },
            { path: '/admin/winback', icon: RefreshCw, label: 'Geri Kazanım', pageKey: 'offers' },
            { path: '/admin/not-interested', icon: UserX, label: 'İlgilenmeyenler', pageKey: 'offers' },
            { path: '/admin/remarketing', icon: Megaphone, label: 'Remarketing', pageKey: 'offers' },
            { path: '/admin/offer-reclaim-requests', icon: RefreshCw, label: 'Geri Dönüş Talepleri', pageKey: 'offers' },
            { path: '/admin/reminders', icon: AlarmClock, label: 'Hatırlatmalar', pageKey: 'reminders' },
            { path: '/admin/sales-support', icon: PhoneCall, label: 'Satış Destek', pageKey: 'sales-support' },
            { path: '/admin/support-live', icon: Headset, label: 'Canlı Destek', pageKey: 'sales-support' },
            { path: '/admin/customer-health', icon: Heart, label: 'Müşteri Sağlığı', pageKey: 'customer-health' },
            { path: '/admin/consent-records', icon: ShieldCheck, label: 'KVKK Onay Kayıtları', pageKey: 'consent-records' },
        ]
    },
    {
        key: 'devices',
        label: 'Cihaz Yönetimi',
        icon: MonitorSmartphone,
        items: [
            { path: '/admin/devices', icon: MonitorSmartphone, label: 'Müşteri Cihazları', pageKey: 'devices' },
            { path: '/admin/devices/inventory', icon: Package, label: 'Cihaz Envanteri', pageKey: 'devices' },
            { path: '/admin/devices/warranty', icon: ShieldCheck, label: 'Garanti Takibi', pageKey: 'devices' },
            { path: '/admin/devices/registrations', icon: ClipboardList, label: 'Kayıt Talepleri', pageKey: 'devices' },
        ]
    },
    {
        key: 'service',
        label: 'Servis & Destek',
        icon: Wrench,
        items: [
            { path: '/admin/service/requests', icon: Wrench, label: 'Servis Merkezi', pageKey: 'service/requests' },
            { path: '/admin/service/consumables', icon: ShoppingCart, label: 'Sarf Siparişleri', pageKey: 'service/consumables' },
            { path: '/admin/service/sla', icon: Shield, label: 'SLA Panosu', pageKey: 'service/sla' },
            { path: '/admin/knowledge-base', icon: BookOpen, label: 'Bilgi Bankası', pageKey: 'knowledge-base' },
        ]
    },
    {
        key: 'portal',
        label: 'Müşteri Portalı',
        icon: Globe,
        items: [
            { path: '/admin/portal-management', icon: Globe, label: 'Portal Yönetimi', pageKey: 'portal-management' },
            { path: '/admin/portal-documents', icon: FileText, label: 'Portal Dökümanları', pageKey: 'portal-documents' },
            { path: '/admin/onboarding', icon: GraduationCap, label: 'Onboarding Takibi', pageKey: 'onboarding' },
        ]
    },
    {
        key: 'catalog',
        label: 'Ürün & Katalog',
        icon: Package,
        items: [
            { path: '/admin/products', icon: Package, label: 'Ürün Katalogu', pageKey: 'products' },
            { path: '/admin/offer-experience', icon: LayoutTemplate, label: 'Teklif Deneyimi', pageKey: 'offer-experience' },
            { path: '/admin/offer-experience/editor', icon: Pencil, label: 'Teklif Deneyimi Editör', pageKey: 'offer-experience' },
            { path: '/admin/offer-experience/reservation-note', icon: Timer, label: 'Teklif Geri Sayım Notu', pageKey: 'offer-experience' },
            { path: '/admin/settings/offer-image', icon: FileText, label: 'Teklif Görsel Ayarları', pageKey: null, adminOnly: true },
            { path: '/admin/pricing', icon: Tag, label: 'Fiyatlandırma', pageKey: 'pricing' },
            { path: '/admin/campaigns', icon: Megaphone, label: 'Kampanyalar', pageKey: 'campaigns' },
        ]
    },
    {
        key: 'messaging',
        label: 'Mesajlaşma',
        icon: MessageSquare,
        items: [
            { path: '/admin/whatsapp-chat', icon: MessageSquare, label: 'WhatsApp Sohbet', pageKey: 'whatsapp-chat' },
            { path: '/admin/whatsapp-broadcast', icon: Megaphone, label: 'Toplu Pazarlama', pageKey: 'whatsapp-broadcast' },
            { path: '/admin/whatsapp', icon: ListTodo, label: 'Gönderim Logları', pageKey: 'whatsapp' },
            { path: '/admin/templates', icon: Layers, label: 'Şablonlar', pageKey: 'templates' },
        ]
    },
    {
        key: 'chatbot',
        label: 'Chatbot & Otomasyon',
        icon: Workflow,
        items: [
            { path: '/admin/chatbot', icon: Workflow, label: 'Akış Yönetimi', pageKey: 'chatbot' },
            { path: '/admin/chatbot/subscribers', icon: Users, label: 'Chatbot Aboneleri', pageKey: 'chatbot' },
            { path: '/admin/chatbot/runs', icon: Activity, label: 'Çalıştırma Logları', pageKey: 'chatbot' },
            { path: '/admin/chatbot/settings', icon: Settings, label: 'Instagram Ayarları', pageKey: null, adminOnly: true },
        ]
    },
    {
        key: 'marketing',
        label: 'Pazarlama',
        icon: Megaphone,
        items: [
            { path: '/admin/social', icon: Share2, label: 'Sosyal Medya', pageKey: 'social' },
            { path: '/admin/influencer-applications', icon: Sparkles, label: 'Influencer Başvuruları', pageKey: 'influencer-applications' },
            { path: '/admin/social/calendar', icon: CalendarDays, label: 'Paylaşım Takvimi', pageKey: 'social' },
            { path: '/admin/social/settings', icon: Settings, label: 'Sosyal Medya Ayarları', pageKey: null, adminOnly: true },
            // Standalone Landing Page CMS retired in 6.8.26 — admins manage landing
            // exclusively through A/B Test Varyantları now (the default 'Default Landing'
            // variant is the main page). Sidebar entry hidden; route still works for
            // legacy bookmarks but the page should be considered deprecated.
            // { path: '/admin/landing-editor', icon: Globe, label: 'Landing Page', pageKey: null, adminOnly: true },
            { path: '/admin/landing-variants', icon: FlaskConical, label: 'Landing Page (Varyantlar)', pageKey: null, adminOnly: true },
            { path: '/lp?edit=true', icon: Pencil, label: 'Sayfa Üzerinde Düzenle', pageKey: null, adminOnly: true, external: true },
            { path: '/admin/ab-test', icon: BarChart3, label: 'A/B Test Panosu', pageKey: null, adminOnly: true },
            { path: '/admin/heatmap', icon: MousePointer2, label: 'Isı Haritası', pageKey: null, adminOnly: true },
            { path: '/admin/device-preview', icon: Smartphone, label: 'Cihaz Önizleme', pageKey: null, adminOnly: true },
            { path: '/admin/seo-pages/roadmap', icon: FileText, label: 'SEO Yol Haritası', pageKey: null, adminOnly: true },
            { path: '/admin/seo-pages', icon: FileText, label: 'SEO Sayfaları', pageKey: null, adminOnly: true },
            { path: '/admin/seo-pages/ai-settings', icon: Sparkles, label: 'SEO AI Ayarları', pageKey: null, adminOnly: true },
            { path: '/admin/seo-monitor', icon: Sparkles, label: 'SEO GEO Monitor', pageKey: null, adminOnly: true },
            { path: '/admin/seo-sitemap', icon: FileText, label: 'Sitemap Yöneticisi', pageKey: null, adminOnly: true },
        ]
    },
    {
        key: 'finance',
        label: 'Finans',
        icon: CreditCard,
        items: [
            { path: '/admin/orders', icon: ShoppingCart, label: 'Siparişler', pageKey: 'orders' },
            { path: '/admin/payments', icon: CreditCard, label: 'Ödemeler', pageKey: 'payments' },
            { path: '/admin/payment-settings', icon: Settings, label: 'Ödeme Ayarları', pageKey: null, adminOnly: true },
            { path: '/admin/markets', icon: Globe, label: 'Pazar Yönetimi', pageKey: null, adminOnly: true },
            { path: '/admin/invoice-forms', icon: FileText, label: 'Fatura Formları', pageKey: null, adminOnly: true },
            { path: '/admin/contracts', icon: FileText, label: 'Sözleşmeler', pageKey: null, adminOnly: true },
            { path: '/admin/contract-acceptances', icon: ShieldCheck, label: 'Sözleşme Onayları', pageKey: null, adminOnly: true },
            { path: '/admin/subscriptions', icon: RefreshCw, label: 'Abonelik Yönetimi', pageKey: 'subscriptions' },
        ]
    },
    {
        key: 'reports',
        label: 'Raporlar',
        icon: BarChart3,
        items: [
            { path: '/admin/analytics', icon: Activity, label: 'Site Analitiği', pageKey: 'analytics' },
            { path: '/admin/reports/funnel', icon: PieChart, label: 'Huni Analizi', pageKey: 'reports/funnel' },
            { path: '/admin/reports/performance', icon: BarChart3, label: 'Performans', pageKey: 'reports/performance' },
            { path: '/admin/reports/automation', icon: Bot, label: 'Bot Raporu', pageKey: 'reports/automation' },
            { path: '/admin/reports/service', icon: FileBarChart, label: 'Servis Raporu', pageKey: 'reports/service' },
            { path: '/admin/reports/revenue', icon: DollarSign, label: 'Gelir Analizi', pageKey: 'reports/revenue' },
            { path: '/admin/reports/lead-quality', icon: Flame, label: 'Lead Kalitesi', pageKey: 'reports/lead-quality' },
        ]
    },
    {
        key: 'automation',
        label: 'Otomasyon',
        icon: Bot,
        items: [
            { path: '/admin/automation/tasks', icon: ListTodo, label: 'Otomasyon Görevleri', pageKey: 'automation/tasks' },
            { path: '/admin/automation/settings', icon: Bot, label: 'Otomasyon Ayarları', pageKey: 'automation/settings' },
            { path: '/admin/templates', icon: MessageSquare, label: 'WhatsApp Şablonları', pageKey: 'whatsapp/templates' },
        ]
    },
    {
        key: 'hr',
        label: 'İnsan Kaynakları',
        icon: Briefcase,
        items: [
            { path: '/admin/hr', icon: Briefcase, label: 'İK Genel Bakış', pageKey: 'hr' },
            { path: '/admin/hr/employees', icon: Users, label: 'Personel', pageKey: 'hr/employees' },
            { path: '/admin/hr/candidates', icon: UserPlus, label: 'İşe Alım', pageKey: 'hr/candidates' },
            { path: '/admin/hr/jobs', icon: Briefcase, label: 'İş İlanları', pageKey: 'hr/candidates' },
            // Huni raporu ise alim yetkisiyle acilir: ayri bir pageKey, IK'nin
            // yetki tablosunda ellemesi gereken yeni bir satir demek olurdu.
            { path: '/admin/hr/funnel', icon: Filter, label: 'İşe Alım Hunisi', pageKey: 'hr/candidates' },
            { path: '/admin/hr/attendance', icon: CalendarDays, label: 'Puantaj', pageKey: 'hr/attendance' },
            { path: '/admin/hr/leaves', icon: AlarmClock, label: 'İzinler', pageKey: 'hr/leaves' },
            { path: '/admin/hr/kpi', icon: BarChart3, label: 'KPI', pageKey: 'hr/kpi' },
            { path: '/admin/hr/commission', icon: DollarSign, label: 'Prim', pageKey: 'hr/commission' },
            { path: '/admin/hr/payroll', icon: CreditCard, label: 'Bordro', pageKey: 'hr/payroll' },
            { path: '/admin/hr/contract-templates', icon: FileSignature, label: 'Sözleşme Şablonları', pageKey: 'hr/contract-templates' },
            { path: '/admin/hr/interviews', icon: Video, label: 'Mülakat Şablonları', pageKey: 'hr/interviews' },
            { path: '/admin/hr/settings', icon: Settings, label: 'İK Ayarları', pageKey: 'hr/settings' },
            // "Benim Sayfam" buradan "Benim Alanım" grubuna taşındı: İK grubu
            // YÖNETİM işidir, kişinin kendi kaydı değil.
        ]
    },
    {
        key: 'system',
        label: 'Sistem',
        icon: Settings,
        items: [
            { path: '/admin/users', icon: UserCog, label: 'Kullanıcı Yönetimi', pageKey: null, adminOnly: true },
            { path: '/admin/permissions', icon: Shield, label: 'Yetki Yönetimi', pageKey: null, adminOnly: true },
            { path: '/admin/blocked-contacts', icon: ShieldAlert, label: 'Engellenenler', pageKey: null, adminOnly: true },
            { path: '/admin/settings/roi', icon: Calculator, label: 'ROI Ayarları', pageKey: 'settings/roi' },
            { path: '/admin/settings/ai-persona', icon: Bot, label: 'AI Danışman Eğitimi', pageKey: null, adminOnly: true },
            { path: '/admin/settings/name-gender', icon: UserCheck, label: 'İsim → Hitap İstisnaları', pageKey: 'settings' },
            { path: '/admin/settings/notifications', icon: Bell, label: 'Bildirim Ayarları', pageKey: null, adminOnly: true },
            { path: '/admin/settings', icon: Settings, label: 'Platform Ayarları', pageKey: 'settings' },
            { path: '/admin/ai-chat-logs', icon: MessageSquare, label: 'AI Sohbet Logları', pageKey: null, adminOnly: true },
            { path: '/admin/audit-logs', icon: ClipboardList, label: 'Denetim Logları', pageKey: 'audit-logs' },
            { path: '/admin/languages', icon: Globe, label: 'Dil & Çeviri', pageKey: null, adminOnly: true },
            { path: '/admin/diagnostics', icon: Wrench, label: 'Sistem Teşhis', pageKey: null, adminOnly: true },
            ...(import.meta.env.VITE_GOOGLE_SHEETS_INTEGRATION_ENABLED === 'true' ? [
                { path: '/admin/integrations/google-sheets', icon: Layers, label: 'Sheet Entegrasyonları', pageKey: 'integrations/google-sheets' }
            ] : [])
        ]
    },
];

/**
 * Aktif menü satırını belirler.
 *
 * INVARIANT: aynı grup içinde EN UZUN eşleşen path kazanır. Aksi halde
 * /admin/devices ile /admin/devices/inventory aynı anda aktif yanar.
 * /admin kökü tam eşleşme ister, yoksa her admin rotasında aktif olurdu.
 *
 * Kardeşler groupKey üzerinden KANONİK listeden okunur, çağıranın elindeki
 * listeden değil: arama/izin filtresi bir kardeşi listeden düşürdüğünde
 * "daha uzun path var mı" sorusu yanlış cevaplanır ve üst satır da yanardı.
 */
export function isNavItemActive(item: NavItem, groupKey: string, pathname: string): boolean {
    if (item.path === '/admin') return pathname === '/admin';
    const matches = (p: string) => pathname === p || pathname.startsWith(p + '/');
    if (!matches(item.path)) return false;
    const siblings = navGroups.find((g) => g.key === groupKey)?.items ?? [];
    return !siblings.some(
        (other) => other.path !== item.path && other.path.length > item.path.length && matches(other.path)
    );
}

/**
 * Kullanıcının sürükleyerek belirlediği grup sırasını uygular.
 *
 * ÜÇ KURAL:
 *   1) label === null olan kök grup (Kontrol Paneli / Canlı İzleme) SABİT ve hep
 *      tepededir; sürüklenemez. Aksi halde ana panele dönüş linki menünün dibine
 *      gömülebilirdi.
 *   2) Kayıtlı sırada GEÇMEYEN grup atılmaz, SONA EKLENİR. Koda sonradan yeni bir
 *      grup eklendiğinde, daha önce sürükleme yapmış herkeste o grup görünmez
 *      olurdu — sessiz kaybolma en kötü hata türüdür.
 *   3) Kayıtlı sırada olup artık var olmayan anahtar yok sayılır (silinen grup,
 *      ya da izin filtresine takılan grup).
 */
export function applyGroupOrder(groups: NavGroup[], order: string[]): NavGroup[] {
    if (order.length === 0) return groups;
    const pinned = groups.filter((g) => g.label === null);
    const rest = groups.filter((g) => g.label !== null);
    const rank = new Map(order.map((k, i) => [k, i]));
    const known = rest
        .filter((g) => rank.has(g.key))
        .sort((a, b) => rank.get(a.key)! - rank.get(b.key)!);
    const fresh = rest.filter((g) => !rank.has(g.key));
    return [...pinned, ...known, ...fresh];
}
