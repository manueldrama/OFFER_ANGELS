import type { NavItem } from './navConfig';

export type NavBadgeCounts = {
    pendingBankTransfers: number;
    pendingReclaim: number;
    waFailures: number;
    remindersDue: number;
    /** İncelenmeyi bekleyen online mülakat (hr_interview_invites.status='submitted'). */
    submittedInterviews: number;
};

export type NavBadge = {
    count: number;
    danger: boolean;
    title: string;
    /** Rozet varken satırın gideceği yer — doğrudan filtrelenmiş listeye düşürür. */
    targetPath: string;
};

/**
 * Menü satırındaki bekleyen-iş rozeti. Sayfayı açmadan "burada iş var" sinyali.
 *
 * TEK KAYNAK: hem satır rozetini hem ikon rayındaki noktayı bu fonksiyon besler.
 * İkisi ayrı yerde hesaplanırsa katlanmış grubun rozeti satırdakinden sapabilir.
 */
export function resolveNavBadge(path: string, counts: NavBadgeCounts): NavBadge | null {
    switch (path) {
        // Aday mülakatını gönderdi ve kimse bakmadı. 'danger': aday karşı tarafta
        // yanıt bekliyor ve gecikme doğrudan aday deneyimine yazılıyor.
        case '/admin/hr/candidates':
            return counts.submittedInterviews > 0
                ? {
                      count: counts.submittedInterviews,
                      danger: true,
                      title: 'İncelenmeyi bekleyen mülakat',
                      targetPath: '/admin/hr/candidates?interview=submitted',
                  }
                : null;
        case '/admin/orders':
            return counts.pendingBankTransfers > 0
                ? {
                      count: counts.pendingBankTransfers,
                      danger: false,
                      title: 'Bekleyen havale bildirimi',
                      targetPath: '/admin/orders?filter=pending_bank_transfer',
                  }
                : null;
        case '/admin/offer-reclaim-requests':
            return counts.pendingReclaim > 0
                ? {
                      count: counts.pendingReclaim,
                      danger: false,
                      title: 'Bekleyen geri dönüş talebi',
                      targetPath: '/admin/offer-reclaim-requests',
                  }
                : null;
        case '/admin/whatsapp':
            return counts.waFailures > 0
                ? {
                      count: counts.waFailures,
                      danger: true,
                      title: 'Son 24 saatte gönderilemeyen mesaj',
                      targetPath: '/admin/whatsapp?status=failed',
                  }
                : null;
        case '/admin/reminders':
            return counts.remindersDue > 0
                ? {
                      count: counts.remindersDue,
                      danger: true,
                      title: 'Zamanı gelen hatırlatma',
                      targetPath: '/admin/reminders',
                  }
                : null;
        default:
            return null;
    }
}

/**
 * Grup başlığındaki nokta: grup KAPALIYKEN içeride bekleyen iş olduğunu görünür
 * kılar — satır rozetleri o an gizli olduğu için tek sinyal budur.
 * 'danger' varsa kırmızı, yoksa yeşil, hiç yoksa null.
 *
 * İZİN FİLTRESİNDEN GEÇMİŞ item listesi beklenir; aksi halde kullanıcının
 * göremediği bir sayfa yüzünden asla açıklayamayacağı bir nokta yanardı.
 */
export function resolveGroupBadgeTone(
    items: NavItem[],
    counts: NavBadgeCounts
): 'danger' | 'info' | null {
    let tone: 'danger' | 'info' | null = null;
    for (const item of items) {
        const badge = resolveNavBadge(item.path, counts);
        if (!badge) continue;
        if (badge.danger) return 'danger';
        tone = 'info';
    }
    return tone;
}
