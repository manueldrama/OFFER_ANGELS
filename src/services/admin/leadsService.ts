import { supabase } from '../../lib/supabase/client';
import { fetchInChunks } from '../../lib/supabase/paginate';
import { sanitizeSearchTerm } from '../../utils/searchFilter';
import { normalizePhone } from '../leadDedup';
import { UNKNOWN_COUNTRY, buildCountryOrFilter, buildUnknownCountryOrFilter } from '../../utils/countries';

export interface Lead {
    id: string;
    assigned_to?: string | null;
    customer_name: string;
    company_name?: string | null;
    business_type?: string | null;
    phone_number?: string | null;
    email?: string | null;
    status: 'new' | 'contacted' | 'hot' | 'warm' | 'follow_up' | 'cold' | 'offer_sent' | 'payment_started' | 'won' | 'lost';
    /** Durumu AI mı (auto) yoksa ekip mi (manual) belirledi. */
    status_source?: 'auto' | 'manual' | null;
    source: string;
    /** Müşterinin Instagram kullanıcı adı — sheet connector'dan (ör. ManyChat) eşlenir. */
    instagram_username?: string | null;
    created_at: string;
    updated_at: string;
    ai_state?: LeadAiState | null;
    offer_links?: any[];
    // Geo + attribution (populated by analytics tracker at lead capture).
    country?: string | null;
    country_code?: string | null;
    city?: string | null;
    region?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_term?: string | null;
    utm_content?: string | null;
    first_utm_source?: string | null;
    first_utm_medium?: string | null;
    first_utm_campaign?: string | null;
    fbclid?: string | null;
    gclid?: string | null;
    referrer?: string | null;
    landing_path?: string | null;
    visitor_id?: string | null;
    os?: string | null;
    browser?: string | null;
}

export interface LeadAiState {
    lead_id: string;
    score: number | null;
    score_reason: string | null;
    summary: string | null;
    next_action: string | null;
}

export interface LeadEvent {
    id: string;
    lead_id: string;
    event_type: string;
    metadata: any;
    created_at: string;
}

export interface LeadNote {
    id: string;
    lead_id: string;
    note_content: string;
    is_system_generated: boolean;
    created_at: string;
}

