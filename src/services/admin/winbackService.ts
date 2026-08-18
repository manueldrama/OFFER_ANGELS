// Geri Kazanım (Win-Back) kokpiti veri motoru — client-side.
//
// Otomasyon DEĞİL: ekibin elle takip edeceği ölü/sessiz leadleri toplar,
// "geri dönme şansı" skorunu hesaplar ve takip durumunu (winback_*) yazar.
//
// Sıfırdan sorgu yazmaz; mevcut listAllOffers (offer_analytics + leads + ai_state
// embed'li) ve deriveOffer (opens/lastOpened/products) çıktısını yeniden kullanır.

import { supabase } from '../../lib/supabase/client';
import { AdminOfferLinksService, OfferLink } from './offerLinksService';
import { deriveOffer } from '../../lib/offerPriority';
import { computeWinBackScore, winBackBucket, type WinBackBucket, type WinBackStatus } from '../../lib/winbackScore';
import { leadChannel, type LeadChannelInfo } from '../../utils/leadChannel';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Final teklif kalemi — popup tablosu + satır içi fiyat için normalize edilmiş hâl. */
export interface WinBackOfferItem {
    name: string;
    /** Satış (indirimli) birim fiyat. */
    price: number;
    /** Liste fiyatı — price'tan büyükse strikethrough; yoksa null. */
    listPrice: number | null;
    quantity: number;
}

export interface WinBackCandidate {
    leadId: string;
    customerName: string;
    phone: string | null;
    companyName: string | null;
    businessType: string | null;
    countryCode: string | null;
    channel: LeadChannelInfo;
    createdAt: string;
    ageDays: number;
    /** Lead manuel/auto satış durumu (sıcaklık). */
    status: string;
    /** Önceki ilgi sinyalleri. */
    opens: number;
    lastOpenedAt: string | null;
    lastViewedLabel: string;
    paymentStarted: boolean;
    paymentCompleted: boolean;
    aiScore: number | null;
    aiReasoning: string | null;
    products: string[];
    /** En güncel final teklifin kalemleri (generated_offers.items) — popup + satır içi fiyat. */
    offerItems: WinBackOfferItem[];
    /** KDV dahil toplam (generated_offers.total). */
    offerTotal: number | null;
    /** Final teklif numarası (#MNL-… / #RBK-…). */
    offerNumber: string | null;
    /** En güncel teklif — manuel aksiyonlar (WhatsApp/uzatma) için referans. */
    offerToken: string | null;
    offerIsActive: boolean;
    offerValidUntil: string | null;
    /** ExtendOfferExpiryDialog'a verilecek ham teklif nesnesi. */
    rawOffer: OfferLink | null;
    /** Geri kazanım takibi. */
    winbackStatus: WinBackStatus | null;
    winbackContactedAt: string | null;
    lastNote: string | null;
    /** Türetilen. */
    score: number;
    bucket: WinBackBucket;
}

interface LeadRow {
    id: string;
    customer_name?: string | null;
    phone_number?: string | null;
    company_name?: string | null;
    email?: string | null;
    business_type?: string | null;
    country_code?: string | null;
    created_at?: string | null;
    status?: string | null;
    status_source?: string | null;
    ai_state?: { score?: number | null; reasoning?: string | null } | null;
    winback_status?: WinBackStatus | null;
    winback_contacted_at?: string | null;
    // kaynak/kanal alanları (leadChannel için)
    source?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    first_utm_source?: string | null;
    first_utm_medium?: string | null;
    first_utm_campaign?: string | null;
    fbclid?: string | null;
    gclid?: string | null;
    referrer?: string | null;
}

/** Lead başına teklif sinyallerinin toplulaştırılmış hâli. */
interface LeadAggregate {
    offers: OfferLink[];
    mostRecent: OfferLink;
    opens: number;
    lastOpenedAt: Date | null;
    lastViewedLabel: string;
    paymentStarted: boolean;
    paymentCompleted: boolean;
    products: string[];
}

function analyticsOf(offer: OfferLink): Array<{ action_type?: string }> {
    return ((offer as unknown as { offer_analytics?: any[] }).offer_analytics) || [];
}

