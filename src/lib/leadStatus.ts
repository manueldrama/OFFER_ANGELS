// Lead manuel durumu (manuel sıcaklık) — tek doğruluk kaynağı.
// Hem Müşteri Yönetimi (PriorityLeadTable) hem Teklif Linkleri sayfası kullanır.

export type LeadStatus =
    | 'new' | 'contacted' | 'hot' | 'warm' | 'follow_up' | 'cold'
    | 'offer_sent' | 'payment_started' | 'won' | 'lost';

export const LEAD_STATUS_LABELS: Record<string, string> = {
    new: 'Yeni',
    contacted: 'İletişime Geçildi',
    hot: 'Sıcak',
    warm: 'Ilık',
    follow_up: 'Takipte',
    cold: 'Soğuk',
    offer_sent: 'Teklif Gönderildi',
    payment_started: 'Ödeme Bekleniyor',
    won: 'Kazanıldı',
    lost: 'Kaybedildi',
};

export const LEAD_STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-50 text-blue-700',
    contacted: 'bg-indigo-50 text-indigo-700',
    hot: 'bg-red-50 text-red-700',
    warm: 'bg-orange-50 text-orange-700',
    follow_up: 'bg-cyan-50 text-cyan-700',
    cold: 'bg-teal-50 text-teal-700',
    offer_sent: 'bg-amber-50 text-amber-700',
    payment_started: 'bg-purple-50 text-purple-700',
    won: 'bg-green-50 text-green-700',
    lost: 'bg-red-50 text-red-700',
};

/** Select/dropdown sırası — yaşam döngüsü mantığına göre. */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
    'new', 'contacted', 'hot', 'warm', 'follow_up', 'cold',
    'offer_sent', 'payment_started', 'won', 'lost',
];

export function leadStatusLabel(status: string | null | undefined): string {
    return (status && LEAD_STATUS_LABELS[status]) || 'Bilinmiyor';
}

export function leadStatusColor(status: string | null | undefined): string {
    return (status && LEAD_STATUS_COLORS[status]) || 'bg-slate-100 text-slate-600';
}