export const AdminLeadsService = {
    // 1) List Leads with Pagination/Filters
    async listLeads({
        search = '',
        status,
        source,
        assignedTo,
        businessType,
        country,
        page = 1,
        limit = 20
    }: {
        search?: string;
        status?: string;
        source?: string;
        assignedTo?: string;
        businessType?: string;
        /** 'all' | ISO-2 ülke kodu | 'unknown' */
        country?: string;
        page?: number;
        limit?: number;
    }) {
        let query = supabase
            .from('leads')
            .select(`
                *,
                offer_links:offer_links(
                    is_active,
                    token,
                    offer_analytics:offer_analytics(action_type, created_at)
                )
            `, { count: 'exact' });

        const s = sanitizeSearchTerm(search);
        if (s) {
            query = query.or(`customer_name.ilike.%${s}%,phone_number.ilike.%${s}%,company_name.ilike.%${s}%`);
        }

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        // Kaynak filtresi: artık kanal anahtarı (paid_meta, organic, direct ...).
        // classifyChannel mantığının yaklaşık sunucu-taraflı karşılığı; utm/click-id/referrer
        // alanları üzerinden filtreler. (.or() ve zincirli .is()/.not() top-level AND'lenir.)
        if (source && source !== 'all') {
            const PAID = 'cpc,ppc,paid,paid_social,paidsocial';
            switch (source) {
                case 'paid_meta':
                    query = query.or(`fbclid.not.is.null,and(utm_medium.in.(${PAID}),or(utm_source.ilike.*meta*,utm_source.ilike.*facebook*,utm_source.ilike.*instagram*,utm_source.ilike.*messenger*,utm_source.in.(ig,fb,fbig)))`);
                    break;
                case 'paid_google':
                    query = query.or(`gclid.not.is.null,and(utm_medium.in.(${PAID}),or(utm_source.ilike.*google*,utm_source.ilike.*youtube*,utm_source.in.(yt,gdn)))`);
                    break;
                case 'paid_other':
                    query = query
                        .in('utm_medium', ['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial'])
                        .is('fbclid', null)
                        .is('gclid', null)
                        .not('utm_source', 'ilike', '%google%')
                        .not('utm_source', 'ilike', '%youtube%')
                        .not('utm_source', 'ilike', '%meta%')
                        .not('utm_source', 'ilike', '%facebook%')
                        .not('utm_source', 'ilike', '%instagram%')
                        .not('utm_source', 'ilike', '%messenger%')
                        .not('utm_source', 'in', '(ig,fb,fbig,yt,gdn)');
                    break;
                case 'email':
                    query = query.or('utm_medium.ilike.email,utm_source.ilike.email');
                    break;
                case 'whatsapp':
                    query = query.or('utm_source.ilike.*whatsapp*,referrer.ilike.*whatsapp*,referrer.ilike.*wa.me*');
                    break;
                case 'organic':
                    query = query
                        .is('fbclid', null)
                        .is('gclid', null)
                        .or('utm_source.ilike.*facebook*,utm_source.ilike.*instagram*,utm_source.ilike.*meta*,utm_source.ilike.*google*,utm_source.ilike.*youtube*,utm_source.in.(ig,fb,fbig,yt,gdn),referrer.ilike.*facebook.com*,referrer.ilike.*instagram.com*,referrer.ilike.*google.*,referrer.ilike.*youtube.com*');
                    break;
                case 'referral':
                    query = query.not('referrer', 'is', null).is('utm_source', null);
                    break;
                case 'direct':
                    query = query.is('utm_source', null).is('fbclid', null).is('gclid', null).is('referrer', null);
                    break;
                default:
                    // Geriye dönük uyum: bilinmeyen değer ham source sütununda eşleşir.
                    query = query.eq('source', source);
            }
        }

        if (assignedTo && assignedTo !== 'all') {
            if (assignedTo === 'unassigned') {
                query = query.is('assigned_to', null);
            } else {
                query = query.eq('assigned_to', assignedTo);
            }
        }

        // İşletme türü filtresi — sheet'ten gelen ham slug/değer üzerinde tam eşleşme.
        if (businessType && businessType !== 'all') {
            query = query.eq('business_type', businessType);
        }

        // Ülke filtresi — resolveLeadCountry'nin sunucu tarafı karşılığı.
        // country_code yalnız guest yakalama yolunda (guest.ts / leadDedup.ts)
        // doluyor; elle veya sheet'ten açılan leadlerde boş kalıyor, bu yüzden
        // beyan yoksa telefon ön ekine düşülür. Liste sunucudan sayfalandığı
        // için filtre BURADA olmak zorunda: istemcide süzmek yalnız görünen 20
        // satırı süzer, toplam/sayfalama sayacı yanlış kalırdı.
        if (country && country !== 'all') {
            if (country === UNKNOWN_COUNTRY) {
                query = query.is('country_code', null).or(buildUnknownCountryOrFilter());
            } else {
                query = query.or(buildCountryOrFilter(country));
            }
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[AdminLeadsService] Error listing leads:', error);
            throw error;
        }

        return { leads: data as Lead[], count: count || 0 };
    },

    /**
     * Lead'lerde mevcut DISTINCT işletme türü değerleri (filtre dropdown'u için).
     * PostgREST server-side DISTINCT desteklemediğinden tek kolon çekip JS'te
     * tekilleştiriyoruz; business_type düşük kardinaliteli olduğundan payload küçük.
     */
    async listDistinctBusinessTypes(): Promise<string[]> {
        const { data, error } = await supabase
            .from('leads')
            .select('business_type')
            .not('business_type', 'is', null)
            .limit(5000);
        if (error) {
            console.error('[AdminLeadsService] Error listing business types:', error);
            return [];
        }
        const set = new Set<string>();
        (data || []).forEach((r: any) => {
            const v = (r.business_type || '').trim();
            if (v) set.add(v);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
    },

    // 2) Get Full Lead Profile
    async getLeadProfile(leadId: string) {
        // Parallelize detailed queries
        const [leadRes, eventsRes, notesRes, linksRes, paymentsRes, reservationsRes] = await Promise.all([
            supabase.from('leads').select('*').eq('id', leadId).single(),
            supabase.from('lead_events').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
            supabase.from('lead_notes').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
            supabase.from('offer_links').select('*, offer_analytics(action_type)').eq('lead_id', leadId).order('created_at', { ascending: false }),
            supabase.from('payment_transactions').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
            supabase.from('customer_reservations').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
        ]);

        if (leadRes.error) throw leadRes.error;

        return {
            lead: leadRes.data as Lead,
            events: (eventsRes.data || []) as LeadEvent[],
            notes: (notesRes.data || []) as LeadNote[],
            offerLinks: linksRes.data || [],
            payments: paymentsRes.data || [],
            reservations: reservationsRes.data || []
        };
    },

    // 3) Update Lead Status
    async updateStatus(leadId: string, status: Lead['status']) {
        const { error } = await supabase
            .from('leads')
            // status_source='manual' → AI skorlama bu leadin durumunu bir daha ezmez.
            .update({ status, status_source: 'manual', updated_at: new Date().toISOString() })
            .eq('id', leadId);

        if (error) throw error;

        // Log the change
        const [auth] = await Promise.all([
            supabase.auth.getUser(),
            this.addNote(leadId, `System: Durum "${status}" olarak güncellendi.`, true)
        ]);

        if (auth.data.user) {
            await supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'UPDATE',
                entity_type: 'LEAD_STATUS',
                entity_id: leadId,
                new_values: { status }
            });
        }
    },

    // 3b) Elle sıralama / sabitleme (Teklif Linkleri grup içi pin + drag-reorder).
    // manual_rank: NULL → sabit değil; dolu → grubun en üstünde artan sırayla.
    // updateStatus ile aynı yol (anon key + RLS authenticated leads UPDATE).
    async pinLead(leadId: string, rank: number) {
        const { error } = await supabase
            .from('leads')
            .update({ manual_rank: rank, updated_at: new Date().toISOString() })
            .eq('id', leadId);
        if (error) throw error;
    },

    async unpinLead(leadId: string) {
        const { error } = await supabase
            .from('leads')
            .update({ manual_rank: null, updated_at: new Date().toISOString() })
            .eq('id', leadId);
        if (error) throw error;
    },

    // Sabitli bloğun yeni sırasını toplu yazar (küçük sayı → Promise.all yeterli).
    async reorderPinned(updates: { id: string; rank: number }[]) {
        if (!updates.length) return;
        const ts = new Date().toISOString();
        const results = await Promise.all(
            updates.map(u =>
                supabase.from('leads').update({ manual_rank: u.rank, updated_at: ts }).eq('id', u.id)
            )
        );
        const failed = results.find(r => r.error);
        if (failed?.error) throw failed.error;
    },

    // 3c) WhatsApp Sohbet listesi "Takipte" pin'i (leads.chat_pinned boolean).
    // manual_rank'tan ayrı, basit aç/kapa sabitleme. updateStatus ile aynı yol.
    async setChatPinned(leadId: string, pinned: boolean) {
        const { error } = await supabase
            .from('leads')
            .update({ chat_pinned: pinned, updated_at: new Date().toISOString() })
            .eq('id', leadId);
        if (error) throw error;
    },

    // Bulk: sidebar için pinli (chat_pinned=true) lead id'lerini Set olarak döndürür.
    async listChatPinned(leadIds: string[]): Promise<Set<string>> {
        if (leadIds.length === 0) return new Set();
        const { data, error } = await supabase
            .from('leads')
            .select('id')
            .in('id', leadIds)
            .eq('chat_pinned', true);
        if (error) throw error;
        return new Set(((data || []) as { id: string }[]).map(r => r.id));
    },

    // 4) List Notes (hafif — tek tablo; getLeadProfile'in tamamını çekmeden)
    async listNotes(leadId: string) {
        const { data, error } = await supabase
            .from('lead_notes')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as LeadNote[];
    },

    // 4a) Bulk: her lead için EN SON oluşturulan kullanıcı notu (sistem logları hariç).
    // Teklif Linkleri satırı kapalıyken orta boşlukta özet göstermek için tek sorguda
    // toplar — listCallsForLeads / listForLeads ile aynı toplu çekme deseni.
    async listLatestNotesForLeads(leadIds: string[]): Promise<Record<string, LeadNote>> {
        if (leadIds.length === 0) return {};
        const data = await fetchInChunks<LeadNote>(
            leadIds,
            (chunk, from, to) => supabase
                .from('lead_notes')
                .select('*')
                .in('lead_id', chunk)
                .eq('is_system_generated', false)
                .order('created_at', { ascending: false })
                .range(from, to),
        );
        const map: Record<string, LeadNote> = {};
        for (const note of data) {
            // desc sıralı → her lead için ilk görülen kayıt en yenisidir.
            if (!map[note.lead_id]) map[note.lead_id] = note;
        }
        return map;
    },

    // 4b) Mevcut bir notun içeriğini günceller (satır içi düzenleme).
    async updateNote(noteId: string, content: string) {
        const { data, error } = await supabase
            .from('lead_notes')
            .update({ note_content: content })
            .eq('id', noteId)
            .select()
            .single();
        if (error) throw error;
        return data as LeadNote;
    },

    // 4) Add Note
    async addNote(leadId: string, content: string, isSystem = false) {
        // author_id doldurulur: KPI'nin CRM bileşeni notu YAZANA atfetmeli.
        // Boş kaldığı sürece emek, leadin atandığı kişiye yazılıyordu — başkasının
        // leadine not yazan temsilcinin katkısı yanlış kişide görünüyordu.
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('lead_notes')
            .insert({
                lead_id: leadId,
                note_content: content,
                is_system_generated: isSystem,
                author_id: isSystem ? null : (user?.id ?? null)
            })
            .select()
            .single();

        if (error) throw error;
        return data as LeadNote;
    },

    // 5) Create Lead Manually
    async createLead(payload: { customer_name: string; company_name?: string; phone_number?: string; email?: string; }) {
        const { data, error } = await supabase
            .from('leads')
            .insert([{
                ...payload,
                source: 'manual_admin',
                status: 'new'
            }])
            .select()
            .single();

        if (error) {
            console.error('[AdminLeadsService] Error creating lead:', error);
            // 23505 = unique_violation: aynı phone_normalized ile lead var
            if ((error as any).code === '23505' && payload.phone_number) {
                const phone_normalized = normalizePhone(payload.phone_number);
                let name = 'mevcut bir kayıt';
                if (phone_normalized) {
                    const { data: existing } = await supabase
                        .from('leads')
                        .select('customer_name')
                        .eq('phone_normalized', phone_normalized)
                        .limit(1)
                        .maybeSingle();
                    if (existing?.customer_name) name = existing.customer_name;
                }
                throw new Error(`Bu telefon numarasıyla zaten bir lead var: ${name}`);
            }
            throw error;
        }

        const leadId = data.id;

        // Log the change
        const auth = await supabase.auth.getUser();
        await Promise.all([
            this.addNote(leadId, `System: Lead manuel olarak oluşturuldu.`, true),
            supabase.from('lead_events').insert({
                lead_id: leadId,
                event_type: 'lead_created',
                metadata: { source: 'manual_admin' }
            }),
            auth.data.user ? supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'CREATE',
                entity_type: 'LEAD',
                entity_id: leadId,
                new_values: payload
            }) : Promise.resolve()
        ]);

        return data as Lead;
    },

    // 6) Update Lead Information
    async updateLead(leadId: string, payload: { customer_name?: string; company_name?: string; phone_number?: string; email?: string; status?: string; }) {
        const { data, error } = await supabase
            .from('leads')
            .update({
                ...payload,
                // Durum elle değiştirildiyse manuel kilitle (AI ezmesin).
                ...(payload.status !== undefined ? { status_source: 'manual' } : {}),
                updated_at: new Date().toISOString()
            })
            .eq('id', leadId)
            .select()
            .single();

        if (error) {
            console.error('[AdminLeadsService] Error updating lead:', error);
            throw error;
        }

        // Log the change
        const auth = await supabase.auth.getUser();
        await Promise.all([
            this.addNote(leadId, `System: Lead bilgileri güncellendi.`, true),
            auth.data.user ? supabase.from('audit_logs').insert({
                user_id: auth.data.user.id,
                action_type: 'UPDATE',
                entity_type: 'LEAD',
                entity_id: leadId,
                new_values: payload
            }) : Promise.resolve()
        ]);

        return data as Lead;
    },

    // 7) Delete a Single Lead
    async deleteLead(leadId: string) {
        const { error } = await supabase.from('leads').delete().eq('id', leadId);
        if (error) throw error;
    },

    // 8) Bulk Delete Leads
    async bulkDeleteLeads(leadIds: string[]) {
        if (leadIds.length === 0) return;
        const { error } = await supabase.from('leads').delete().in('id', leadIds);
        if (error) throw error;
    },

    // 9) Assign Lead to Sales Rep
    async updateAssignedTo(leadId: string, assignedTo: string | null) {
        const { error } = await supabase
            .from('leads')
            .update({ assigned_to: assignedTo, assigned_at: assignedTo ? new Date().toISOString() : null })
            .eq('id', leadId);
        if (error) throw error;
    },

    // 10) Bulk Assign Leads to Sales Rep (assignedTo=null → atamayı kaldır)
    async bulkAssignLeads(leadIds: string[], assignedTo: string | null) {
        if (leadIds.length === 0) return;
        const { error } = await supabase
            .from('leads')
            .update({ assigned_to: assignedTo, assigned_at: assignedTo ? new Date().toISOString() : null })
            .in('id', leadIds);
        if (error) throw error;
    }
};
