// Teklif geçerlilik tarihi hesabı — saf fonksiyon, dış bağımlılığı yok.
// Hem Vite frontend (src/services/...) hem Node backend (api/services/...) ve
// Cloudflare Worker (functions/...) tarafı bu modülü güvenle import edebilir.
//
// Tek doğruluk noktası: müşteri sayfası, DB yazımı ve cron aynı sonuca ulaşır.

export interface OfferExpiryCampaign {
    max_offer_validity_days?: number | null;
    valid_until?: string | null;
    offer_cannot_exceed_campaign_end?: boolean | null;
    is_active?: boolean | null;
}

// Bir kampanyanın YENİ teklif basmak için "kullanılabilir" olup olmadığı.
// Kullanılabilir = kayıt var + pasif değil + bitiş tarihi geçmemiş.
// Kullanılabilir DEĞİLSE: ortada güncel fiyat/kapasite/parti şartı yoktur →
// sistem otomatik teklif basmamalı, lead admin onay (reclaim) akışına gitmeli.
// Tek doğruluk noktası: guest.ts ve functions/ tarafı aynı kararı verir.
export function isCampaignUsable(
    campaign: OfferExpiryCampaign | null | undefined,
    now: Date = new Date(),
): boolean {
    if (!campaign) return false;
    if (campaign.is_active === false) return false;
    if (campaign.valid_until && new Date(campaign.valid_until).getTime() <= now.getTime()) {
        return false;
    }
    return true;
}

export function computeOfferExpiry(campaign: OfferExpiryCampaign, offerCreatedAt: Date): Date {
    const maxDays = campaign.max_offer_validity_days ?? 7;
    const offerExpiry = new Date(offerCreatedAt);
    offerExpiry.setDate(offerExpiry.getDate() + maxDays);

    if (campaign.valid_until && campaign.offer_cannot_exceed_campaign_end !== false) {
        const campaignEnd = new Date(campaign.valid_until);
        return offerExpiry < campaignEnd ? offerExpiry : campaignEnd;
    }
    return offerExpiry;
}

export type ExpiryTone = 'green' | 'amber' | 'red' | 'slate';

// Bir teklif linkinin kalan geçerlilik süresini insan-okur etikete çevirir.
// Tek doğruluk noktası: hem liste satırı hem süre uzatma diyaloğu bunu kullanır.
export function describeRemaining(validUntil: string | null | undefined): { label: string; tone: ExpiryTone } {
    if (!validUntil) return { label: 'Bitiş tarihi yok', tone: 'slate' };
    const end = new Date(validUntil).getTime();
    if (isNaN(end)) return { label: 'Bitiş tarihi yok', tone: 'slate' };
    const diffMs = end - Date.now();
    if (diffMs <= 0) {
        const pastDays = Math.floor(Math.abs(diffMs) / 86400000);
        return { label: pastDays === 0 ? 'Bugün doldu' : `Süresi ${pastDays} gün önce doldu`, tone: 'red' };
    }
    const totalMinutes = Math.floor(diffMs / 60000);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    let label: string;
    if (days === 0 && totalMinutes < 60) label = `${totalMinutes} dakika kaldı`;
    else if (days === 0) label = `${totalHours} saat kaldı`;
    else if (hours === 0) label = `${days} gün kaldı`;
    else label = `${days} gün ${hours} saat kaldı`;

    const tone: ExpiryTone = days <= 3 ? 'amber' : 'green';
    return { label, tone };
}

// Bir final teklifin (generated_offer) etkin son kullanma tarihi.
// generated_offers kendi expiry alanı tutmaz — parent offer_link'in valid_until'ine
// bağlıdır. Admin link'i manuel uzattıysa createdAt+maxDays formülünü aşan tarihi
// kullan; aksi halde createdAt+maxDays geçerli. Tek doğruluk noktası: tüm müşteri
// tarafı "expired" kontrolleri bu fonksiyonu kullanır.
export function computeEffectiveOfferExpiry(
    offerCreatedAt: string | Date,
    linkValidUntil: string | Date | null | undefined,
    maxOfferValidityDays: number,
): Date {
    const created = new Date(offerCreatedAt);
    const createdExpiry = new Date(created.getTime() + maxOfferValidityDays * 86400000);
    if (linkValidUntil) {
        const link = new Date(linkValidUntil);
        if (!isNaN(link.getTime()) && link.getTime() > createdExpiry.getTime()) {
            return link;
        }
    }
    return createdExpiry;
}