/** generated_offers.items ham dizisini fiyatlı kalemlere normalize eder (manuel + katalog ortak şekli). */
function normalizeOfferItems(raw: unknown): WinBackOfferItem[] {
    const arr = Array.isArray(raw) ? raw : [];
    // type alanı varsa rezervasyon/ek satırları ele; yalnız ürün + aksesuar.
    const hasTyped = arr.some((it: any) => it && typeof it.type === 'string');
    const source = hasTyped ? arr.filter((it: any) => it?.type === 'product' || it?.type === 'accessory') : arr;
    return (source.length ? source : arr)
        .map((it: any): WinBackOfferItem | null => {
            const name = it?.name || it?.model || it?.product_name || it?.title;
            const price = Number(it?.price ?? it?.sale_price ?? it?.unit_price);
            if (typeof name !== 'string' || !name.trim() || !Number.isFinite(price)) return null;
            const listPrice = Number(it?.listPrice ?? it?.list_price ?? it?.oldPrice);
            const quantity = Number(it?.quantity);
            return {
                name: name.trim(),
                price,
                listPrice: Number.isFinite(listPrice) && listPrice > price ? listPrice : null,
                quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            };
        })
        .filter((x): x is WinBackOfferItem => x !== null);
}

function aggregateLeadOffers(list: OfferLink[]): LeadAggregate {
    const offers = [...list].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const mostRecent = offers[0];

    let opens = 0;
    let lastOpenedAt: Date | null = null;
    let paymentStarted = false;
    let paymentCompleted = false;

    for (const o of offers) {
        const d = deriveOffer(o);
        opens += d.opens;
        if (d.lastOpenedAt && (!lastOpenedAt || d.lastOpenedAt > lastOpenedAt)) {
            lastOpenedAt = d.lastOpenedAt;
        }
        for (const a of analyticsOf(o)) {
            if (a.action_type === 'payment_started') paymentStarted = true;
            if (a.action_type === 'payment_completed') paymentCompleted = true;
        }
    }

    return {
        offers,
        mostRecent,
        opens,
        lastOpenedAt,
        lastViewedLabel: deriveOffer(mostRecent).lastViewedLabel,
        paymentStarted,
        paymentCompleted,
        products: deriveOffer(mostRecent).products,
    };
}

/** En güncel teklif aktif + geçerli mi (yaşıyor mu).
 *  Canlılık HAM valid_until'e değil EFEKTİF bitişe bakar (created + kampanya
 *  max_offer_validity_days, link uzatıldıysa uzatma) — müşteri sayfasının
 *  "expired" kontrolüyle aynı tek-doğruluk (computeEffectiveOfferExpiry). */
function isOfferLive(offer: OfferLink): boolean {
    if (offer.is_active === false) return false;
    return deriveOffer(offer).effectiveExpiry.getTime() > Date.now();
}

