/// <reference types="vite/client" />

// Arama Asistanı veri motoru.
//
// YENİ TABLO YOK. Mevcut altyapıyı yeniden kullanır:
//   - Öncelik/türetme: src/lib/offerPriority.ts → deriveOffer (AI skoru + teklif
//     aciliyeti + aktivite tazeliği + durum zaten içinde).
//   - Teklif + müşteri verisi: AdminOfferLinksService.listAllOffers (Offers ekranıyla
//     aynı embed: leads, ai_state, offer_analytics).
//   - Arama kaydı (cooldown kaynağı): leadCallsService → lead_events.call_logged.
//   - Snooze ("sonra ara"): lead_events.call_snooze (metadata.until ISO) — şema değişmez.
//
// buildQueue: lead başına tek kayıt, "öncelik DESC" + cooldown/snooze cezası ile sıralı.

import { supabase } from '../../lib/supabase/client';
import { fetchInChunks } from '../../lib/supabase/paginate';
import { AdminOfferLinksService, type OfferLink } from './offerLinksService';
import { deriveOffer, type OfferDerived } from '../../lib/offerPriority';
import { leadCallsService, type LeadCallInfo } from './leadCallsService';
import { leadRemindersService } from './leadRemindersService';
import { AdminWinBackService, type WinBackCandidate } from './winbackService';
import type { WinBackBucket, WinBackStatus } from '../../lib/winbackScore';

/** Son bu kadar saat içinde aranan kişi "cooldown"da — sıranın dibine iner. */
export const CALL_COOLDOWN_HOURS = 12;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export interface CallQueueItem {
    leadId: string;
    token: string;
    customerName: string;
    companyName: string | null;
    phone: string | null;
    offer: OfferLink;
    derived: OfferDerived;
    /** Arama özeti (count/son arama) — yoksa null. */
    callInfo: LeadCallInfo | null;
    /** Son aramanın üzerinden geçen saat (yoksa null). */
    hoursSinceLastCall: number | null;
    /** Son CALL_COOLDOWN_HOURS içinde arandı → sırada dipte. */
    cooled: boolean;
    /** Son WhatsApp mesajı müşteriden geldi → cevap bekliyor (en güçlü sinyal). */
    waAwaitingReply: boolean;
    /** Müşterinin son WhatsApp mesajının üzerinden geçen saat (yoksa null). */
    waLastInboundHours: number | null;
    /** Son (sistem dışı) ekip notunun üzerinden geçen saat (yoksa null). */
    noteRecentHours: number | null;
    /** Vadesi gelmiş (remind_at <= now) açık hatırlatması var → takip vakti, sırada üstte. */
    reminderDue: boolean;
    /** Vadesi gelmiş en yakın hatırlatmanın notu (varsa) — kartta gösterilir. */
    reminderNote: string | null;
    /** Teklif edilen model adları — generated_offers (final teklif) önce, yoksa snapshot. */
    products: string[];
    /** Nihai sıralama skoru = priorityScore + WhatsApp + not bonusu. */
    rankScore: number;
    /** "Neden bu sırada" — sıralamaya katkı veren aktif sinyallerin okunur listesi. */
    signals: string[];
}

/** Geri Kazanım modunda sıradaki aday — winbackService adayını arama akışına uyarlar. */
export interface WinbackQueueItem {
    leadId: string;
    customerName: string;
    companyName: string | null;
    businessType: string | null;
    phone: string | null;
    countryCode: string | null;
    /** Ham winback adayı — kart tüm zengin alanları (skor, kova, teklif, sinyaller) buradan okur. */
    candidate: WinBackCandidate;
    /** ExtendOfferExpiryDialog / silme için ham teklif (yoksa null). */
    rawOffer: WinBackCandidate['rawOffer'];
    callInfo: LeadCallInfo | null;
    hoursSinceLastCall: number | null;
    /** Vadesi gelmiş açık hatırlatma var → takip vakti. */
    reminderDue: boolean;
    reminderNote: string | null;
    /** Geri dönme şansı skoru + kova. */
    score: number;
    bucket: WinBackBucket;
    /** Mevcut geri kazanım takip durumu (yoksa null). */
    winbackStatus: WinBackStatus | null;
    /** "Neden bu sırada" — şeffaflık sinyalleri. */
    signals: string[];
}

