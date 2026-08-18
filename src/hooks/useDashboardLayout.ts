import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'cafepaste_dashboard_layout';
// Kullanıcının BİR KEZ görmüş olduğu widget id'leri. Yeni bir widget yayına
// girdiğinde "kullanıcı bunu gizlemiş" ile "bu daha önce hiç var olmamıştı"
// ayrımını yapabilmek için gerekli — bkz. readLayout.
const KNOWN_KEY = 'cafepaste_dashboard_known_widgets';

export const ALL_WIDGET_IDS = [
    'reminders',
    'tasks',
    'support-inbox',
    'kpi-leads', 'kpi-offers', 'kpi-whatsapp', 'kpi-payments',
    'kpi-revenue', 'kpi-conversion', 'kpi-cancellations', 'kpi-service',
    'kpi-bank-transfers-pending',
    'revenue-chart', 'funnel',
    'recent-offers', 'activity',
    // Yeni özel widget'lar
    'recent-reservations', 'pending-shipments', 'urgent-deposits', 'today-activity',
    'site-analytics',
] as const;

export type WidgetId = (typeof ALL_WIDGET_IDS)[number];

export const DEFAULT_LAYOUT: WidgetId[] = [...ALL_WIDGET_IDS];

export const WIDGET_META: Record<WidgetId, { label: string; description: string }> = {
    'reminders': { label: 'Hatırlatmalar', description: 'Vakti gelen ve yaklaşan takip hatırlatmaları' },
    'tasks': { label: 'Görevler', description: 'Onay bekleyen, geciken ve açık ekip görevleri' },
    'support-inbox': { label: 'Destek Kutusu', description: 'Açık destek talepleri' },
    'kpi-leads': { label: 'Lead Sayısı', description: 'Toplam lead' },
    'kpi-offers': { label: 'Teklif Sayısı', description: 'Oluşturulan teklifler' },
    'kpi-whatsapp': { label: 'WhatsApp', description: 'Gönderilen WhatsApp mesajları' },
    'kpi-payments': { label: 'Başarılı Ödeme', description: 'Tamamlanan ödeme sayısı' },
    'kpi-revenue': { label: 'Ciro', description: 'Toplam tahsilat' },
    'kpi-conversion': { label: 'Dönüşüm Oranı', description: 'Lead → satış oranı' },
    'kpi-cancellations': { label: 'İptaller', description: 'İptal edilen rezervasyonlar' },
    'kpi-service': { label: 'Açık Servisler', description: 'Bekleyen servis talepleri' },
    'kpi-bank-transfers-pending': { label: 'Bekleyen Havaleler', description: 'Onay bekleyen havale ödemeleri' },
    'revenue-chart': { label: 'Ciro Grafiği', description: 'Zamana göre ciro trendi' },
    'funnel': { label: 'Satış Hunisi', description: 'Lead → ödeme dönüşümü' },
    'recent-offers': { label: 'Son Teklifler', description: 'Yakın zamanda oluşturulan teklifler' },
    'activity': { label: 'Son Aktiviteler', description: 'Sistem genelinde olaylar' },
    'recent-reservations': { label: 'Son Rezervasyonlar', description: 'Yeni siparişler ve durumları' },
    // DİKKAT: label/description widget'ın KENDİ başlığıyla ve gerçek sorgusuyla aynı
    // kalmalı. "Modül Ekle" listesinde başka, kutucuğun içinde başka şey yazması
    // kullanıcının hangi kutucuğu açtığını bilmemesine yol açar.
    'pending-shipments': { label: 'Bekleyen Sevkiyatlar', description: 'Onaylı ama henüz kargolanmamış siparişler' },
    'urgent-deposits': { label: 'Bekleyen Kaporalar', description: 'Kalan ödemesi beklenen kapora rezervasyonları' },
    'today-activity': { label: 'Bugünkü Aktivite', description: 'Bugünkü lead, teklif, ödeme, ciro özeti' },
    'site-analytics': { label: 'Site Analitiği', description: 'Ziyaretçi, oturum, canlı trafik ve 7 günlük trend' },
};

