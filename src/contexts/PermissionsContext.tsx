import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';

// All configurable page keys (admin always has full access)
export const ALL_PAGES: { key: string; label: string; group: string }[] = [
    // Müşteri & CRM
    { key: 'leads', label: 'CRM & Leads', group: 'Müşteri & CRM' },
    { key: 'devices', label: 'Müşteri Cihazları', group: 'Müşteri & CRM' },
    { key: 'sales-support', label: 'Satış Destek', group: 'Müşteri & CRM' },
    { key: 'reminders', label: 'Hatırlatmalar', group: 'Müşteri & CRM' },
    { key: 'onboarding', label: 'Onboarding Monitor', group: 'Müşteri & CRM' },
    { key: 'customer-health', label: 'Müşteri Sağlığı', group: 'Müşteri & CRM' },
    { key: 'consent-records', label: 'KVKK Onay Kayıtları', group: 'Müşteri & CRM' },
    // Ürün & Satış
    { key: 'products', label: 'Ürün Katalogu', group: 'Ürün & Satış' },
    { key: 'offers', label: 'Offer Links', group: 'Ürün & Satış' },
    { key: 'offer-experience', label: 'Offer Experience', group: 'Ürün & Satış' },
    { key: 'pricing', label: 'Fiyatlandırma', group: 'Ürün & Satış' },
    { key: 'campaigns', label: 'Kampanyalar', group: 'Ürün & Satış' },
    // Servis
    { key: 'service/requests', label: 'Servis Talepleri', group: 'Servis' },
    { key: 'service/consumables', label: 'Sarf Siparişleri', group: 'Servis' },
    { key: 'service/sla', label: 'SLA Dashboard', group: 'Servis' },
    { key: 'knowledge-base', label: 'Bilgi Bankası', group: 'Servis' },
    // Chatbot
    { key: 'chatbot', label: 'Chatbot Akışları', group: 'Chatbot & Otomasyon' },
    // Pazarlama
    { key: 'social', label: 'Sosyal Medya', group: 'Pazarlama' },
    { key: 'influencer-applications', label: 'Influencer Başvuruları', group: 'Pazarlama' },
    // CAFEPASTE Angels
    { key: 'angels', label: 'Angels Genel', group: 'CAFEPASTE Angels' },
    { key: 'angels/invitations', label: 'Davetler', group: 'CAFEPASTE Angels' },
    { key: 'angels/creators', label: "Creator'lar", group: 'CAFEPASTE Angels' },
    { key: 'angels/requests', label: 'İşbirliği Talepleri', group: 'CAFEPASTE Angels' },
    { key: 'angels/applications', label: 'Creator Başvuruları', group: 'CAFEPASTE Angels' },
    { key: 'angels/venues', label: 'Mekan Partnerlikleri', group: 'CAFEPASTE Angels' },
    { key: 'angels/content', label: 'Sayfa İçerikleri', group: 'CAFEPASTE Angels' },
    { key: 'angels/photo-examples', label: 'Fotoğraf Örnekleri', group: 'CAFEPASTE Angels' },
    { key: 'angels/settings', label: 'Venue Erişimi', group: 'CAFEPASTE Angels' },
    { key: 'angels/venue-accounts', label: 'Mekan Hesapları', group: 'CAFEPASTE Angels' },
    { key: 'angels/collab-requests', label: 'Talepler & Teklifler', group: 'CAFEPASTE Angels' },
    { key: 'angels/projects', label: 'Projeler', group: 'CAFEPASTE Angels' },
    { key: 'angels/payments', label: 'Ödemeler & Payout', group: 'CAFEPASTE Angels' },
    { key: 'angels/spotlight', label: 'Spotlight', group: 'CAFEPASTE Angels' },
    { key: 'angels/platform-settings', label: 'Platform Ayarları', group: 'CAFEPASTE Angels' },
    // İnsan Kaynakları
    // NOT: Bu anahtarlar yalnızca menü/rota görünürlüğünü kontrol eder. Maaş,
    // prim ve bordro verisinin gerçek koruması hr_* tablolarındaki RLS'tir
    // (hr_is_manager() = super_admin | finance).
    { key: 'hr', label: 'İK Genel Bakış', group: 'İnsan Kaynakları' },
    { key: 'hr/employees', label: 'Personel', group: 'İnsan Kaynakları' },
    { key: 'hr/candidates', label: 'İşe Alım', group: 'İnsan Kaynakları' },
    { key: 'hr/attendance', label: 'Puantaj', group: 'İnsan Kaynakları' },
    { key: 'hr/leaves', label: 'İzinler', group: 'İnsan Kaynakları' },
    { key: 'hr/kpi', label: 'KPI', group: 'İnsan Kaynakları' },
    { key: 'hr/commission', label: 'Prim', group: 'İnsan Kaynakları' },
    { key: 'hr/payroll', label: 'Bordro', group: 'İnsan Kaynakları' },
    { key: 'hr/contract-templates', label: 'Sözleşme Şablonları', group: 'İnsan Kaynakları' },
    { key: 'hr/interviews', label: 'Mülakat Şablonları', group: 'İnsan Kaynakları' },
    { key: 'hr/settings', label: 'İK Ayarları', group: 'İnsan Kaynakları' },
    // Mesajlaşma
    { key: 'whatsapp-chat', label: 'WhatsApp Sohbet', group: 'Mesajlaşma' },
    { key: 'whatsapp-broadcast', label: 'Toplu Pazarlama', group: 'Mesajlaşma' },
    { key: 'whatsapp', label: 'Gönderim Logları', group: 'Mesajlaşma' },
    { key: 'templates', label: 'Şablonlar', group: 'Mesajlaşma' },
    // Finans
    { key: 'orders', label: 'Siparişler', group: 'Finans' },
    { key: 'payments', label: 'Payments', group: 'Finans' },
    { key: 'subscriptions', label: 'Abonelik Yönetimi', group: 'Finans' },
    // Raporlar
    { key: 'reports/funnel', label: 'Huni Analizi', group: 'Raporlar' },
    { key: 'reports/performance', label: 'Performans', group: 'Raporlar' },
    { key: 'reports/automation', label: 'Bot Raporu', group: 'Raporlar' },
    { key: 'reports/service', label: 'Servis Raporu', group: 'Raporlar' },
    { key: 'reports/revenue', label: 'Gelir Analizi', group: 'Raporlar' },
    { key: 'reports/lead-quality', label: 'Lead Kalitesi', group: 'Raporlar' },
    // Otomasyon
    { key: 'automation/tasks', label: 'Auto Tasks', group: 'Otomasyon' },
    { key: 'automation/settings', label: 'Auto Settings', group: 'Otomasyon' },
    // Sistem
    { key: 'settings/roi', label: 'ROI Ayarları', group: 'Sistem' },
    { key: 'settings', label: 'Platform Ayarları', group: 'Sistem' },
    { key: 'audit-logs', label: 'Audit Logs', group: 'Sistem' },
];