/** Geri Kazanım arama sonucu — winback statüsü + erteleme. */
export type WinbackOutcome = WinBackStatus | 'snooze';

/* ──────────────────────────────────────────────────────────────────────────
   WhatsApp içerik NİYET analizi — müşterinin YAZDIKLARINI ciddiye alır.
   Sıralamada "ne zaman yazdı" (waBoost) yanında "NE yazdı" da puanlanır:
   satın-alma sinyali yukarı çeker, ret/itiraz aşağı iter. Deterministik ve
   ücretsiz olduğu için tüm kuyruğa (yüzlerce lead) anında uygulanabilir.
─────────────────────────────────────────────────────────────────────────── */

/** Niyet kategorileri — ağırlık + anahtar kalıplar (TR ağırlıklı, birkaç EN karşılığı). */
const INTENT_PATTERNS: { key: string; label: string; weight: number; terms: string[] }[] = [
    {
        // En güçlü sinyal: müşteri yazışmayı bırakıp KONUŞMAK istiyor. Çoğu zaman
        // teklif şablonunun altındaki "Ürün Rezervasyonu Yaptırmak İstiyorum" quick
        // reply'ından gelir ([Button Clicked]: ... olarak kaydedilir, 'contains'
        // eşleşmesi prefix'e takılmaz). 'buy'ın üstünde: arama randevusu, ödeme
        // niyetinden bile daha net bir aksiyon talebidir.
        key: 'call_request', label: 'arama/rezervasyon talebi', weight: 28,
        terms: [
            'rezervasyon', 'rezerve', 'yer ayır', 'beni arayın', 'arayabilir misiniz',
            'call me', 'reservation',
        ],
    },
    {
        // "Detaylı Bilgi Almak İstiyorum" butonu. Süreç gereği bu da bir arama
        // talebidir (bilgiyi telefonda veriyoruz), ama rezervasyon kadar ileri
        // değil. İkisi de kuyrukta hatırlatma açtığı için tepede yer alır;
        // aralarındaki sırayı bu puan farkı belirler.
        key: 'info_request', label: 'bilgi için arama talebi', weight: 16,
        terms: ['detaylı bilgi', 'bilgi almak istiyorum', 'bilgi istiyorum'],
    },
    {
        key: 'buy', label: 'satın alma sinyali', weight: 20,
        terms: [
            'ödeme', 'ödeyece', 'ödeyeyim', 'öderim', 'öderim', 'havale', 'eft', 'iban',
            'satın al', 'sipariş', 'alalım', 'alıyorum', 'alırım', 'anlaştık', 'kapora',
            'depozito', 'kargo', 'ne zaman gelir', 'ne zaman teslim', 'kaç günde', 'fatura',
            'gönderin', 'gönderebilir', 'hazırım', 'başlayalım',
            'ready to buy', 'i will pay', 'payment', 'place order', 'buy it',
        ],
    },
    {
        key: 'warm', label: 'aktif ilgi', weight: 9,
        terms: [
            'fiyat', 'kaç para', 'ne kadar', 'kaça', 'detay', 'bilgi alabilir', 'demo',
            'video', 'numune', 'görüşelim', 'arayabilir', 'randevu', 'toplantı',
            'ilgileniyorum', 'merak', 'price', 'how much', 'interested', 'details',
        ],
    },
    {
        key: 'objection', label: 'itiraz/tereddüt', weight: -8,
        terms: [
            'pahalı', 'bütçe', 'düşün', 'şimdi değil', 'müsait değil', 'zamanım yok',
            'emin değil', 'expensive', 'not now', 'maybe later', 'budget',
        ],
    },
    {
        key: 'drop', label: 'ret sinyali', weight: -16,
        terms: [
            'ilgilenmiyorum', 'istemiyorum', 'vazgeçtim', 'gerek yok', 'almayacağım',
            'iptal', 'rahatsız etmeyin', 'aramayın', 'çıkarın listeden',
            'not interested', 'stop', 'remove me', 'do not call', "don't call",
        ],
    },
];

