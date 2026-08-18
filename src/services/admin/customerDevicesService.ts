import { supabase } from '../../lib/supabase/client';
import { sanitizeSearchTerm } from '../../utils/searchFilter';
import { CustomerDevice, DeviceRegistrationRequest, WarrantyConfiguration } from '../../types';
import { PortalNotificationsService } from '../portalNotificationsService';

export const AdminCustomerDevicesService = {
    // ─── LIST DEVICES (customer-assigned, with optional filtering) ────────
    async listDevices(
        params: { search?: string; status?: string; page?: number; limit?: number }
    ) {
        const { search, status, page = 1, limit = 20 } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase.from('customer_devices').select('*, leads(customer_name, phone_number)', { count: 'exact' })
            .not('lead_id', 'is', null);

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        const s = sanitizeSearchTerm(search);
        if (s) {
            query = query.or(`serial_number.ilike.%${s}%, notes.ilike.%${s}%, product_model.ilike.%${s}%`);
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[AdminCustomerDevicesService] Error listing devices:', error);
            throw error;
        }

        return { devices: data as (CustomerDevice & { leads: { customer_name: string; phone_number: string } | null })[], count: count || 0 };
    },

    // ─── LIST INVENTORY (unassigned devices, production registry) ────────
    async listInventory(
        params: { search?: string; lifecycleStatus?: string; model?: string; page?: number; limit?: number }
    ) {
        const { search, lifecycleStatus, model, page = 1, limit = 20 } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase.from('customer_devices').select('*', { count: 'exact' })
            .is('lead_id', null);

        if (lifecycleStatus && lifecycleStatus !== 'all') {
            query = query.eq('lifecycle_status', lifecycleStatus);
        }
        if (model && model !== 'all') {
            query = query.eq('product_model', model);
        }
        const s = sanitizeSearchTerm(search);
        if (s) {
            query = query.or(`serial_number.ilike.%${s}%, batch_number.ilike.%${s}%, notes.ilike.%${s}%`);
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[AdminCustomerDevicesService] Error listing inventory:', error);
            throw error;
        }

        return { devices: data as CustomerDevice[], count: count || 0 };
    },

    // ─── GET DISTINCT PRODUCT MODELS ──────────────────────────────────────
    async getDistinctModels(): Promise<string[]> {
        const { data, error } = await supabase
            .from('customer_devices')
            .select('product_model')
            .order('product_model');

        if (error) throw error;
        const unique = [...new Set((data || []).map(d => d.product_model).filter(Boolean))];
        return unique;
    },

    // ─── GET DEVICES BY LEAD ─────────────────────────────────────────────
    async getDevicesByLead(leadId: string): Promise<CustomerDevice[]> {
        const { data, error } = await supabase
            .from('customer_devices')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[AdminCustomerDevicesService] Error fetching devices for lead:', error);
            throw error;
        }

        return data as CustomerDevice[];
    },

    // ─── GET DEVICE BY SERIAL NUMBER ─────────────────────────────────────
    async getDeviceBySerial(serialNumber: string): Promise<CustomerDevice | null> {
        const { data, error } = await supabase
            .from('customer_devices')
            .select('*, leads(customer_name, phone_number)')
            .eq('serial_number', serialNumber.toUpperCase().trim())
            .maybeSingle();

        if (error) {
            console.error('[AdminCustomerDevicesService] Error fetching device by serial:', error);
            throw error;
        }

        return data as (CustomerDevice & { leads: { customer_name: string; phone_number: string } | null }) | null;
    },

    // ─── GENERATE SERIAL NUMBER (via DB RPC) ─────────────────────────────
    async generateSerialNumber(modelPrefix: string): Promise<string> {
        const cleanPrefix = modelPrefix.replace(/[-\s]/g, '').toUpperCase();

        const { data, error } = await supabase.rpc('generate_serial_number', {
            p_model_prefix: cleanPrefix
        });

        if (error) {
            console.error('[AdminCustomerDevicesService] Error generating serial number:', error);
            throw error;
        }

        return data as string;
    },

    // ─── CREATE DEVICE ───────────────────────────────────────────────────
    async createDevice(deviceData: Omit<CustomerDevice, 'id' | 'created_at' | 'updated_at'>) {
        const { error, data } = await supabase
            .from('customer_devices')
            .insert([deviceData])
            .select()
            .single();

        if (error) {
            console.error('[AdminCustomerDevicesService] Error creating device:', error);
            throw error;
        }

        return data;
    },

    // ─── CREATE INVENTORY DEVICE (no customer) ───────────────────────────
    async createInventoryDevice(deviceData: {
        product_model: string;
        serial_number: string;
        batch_number?: string;
        firmware_version?: string;
        manufactured_at?: string;
        notes?: string;
    }) {
        const { error, data } = await supabase
            .from('customer_devices')
            .insert([{
                ...deviceData,
                lead_id: null,
                status: 'inactive',
                lifecycle_status: 'in_stock',
                manufactured_at: deviceData.manufactured_at || new Date().toISOString(),
            }])
            .select()
            .single();

        if (error) {
            console.error('[AdminCustomerDevicesService] Error creating inventory device:', error);
            throw error;
        }

        return data as CustomerDevice;
    },

    // ─── BULK CREATE INVENTORY ───────────────────────────────────────────
    async bulkCreateInventory(devices: Array<{
        product_model: string;
        serial_number: string;
        batch_number?: string;
        firmware_version?: string;
        manufactured_at?: string;
    }>) {
        const rows = devices.map(d => ({
            ...d,
            lead_id: null,
            status: 'inactive',
            lifecycle_status: 'in_stock',
            manufactured_at: d.manufactured_at || new Date().toISOString(),
        }));

        const { error, data } = await supabase
            .from('customer_devices')
            .insert(rows)
            .select();

        if (error) {
            console.error('[AdminCustomerDevicesService] Error bulk creating inventory:', error);
            throw error;
        }

        return data as CustomerDevice[];
    },

    // ─── ASSIGN DEVICE TO CUSTOMER ───────────────────────────────────────
    async assignDeviceToCustomer(
        deviceId: string,
        leadId: string,
        warrantyMonths: number = 24,
        assignedBy?: string
    ) {
        const now = new Date();
        const warrantyEnd = new Date(now);
        warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths);

        const { error, data } = await supabase
            .from('customer_devices')
            .update({
                lead_id: leadId,
                status: 'active',
                lifecycle_status: 'assigned',
                assigned_at: now.toISOString(),
                assigned_by: assignedBy || null,
                warranty_months: warrantyMonths,
                warranty_start_date: now.toISOString().split('T')[0],
                warranty_end_date: warrantyEnd.toISOString().split('T')[0],
            })
            .eq('id', deviceId)
            .select()
            .single();

        if (error) {
            console.error('[AdminCustomerDevicesService] Error assigning device:', error);
            throw error;
        }

        return data as CustomerDevice;
    },

    // ─── DELETE DEVICE ───────────────────────────────────────────────────
    async deleteDevice(deviceId: string) {
        const { error } = await supabase
            .from('customer_devices')
            .delete()
            .eq('id', deviceId);

        if (error) {
            console.error('[AdminCustomerDevicesService] Error deleting device:', error);
            throw error;
        }
    },

    // ─── UPDATE DEVICE ───────────────────────────────────────────────────
    async updateDevice(deviceId: string, updates: Partial<CustomerDevice>) {
        const { error, data } = await supabase
            .from('customer_devices')
            .update(updates)
            .eq('id', deviceId)
            .select()
            .single();

        if (error) {
            console.error('[AdminCustomerDevicesService] Error updating device:', error);
            throw error;
        }

        return data;
    },

    // ─── EXTEND WARRANTY ─────────────────────────────────────────────────
    async extendWarranty(deviceId: string, additionalMonths: number) {
        // First fetch current warranty end
        const { data: device, error: fetchError } = await supabase
            .from('customer_devices')
            .select('warranty_end_date')
            .eq('id', deviceId)
            .single();

        if (fetchError) throw fetchError;

        const currentEnd = device?.warranty_end_date ? new Date(device.warranty_end_date) : new Date();
        currentEnd.setMonth(currentEnd.getMonth() + additionalMonths);

        const { error, data } = await supabase
            .from('customer_devices')
            .update({
                warranty_end_date: currentEnd.toISOString().split('T')[0],
                warranty_months: (device as any)?.warranty_months ? ((device as any).warranty_months + additionalMonths) : additionalMonths,
            })
            .eq('id', deviceId)
            .select()
            .single();

        if (error) throw error;
        return data as CustomerDevice;
    },

    // ─── WARRANTY REPORT ─────────────────────────────────────────────────
    async getWarrantyReport(params: { expiringWithinDays?: number; status?: string; page?: number; limit?: number }) {
        const { expiringWithinDays = 30, status, page = 1, limit = 20 } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase.from('customer_devices').select('*, leads(customer_name, phone_number)', { count: 'exact' })
            .not('lead_id', 'is', null)
            .not('warranty_end_date', 'is', null);

        if (status === 'expiring') {
            const now = new Date();
            const future = new Date(now);
            future.setDate(future.getDate() + expiringWithinDays);
            query = query
                .gte('warranty_end_date', now.toISOString().split('T')[0])
                .lte('warranty_end_date', future.toISOString().split('T')[0]);
        } else if (status === 'expired') {
            query = query.lt('warranty_end_date', new Date().toISOString().split('T')[0]);
        } else if (status === 'active') {
            query = query.gte('warranty_end_date', new Date().toISOString().split('T')[0]);
        }

        const { data, count, error } = await query
            .order('warranty_end_date', { ascending: true })
            .range(from, to);

        if (error) throw error;

        return {
            devices: data as (CustomerDevice & { leads: { customer_name: string; phone_number: string } | null })[],
            count: count || 0
        };
    },

    // ─── INVENTORY STATS ─────────────────────────────────────────────────
    async getInventoryStats() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [inStock, thisMonth, assigned, warrantyExpiring] = await Promise.all([
            supabase.from('customer_devices').select('id', { count: 'exact', head: true }).is('lead_id', null).in('lifecycle_status', ['manufactured', 'in_stock']),
            supabase.from('customer_devices').select('id', { count: 'exact', head: true }).gte('manufactured_at', monthStart),
            supabase.from('customer_devices').select('id', { count: 'exact', head: true }).not('lead_id', 'is', null).gte('assigned_at', monthStart),
            (() => {
                const future = new Date(now);
                future.setDate(future.getDate() + 30);
                return supabase.from('customer_devices').select('id', { count: 'exact', head: true })
                    .not('lead_id', 'is', null)
                    .gte('warranty_end_date', now.toISOString().split('T')[0])
                    .lte('warranty_end_date', future.toISOString().split('T')[0]);
            })(),
        ]);

        return {
            inStockCount: inStock.count || 0,
            manufacturedThisMonth: thisMonth.count || 0,
            assignedThisMonth: assigned.count || 0,
            warrantyExpiringIn30Days: warrantyExpiring.count || 0,
        };
    },

    // ─── WARRANTY CONFIGURATIONS ─────────────────────────────────────────
    async getWarrantyConfigurations(): Promise<WarrantyConfiguration[]> {
        const { data, error } = await supabase
            .from('warranty_configurations')
            .select('*')
            .order('product_model');

        if (error) throw error;
        return data as WarrantyConfiguration[];
    },

    async upsertWarrantyConfiguration(config: { id?: string; product_model: string; default_warranty_months: number; max_extension_months: number; warranty_terms?: string }): Promise<WarrantyConfiguration> {
        const { data, error } = await supabase
            .from('warranty_configurations')
            .upsert({
                ...(config.id ? { id: config.id } : {}),
                product_model: config.product_model,
                default_warranty_months: config.default_warranty_months,
                max_extension_months: config.max_extension_months,
                warranty_terms: config.warranty_terms || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'product_model' })
            .select()
            .single();

        if (error) throw error;
        return data as WarrantyConfiguration;
    },

    async deleteWarrantyConfiguration(id: string): Promise<void> {
        const { error } = await supabase
            .from('warranty_configurations')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /** Update warranty_months + warranty_end_date for all assigned devices matching a product_model */
    async applyWarrantyPolicyToExistingDevices(productModel: string, warrantyMonths: number): Promise<number> {
        // Fetch all assigned devices with this model that have a warranty_start_date
        const { data: devices, error: fetchError } = await supabase
            .from('customer_devices')
            .select('id, warranty_start_date')
            .eq('product_model', productModel)
            .not('lead_id', 'is', null)
            .not('warranty_start_date', 'is', null);

        if (fetchError) throw fetchError;
        if (!devices || devices.length === 0) return 0;

        let updated = 0;
        for (const device of devices) {
            const start = new Date(device.warranty_start_date);
            const end = new Date(start);
            end.setMonth(end.getMonth() + warrantyMonths);

            const { error: updateError } = await supabase
                .from('customer_devices')
                .update({
                    warranty_months: warrantyMonths,
                    warranty_end_date: end.toISOString().split('T')[0],
                })
                .eq('id', device.id);

            if (!updateError) updated++;
        }
        return updated;
    },

    // ─── VOID WARRANTY ────────────────────────────────────────────────────
    async voidWarranty(deviceId: string, reason: string, voidedBy?: string): Promise<CustomerDevice> {
        const { data, error } = await supabase
            .from('customer_devices')
            .update({
                warranty_voided: true,
                warranty_void_reason: reason,
                warranty_voided_at: new Date().toISOString(),
                warranty_voided_by: voidedBy || null,
            })
            .eq('id', deviceId)
            .select('*, leads(customer_name)')
            .single();

        if (error) {
            console.error('[AdminCustomerDevicesService] Error voiding warranty:', error);
            throw error;
        }

        // Send portal notification
        if (data?.lead_id) {
            PortalNotificationsService.createNotification(data.lead_id, {
                title: 'Garanti İptal Edildi',
                message: `"${data.product_model}" model cihazınızın garantisi iptal edilmiştir. Sebep: ${reason}`,
                type: 'warning',
                link: '/portal/devices',
            }).catch(err => console.error('[AdminCustomerDevicesService] Portal notification failed:', err));
        }

        return data as CustomerDevice;
    },

    // ─── RESTORE WARRANTY ─────────────────────────────────────────────────
    async restoreWarranty(deviceId: string): Promise<CustomerDevice> {
        const { data, error } = await supabase
            .from('customer_devices')
            .update({
                warranty_voided: false,
                warranty_void_reason: null,
                warranty_voided_at: null,
                warranty_voided_by: null,
            })
            .eq('id', deviceId)
            .select('*, leads(customer_name)')
            .single();

        if (error) {
            console.error('[AdminCustomerDevicesService] Error restoring warranty:', error);
            throw error;
        }

        // Send portal notification
        if (data?.lead_id) {
            PortalNotificationsService.createNotification(data.lead_id, {
                title: 'Garanti Yeniden Aktif',
                message: `"${data.product_model}" model cihazınızın garantisi yeniden aktifleştirilmiştir.`,
                type: 'success',
                link: '/portal/devices',
            }).catch(err => console.error('[AdminCustomerDevicesService] Portal notification failed:', err));
        }

        return data as CustomerDevice;
    },

    // ─── REGISTRATION REQUESTS ───────────────────────────────────────────
    async listRegistrationRequests(params: { status?: string; page?: number; limit?: number }) {
        const { status, page = 1, limit = 20 } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase.from('device_registration_requests')
            .select('*, leads(customer_name, phone_number)', { count: 'exact' });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return {
            requests: data as (DeviceRegistrationRequest & { leads: { customer_name: string; phone_number: string } })[],
            count: count || 0
        };
    },

    async approveRegistration(requestId: string, reviewedBy: string) {
        // Validate UUID — mock-admin is not a real UUID
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reviewedBy);
        const safeReviewedBy = isValidUuid ? reviewedBy : null;

        // Get the request
        const { data: request, error: fetchError } = await supabase
            .from('device_registration_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError) throw fetchError;

        // Find the device by serial number
        const device = await AdminCustomerDevicesService.getDeviceBySerial(request.serial_number);
        if (!device) throw new Error('Cihaz bulunamadı');
        if (device.lead_id) throw new Error('Bu cihaz zaten bir müşteriye atanmış');

        // Assign device to customer
        await AdminCustomerDevicesService.assignDeviceToCustomer(
            device.id,
            request.lead_id,
            device.warranty_months || 24,
            safeReviewedBy
        );

        // Update request status
        const { error } = await supabase
            .from('device_registration_requests')
            .update({
                status: 'approved',
                reviewed_by: safeReviewedBy,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', requestId);

        if (error) throw error;
    },

    async rejectRegistration(requestId: string, reviewedBy: string, adminNotes?: string) {
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reviewedBy);
        const safeReviewedBy = isValidUuid ? reviewedBy : null;

        const { error } = await supabase
            .from('device_registration_requests')
            .update({
                status: 'rejected',
                reviewed_by: safeReviewedBy,
                reviewed_at: new Date().toISOString(),
                admin_notes: adminNotes || null,
            })
            .eq('id', requestId);

        if (error) throw error;
    },
};
