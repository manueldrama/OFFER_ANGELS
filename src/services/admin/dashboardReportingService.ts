import { supabase } from '../../lib/supabase/client';

export interface DashboardReportMetrics {
    newLeads: number;
    whatsappSent: number;
    linksOpened: number;
    offersGenerated: number;
    paymentsStarted: number;
    paymentsSuccess: number;
    totalRevenueTRY: number;
    depositRevenueTRY: number;
    openServiceTickets: number;
    funnel: {
        stage: string;
        count: number;
        conversionRate: number; // Percentage from previous stage
    }[];
}

export const DashboardReportingService = {
    // leadIds verilirse tüm metrikler o leadlere kısıtlanır (satış temsilcisi
    // kendi dashboard'unu görür). 8 tablonun hepsi lead_id taşıdığı için köprü
    // gerekmez. Liste birkaç yüzü aşarsa src/lib/supabase/paginate.ts
    // fetchInChunks'a geçilmeli (URL uzunluk sınırı).
    async getMetrics(startDate?: Date, endDate?: Date, leadIds?: string[]): Promise<DashboardReportMetrics> {
        const metrics: DashboardReportMetrics = {
            newLeads: 0,
            whatsappSent: 0,
            linksOpened: 0,
            offersGenerated: 0,
            paymentsStarted: 0,
            paymentsSuccess: 0,
            totalRevenueTRY: 0,
            depositRevenueTRY: 0,
            openServiceTickets: 0,
            funnel: []
        };

        // Hiç lead'i olmayan temsilci: sorgu atmadan sıfır metrik dön.
        if (leadIds && leadIds.length === 0) {
            metrics.funnel = [
                { stage: 'Yeni Lead', count: 0, conversionRate: 100 },
                { stage: 'Teklif Oluşturuldu', count: 0, conversionRate: 0 },
                { stage: 'Link Açıldı', count: 0, conversionRate: 0 },
                { stage: 'Ödeme Başlatıldı', count: 0, conversionRate: 0 },
                { stage: 'Ödeme Başarılı', count: 0, conversionRate: 0 },
            ];
            return metrics;
        }

        try {
            // Base queries with optional date filters
            let leadsQuery = supabase.from('leads').select('id', { count: 'exact' });
            let waQuery = supabase.from('whatsapp_messages').select('id', { count: 'exact' });
            let linksQuery = supabase.from('offer_links').select('view_count, created_at');
            let eventsQuery = supabase.from('lead_events').select('event_type, created_at');
            let paymentsQuery = supabase.from('payment_transactions').select('status, amount, created_at');
            // Havale/EFT siparişleri payment_transactions'a "success" yazmaz; ayrı
            // customer_reservations tablosunda yaşar. Admin onayından itibaren
            // (deposit_paid/Kapora Ödendi → confirmed → fully_paid → shipped →
            // delivered) ciroya dahil edilirler. NOT: "deposit_paid" admin'in havale
            // onaylarken en sık kullandığı statü; listeden çıkarsa onaylanmış havaleler
            // ciroda hiç görünmez.
            let bankReservationsQuery = supabase
                .from('customer_reservations')
                .select('status, payment_method, original_total, updated_total, created_at')
                .eq('payment_method', 'bank-transfer')
                // Manuel satışlar aşağıda ayrı sayılır (kaporada sadece tahsil edilen
                // tutar girer); burada sayılırsa çift sayım olur.
                .eq('sale_source', 'online')
                .in('status', ['deposit_paid', 'confirmed', 'paid', 'fully_paid', 'shipped', 'delivered']);
            // Ön ödeme (pre-payment) siparişlerinde KAPORA PayTR'den geçer ve
            // payment_transactions'ta success olarak zaten sayılır. KALAN tutar ise
            // genelde havale/EFT ile offline tahsil edilir ve hiçbir transaction
            // üretmez. Sipariş "ödeme tamamlandı" statüsüne (fully_paid/shipped/
            // delivered — uygulamanın kendi semantiği) geldiğinde kalan tahsil
            // edilmiş kabul edilir; SADECE remaining_amount ciroya eklenir (kapora
            // payment_transactions'tan geldiği için çift sayım olmaz). bank-transfer
            // hariç tutulur; onlar zaten bankReservationsQuery'de tam toplamıyla var.
            let prepaidRemainingQuery = supabase
                .from('customer_reservations')
                .select('status, payment_method, remaining_amount, created_at')
                .neq('payment_method', 'bank-transfer')
                .eq('sale_source', 'online')
                .gt('remaining_amount', 0)
                .in('status', ['fully_paid', 'shipped', 'delivered']);
            // Manuel (offline) satışlar: ne payment_transactions'ta ne de havale
            // sorgusunda yer alırlar. Kapora durumunda SADECE tahsil edilen kapora,
            // tamamlanmış durumlarda tüm tutar ciroya girer.
            let manualReservationsQuery = supabase
                .from('customer_reservations')
                .select('status, deposit_amount, original_total, updated_total, created_at')
                .eq('sale_source', 'manual')
                .in('status', ['deposit_paid', 'paid', 'fully_paid', 'shipped', 'delivered']);
            let ticketsQuery = supabase.from('service_requests').select('id', { count: 'exact' }).in('status', ['new', 'in_progress']);

            // Temsilci scoping: tüm sorgular ilgili lead kümesine kısıtlanır.
            if (leadIds) {
                leadsQuery = leadsQuery.in('id', leadIds);
                waQuery = waQuery.in('lead_id', leadIds);
                linksQuery = linksQuery.in('lead_id', leadIds);
                eventsQuery = eventsQuery.in('lead_id', leadIds);
                paymentsQuery = paymentsQuery.in('lead_id', leadIds);
                bankReservationsQuery = bankReservationsQuery.in('lead_id', leadIds);
                prepaidRemainingQuery = prepaidRemainingQuery.in('lead_id', leadIds);
                manualReservationsQuery = manualReservationsQuery.in('lead_id', leadIds);
                ticketsQuery = ticketsQuery.in('lead_id', leadIds);
            }

            // Apply Date Filters if provided
            if (startDate) {
                const startStr = startDate.toISOString();
                leadsQuery = leadsQuery.gte('created_at', startStr);
                waQuery = waQuery.gte('created_at', startStr);
                linksQuery = linksQuery.gte('created_at', startStr);
                eventsQuery = eventsQuery.gte('created_at', startStr);
                paymentsQuery = paymentsQuery.gte('created_at', startStr);
                bankReservationsQuery = bankReservationsQuery.gte('created_at', startStr);
                prepaidRemainingQuery = prepaidRemainingQuery.gte('created_at', startStr);
                manualReservationsQuery = manualReservationsQuery.gte('created_at', startStr);
            }
            if (endDate) {
                const endStr = endDate.toISOString();
                leadsQuery = leadsQuery.lte('created_at', endStr);
                waQuery = waQuery.lte('created_at', endStr);
                linksQuery = linksQuery.lte('created_at', endStr);
                eventsQuery = eventsQuery.lte('created_at', endStr);
                paymentsQuery = paymentsQuery.lte('created_at', endStr);
                bankReservationsQuery = bankReservationsQuery.lte('created_at', endStr);
                prepaidRemainingQuery = prepaidRemainingQuery.lte('created_at', endStr);
                manualReservationsQuery = manualReservationsQuery.lte('created_at', endStr);
                ticketsQuery = ticketsQuery.lte('created_at', endStr);
            }

            // Execute in parallel
            const results = await Promise.all([
                leadsQuery,
                waQuery,
                linksQuery,
                eventsQuery,
                paymentsQuery,
                bankReservationsQuery,
                prepaidRemainingQuery,
                manualReservationsQuery,
                ticketsQuery
            ]);

            // PostgREST hatası THROW ETMEZ, `error` alanında döner. Eskiden yalnızca
            // `count`/`data` destructure ediliyordu; bir sorgu 400 dönse o metrik
            // sessizce 0 oluyor, aşağıdaki catch hiç tetiklenmiyordu. Sonuç: pano
            // "bu ay 0 lead, ₺0 ciro" diyordu ve bu gerçek veriden ayırt edilemiyordu.
            // Burada fırlatınca Dashboard.tsx'teki mevcut catch + toast devreye girer.
            const failed = results.find(r => (r as { error?: unknown }).error);
            if (failed) {
                throw (failed as { error: Error }).error;
            }

            const [
                { count: leadsCount },
                { count: waCount },
                { data: links },
                { data: events },
                { data: payments },
                { data: bankReservations },
                { data: prepaidRemaining },
                { data: manualReservations },
                { count: ticketsCount }
            ] = results;

            metrics.newLeads = leadsCount || 0;
            metrics.whatsappSent = waCount || 0;
            metrics.offersGenerated = links?.length || 0;
            metrics.openServiceTickets = ticketsCount || 0;

            // Calculate Link Opens (from view_count > 0 or link_opened events)
            // Simplified approximation for reporting
            let openCount = 0;
            links?.forEach(link => { if (link.view_count > 0) openCount++; });
            metrics.linksOpened = openCount;

            // Calculate Events (Payment Started)
            if (events) {
                const startedEvents = events.filter(e => e.event_type === 'payment_started').length;
                metrics.paymentsStarted = startedEvents; // Alternatively count unique links
            }

            // Calculate Payments (Success & Revenue)
            if (payments) {
                payments.forEach(p => {
                    if (p.status === 'success') {
                        metrics.paymentsSuccess++;
                        metrics.totalRevenueTRY += Number(p.amount) || 0;
                        // Deposit is assumed if not explicitly marked, or we could filter by payment_type if it existed
                        metrics.depositRevenueTRY += Number(p.amount) || 0;
                    }
                });
            }

            // Havale/EFT cirosu: payment_transactions'a yazılmadığı için onaylanmış
            // (confirmed+) havale rezervasyonlarının tutarını ciroya ekle. Güncel
            // fiyat (updated_total) varsa onu, yoksa orijinal toplamı kullan.
            if (bankReservations) {
                bankReservations.forEach(r => {
                    const amount = Number(r.updated_total) || Number(r.original_total) || 0;
                    if (amount > 0) {
                        metrics.paymentsSuccess++;
                        metrics.totalRevenueTRY += amount;
                        metrics.depositRevenueTRY += amount;
                    }
                });
            }

            // Ön ödeme kalan tahsilatı: kapora payment_transactions'tan sayıldı;
            // sipariş tamamlandığında (fully_paid/shipped/delivered) offline havaleyle
            // gelen KALAN tutarı da ciroya ekle. Böylece ör. 264.000 TL'lik siparişin
            // sadece 52.800 kaporası değil, tamamı ciroda görünür.
            if (prepaidRemaining) {
                prepaidRemaining.forEach(r => {
                    const remaining = Number(r.remaining_amount) || 0;
                    if (remaining > 0) {
                        metrics.totalRevenueTRY += remaining;
                    }
                });
            }

            // Manuel (offline) satış cirosu: hiçbir ödeme sağlayıcısından geçmediği
            // için yalnızca burada sayılır. Kapora aşamasındaki kayıtta sadece
            // TAHSİL EDİLEN kapora ciroya girer; kalan tutar henüz alınmamıştır.
            // Sipariş tamamlandığında (paid/fully_paid/shipped/delivered) tam tutar sayılır.
            if (manualReservations) {
                manualReservations.forEach(r => {
                    const amount = r.status === 'deposit_paid'
                        ? Number(r.deposit_amount) || 0
                        : Number(r.updated_total) || Number(r.original_total) || 0;
                    if (amount > 0) {
                        metrics.paymentsSuccess++;
                        metrics.totalRevenueTRY += amount;
                        metrics.depositRevenueTRY += amount;
                    }
                });
            }

            // Build Funnel Breakdown
            metrics.funnel = [
                { stage: 'Yeni Lead', count: metrics.newLeads, conversionRate: 100 },
                { stage: 'Teklif Oluşturuldu', count: metrics.offersGenerated, conversionRate: this.calcConv(metrics.offersGenerated, metrics.newLeads) },
                { stage: 'Link Açıldı', count: metrics.linksOpened, conversionRate: this.calcConv(metrics.linksOpened, metrics.offersGenerated) },
                { stage: 'Ödeme Başlatıldı', count: metrics.paymentsStarted, conversionRate: this.calcConv(metrics.paymentsStarted, metrics.linksOpened) },
                { stage: 'Ödeme Başarılı', count: metrics.paymentsSuccess, conversionRate: this.calcConv(metrics.paymentsSuccess, metrics.paymentsStarted) },
            ];

            return metrics;
        } catch (error) {
            console.error('[DashboardReportingService] Failed to generate metrics:', error);
            throw error;
        }
    },

    calcConv(current: number, previous: number): number {
        if (previous === 0) return 0;
        return Math.round((current / previous) * 100);
    }
};
