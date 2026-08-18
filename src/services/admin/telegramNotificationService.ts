import { supabase } from '../../lib/supabase/client';

// Telegram operatör bildirimleri — panel ayarları.
// Tek satırlık tablo (automation_settings ile aynı desen); Worker tarafı
// functions/api/internal/telegramNotify.ts aynı satırı 60sn cache ile okur.

export interface TelegramNotificationSettings {
    id: string;
    is_enabled: boolean;

    notify_payment_success: boolean;
    notify_payment_failed: boolean;
    notify_lead_new: boolean;
    notify_offer_created: boolean;
    notify_wa_inbound: boolean;
    notify_wa_not_interested: boolean;
    notify_wa_send_failed: boolean;
    notify_system_error: boolean;
    notify_hr_alert: boolean;

    quiet_hours_enabled: boolean;
    quiet_hours_start: number;
    quiet_hours_end: number;
    money_bypasses_quiet_hours: boolean;
    tz_offset: number;

    allow_reply_from_telegram: boolean;

    updated_at: string;
}

/** Panelde gruplu gösterim için olay tanımları — tek kaynak. */
export type NotificationCategoryKey = 'money' | 'sales' | 'chat' | 'system';

export interface NotificationToggleDef {
    field: keyof TelegramNotificationSettings;
    label: string;
    description: string;
    /** Bildirimde görünen ikon — panelde de aynısını göstererek eşleştirme kolaylaşır. */
    emoji: string;
}

export const NOTIFICATION_GROUPS: Array<{
    key: NotificationCategoryKey;
    title: string;
    description: string;
    items: NotificationToggleDef[];
}> = [
    {
        key: 'money',
        title: 'Para hareketleri',
        description: 'Sessiz saatleri delebilen tek kategori — gece gelen ödeme beklemez.',
        items: [
            { field: 'notify_payment_success', emoji: '💰', label: 'Ödeme alındı', description: 'Kapora veya tam ödeme başarıyla tahsil edildiğinde.' },
            { field: 'notify_payment_failed', emoji: '🔴', label: 'Ödeme başarısız', description: 'Ödeme reddedildiğinde, başarısızlık sebebiyle birlikte.' },
        ],
    },
    {
        key: 'sales',
        title: 'Satış',
        description: 'Yeni fırsatlar ve teklif hareketleri.',
        items: [
            { field: 'notify_lead_new', emoji: '🆕', label: 'Yeni lead', description: 'WhatsApp\'tan ilk kez yazan anında; web formu ve reklam içe aktarımları 15 dakika içinde.' },
            { field: 'notify_offer_created', emoji: '📤', label: 'Teklif gönderildi', description: 'Teklif oluşturulup müşteriye iletildiğinde — gönderilemediğinde de bildirir.' },
        ],
    },
    {
        key: 'chat',
        title: 'Sohbet',
        description: 'Yoğun günlerde en çok bildirim üreten kategori. Telefonun susmuyorsa önce burayı kapat.',
        items: [
            { field: 'notify_wa_inbound', emoji: '💬', label: 'Müşteri mesajı', description: 'Her gelen WhatsApp mesajı, içeriğiyle ve cevaplanıp cevaplanmadığı bilgisiyle.' },
            { field: 'notify_wa_not_interested', emoji: '🚫', label: 'İlgilenmiyorum yanıtı', description: 'Müşteri çıkış sinyali verdiğinde — otomasyon ve remarketing\'den çıkarılır.' },
        ],
    },
    {
        key: 'system',
        title: 'Sistem sağlığı',
        description: 'Sessiz arızaları yakalar. Kapatman önerilmez — bunlar kimsenin bakmadığı log\'a düşen hatalar.',
        items: [
            { field: 'notify_wa_send_failed', emoji: '📵', label: 'WhatsApp gönderim hatası', description: 'Meta reddi, token süresi bitişi, kota aşımı. Hata kodu başına saatte bir.' },
            { field: 'notify_system_error', emoji: '⚠️', label: 'Cron arızası', description: 'Zamanlanmış bir görev patladığında. Adım başına saatte bir.' },
            { field: 'notify_hr_alert', emoji: '👥', label: 'İK günlük özeti', description: 'Süresi yaklaşan belge ve sözleşme, silinen mülakat videosu, süresi dolan davet. Günde tek özet.' },
        ],
    },
];

/**
 * /api/internal/telegram-test yanıtı.
 *
 * NEDEN GEREKLİ: bu tablodaki anahtarların hepsi açık olsa bile, Cloudflare'de
 * TELEGRAM_BOT_TOKEN yoksa bildirim gönderimi SESSİZCE no-op olur (tasarım
 * gereği: telegramNotify.ts hiçbir akışı bloklamaz, hata fırlatmaz). O yüzden
 * "ayarlar açık ama bildirim gelmiyor" durumunun tek görünür teşhisi budur.
 */
export interface TelegramConnectionStatus {
    /** false → bot token yok/geçersiz ya da chat_id set edilmemiş. */
    configured: boolean;
    bot_username?: string;
    chat_id?: string;
    /** true → bu çağrı gerçekten Telegram'a mesaj bıraktı. */
    test_message_sent?: boolean;
    error?: string;
    detail?: string;
    next_step?: string;
    /** chat_id henüz yokken bota yazan sohbetler — kuruluma yardım eder. */
    found_chats?: Array<{ chat_id: string | number; type: string; name: string }>;
}

export const AdminTelegramNotificationService = {
    /**
     * Kurulumu uçtan uca dener: bot token geçerli mi, chat_id var mı, mesaj
     * gidiyor mu. Worker ucu admin oturum JWT'si kabul ediyor (verifyAdminOrSecret).
     */
    async testConnection(): Promise<TelegramConnectionStatus> {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Oturum bulunamadı — tekrar giriş yapın.');

        const res = await fetch('/api/internal/telegram-test', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as TelegramConnectionStatus & { error?: string };
        if (!res.ok) throw new Error(body?.error || `Sunucu hatası (${res.status})`);
        return body;
    },

    /** Tek satırı getirir. Tablo boşsa null döner (migration uygulanmamış olabilir). */
    async getSettings(): Promise<TelegramNotificationSettings | null> {
        const { data, error } = await supabase
            .from('telegram_notification_settings')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[AdminTelegramNotificationService] getSettings:', error);
            throw error;
        }
        return (data as TelegramNotificationSettings) || null;
    },

    async updateSettings(
        id: string,
        updates: Partial<TelegramNotificationSettings>,
    ): Promise<TelegramNotificationSettings> {
        const { data, error } = await supabase
            .from('telegram_notification_settings')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[AdminTelegramNotificationService] updateSettings:', error);
            throw error;
        }

        // Denetim izi — diğer ayar sayfalarıyla aynı desen.
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
            await supabase.from('audit_logs').insert({
                user_id: authData.user.id,
                action_type: 'UPDATE',
                entity_type: 'TELEGRAM_NOTIFICATION_SETTINGS',
                entity_id: id,
                new_values: updates,
            }).then(undefined, () => undefined);
        }

        return data as TelegramNotificationSettings;
    },
};