/** Son inbound mesaj metinlerinden niyet skoru + baskın etiket üretir. */
function analyzeWaIntent(texts: string[]): { score: number; label: string | null } {
    if (!texts.length) return { score: 0, label: null };
    const blob = texts.join(' \n ').toLocaleLowerCase('tr-TR');
    let bestPos = 0, bestNeg = 0;
    let posLabel: string | null = null, negLabel: string | null = null;
    for (const cat of INTENT_PATTERNS) {
        if (!cat.terms.some((t) => blob.includes(t))) continue;
        if (cat.weight >= 0) {
            if (cat.weight > bestPos) { bestPos = cat.weight; posLabel = cat.label; }
        } else if (cat.weight < bestNeg) { bestNeg = cat.weight; negLabel = cat.label; }
    }
    // Tavan 30: 'call_request' (28) kırpılmadan geçebilsin — arama talebi ile sıradan
    // "satın alma sinyali" (20) arasındaki fark sıralamada gerçekten hissedilmeli.
    const score = Math.max(-20, Math.min(30, bestPos + bestNeg));
    // Baskın etiket: mutlak katkısı büyük olan.
    const label = Math.abs(bestPos) >= Math.abs(bestNeg) ? posLabel : negLabel;
    return { score, label: score === 0 ? null : label };
}

/** Lead başına WhatsApp etkileşim sinyali. */
interface WaSignal {
    /** Müşterinin (inbound) en son mesaj zamanı. */
    lastInboundAt: string | null;
    /** Konuşmadaki en son mesaj müşteriden mi (= bizden cevap bekliyor). */
    lastIsInbound: boolean;
    /** Müşterinin son mesajlarının içerik-niyet skoru (satın alma + / ret −). */
    intentScore: number;
    /** Baskın niyet etiketi (şeffaflık sinyali için) — yoksa null. */
    intentLabel: string | null;
}

/** Lead başına WhatsApp sinyallerini çeker (son mesaj yönü + son inbound zamanı + içerik niyeti). */
async function loadWhatsAppSignals(leadIds: string[]): Promise<Record<string, WaSignal>> {
    if (leadIds.length === 0) return {};
    const data = await fetchInChunks<{ lead_id: string; direction: string; message_content: string | null; sent_at: string | null; created_at: string }>(
        leadIds,
        (chunk, from, to) => supabase
            .from('whatsapp_messages')
            .select('lead_id, direction, message_content, sent_at, created_at')
            .in('lead_id', chunk)
            .order('created_at', { ascending: false })
            .range(from, to),
    );

    const map: Record<string, WaSignal> = {};
    const inboundTexts: Record<string, string[]> = {};
    for (const row of data) {
        if (!row.lead_id) continue;
        let sig = map[row.lead_id];
        if (!sig) {
            // İlk görülen (en yeni) satır = konuşmanın son mesajı.
            sig = { lastInboundAt: null, lastIsInbound: row.direction === 'inbound', intentScore: 0, intentLabel: null };
            map[row.lead_id] = sig;
        }
        if (row.direction === 'inbound') {
            if (!sig.lastInboundAt) sig.lastInboundAt = row.sent_at || row.created_at;
            // Müşterinin son ~6 mesajını niyet analizi için topla.
            const bag = (inboundTexts[row.lead_id] ||= []);
            if (bag.length < 6 && row.message_content) bag.push(row.message_content);
        }
    }
    // Toplanan inbound metinlerden niyet skorunu hesapla.
    for (const [leadId, texts] of Object.entries(inboundTexts)) {
        const { score, label } = analyzeWaIntent(texts);
        map[leadId].intentScore = score;
        map[leadId].intentLabel = label;
    }
    return map;
}

/** WhatsApp etkileşim bonusu — sıralama skoruna eklenir. */
function waBoost(sig: WaSignal | undefined): number {
    if (!sig) return 0;
    let b = 0;
    if (sig.lastInboundAt) {
        const h = (Date.now() - new Date(sig.lastInboundAt).getTime()) / HOUR_MS;
        if (h <= 24) b += 15;            // son 24 saatte yazdı → çok sıcak
        else if (h <= 48) b += 8;
        else if (h <= 72) b += 4;
    }
    if (sig.lastIsInbound) b += 12;      // son mesaj müşteriden → cevap bekliyor
    return b;
}

