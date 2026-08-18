// Hatırlatma zaman gösterimleri için ortak yardımcılar (zil + sayfa paylaşır).

/** "+90..." biçimine normalize et (WhatsAppChat kontak eşleşmesiyle uyumlu). */
export function normalizePhone(raw: string | null | undefined): string {
    if (!raw) return '';
    return '+' + raw.replace(/\D/g, '');
}

/** Göreli, okunur Türkçe zaman: "12 dk gecikti", "2 sa sonra", "Yarın 10:00". */
export function relativeReminderLabel(remindAtIso: string, now: number = Date.now()): string {
    const t = new Date(remindAtIso).getTime();
    const diffMin = Math.round((t - now) / 60000);
    const abs = Math.abs(diffMin);

    if (abs < 1) return 'Şimdi';
    const overdue = diffMin < 0;

    let core: string;
    if (abs < 60) core = `${abs} dk`;
    else if (abs < 60 * 24) core = `${Math.round(abs / 60)} sa`;
    else core = `${Math.round(abs / (60 * 24))} gün`;

    return overdue ? `${core} gecikti` : `${core} sonra`;
}

/** Mutlak gün/saat etiketi: "9 Haz 14:30". */
export function absoluteReminderLabel(remindAtIso: string): string {
    return new Date(remindAtIso).toLocaleString('tr-TR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

export function isOverdue(remindAtIso: string, now: number = Date.now()): boolean {
    return new Date(remindAtIso).getTime() <= now;
}
