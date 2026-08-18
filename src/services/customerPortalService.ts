import { supabase } from '../lib/supabase/client';
import { CustomerPortal, ServiceSubscription, ServiceRequest, CustomerDevice, ConsumableOrder, OnboardingChecklist, CartridgeSubscription, PortalDocument, KnowledgeArticle } from '../types';

export const CustomerPortalService = {
    /**
     * Generate a URL-friendly slug from a company or customer name.
     * Priority: Company Name > Customer Name
     */
    generateSlug(companyName?: string | null, customerName?: string | null): string {
        const source = (companyName && companyName.trim().length > 0) ? companyName : (customerName || 'customer');
        return source
            .toLowerCase()
            .trim()
            .replace(/[ğĞ]/g, 'g')
            .replace(/[üÜ]/g, 'u')
            .replace(/[şŞ]/g, 's')
            .replace(/[ıİ]/g, 'i')
            .replace(/[öÖ]/g, 'o')
            .replace(/[çÇ]/g, 'c')
            .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
            .replace(/[\s-]+/g, '-')       // Replace spaces/hyphens with single hyphen
            .replace(/^-+|-+$/g, '');     // Trim hyphens from ends
    },

    /**
     * Fetch portal configuration by slug.
     */
    async getPortalBySlug(slug: string) {
        const { data, error } = await supabase
            .from('customer_portals')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) throw error;
        return data as CustomerPortal;
    },

    /**
     * Create or update a portal link for a lead.
     */
    async hashPin(pin: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async ensurePortalLink(leadId: string, companyName?: string | null, customerName?: string | null): Promise<CustomerPortal & { _generatedPin?: string | null }> {
        const slugBase = this.generateSlug(companyName, customerName);

        // Check if slug exists for a different lead
        let finalSlug = slugBase;
        const { data: existing } = await supabase.from('customer_portals').select('id, lead_id, slug').eq('slug', slugBase).maybeSingle();

        if (existing && existing.lead_id !== leadId) {
            finalSlug = `${slugBase}-${Math.random().toString(36).substring(2, 5)}`;
        }

        // Check if lead already has a portal
        const { data: leadPortal } = await supabase.from('customer_portals').select('*').eq('lead_id', leadId).maybeSingle();

        // Generate 6-digit PIN
        let pin: string | null = null;
        let pinHash: string | undefined;
        try {
            const needsPin = !leadPortal?.pin_hash;
            pin = needsPin ? String(Math.floor(100000 + Math.random() * 900000)) : null;
            pinHash = pin ? await this.hashPin(pin) : undefined;
        } catch (e) {
            // pin_hash column may not exist yet — skip PIN generation
            console.warn('[Portal] PIN hash failed, skipping:', e);
            pin = null;
            pinHash = undefined;
        }

        const upsertData: Record<string, any> = {
            lead_id: leadId,
            slug: finalSlug,
            updated_at: new Date().toISOString()
        };
        if (pinHash) upsertData.pin_hash = pinHash;
        if (pin) upsertData.pin_plain = pin;

        const { data, error } = await supabase
            .from('customer_portals')
            .upsert(upsertData, { onConflict: 'lead_id' })
            .select()
            .single();

        if (error) throw error;
        const result = data as CustomerPortal & { _generatedPin?: string | null };
        result._generatedPin = pin;
        return result;
    },

    /**
     * Mark onboarding as completed.
     */
    async completeOnboarding(portalId: string) {
        const { error } = await supabase
            .from('customer_portals')
            .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
            .eq('id', portalId);
        
        if (error) throw error;
    },

    /**
     * Recover portal link by phone or ID
     */
    async recoverPortal(phone?: string, identifier?: string) {
        // 1) Try searching by phone in leads
        let leadQuery = supabase.from('leads').select('id, phone_number');
        if (phone) {
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            leadQuery = leadQuery.ilike('phone_number', `%${cleanPhone}%`);
        }

        const { data: leads, error: leadErr } = await leadQuery;
        if (leadErr || !leads || leads.length === 0) return null;

        // 2) Find a portal for one of these leads
        const leadIds = leads.map(l => l.id);
        const { data: portal, error: portalErr } = await supabase
            .from('customer_portals')
            .select('*')
            .in('lead_id', leadIds)
            .maybeSingle();

        if (portalErr) throw portalErr;
        return portal as CustomerPortal | null;
    },

    /**
     * Create or update a service subscription
     */
    async createSubscription(leadId: string, packageType: string, months: number = 12) {
        const startsAt = new Date();
        const expiresAt = new Date();
        expiresAt.setMonth(startsAt.getMonth() + months);

        const { data, error } = await supabase
            .from('service_subscriptions')
            .upsert({
                lead_id: leadId,
                package_type: packageType,
                status: 'active',
                starts_at: startsAt.toISOString(),
                expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data as ServiceSubscription;
    },

    // ─── PIN Auth ────────────────────────────────────────────────

    /**
     * Verify a 6-digit PIN against the stored hash.
     * For MVP, we do a simple comparison via the API server.
     */
    async verifyPin(portalId: string, pin: string): Promise<boolean> {
        try {
            const res = await fetch('/api/portal/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portalId, pin })
            });
            const json = await res.json();
            return json.valid === true;
        } catch {
            return false;
        }
    },

    /**
     * Set or update the portal PIN (called during onboarding or account page).
     */
    async setPin(portalId: string, pin: string, currentPin?: string): Promise<void> {
        // currentPin: portalda PIN varken müşteri tarafı değişikliklerde zorunlu
        // (sunucu doğrular); admin paneli bunun yerine oturum JWT'si gönderir.
        const res = await fetch('/api/portal/set-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portalId, pin, ...(currentPin ? { currentPin } : {}) })
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({} as any));
            throw new Error(errBody.error || 'PIN ayarlanamadı');
        }
    },

    async requestPinReminder(portalId: string): Promise<{ success: boolean; message?: string }> {
        try {
            const res = await fetch('/api/portal/pin-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portalId })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'PIN hatırlatma gönderilemedi');
            return { success: true, message: json.message };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    },

    // ─── Extended Data Fetching ──────────────────────────────────

    /**
     * Fetch full portal data including new expansion tables.
     */
    async getPortalFullData(leadId: string) {
        const [
            leadRes,
            devicesRes,
            requestsRes,
            subscriptionsRes,
            ordersRes,
            checklistRes,
            cartridgeSubsRes,
            documentsRes
        ] = await Promise.all([
            supabase.from('leads').select('*').eq('id', leadId).single(),
            supabase.from('customer_devices').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
            supabase.from('service_requests').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
            supabase.from('service_subscriptions').select('*').eq('lead_id', leadId).eq('status', 'active'),
            supabase.from('consumable_orders').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
            supabase.from('onboarding_checklists').select('*, template:onboarding_step_templates(*)').eq('lead_id', leadId).order('created_at', { ascending: true }),
            supabase.from('cartridge_subscriptions').select('*, device:customer_devices(*)').eq('lead_id', leadId).order('created_at', { ascending: false }),
            supabase.from('portal_documents').select('*').or(`lead_id.eq.${leadId},lead_id.is.null`).order('created_at', { ascending: false })
        ]);

        return {
            lead: leadRes.data,
            devices: (devicesRes.data || []) as CustomerDevice[],
            requests: (requestsRes.data || []) as ServiceRequest[],
            subscriptions: (subscriptionsRes.data || []) as ServiceSubscription[],
            orders: (ordersRes.data || []) as ConsumableOrder[],
            onboardingChecklist: (checklistRes.data || []) as OnboardingChecklist[],
            cartridgeSubscriptions: (cartridgeSubsRes.data || []) as CartridgeSubscription[],
            documents: (documentsRes.data || []) as PortalDocument[]
        };
    },

    // ─── Onboarding ──────────────────────────────────────────────

    /**
     * Initialize onboarding checklist for a customer based on their device model.
     */
    async initializeOnboarding(leadId: string, portalId: string, productModel?: string) {
        // Fetch step templates
        let query = supabase.from('onboarding_step_templates').select('*').order('sort_order');
        if (productModel) {
            query = query.or(`product_model.eq.${productModel},product_model.is.null`);
        }
        const { data: templates } = await query;
        if (!templates || templates.length === 0) return;

        // Check existing
        const { data: existing } = await supabase.from('onboarding_checklists').select('step_key').eq('lead_id', leadId);
        const existingKeys = new Set((existing || []).map(e => e.step_key));

        // Insert missing steps
        const newSteps = templates
            .filter(t => !existingKeys.has(t.step_key))
            .map(t => ({
                lead_id: leadId,
                portal_id: portalId,
                step_key: t.step_key,
                completed: false
            }));

        if (newSteps.length > 0) {
            await supabase.from('onboarding_checklists').insert(newSteps);
        }
    },

    /**
     * Mark an onboarding step as completed.
     */
    async completeOnboardingStep(leadId: string, stepKey: string) {
        const { error } = await supabase
            .from('onboarding_checklists')
            .update({ completed: true, completed_at: new Date().toISOString() })
            .eq('lead_id', leadId)
            .eq('step_key', stepKey);
        if (error) throw error;
    },

    // ─── Knowledge Base ──────────────────────────────────────────

    /**
     * Fetch published knowledge articles, optionally filtered by category or product model.
     */
    async getKnowledgeArticles(options?: { category?: string; productModel?: string }) {
        let query = supabase
            .from('knowledge_articles')
            .select('*')
            .eq('is_published', true)
            .order('sort_order');

        if (options?.category) {
            query = query.eq('category', options.category);
        }
        if (options?.productModel) {
            query = query.or(`product_model.eq.${options.productModel},product_model.is.null`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as KnowledgeArticle[];
    },

    // ─── Cartridge Subscriptions ─────────────────────────────────

    /**
     * Create a cartridge subscription for a device.
     */
    async createCartridgeSubscription(leadId: string, deviceId: string, cartridgeType: string, quantity: number, intervalDays: number) {
        const nextDelivery = new Date();
        nextDelivery.setDate(nextDelivery.getDate() + intervalDays);

        const { data, error } = await supabase
            .from('cartridge_subscriptions')
            .insert({
                lead_id: leadId,
                customer_device_id: deviceId,
                cartridge_type: cartridgeType,
                quantity,
                interval_days: intervalDays,
                next_delivery_at: nextDelivery.toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data as CartridgeSubscription;
    },

    /**
     * Pause or cancel a cartridge subscription.
     */
    async updateCartridgeSubscription(subscriptionId: string, status: 'active' | 'paused' | 'cancelled') {
        const { error } = await supabase
            .from('cartridge_subscriptions')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', subscriptionId);
        if (error) throw error;
    },

    // ─── Service Notes (customer-facing) ─────────────────────────

    /**
     * Fetch non-internal notes for a service request.
     */
    async getServiceNotes(requestId: string) {
        const { data, error } = await supabase
            .from('service_notes')
            .select('*')
            .eq('service_request_id', requestId)
            .eq('is_internal', false)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    /**
     * Add a customer note to a service request.
     */
    async addServiceNote(requestId: string, content: string) {
        const { error } = await supabase
            .from('service_notes')
            .insert({
                service_request_id: requestId,
                author_type: 'customer',
                content,
                is_internal: false
            });
        if (error) throw error;
    },

    // ─── Device Registration (Customer-facing) ───────────────────

    /**
     * Register a new device from the customer portal.
     */
    async registerDevice(leadId: string, deviceData: {
        product_model: string;
        serial_number?: string;
        purchase_date?: string;
        notes?: string;
    }) {
        const { data, error } = await supabase
            .from('customer_devices')
            .insert([{
                lead_id: leadId,
                product_model: deviceData.product_model,
                serial_number: deviceData.serial_number || null,
                purchase_date: deviceData.purchase_date || null,
                notes: deviceData.notes || null,
                status: 'active'
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ─── Serial Number Based Registration (with admin approval) ──────

    /**
     * Request device registration by serial number.
     * Validates serial exists and is unassigned, then creates a pending request.
     */
    async requestDeviceBySerial(leadId: string, serialNumber: string): Promise<{ status: 'pending' | 'not_found' | 'already_assigned' | 'already_requested' }> {
        const serial = serialNumber.toUpperCase().trim();

        // Check if device exists
        const { data: device } = await supabase
            .from('customer_devices')
            .select('id, lead_id')
            .eq('serial_number', serial)
            .maybeSingle();

        if (!device) return { status: 'not_found' };
        if (device.lead_id) return { status: 'already_assigned' };

        // Check if already requested by this lead
        const { data: existing } = await supabase
            .from('device_registration_requests')
            .select('id')
            .eq('lead_id', leadId)
            .eq('serial_number', serial)
            .eq('status', 'pending')
            .maybeSingle();

        if (existing) return { status: 'already_requested' };

        // Create registration request
        const { error } = await supabase
            .from('device_registration_requests')
            .insert([{ lead_id: leadId, serial_number: serial }]);

        if (error) throw error;
        return { status: 'pending' };
    },

    /**
     * Get registration requests for a lead.
     */
    async getRegistrationRequests(leadId: string) {
        const { data, error } = await supabase
            .from('device_registration_requests')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Get active machine product codes from catalog for portal device registration.
     */
    async getProductModels(): Promise<string[]> {
        const { data, error } = await supabase
            .from('catalog_products')
            .select('product_code')
            .eq('product_type', 'machine')
            .eq('is_active', true)
            .order('product_code');

        if (error) return [];
        return (data || []).map((p: any) => p.product_code);
    },

    async getWarrantyTermsByModels(models: string[]): Promise<Record<string, string>> {
        if (models.length === 0) return {};
        const { data, error } = await supabase
            .from('warranty_configurations')
            .select('product_model, warranty_terms')
            .in('product_model', models)
            .not('warranty_terms', 'is', null);

        if (error) return {};
        const result: Record<string, string> = {};
        (data || []).forEach((row: any) => {
            if (row.warranty_terms) result[row.product_model] = row.warranty_terms;
        });
        return result;
    }
};
