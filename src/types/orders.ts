/** customer_reservations satırı — Siparişler sayfası ve modallerinin paylaştığı tip. */

export interface ReservationItem {
    product_id: number;
    name: string;
    quantity: number;
    price: number;
    image?: string;
}

export interface CustomerReservation {
    id: string;
    offer_token: string;
    offer_code: string;
    customer_name: string;
    company_name: string;
    payment_method: string;
    items: ReservationItem[];
    total: number;
    status: string;
    lead_id?: string | null;
    shipping_company?: string;
    tracking_number?: string;
    created_at: string;
    deposit_amount?: number;
    deposit_paid_at?: string;
    remaining_amount?: number;
    original_total?: number;
    updated_total?: number;
    price_lock_expires_at?: string;
    final_deadline_at?: string;
    second_chance_expires_at?: string;
    cancellation_reason?: string;
    // Invoice & delivery
    invoice_type?: string;
    invoice_name?: string;
    invoice_tax_office?: string;
    invoice_tax_number?: string;
    invoice_address?: string;
    invoice_city?: string;
    invoice_district?: string;
    invoice_postal_code?: string;
    invoice_email?: string;
    invoice_phone?: string;
    delivery_contact_name?: string;
    delivery_phone?: string;
    delivery_address?: string;
    delivery_city?: string;
    delivery_district?: string;
    delivery_postal_code?: string;
    delivery_notes?: string;
    delivery_same_as_invoice?: boolean;
    info_completed_at?: string;
    bank_transfer_notified_at?: string;
    parasut_contact_id?: number | null;
    parasut_invoice_id?: number | null;
    parasut_invoice_number?: string | null;
    parasut_sent_at?: string | null;
    // Manuel (offline) satış kaydı — bkz. manualSaleService.ts
    sale_source?: 'online' | 'manual' | string;
    manual_payment_method?: string | null;
    manual_note?: string | null;
    manual_automation_opt_in?: boolean;
}
