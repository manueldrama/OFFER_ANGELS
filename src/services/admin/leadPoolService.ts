import { supabase } from '../../lib/supabase/client';
import { fetchAllPages } from '../../lib/supabase/paginate';
import { resolveLeadCountry } from '../../utils/countries';
import { AdminUsersService } from './usersService';

export interface PoolStats {
    total: number;
    byStatus: Record<string, number>;
    /** ISO-2 → adet. Ülke sekmesi sayaçları; resolveLeadCountry ile türetilir. */
    byCountry: Record<string, number>;
    /** Ne beyan ne de telefondan ülkesi çözülemeyen kayıtlar. */
    unknownCountry: number;
    highScore: number;   // ai_state.score >= 80
    riskCount: number;   // 24h+ no activity & not won/lost
    newThisWeek: number;
}

export interface ConversionStage {
    key: string;
    label: string;
    count: number;
    percent: number;
    color: string;
}

export interface RepLoad {
    id: string;
    name: string;
    initials: string;
    leadCount: number;
    hotCount: number;
    status: 'En aktif' | 'Dengeli' | 'Yakın kapanış' | 'Düşük';
}

export interface DetailMetric {
    label: string;
    value: string | number;
    description: string;
    color: string;
}

export const LeadPoolService = {

    // assignedTo verilirse istatistikler o temsilcinin leadlerine kısıtlanır
    // (satış temsilcisi kendi havuzunu görür, admin globali).
    async getPoolStats(assignedTo?: string): Promise<PoolStats> {
        // Get all leads with minimal fields.
        // country_code + phone_number ülke sekmesi sayaçları için; zaten tüm
        // havuz çekildiğinden ek sorgu maliyeti yok.
        // fetchAllPages şart: Supabase tek istekte en fazla 1000 satır döner,
        // havuz 1000'i geçtiğinde hem segment hem ülke sayaçları sessizce eksik
        // kalırdı. id'ye göre sıralama sayfalar arası kaymayı önler.
        const all = await fetchAllPages<any>((from, to) => {
            let query = supabase
                .from('leads')
                .select('id, status, ai_state, created_at, updated_at, country_code, phone_number');
            if (assignedTo) query = query.eq('assigned_to', assignedTo);
            return query.order('id', { ascending: true }).range(from, to);
        });

        const byStatus: Record<string, number> = {};
        const byCountry: Record<string, number> = {};
        let unknownCountry = 0;
        let highScore = 0;
        let newThisWeek = 0;

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);

        let riskCount = 0;

        for (const lead of all) {
            byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;

            // Sekmelerle birebir aynı çözümleme (beyan → telefon ön eki).
            const country = resolveLeadCountry(lead);
            if (country) byCountry[country] = (byCountry[country] || 0) + 1;
            else unknownCountry++;

            if (lead.ai_state?.score >= 80) highScore++;

            if (new Date(lead.created_at) >= weekAgo) newThisWeek++;

            // Risk: updated more than 24h ago AND not won/lost
            if (!['won', 'lost'].includes(lead.status) &&
                new Date(lead.updated_at || lead.created_at) < dayAgo) {
                riskCount++;
            }
        }

        return {
            total: all.length,
            byStatus,
            byCountry,
            unknownCountry,
            highScore,
            riskCount,
            newThisWeek,
        };
    },

    getConversionFlow(byStatus: Record<string, number>, total: number): ConversionStage[] {
        const stages = [
            { key: 'new', label: 'Yeni gelenler', color: 'bg-indigo-500' },
            { key: 'contacted,warm,follow_up', label: 'Warm takip', color: 'bg-amber-500' },
            { key: 'hot,offer_sent', label: 'Sıcak fırsatlar', color: 'bg-orange-500' },
            { key: 'payment_started', label: 'Karar aşaması', color: 'bg-violet-500' },
        ];

        return stages.map(stage => {
            const keys = stage.key.split(',');
            const count = keys.reduce((sum, k) => sum + (byStatus[k] || 0), 0);
            return {
                key: stage.key,
                label: stage.label,
                count,
                percent: total > 0 ? Math.round((count / total) * 100) : 0,
                color: stage.color,
            };
        });
    },

    async getRepDistribution(): Promise<RepLoad[]> {
        const [reps, counts] = await Promise.all([
            AdminUsersService.listActiveSalesReps(),
            AdminUsersService.getLeadCountPerUser(),
        ]);

        // Get hot/warm counts per rep
        const { data: hotLeads } = await supabase
            .from('leads')
            .select('assigned_to, status')
            .in('status', ['hot', 'offer_sent', 'payment_started']);

        const hotByRep: Record<string, number> = {};
        for (const l of hotLeads || []) {
            if (l.assigned_to) {
                hotByRep[l.assigned_to] = (hotByRep[l.assigned_to] || 0) + 1;
            }
        }

        return reps.map(rep => {
            const leadCount = counts[rep.id] || 0;
            const hotCount = hotByRep[rep.id] || 0;
            let status: RepLoad['status'] = 'Dengeli';
            if (leadCount > 8) status = 'En aktif';
            else if (hotCount >= 3) status = 'Yakın kapanış';
            else if (leadCount < 3) status = 'Düşük';

            const nameParts = (rep.full_name || rep.email || '').split(' ');
            const initials = nameParts.length >= 2
                ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                : (nameParts[0]?.substring(0, 2) || '??').toUpperCase();

            return {
                id: rep.id,
                name: rep.full_name || rep.email,
                initials,
                leadCount,
                hotCount,
                status,
            };
        });
    },

    async getDetailMetrics(assignedTo?: string): Promise<DetailMetric[]> {
        // assignedTo → lead sorguları temsilciye kısıtlanır. lead_events (demo) ve
        // whatsapp_messages (yanıt süresi) join gerektirdiği için global kalır.
        let highScoreQuery = supabase.from('leads').select('id').not('ai_state', 'is', null);
        let riskQuery = supabase.from('leads').select('id, updated_at').not('status', 'in', '("won","lost")');
        if (assignedTo) {
            highScoreQuery = highScoreQuery.eq('assigned_to', assignedTo);
            riskQuery = riskQuery.eq('assigned_to', assignedTo);
        }
        // Parallel queries
        const [
            { count: demoCount },
            { data: highScoreLeads },
            { data: riskLeads },
        ] = await Promise.all([
            supabase.from('lead_events').select('*', { count: 'exact', head: true }).eq('event_type', 'product_selected'),
            highScoreQuery,
            riskQuery,
        ]);

        const totalLeads = (riskLeads || []).length;
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        const staleCount = (riskLeads || []).filter(l =>
            new Date(l.updated_at) < dayAgo
        ).length;

        const highScoreCount = (highScoreLeads || []).length;

        // --- Calculate Average Response Time ---
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const { data: messages } = await supabase
            .from('whatsapp_messages')
            .select('phone_number, direction, created_at')
            .gte('created_at', fourteenDaysAgo.toISOString())
            .order('created_at', { ascending: true });

        const msgList = messages || [];
        
        // Group messages by phone number
        const byPhone: Record<string, { direction: string; timestamp: number }[]> = {};
        for (const m of msgList) {
            if (!m.phone_number) continue;
            if (!byPhone[m.phone_number]) byPhone[m.phone_number] = [];
            byPhone[m.phone_number].push({
                direction: m.direction,
                timestamp: new Date(m.created_at).getTime()
            });
        }

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoTs = weekAgo.getTime();

        const currentWeekTimes: number[] = [];
        const prevWeekTimes: number[] = [];

        // For each phone, find inbound -> first outbound pairs
        for (const phone in byPhone) {
            const msgs = byPhone[phone];
            let pendingInboundTs: number | null = null;

            for (const m of msgs) {
                if (m.direction === 'inbound') {
                    if (pendingInboundTs === null) {
                        pendingInboundTs = m.timestamp; // Start of waiting context
                    }
                } else if (m.direction === 'outbound' && pendingInboundTs !== null) {
                    const diffMs = m.timestamp - pendingInboundTs;
                    
                    // Sanity check: cap at 48 hours to avoid skewed skewed data from weekends/dropped contexts
                    if (diffMs > 0 && diffMs < 48 * 60 * 60 * 1000) {
                        if (m.timestamp >= weekAgoTs) {
                            currentWeekTimes.push(diffMs);
                        } else {
                            prevWeekTimes.push(diffMs);
                        }
                    }
                    pendingInboundTs = null; // Reset context
                }
            }
        }

        const avgMsCurrent = currentWeekTimes.length > 0 
            ? currentWeekTimes.reduce((a, b) => a + b, 0) / currentWeekTimes.length 
            : 0;

        const avgMsPrev = prevWeekTimes.length > 0
            ? prevWeekTimes.reduce((a, b) => a + b, 0) / prevWeekTimes.length
            : 0;

        // Formatting Helper
        const formatMs = (ms: number) => {
            if (ms === 0) return '0 dk';
            const mins = Math.round(ms / 60000);
            if (mins < 60) return `${mins} dk`;
            const hrs = (mins / 60).toFixed(1);
            return `${hrs} sa`;
        };

        let responseVal = formatMs(avgMsCurrent);
        let responseDesc = 'Yanıt performansı henüz ölçülemedi.';
        
        if (avgMsCurrent > 0 && avgMsPrev > 0) {
            if (avgMsCurrent < avgMsPrev) {
                const percent = Math.round(((avgMsPrev - avgMsCurrent) / avgMsPrev) * 100);
                responseDesc = `İlk dönüş süresi geçen haftaya göre %${percent} iyileşti.`;
            } else if (avgMsCurrent > avgMsPrev) {
                const percent = Math.round(((avgMsCurrent - avgMsPrev) / avgMsPrev) * 100);
                responseDesc = `Dönüş süresi geçen haftaya göre %${percent} gecikti.`;
            } else {
                responseDesc = 'Dönüş süresi geçen haftayla aynı.';
            }
        } else if (avgMsCurrent > 0) {
            responseDesc = 'Temsilci yanıt süreleri baz alınmıştır.';
        }

        return [
            {
                label: 'Ortalama yanıt süresi',
                value: responseVal,
                description: responseDesc,
                color: 'text-indigo-600',
            },
            {
                label: 'Demo talebi oranı',
                value: demoCount || 0,
                description: `Toplam ${totalLeads} kayıt içinde ürün seçimi yapan lead sayısı.`,
                color: 'text-violet-600',
            },
            {
                label: 'AI yüksek skor',
                value: highScoreCount,
                description: 'Skor değerlendirmesi yapılmış kayıt sayısı.',
                color: 'text-emerald-600',
            },
            {
                label: 'Riskte olanlar',
                value: staleCount,
                description: '24 saati aşan sessiz kayıtlar. Hızlı dönüşüm için kritik.',
                color: 'text-rose-600',
            },
        ];
    },
};