/** Lead başına en güncel (sistem dışı) ekip notunun zamanını çeker. */
async function loadLatestNotes(leadIds: string[]): Promise<Record<string, string>> {
    if (leadIds.length === 0) return {};
    const data = await fetchInChunks<{ lead_id: string; created_at: string }>(
        leadIds,
        (chunk, from, to) => supabase
            .from('lead_notes')
            .select('lead_id, created_at, is_system_generated')
            .in('lead_id', chunk)
            .eq('is_system_generated', false)
            .order('created_at', { ascending: false })
            .range(from, to),
    );
    const map: Record<string, string> = {};
    for (const row of data) {
        if (!row.lead_id || map[row.lead_id]) continue; // ilk (en yeni) kazanır
        map[row.lead_id] = row.created_at;
    }
    return map;
}

/** Son ekip notuna göre bonus — taze not = aktif takip sinyali. */
function noteBoost(hoursSince: number | null): number {
    if (hoursSince === null) return 0;
    if (hoursSince <= 24) return 8;      // bugün not düşülmüş → aktif takipte
    if (hoursSince <= 72) return 4;      // son 3 günde
    return 0;
}

/** Vadesi gelmiş hatırlatma bonusu — planlanan takibin zamanı geldi, en güçlü sinyal. */
const REMINDER_BOOST = 18;

/** Remarketing opt-out yapan lead'leri (Set) çeker — aktif sıradan tamamen çıkarılır. */
async function loadOptedOut(leadIds: string[]): Promise<Set<string>> {
    if (leadIds.length === 0) return new Set();
    const data = await fetchInChunks<{ id: string }>(
        leadIds,
        (chunk, from, to) => supabase
            .from('leads')
            .select('id')
            .in('id', chunk)
            .eq('remarketing_opt_out', true)
            .range(from, to),
    );
    return new Set(data.map((r) => r.id).filter(Boolean));
}

/** Lead başına remarketing dokunuş sinyali. */
interface RmktSignal {
    /** En son gönderilen remarketing kampanyasının zamanı (yoksa null). */
    lastSentAt: string | null;
    /** Son 7 günde taze bir yeniden-teklif (reissue/prepared) hazırlandı mı. */
    reissuedRecently: boolean;
}

/** Lead başına remarketing sinyallerini çeker: son gönderim + taze yeniden-teklif. */
async function loadRemarketingSignals(leadIds: string[]): Promise<Record<string, RmktSignal>> {
    if (leadIds.length === 0) return {};
    const map: Record<string, RmktSignal> = {};
    const ensure = (id: string): RmktSignal => (map[id] ||= { lastSentAt: null, reissuedRecently: false });

    // Gönderilen kampanyalar → lead başına en yeni sent_at.
    const sends = await fetchInChunks<{ lead_id: string; sent_at: string | null; created_at: string }>(
        leadIds,
        (chunk, from, to) => supabase
            .from('remarketing_campaign_recipients')
            .select('lead_id, sent_at, created_at')
            .in('lead_id', chunk)
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })
            .range(from, to),
    );
    for (const row of sends) {
        if (!row.lead_id) continue;
        const sig = ensure(row.lead_id);
        const at = row.sent_at || row.created_at;
        if (at && !sig.lastSentAt) sig.lastSentAt = at; // ilk (en yeni) kazanır
    }

    // Taze yeniden-teklif olayları (son 7 gün).
    const cutoff = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const events = await fetchInChunks<{ lead_id: string; created_at: string }>(
        leadIds,
        (chunk, from, to) => supabase
            .from('lead_events')
            .select('lead_id, created_at')
            .in('lead_id', chunk)
            .in('event_type', ['remarketing_offer_reissued', 'remarketing_offer_prepared'])
            .gte('created_at', cutoff)
            .range(from, to),
    );
    for (const row of events) {
        if (!row.lead_id) continue;
        ensure(row.lead_id).reissuedRecently = true;
    }
    return map;
}

/** Remarketing dokunuş bonusu — yakın gönderim = sıcak takip penceresi, taze yeniden-teklif = bekleyen fırsat. */
function remarketingBoost(sig: RmktSignal | undefined): number {
    if (!sig) return 0;
    let b = 0;
    if (sig.lastSentAt) {
        const h = (Date.now() - new Date(sig.lastSentAt).getTime()) / HOUR_MS;
        if (h <= 24) b += 12;            // dün gönderildi → sıcak takip
        else if (h <= 48) b += 9;
        else if (h <= 72) b += 6;
    }
    if (sig.reissuedRecently) b += 6;    // son 7 günde taze teklif hazırlandı
    return b;
}