type PermissionsMap = Record<string, string[]>; // role -> allowed page keys

interface PermissionsContextValue {
    permissions: PermissionsMap;
    isLoading: boolean;
    canAccess: (role: string | null, pageKey: string) => boolean;
    reload: () => void;
}

export const PermissionsContext = createContext<PermissionsContextValue>({
    permissions: {},
    isLoading: true,
    canAccess: () => false,
    reload: () => {},
});

export const PermissionsProvider = ({ children }: { children: React.ReactNode }) => {
    const [permissions, setPermissions] = useState<PermissionsMap>({});
    const [isLoading, setIsLoading] = useState(true);

    const load = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('role_permissions').select('role, allowed_pages');
        const map: PermissionsMap = {};
        (data || []).forEach((row: any) => { map[row.role] = row.allowed_pages || []; });
        setPermissions(map);
        setIsLoading(false);
    };

    useEffect(() => { load(); }, []);

    const canAccess = (role: string | null, pageKey: string): boolean => {
        if (!role) return false;
        if (role === 'super_admin') return true; // super_admin always has full access
        return (permissions[role] || []).includes(pageKey);
    };

    return (
        <PermissionsContext.Provider value={{ permissions, isLoading, canAccess, reload: load }}>
            {children}
        </PermissionsContext.Provider>
    );
};

export const usePermissions = () => useContext(PermissionsContext);
