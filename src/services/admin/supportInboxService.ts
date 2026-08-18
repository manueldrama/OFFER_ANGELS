import { supabase } from '../../lib/supabase/client';

export type SupportInboxSource = 'sales' | 'service';

export interface SupportInboxItem {
    id: string;
    source: SupportInboxSource;
    status: string;
    customer_name: string | null;
    customer_phone: string | null;
    company_name: string | null;
    title: string;
    subtitle: string;
    created_at: string;
    link: string;
    priority?: string | null;
    channel?: string | null;
}

interface OpenCounts {
    salesNew: number;
    serviceOpen: number;
    total: number;
}

// Statuses that count as "still needs attention" for the service side.
// We include all non-terminal states so the operator never misses one.
const SERVICE_OPEN_STATUSES = ['new', 'triaged', 'in_progress', 'testing', 'shipped_to_center', 'shipped_to_customer'];

export const SupportInboxService = {
    async listOpenRequests(limit: number = 50): Promise<SupportInboxItem[]> {
        const halfLimit = Math.ceil(limit / 2);

        const [salesResult, serviceResult] = await Promise.all([
            supabase
                .from('sales_callback_requests')
                .select('id, customer_name, customer_phone, company_name, channel, status, created_at')
                .eq('status', 'new')
                .order('created_at', { ascending: false })
                .limit(halfLimit),
            supabase
                .from('service_requests')
                .select('id, title, status, priority, created_at, lead_id, leads(customer_name, phone_number, company_name)')
                .in('status', SERVICE_OPEN_STATUSES)
                .order('created_at', { ascending: false })
                .limit(halfLimit),
        ]);

        // İki kaynaktan biri patlarsa yarım liste dönmek, "bekleyen talep yok"
        // demekle aynı kapıya çıkar — operatör kaçırdığını fark edemez.
        // Context (SupportInboxContext) zaten try/catch ile sarıyor.
        if (salesResult.error) throw salesResult.error;
        if (serviceResult.error) throw serviceResult.error;

        const items: SupportInboxItem[] = [];

        for (const row of salesResult.data || []) {
            const channelLabel = row.channel === 'whatsapp' ? 'WhatsApp' : 'Telefon';
            items.push({
                id: row.id,
                source: 'sales',
                status: row.status,
                customer_name: row.customer_name,
                customer_phone: row.customer_phone,
                company_name: row.company_name,
                title: row.customer_name || row.company_name || 'İsimsiz müşteri',
                subtitle: `Geri arama isteği — ${channelLabel}`,
                created_at: row.created_at,
                channel: row.channel,
                link: `/admin/sales-support?openId=${row.id}`,
            });
        }

        for (const row of serviceResult.data || []) {
            const lead = (row as any).leads as { customer_name?: string; phone_number?: string; company_name?: string } | null;
            items.push({
                id: row.id,
                source: 'service',
                status: row.status,
                customer_name: lead?.customer_name || null,
                customer_phone: lead?.phone_number || null,
                company_name: lead?.company_name || null,
                title: row.title || 'Servis talebi',
                subtitle: lead?.customer_name ? `Servis — ${lead.customer_name}` : 'Servis talebi',
                created_at: row.created_at,
                priority: row.priority,
                link: `/admin/service/requests/${row.id}`,
            });
        }

        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return items.slice(0, limit);
    },

    async getOpenCounts(): Promise<OpenCounts> {
        const [salesRes, serviceRes] = await Promise.all([
            supabase
                .from('sales_callback_requests')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'new'),
            supabase
                .from('service_requests')
                .select('id', { count: 'exact', head: true })
                .in('status', SERVICE_OPEN_STATUSES),
        ]);

        if (salesRes.error) throw salesRes.error;
        if (serviceRes.error) throw serviceRes.error;

        const salesNew = salesRes.count || 0;
        const serviceOpen = serviceRes.count || 0;
        return { salesNew, serviceOpen, total: salesNew + serviceOpen };
    },
};