/** Token başına final tekliften (generated_offers) seçilen model adlarını çeker. */
async function loadOfferModels(tokens: string[]): Promise<Record<string, string[]>> {
    if (tokens.length === 0) return {};
    const data = await fetchInChunks<{ offer_token: string; items: any }>(
        tokens,
        (chunk, from, to) => supabase
            .from('generated_offers')
            .select('offer_token, items, created_at')
            .in('offer_token', chunk)
            .order('created_at', { ascending: false })
            .range(from, to),
    );
    const map: Record<string, string[]> = {};
    for (const row of data) {
        if (!row.offer_token || map[row.offer_token]) continue; // ilk (en yeni) kazanır
        const items = Array.isArray(row.items) ? row.items : [];
        const names = items
            .map((it: any) => it?.name || it?.model || it?.title)
            .filter((n: any): n is string => typeof n === 'string' && n.trim().length > 0);
        map[row.offer_token] = Array.from(new Set(names)).slice(0, 4);
    }
    return map;
}

export type CallOutcome = 'reached' | 'no_answer' | 'snooze' | 'not_interested' | 'won';

/** "Sonra ara" için hazır snooze süreleri (saat). */
export const SNOOZE_OPTIONS: { label: string; hours: number }[] = [
    { label: '1 saat sonra', hours: 1 },
    { label: '3 saat sonra', hours: 3 },
    { label: 'Yarın', hours: 24 },
    { label: '3 gün sonra', hours: 72 },
];

/** Lead başına en güncel aktif snooze son-zamanını (ISO) döndürür. */
async function loadSnoozes(leadIds: string[]): Promise<Record<string, string>> {
    if (leadIds.length === 0) return {};
    const data = await fetchInChunks<{ lead_id: string; metadata: any }>(
        leadIds,
        (chunk, from, to) => supabase
            .from('lead_events')
            .select('lead_id, metadata, created_at')
            .eq('event_type', 'call_snooze')
            .in('lead_id', chunk)
            .order('created_at', { ascending: false })
            .range(from, to),
    );

    const map: Record<string, string> = {};
    data.forEach((row) => {
        if (!row.lead_id || map[row.lead_id]) return; // ilk (en yeni) kazanır
        const until = row.metadata?.until;
        if (typeof until === 'string') map[row.lead_id] = until;
    });
    return map;
}

