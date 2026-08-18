// Teklif Linkleri komuta merkezi — sıcaklık grupları (tek kaynak).
// Referans 7 grubu, bizim gerçek 9 lead durumuna (src/lib/leadStatus.ts) eşlenir.
// Atomlar, OfferGroupAccordion, KPI bar ve priority queue bu config'i paylaşır.

import {
    Flame, Target, Sun, RotateCcw, Sparkles, Snowflake, Pause, Trophy, XCircle, LucideIcon,
} from 'lucide-react';
import type { OfferLink } from '../../../services/admin/offerLinksService';

/** Komuta merkezi grup anahtarları — sabit sıra (en öncelikli → arşiv). */
export type OfferGroupKey =
    | 'hot' | 'closing' | 'warm' | 'followup' | 'new' | 'cold' | 'low' | 'won' | 'lost';

export interface OfferGroupConfig {
    key: OfferGroupKey;
    /** Grup başlığı. */
    label: string;
    /** Tek cümlelik açıklama. */
    desc: string;
    /** index.css token taban adı (var(--color-{color}) / -bg / -soft). */
    color: 'hot' | 'closing' | 'warm' | 'follow' | 'new' | 'ice' | 'cold' | 'won' | 'lost';
    icon: LucideIcon;
    /** Liste ilk açılışta bu grup açık mı. */
    defaultOpen: boolean;
}

/** Sabit grup sırası + görsel config. Referans GROUPS + GROUP_ICON birleşimi. */
export const OFFER_GROUPS: OfferGroupConfig[] = [
    { key: 'won', label: 'Satıldı', desc: 'Kazanılan leadler — ödeme/satış tamamlandı. 🎉', color: 'won', icon: Trophy, defaultOpen: true },
    { key: 'hot', label: 'Hot Leads', desc: 'Satışa en yakın, yüksek niyetli müşteriler.', color: 'hot', icon: Flame, defaultOpen: true },
    { key: 'closing', label: 'Kapanışa Yakın', desc: 'Teklif paylaşıldı; imza/ödeme aşamasında, hızlı aksiyon gerekiyor.', color: 'closing', icon: Target, defaultOpen: true },
    { key: 'warm', label: 'Warm Leads', desc: 'İlgili, doğru takiple ısınabilecek müşteriler.', color: 'warm', icon: Sun, defaultOpen: true },
    { key: 'followup', label: 'Takip Bekleyenler', desc: 'Takip zamanı gelen veya geçen leadler.', color: 'follow', icon: RotateCcw, defaultOpen: true },
    { key: 'new', label: 'Yeni Lead’ler', desc: 'Yeni gelen, henüz ilk teması yapılmamış leadler.', color: 'new', icon: Sparkles, defaultOpen: true },
    { key: 'cold', label: 'Soğuk Lead’ler', desc: 'Düşük AI skoru — ilgi az, soğumuş leadler.', color: 'ice', icon: Snowflake, defaultOpen: false },
    { key: 'low', label: 'Düşük Öncelik', desc: 'Pasif; iptal edilmiş / süresi dolmuş linkler.', color: 'cold', icon: Pause, defaultOpen: false },
    { key: 'lost', label: 'Kaybedildi', desc: 'Kapanan leadler — iptal edildi veya kaybedildi.', color: 'lost', icon: XCircle, defaultOpen: false },
];

/** Kapanmış (terminal) gruplar — won/lost. Aktif aksiyon/öncelik hesaplarından hariç tutulur. */
export const isClosedGroup = (k: OfferGroupKey): boolean => k === 'won' || k === 'lost';

export const OFFER_GROUP_BY_KEY: Record<OfferGroupKey, OfferGroupConfig> =
    OFFER_GROUPS.reduce((acc, g) => { acc[g.key] = g; return acc; }, {} as Record<OfferGroupKey, OfferGroupConfig>);

/**
 * Sürükle-bırak hedefi olabilecek gruplar → atanacak temsili lead durumu.
 * Yalnızca tek statüye karşılık gelen "net" gruplar. Çift anlamlı gruplar
 * (closing = offer_sent/payment_started, won/lost = terminal, low = link pasif)
 * hedef değildir; onlar için satırdaki manuel durum menüsü kullanılır.
 */
export const GROUP_TO_STATUS: Partial<Record<OfferGroupKey, string>> = {
    hot: 'hot', warm: 'warm', followup: 'follow_up', new: 'new', cold: 'cold',
};

/** Bir grubun sürükle-bırak hedefi olup olmadığını döner. */
export const isGroupDropTarget = (k: OfferGroupKey): boolean => k in GROUP_TO_STATUS;

/** Grup rengini CSS değişkenlerine çözer (inline style için). */
export function groupColors(color: OfferGroupConfig['color']) {
    return {
        base: `var(--color-${color})`,
        bg: `var(--color-${color}-bg)`,
        soft: `var(--color-${color}-soft)`,
    };
}

/**
 * Kural-tabanlı AI skorunu sıcaklık lead durumuna eşler (yalnız auto leadler).
 * Backend scoreToTemperature ile birebir; pipeline durumları üretmez.
 */
export function scoreToTemperature(score: number): string {
    if (score >= 80) return 'hot';
    if (score >= 40) return 'warm';  // 40–79 ılık → warm (AiScoreRing "Ilık" eşiğiyle birebir)
    if (score >= 1) return 'cold';
    return 'new';
    // NOT: follow_up artık skordan TÜRETİLMEZ; "Takip Bekleyenler" sadece manuel takibe alınanları gösterir.
}

/**
 * Listede kullanılacak "etkin" lead durumu. Elle ayarlanmış (status_source=manual)
 * veya terminal/pipeline durumlar korunur; aksi halde (auto) durum AI skorundan
 * türetilir — böylece liste, AI halkasıyla birebir aynı sıcaklığı gösterir ve
 * backend kalıcılığını beklemeden grup doğru oluşur.
 */
export function effectiveLeadStatus(offer: OfferLink): string {
    const raw = offer.leads?.status || 'new';
    if (raw === 'won' || raw === 'lost' || raw === 'offer_sent' || raw === 'payment_started' || raw === 'contacted') return raw;
    if (offer.leads?.status_source === 'manual') return raw;
    const score = offer.leads?.ai_state?.score;
    if (typeof score === 'number') return scoreToTemperature(score);
    return raw;
}

/**
 * Bir teklif linkini sıcaklık grubuna yerleştirir (onaylanan eşleme).
 * Öncelik sırası: terminal durum → arşiv, pasif link → düşük öncelik,
 * aksi halde etkin lead durumuna göre (auto leadlerde AI skorundan türetilir).
 */
export function classifyGroup(offer: OfferLink): OfferGroupKey {
    const status = effectiveLeadStatus(offer);

    if (status === 'won') return 'won';
    if (status === 'lost') return 'lost';
    // İptal edilmiş / pasif link → düşük öncelik (terminal değilse).
    if (offer.is_active === false) return 'low';

    switch (status) {
        case 'hot': return 'hot';
        case 'offer_sent':
        case 'payment_started': return 'closing';
        case 'warm': return 'warm';
        case 'follow_up': return 'followup';
        case 'cold': return 'cold';
        case 'new':
        case 'contacted': return 'new';
        default: return 'low';
    }
}