export const AdminWinBackService = {
    /**
     * Geri kazanım adaylarını döndürür:
     *   - en güncel teklifi ölü (pasif/süresi dolmuş) olan leadler (Düşük Öncelik), VEYA
     *   - soğuk/sessiz aktif leadler (status cold/new + hiç açılmamış + 14+ gün).
     * won/lost (kazanıldı/kaybedildi) hariç.
     */
    // opts.leadIds: temsilci scoping — adaylar o leadlere kısıtlanır (undefined = global).
    async listCandidates(opts: { includeLive?: boolean; leadIds?: string[] } = {}): Promise<WinBackCandidate[]> {
        const offers = await AdminOfferLinksService.listAllOffers({ leadIds: opts.leadIds });

        // 1) Lead bazında grupla
        const byLead = new Map<string, OfferLink[]>();
        for (const o of offers) {
            if (!o.lead_id) continue;
            const arr = byLead.get(o.lead_id);
            if (arr) arr.push(o);
            else byLead.set(o.lead_id, [o]);
        }
        if (byLead.size === 0) return [];

        const aggByLead = new Map<string, LeadAggregate>();
        for (const [leadId, list] of byLead) {
            aggByLead.set(leadId, aggregateLeadOffers(list));
        }

        const leadIds = [...aggByLead.keys()];

        // 2) Lead detaylarını ve son notları çek — PARÇALI (chunk).
        // KRİTİK: .in('id', [700+ UUID]) tek sorguda URL limitini aşıp SESSİZCE boş
        // dönüyordu → her lead offer-link tarihine (fallback) düşüyor, tüm liste aynı
        // "X gün önce geldi" gösteriyordu. 150'lik parçalar limitin çok altında kalır.
        // Chunk 50: lead_notes bire-ÇOK olduğu için 150 id'lik chunk PostgREST'in
        // 1000-satır tavanına takılıp chunk'ın SON lead'lerini sessizce boş bırakabiliyordu.
        // 50 id × ort. not sayısı tavanın çok altında kalır; .limit(1000) da emniyet kemeri.
        const CHUNK = 50;
        const idChunks: string[][] = [];
        for (let i = 0; i < leadIds.length; i += CHUNK) idChunks.push(leadIds.slice(i, i + CHUNK));

        const [leadChunks, noteChunks] = await Promise.all([
            Promise.all(idChunks.map(async (chunk) => {
                const { data, error } = await supabase.from('leads').select('*').in('id', chunk);
                if (error) console.error('[winback] leads chunk failed:', error.message);
                return (data as LeadRow[] | null) || [];
            })),
            Promise.all(idChunks.map(async (chunk) => {
                const { data, error } = await supabase
                    .from('lead_notes')
                    .select('lead_id, note_content, is_system_generated, created_at')
                    .in('lead_id', chunk)
                    .eq('is_system_generated', false)
                    .order('created_at', { ascending: false })
                    .limit(1000);
                if (error) console.error('[winback] lead_notes chunk failed:', error.message);
                return (data as any[] | null) || [];
            })),
        ]);

        const leadById = new Map<string, LeadRow>();
        for (const l of leadChunks.flat()) leadById.set(l.id, l);

        const lastNoteByLead = new Map<string, string>();
        for (const n of noteChunks.flat()) {
            if (!lastNoteByLead.has(n.lead_id) && n.note_content) {
                lastNoteByLead.set(n.lead_id, n.note_content);
            }
        }

        // 3) Aday oluştur + kapsam filtresi + skor
        const candidates: WinBackCandidate[] = [];
        for (const [leadId, agg] of aggByLead) {
            const lead = leadById.get(leadId);
            const status = (lead?.status || agg.mostRecent.leads?.status || 'new') as string;
            if (status === 'won' || status === 'lost') continue;

            const createdAt = lead?.created_at || agg.mostRecent.created_at;
            const ageDays = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS));

            const dead = !isOfferLive(agg.mostRecent);
            const coldSilent =
                (status === 'cold' || status === 'new') && agg.opens === 0 && ageDays >= 14;
            // includeLive: Remarketing "henüz satın almamış HERKES" modu — canlı teklifli,
            // satın almamış leadleri de dahil eder (won/lost zaten yukarıda elendi).
            if (!opts.includeLive && !dead && !coldSilent) continue;

            const aiScore =
                typeof lead?.ai_state?.score === 'number'
                    ? lead!.ai_state!.score!
                    : (typeof agg.mostRecent.leads?.ai_state?.score === 'number'
                        ? agg.mostRecent.leads!.ai_state!.score!
                        : null);
            const aiReasoning =
                lead?.ai_state?.reasoning ?? agg.mostRecent.leads?.ai_state?.reasoning ?? null;

            const score = computeWinBackScore({
                aiScore,
                paymentStarted: agg.paymentStarted,
                opens: agg.opens,
                lastOpenedAt: agg.lastOpenedAt,
            });

            candidates.push({
                leadId,
                customerName: lead?.customer_name || agg.mostRecent.leads?.customer_name || 'Bilinmiyor',
                phone: lead?.phone_number ?? agg.mostRecent.leads?.phone_number ?? null,
                companyName: lead?.company_name ?? null,
                businessType: lead?.business_type ?? null,
                countryCode: lead?.country_code ?? agg.mostRecent.country_code ?? null,
                channel: leadChannel(lead || {}),
                createdAt,
                ageDays,
                status,
                opens: agg.opens,
                lastOpenedAt: agg.lastOpenedAt ? agg.lastOpenedAt.toISOString() : null,
                lastViewedLabel: agg.lastViewedLabel,
                paymentStarted: agg.paymentStarted,
                paymentCompleted: agg.paymentCompleted,
                aiScore,
                aiReasoning,
                products: agg.products,
                offerItems: [],   // 2. geçişte generated_offers'tan doldurulur
                offerTotal: null,
                offerNumber: null,
                offerToken: agg.mostRecent.token,
                offerIsActive: agg.mostRecent.is_active !== false,
                // EFEKTİF bitiş (ham valid_until değil) — segment sınıflama ve UI
                // "dolalı X gün" gösterimi bununla tutarlı çalışır.
                offerValidUntil: deriveOffer(agg.mostRecent).effectiveExpiry.toISOString(),
                rawOffer: agg.mostRecent,
                winbackStatus: lead?.winback_status ?? null,
                winbackContactedAt: lead?.winback_contacted_at ?? null,
                lastNote: lastNoteByLead.get(leadId) ?? null,
                score,
                bucket: winBackBucket(score),
            });
        }

        // 4) Final teklif kalemleri + toplam fiyat (generated_offers) — PARÇALI sorgu.
        //    Token başına birden çok teklif olabilir; en yeni (created_at desc) seçilir.
        //    Not: leads sorgusuyla aynı URL-limit tuzağı — 700+ token tek .in()'de
        //    sessizce boş dönüp HERKESİ "final teklif yok" (model_unselected) yapıyordu.
        const tokens = Array.from(
            new Set(candidates.map((c) => c.offerToken).filter((t): t is string => !!t)),
        );
        if (tokens.length) {
            // 50'lik chunk: token başına ÇOK generated_offers olabilir (yeniden üretim);
            // 150 token × 7 versiyon = 1000+ satır → PostgREST tavanı chunk'ın son
            // token'larını sessizce boş bırakıp onları "final teklif yok" gösteriyordu.
            const TOKEN_CHUNK = 50;
            const tokenChunks: string[][] = [];
            for (let i = 0; i < tokens.length; i += TOKEN_CHUNK) tokenChunks.push(tokens.slice(i, i + TOKEN_CHUNK));
            const goChunks = await Promise.all(tokenChunks.map(async (chunk) => {
                const { data, error } = await supabase
                    .from('generated_offers')
                    .select('offer_token, offer_number, items, total, created_at')
                    .in('offer_token', chunk)
                    .order('created_at', { ascending: false })
                    .limit(1000);
                if (error) console.error('[winback] generated_offers chunk failed:', error.message);
                return (data as any[] | null) || [];
            }));

            const goByToken = new Map<string, { offer_number: string | null; items: unknown; total: number | null }>();
            for (const g of goChunks.flat()) {
                if (!goByToken.has(g.offer_token)) goByToken.set(g.offer_token, g); // ilk = en yeni
            }

            for (const c of candidates) {
                const go = c.offerToken ? goByToken.get(c.offerToken) : undefined;
                if (!go) continue;
                c.offerItems = normalizeOfferItems(go.items);
                c.offerTotal = typeof go.total === 'number' ? go.total : null;
                c.offerNumber = go.offer_number ?? null;
                // offer_snapshot ürün adı vermediyse (manuel teklif) kalemlerden türet.
                if (c.products.length === 0 && c.offerItems.length) {
                    c.products = Array.from(new Set(c.offerItems.map((i) => i.name))).slice(0, 4);
                }
            }
        }

        // En yüksek şanstan düşüğe
        candidates.sort((a, b) => b.score - a.score);
        return candidates;
    },

    /**
     * Bir leadin geri kazanım takip durumunu işaretler (Arandı/Geri döndü/…).
     * leads.winback_* günceller ve lead_notes'a sistem kaydı yazar.
     */
    async setWinbackStatus(leadId: string, status: WinBackStatus | null, note?: string): Promise<void> {
        const { data: auth } = await supabase.auth.getUser();
        const nowIso = new Date().toISOString();

        const { error } = await supabase
            .from('leads')
            .update({
                winback_status: status,
                winback_contacted_at: status ? nowIso : null,
                winback_updated_by: auth.user?.id ?? null,
                winback_updated_at: nowIso,
            })
            .eq('id', leadId);
        if (error) throw error;

        const trimmed = (note || '').trim();
        if (trimmed) {
            await supabase.from('lead_notes').insert({
                lead_id: leadId,
                note_content: trimmed,
                is_system_generated: false,
            });
        }
    },
};