export const callAssistantService = {
    /**
     * Aranacak müşteri sırasını kurar. won/lost ve snooze süresi dolmamış kişiler
     * hariç; aktif olmayan/öncelik 0 olanlar elenir; lead başına en yüksek öncelikli
     * teklif tutulur; son CALL_COOLDOWN_HOURS içinde aranan kişiler dibe iner.
     * scopeLeadIds verilirse kuyruk o leadlere kısıtlanır (temsilci görünümü);
     * hidrasyon kuyruktan türediği için tek noktadan geçişli scope'lanır.
     */
    async buildQueue(scopeLeadIds?: string[]): Promise<CallQueueItem[]> {
        const offers = await AdminOfferLinksService.listAllOffers({ leadIds: scopeLeadIds });

        // 1) Lead başına en yüksek priorityScore'lu teklifi seç.
        const bestByLead = new Map<string, { offer: OfferLink; d: OfferDerived }>();
        for (const offer of offers) {
            if (!offer.lead_id) continue;
            const d = deriveOffer(offer);
            if (d.status === 'won' || d.status === 'lost') continue; // terminal → sırada yok
            if (d.priorityScore <= 0) continue;                     // pasif/iptal dibi
            const cur = bestByLead.get(offer.lead_id);
            if (!cur || d.priorityScore > cur.d.priorityScore) {
                bestByLead.set(offer.lead_id, { offer, d });
            }
        }

        const leadIds = [...bestByLead.keys()];
        if (leadIds.length === 0) return [];

        const bestTokens = [...bestByLead.values()].map((v) => v.offer.token);

        // 2) Arama geçmişi (cooldown) + aktif snooze'lar + WhatsApp + son notlar + teklif
        //    modelleri + açık hatırlatmalar (vadesi gelen takip).
        const [callMap, snoozeMap, waMap, noteMap, modelMap, reminderMap, optedOut, rmktMap] = await Promise.all([
            leadCallsService.listCallsForLeads(leadIds),
            loadSnoozes(leadIds),
            loadWhatsAppSignals(leadIds),
            loadLatestNotes(leadIds),
            loadOfferModels(bestTokens),
            leadRemindersService.listOpenForLeads(leadIds),
            loadOptedOut(leadIds),
            loadRemarketingSignals(leadIds),
        ]);

        const now = Date.now();

        // 3) Snooze süresi dolmamış kişileri ele, kalanları zenginleştir.
        const items: CallQueueItem[] = [];
        for (const [leadId, { offer, d }] of bestByLead) {
            if (optedOut.has(leadId)) continue;                     // opt-out → aktif sıradan tamamen çıkar
            const until = snoozeMap[leadId];
            if (until && new Date(until).getTime() > now) continue; // ertelenmiş

            const callInfo = callMap[leadId] || null;
            const hoursSinceLastCall = callInfo
                ? Math.floor((now - new Date(callInfo.lastAt).getTime()) / HOUR_MS)
                : null;
            const cooled = hoursSinceLastCall !== null && hoursSinceLastCall < CALL_COOLDOWN_HOURS;

            const sig = waMap[leadId];
            const waLastInboundHours = sig?.lastInboundAt
                ? Math.floor((now - new Date(sig.lastInboundAt).getTime()) / HOUR_MS)
                : null;
            const noteAt = noteMap[leadId];
            const noteRecentHours = noteAt
                ? Math.floor((now - new Date(noteAt).getTime()) / HOUR_MS)
                : null;

            // Vadesi gelmiş (remind_at <= now) en yakın açık hatırlatma → takip vakti.
            const dueReminder = (reminderMap[leadId] || [])
                .filter((r) => new Date(r.remind_at).getTime() <= now)
                .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())[0] || null;
            const reminderDue = !!dueReminder;
            const reminderNote = dueReminder?.note ?? null;

            const rmktSig = rmktMap[leadId];
            const waPts = waBoost(sig);
            const waIntentPts = sig?.intentScore ?? 0;   // müşteri NE yazdı → niyet
            const notePts = noteBoost(noteRecentHours);
            const reminderPts = reminderDue ? REMINDER_BOOST : 0;
            const rmktPts = remarketingBoost(rmktSig);
            const rankScore = d.priorityScore + waPts + waIntentPts + notePts + reminderPts + rmktPts;

            // "Neden bu sırada" — katkı veren aktif sinyaller (şeffaflık).
            const signals: string[] = [];
            if (reminderDue) signals.push(`hatırlatma vakti geldi +${REMINDER_BOOST}`);
            if (d.aiScore !== null) signals.push(`AI skoru ${d.aiScore}`);
            if (d.opens > 0) signals.push(`${d.opens} açılış`);
            if (d.expiresHours > 0 && d.expiresHours <= 48) signals.push(`teklif ${d.expiresHours}s içinde doluyor`);
            if (sig?.lastIsInbound) signals.push('WhatsApp’tan yazdı, cevap bekliyor +12');
            else if (waLastInboundHours !== null && waPts > 0) signals.push(`WhatsApp ${waLastInboundHours}s önce yazdı +${waPts}`);
            if (waIntentPts !== 0 && sig?.intentLabel) {
                signals.push(`WhatsApp'ta ${sig.intentLabel} ${waIntentPts > 0 ? '+' : ''}${waIntentPts}`);
            }
            if (notePts > 0 && noteRecentHours !== null) signals.push(`ekip notu ${noteRecentHours}s önce +${notePts}`);
            if (rmktPts > 0) {
                if (rmktSig?.reissuedRecently) signals.push(`remarketing yeniden teklif +${rmktPts}`);
                else if (rmktSig?.lastSentAt) {
                    const rh = Math.floor((now - new Date(rmktSig.lastSentAt).getTime()) / HOUR_MS);
                    signals.push(`remarketing ${rh}s önce gönderildi +${rmktPts}`);
                }
            }
            if (cooled) signals.push('son 12s arandı (alta alındı)');

            items.push({
                leadId,
                token: offer.token,
                customerName: offer.leads?.customer_name || 'İsimsiz müşteri',
                companyName: offer.leads?.company_name || null,
                phone: offer.leads?.phone_number || null,
                offer,
                derived: d,
                callInfo,
                hoursSinceLastCall,
                cooled,
                waAwaitingReply: !!sig?.lastIsInbound,
                waLastInboundHours,
                noteRecentHours,
                reminderDue,
                reminderNote,
                // Final teklif modeli önce; yoksa snapshot'tan türetilen.
                products: modelMap[offer.token]?.length ? modelMap[offer.token] : d.products,
                rankScore,
                signals,
            });
        }

        // 4) Sıralama: önce vadesi gelmiş hatırlatması olanlar (cooldown'u ezer — planlanan
        //    takibin zamanı geldi); sonra cooldown'dakiler dibe; içeride rankScore DESC.
        items.sort((a, b) => {
            if (a.reminderDue !== b.reminderDue) return a.reminderDue ? -1 : 1;
            if (a.cooled !== b.cooled) return a.cooled ? 1 : -1;
            return b.rankScore - a.rankScore;
        });

        return items;
    },

    /**
     * AI arama brifingi — /api/internal/ai/lead/:id/call-brief endpoint'ini çağırır.
     * mode='winback' verilirse brifing geri-kazanım (yeniden ikna) çerçevesinde üretilir.
     */
    async getCallBrief(leadId: string, mode?: 'winback'): Promise<{
        why_now: string;
        talking_points: string[];
        objections: { q: string; a: string }[];
        goal: string;
        opening_line: string;
    }> {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/internal/ai/lead/${leadId}/call-brief`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify(mode ? { mode } : {}),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const base = err.error || `Arama brifingi alınamadı (${res.status})`;
            throw new Error(err.detail ? `${base} — ${err.detail}` : base);
        }
        const json = await res.json();
        return json.brief;
    },

    /**
     * Arama sonucunu kaydeder ve otomatik sonraki aksiyonu uygular.
     *   reached        → call_logged (arama sayısı + cooldown).
     *   no_answer      → call_logged (outcome=no_answer).
     *   snooze         → call_snooze (metadata.until); kişi süre dolana dek sıradan çıkar.
     *   not_interested → leads.status='lost' (manuel) + event.
     *   won            → leads.status='won' (manuel) + event.
     */
    async recordOutcome(
        leadId: string,
        token: string,
        outcome: CallOutcome,
        opts: { snoozeHours?: number; untilIso?: string; followUpIso?: string; note?: string; reason?: string } = {},
    ): Promise<void> {
        const auth = await supabase.auth.getUser();
        const by = auth.data.user?.id ?? null;

        // Görüşme notu varsa lead_notes'a da yaz → AI brifing (son 8 not) ve öncelik
        // skoru (noteBoost) bu notu değerlendirir. Takip geçmişinde de event olarak görünür.
        const noteContent = opts.note?.trim();
        if (noteContent) {
            await supabase.from('lead_notes').insert({
                lead_id: leadId, note_content: noteContent, is_system_generated: false,
            });
        }

        if (outcome === 'reached') {
            await leadCallsService.logCall(leadId, token);
            if (opts.note) {
                await supabase.from('lead_events').insert({
                    lead_id: leadId, token, event_type: 'call_note', metadata: { by, note: opts.note },
                });
            }
            // Ulaşıldı → eski bekleyen takipleri kapat; istenirse yeni takip planla.
            await leadRemindersService.markDoneForLead(leadId);
            if (opts.followUpIso) {
                await leadRemindersService.create({ lead_id: leadId, remind_at: opts.followUpIso, note: opts.note });
            }
            return;
        }

        if (outcome === 'no_answer') {
            await supabase.from('lead_events').insert({
                lead_id: leadId, token, event_type: 'call_logged',
                metadata: { by, outcome: 'no_answer', note: opts.note || null },
            });
            return;
        }

        if (outcome === 'snooze') {
            // Kesin saat (untilIso) verildiyse onu kullan; yoksa göreli saat.
            const until = opts.untilIso || new Date(Date.now() + (opts.snoozeHours ?? 3) * HOUR_MS).toISOString();
            await supabase.from('lead_events').insert({
                lead_id: leadId, token, event_type: 'call_snooze',
                metadata: { by, until, hours: opts.snoozeHours ?? null, note: opts.note || null },
            });
            // "Sonra Ara" = takip hatırlatması; soldaki Hatırlatmalar merkezinde de görünür.
            await leadRemindersService.create({ lead_id: leadId, remind_at: until, note: opts.note });
            return;
        }

        // not_interested / won → durum güncelle + olay kaydı.
        const status = outcome === 'won' ? 'won' : 'lost';
        await supabase
            .from('leads')
            .update({ status, status_source: 'manual', updated_at: new Date().toISOString() })
            .eq('id', leadId);
        await supabase.from('lead_events').insert({
            lead_id: leadId, token, event_type: 'call_outcome',
            metadata: { by, outcome, status, reason: opts.reason || null, note: opts.note || null },
        });
        // Görüşme sonuçlandı → bekleyen takipleri kapat.
        await leadRemindersService.markDoneForLead(leadId);
    },

    /**
     * Geri Kazanım sırasını kurar. AdminWinBackService.listCandidates() (ölü/sessiz adaylar +
     * skor + kova + rawOffer + winback_status) çıktısını arama akışına uyarlar; arama
     * geçmişi + vadesi gelmiş hatırlatma ile zenginleştirir. Skora göre (DESC) sıralı.
     */
    async buildWinbackQueue(scopeLeadIds?: string[]): Promise<WinbackQueueItem[]> {
        const candidates = await AdminWinBackService.listCandidates({ leadIds: scopeLeadIds });
        if (candidates.length === 0) return [];

        const leadIds = candidates.map((c) => c.leadId);
        const [callMap, reminderMap] = await Promise.all([
            leadCallsService.listCallsForLeads(leadIds),
            leadRemindersService.listOpenForLeads(leadIds),
        ]);

        const now = Date.now();
        return candidates.map((c) => {
            const callInfo = callMap[c.leadId] || null;
            const hoursSinceLastCall = callInfo
                ? Math.floor((now - new Date(callInfo.lastAt).getTime()) / HOUR_MS)
                : null;

            const dueReminder = (reminderMap[c.leadId] || [])
                .filter((r) => new Date(r.remind_at).getTime() <= now)
                .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())[0] || null;

            // "Neden bu sırada" — geri kazanım sinyalleri (şeffaflık).
            const signals: string[] = [`geri dönme şansı %${c.score}`];
            if (c.offerValidUntil) {
                const days = Math.floor((now - new Date(c.offerValidUntil).getTime()) / DAY_MS);
                if (days >= 0) signals.push(`teklif süresi ${days === 0 ? 'bugün' : `${days} gün önce`} doldu`);
            } else if (!c.offerToken) {
                signals.push('hiç teklif oluşturulmamış');
            }
            if (c.paymentStarted) signals.push('ödemeye gitmişti');
            if (c.opens > 0) signals.push(`${c.opens} açılış`);
            else if (c.ageDays >= 14) signals.push(`${c.ageDays} gün sessiz`);
            if (dueReminder) signals.push('hatırlatma vakti geldi');

            return {
                leadId: c.leadId,
                customerName: c.customerName,
                companyName: c.companyName,
                businessType: c.businessType,
                phone: c.phone,
                countryCode: c.countryCode,
                candidate: c,
                rawOffer: c.rawOffer,
                callInfo,
                hoursSinceLastCall,
                reminderDue: !!dueReminder,
                reminderNote: dueReminder?.note ?? null,
                score: c.score,
                bucket: c.bucket,
                winbackStatus: c.winbackStatus,
                signals,
            };
        });
        // listCandidates zaten skora göre DESC sıralı döndürür.
    },

    /**
     * Geri Kazanım arama sonucunu kaydeder.
     *   contacted/returned/declined/reoffered → winback_status (AdminWinBackService.setWinbackStatus).
     *   snooze → lead_reminders (aktif sıradaki "Sonra ara" ile aynı; statü değişmez).
     * Statü yazılan sonuçlarda (teklif varsa) arama da loglanır — geçmiş + cooldown için.
     */
    async recordWinbackOutcome(
        leadId: string,
        token: string | null,
        outcome: WinbackOutcome,
        opts: { note?: string; snoozeHours?: number; untilIso?: string } = {},
    ): Promise<void> {
        if (outcome === 'snooze') {
            const until = opts.untilIso || new Date(Date.now() + (opts.snoozeHours ?? 24) * HOUR_MS).toISOString();
            await leadRemindersService.create({ lead_id: leadId, remind_at: until, note: opts.note });
            return;
        }
        await AdminWinBackService.setWinbackStatus(leadId, outcome, opts.note);
        if (token) await leadCallsService.logCall(leadId, token); // winback de bir aramadır
    },
};
