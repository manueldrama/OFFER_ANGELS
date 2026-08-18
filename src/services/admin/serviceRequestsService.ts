import { supabase } from '../../lib/supabase/client';
import { sanitizeSearchTerm } from '../../utils/searchFilter';
import { ServiceRequest } from '../../types';
import { AdminWhatsAppService } from './whatsappService';
import { PortalNotificationsService } from '../portalNotificationsService';

export const AdminServiceRequestsService = {
    // ─── SLA Helpers ───────────────────────────────────────────
    async computeSla(requestType: string, priority: string, isVip: boolean) {
        const { data } = await supabase
            .from('sla_definitions')
            .select('response_hours, resolution_hours')
            .eq('request_type', requestType)
            .eq('priority', priority)
            .eq('is_vip', isVip)
            .maybeSingle();
        if (!data) return {};
        const now = new Date();
        return {
            sla_response_due_at: new Date(now.getTime() + data.response_hours * 3600000).toISOString(),
            sla_resolution_due_at: new Date(now.getTime() + data.resolution_hours * 3600000).toISOString(),
        };
    },

    // ─── Assignment ────────────────────────────────────────────
    async assignRequest(requestId: string, userId: string | null) {
        const updates: any = { assigned_to: userId };
        if (userId && !updates.first_responded_at) {
            // Mark first response when first assigned
            const { data: req } = await supabase.from('service_requests').select('first_responded_at').eq('id', requestId).single();
            if (req && !req.first_responded_at) {
                updates.first_responded_at = new Date().toISOString();
            }
        }
        const { error } = await supabase.from('service_requests').update(updates).eq('id', requestId);
        if (error) throw error;

        // Send portal notification when technician is assigned
        if (userId) {
            const { data: sr } = await supabase.from('service_requests').select('lead_id, title').eq('id', requestId).single();
            if (sr?.lead_id) {
                PortalNotificationsService.createNotification(sr.lead_id, {
                    title: 'Teknisyen Atandı',
                    message: `"${sr.title}" başlıklı servis talebinize bir teknisyen atandı. En kısa sürede sizinle iletişime geçilecektir.`,
                    type: 'service',
                    link: '/portal/service',
                }).catch(err => console.error('[ServiceRequests] Portal notification failed:', err));
            }
        }
    },

    // ─── Technicians list ──────────────────────────────────────
    async listTechnicians() {
        const { data, error } = await supabase
            .from('sales_users')
            .select('id, full_name, role')
            .in('role', ['super_admin', 'support_admin', 'technician'])
            .order('full_name');
        if (error) throw error;
        return data || [];
    },

    // 1) List Tickets (with filtering)
    async listRequests(
        params: { search?: string; status?: string; type?: string; priority?: string; page?: number; limit?: number }
    ) {
        const { search, status, type, priority, page = 1, limit = 20 } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase.from('service_requests').select(`
            *,
            leads(customer_name, phone_number, company_name),
            customer_devices(product_model, serial_number),
            assigned_user:sales_users!service_requests_assigned_to_fkey(id, full_name)
        `, { count: 'exact' });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        if (type && type !== 'all') {
            query = query.eq('request_type', type);
        }
        if (priority && priority !== 'all') {
            query = query.eq('priority', priority);
        }
        const s = sanitizeSearchTerm(search);
        if (s) {
            query = query.or(`title.ilike.%${s}%, description.ilike.%${s}%`);
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[AdminServiceRequestsService] Error listing requests:', error);
            throw error;
        }

        return {
            requests: data as (ServiceRequest & {
                leads: { customer_name: string; phone_number: string };
                customer_devices?: { product_model: string; serial_number: string } | null;
            })[],
            count: count || 0
        };
    },

    // 2) Get Tickets for a Lead
    async getRequestsByLead(leadId: string): Promise<ServiceRequest[]> {
        const { data, error } = await supabase
            .from('service_requests')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[AdminServiceRequestsService] Error fetching requests for lead:', error);
            throw error;
        }

        return data as ServiceRequest[];
    },

    // 3) Create Request (if Admin initiates for Customer) — auto-computes SLA
    async createRequest(requestData: Omit<ServiceRequest, 'id' | 'created_at' | 'updated_at' | 'resolved_at'>) {
        // Auto-compute SLA deadlines
        const sla = await this.computeSla(requestData.request_type, requestData.priority, requestData.is_vip_priority || false);
        const rma_number = `RMA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        const { error, data } = await supabase
            .from('service_requests')
            .insert([{ ...requestData, ...sla, rma_number }])
            .select()
            .single();

        if (error) {
            console.error('[AdminServiceRequestsService] Error creating request:', error);
            throw error;
        }

        return data;
    },

    // 4) Update Status / Priority / Resolving
    async updateRequest(requestId: string, updates: Partial<ServiceRequest>) {
        if (updates.status === 'resolved' || updates.status === 'closed') {
            if (!updates.resolved_at) {
                updates.resolved_at = new Date().toISOString();
            }
        } else if (updates.status && updates.status !== 'resolved' && updates.status !== 'closed') {
            // Nullify resolution if reopened
            updates.resolved_at = null;
        }

        const { error, data } = await supabase
            .from('service_requests')
            .update(updates)
            .eq('id', requestId)
            .select(`*, leads(phone_number, customer_name)`)
            .single();

        if (error) {
            console.error('[AdminServiceRequestsService] Error updating request:', error);
            throw error;
        }

        // Trigger WhatsApp notification on status change to 'in_progress' or 'resolved'
        if (updates.status && data.leads?.phone_number) {
            let msg = '';
            if (updates.status === 'in_progress') {
                msg = `Sayın ${data.leads.customer_name}, "${data.title}" başlıklı servis talebiniz işleme alınmıştır. Ekiplerimiz en kısa sürede sizinle iletişime geçecektir.`;
            } else if (updates.status === 'resolved') {
                msg = `Sayın ${data.leads.customer_name}, "${data.title}" başlıklı servis talebiniz çözümlenmiştir. Bizi tercih ettiğiniz için teşekkür ederiz.`;
            } else if (updates.status === 'shipped_to_center') {
                msg = `Sayın ${data.leads.customer_name}, cihazınız merkez servisimize ulaşmak üzere kargoya verilmiştir. Takip kodunuzu portal üzerinden görebilirsiniz.`;
            } else if (updates.status === 'testing') {
                msg = `Sayın ${data.leads.customer_name}, cihazınızın onarımı tamamlanmış olup kalite kontrol ve test aşamasına geçilmiştir.`;
            } else if (updates.status === 'shipped_to_customer') {
                msg = `Sayın ${data.leads.customer_name}, cihazınızın servis süreci tamamlanmış ve size ulaştırılmak üzere kargoya verilmiştir.`;
            }

            if (msg) {
                AdminWhatsAppService.sendManualMessage({
                    lead_id: data.lead_id,
                    phone_number: data.leads.phone_number,
                    message_content: msg,
                    template_name: `service_${updates.status}`
                }).catch(err => console.error('[AdminServiceRequestsService] WhatsApp notification failed:', err));
            }
        }

        // Send portal notification on status change
        if (updates.status && data.lead_id) {
            const statusMessages: Record<string, { title: string; message: string }> = {
                in_progress: { title: 'Servis Talebiniz İşleme Alındı', message: `"${data.title}" başlıklı servis talebiniz işleme alınmıştır.` },
                resolved: { title: 'Servis Talebiniz Tamamlandı', message: `"${data.title}" başlıklı servis talebiniz çözümlenmiştir.` },
                shipped_to_center: { title: 'Cihazınız Kargoya Verildi', message: `"${data.title}" - Cihazınız merkez servisimize gönderilmek üzere kargoya verilmiştir.` },
                testing: { title: 'Cihazınız Test Ediliyor', message: `"${data.title}" - Cihazınızın onarımı tamamlanmış olup test aşamasındadır.` },
                shipped_to_customer: { title: 'Cihazınız Size Gönderildi', message: `"${data.title}" - Cihazınız size ulaştırılmak üzere kargoya verilmiştir.` },
            };
            const notif = statusMessages[updates.status];
            if (notif) {
                PortalNotificationsService.createNotification(data.lead_id, {
                    ...notif,
                    type: 'service',
                    link: '/portal/service',
                }).catch(err => console.error('[AdminServiceRequestsService] Portal notification failed:', err));
            }
        }

        return data;
    }
};