// KNOWN_KEY mekanizması eklenmeden ÖNCE yayında olan widget'lar. Bu anahtarı hiç
// yazmamış bir kullanıcının "gizlediklerini" yeniden açmamak için gerekli sabit
// fotoğraf: kayıtlı bilinenler yoksa bu liste bilinmiş sayılır, dolayısıyla
// yalnızca bu listede OLMAYAN widget'lar (yeni yayınlananlar) eklenir.
// Yeni widget eklerken bu diziye DOKUNMA — sadece ALL_WIDGET_IDS'e ekle.
const LEGACY_WIDGET_IDS: readonly string[] = [
    'support-inbox',
    'kpi-leads', 'kpi-offers', 'kpi-whatsapp', 'kpi-payments',
    'kpi-revenue', 'kpi-conversion', 'kpi-cancellations', 'kpi-service',
    'kpi-bank-transfers-pending',
    'revenue-chart', 'funnel',
    'recent-offers', 'activity',
    'recent-reservations', 'pending-shipments', 'urgent-deposits', 'today-activity',
    'site-analytics',
];

function validateLayout(stored: unknown): WidgetId[] {
    if (!Array.isArray(stored)) return [...DEFAULT_LAYOUT];
    // Sadece bilinen ID'leri tut, sırayı koru. Kayıp ID'leri otomatik geri EKLEME —
    // kullanıcı bilerek gizlemiş olabilir.
    return stored.filter((id): id is WidgetId =>
        ALL_WIDGET_IDS.includes(id as WidgetId)
    );
}

function readKnown(): Set<string> {
    try {
        const raw = localStorage.getItem(KNOWN_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return new Set(parsed.map(String));
        }
    } catch { /* bozuk kayıt → legacy fotoğrafına düş */ }
    return new Set(LEGACY_WIDGET_IDS);
}

function readLayout(): WidgetId[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [...DEFAULT_LAYOUT];

        const layout = validateLayout(JSON.parse(raw));
        // Kullanıcının daha önce hiç görmediği widget'lar → başa ekle. Yeni bir
        // widget yayına girdiğinde kimsenin "Modül Ekle"den elle bulması gerekmesin;
        // gizlemek isteyen tek tıkla kaldırır. Başa eklenir çünkü sona eklenen bir
        // widget 15 kartlık gridin altında kaybolur ve fark edilmez.
        const known = readKnown();
        const fresh = ALL_WIDGET_IDS.filter(id => !known.has(id) && !layout.includes(id));
        return fresh.length > 0 ? [...fresh, ...layout] : layout;
    } catch {
        return [...DEFAULT_LAYOUT];
    }
}

export function useDashboardLayout() {
    const [layout, setLayoutState] = useState<WidgetId[]>(readLayout);
    const [isEditMode, setIsEditMode] = useState(false);

    // Persist on change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    }, [layout]);

    // Tüm mevcut widget'ları "görüldü" olarak işaretle. readLayout state
    // initializer'ında (effect'lerden ÖNCE) çalıştığı için bu yazım güvenli:
    // yeni widget bir kez eklenir, sonraki açılışlarda tekrar dayatılmaz —
    // kullanıcı gizlerse gizli kalır.
    useEffect(() => {
        try {
            localStorage.setItem(KNOWN_KEY, JSON.stringify([...ALL_WIDGET_IDS]));
        } catch { /* kota dolu vs. → bir dahaki açılışta tekrar denenir */ }
    }, []);

    const setLayout = useCallback((newLayout: WidgetId[]) => {
        setLayoutState(newLayout);
    }, []);

    const resetLayout = useCallback(() => {
        setLayoutState([...DEFAULT_LAYOUT]);
    }, []);

    const toggleEditMode = useCallback(() => {
        setIsEditMode(prev => !prev);
    }, []);

    const hideWidget = useCallback((id: WidgetId) => {
        setLayoutState(prev => prev.filter(w => w !== id));
    }, []);

    const showWidget = useCallback((id: WidgetId) => {
        setLayoutState(prev => (prev.includes(id) ? prev : [...prev, id]));
    }, []);

    const hiddenWidgets = ALL_WIDGET_IDS.filter(id => !layout.includes(id));

    return {
        layout,
        setLayout,
        resetLayout,
        isEditMode,
        toggleEditMode,
        hideWidget,
        showWidget,
        hiddenWidgets,
    };
}
